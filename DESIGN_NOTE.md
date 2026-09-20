# Design Note — INE Product Price Tracker

## How I Made the Scraping Reliable

### Reverse-Engineering the Anti-Scraping System

The first thing I did was analyze the mock store. What looks like a simple product page is actually a **React SPA with a multi-layered challenge system**:

1. **Cookie consent gate** — must be dismissed before the price block appears
2. **Mouse tracking** — the store monitors mouse movements over `.price-block`, requires ≥8 distinct `mousemove` events and 600ms of continuous dwell time before enabling the "Reveal Price" button
3. **Proof-of-work challenge** — a background JS process (`/api/challenge`) that must complete in the browser engine
4. **Authenticated price endpoint** — after the challenge, a bearer token is issued via `POST /api/session`, which unlocks `GET /api/products/{id}/price`
5. **XOR-encrypted payload** — the price response `e` field is XOR-encoded, decoded only in browser JS
6. **Asynchronous price load** — even after clicking Reveal Price, the value loads with a short delay

**Conclusion: Plain HTTP fetching is impossible.** The entire challenge depends on a real browser's JS runtime.

### The Scraper Strategy

I chose **Playwright with headless Chromium** as the scraping engine. Key decisions:

**Mouse simulation**: I generate 12 random-ish mouse move events across the `.price-block` element with 40–100ms intervals (human-like), then dwell for 750ms (safely above the 600ms threshold). This passes the challenge on every run.

**Click the real button**: Rather than injecting JS to bypass the challenge, I wait for the button to become enabled (Playwright's `waitForSelector` with `:not([disabled])`) and click it as a real user would. This ensures the telemetry attestation succeeds.

**Validation before storage**: Parsed price must be a positive number — if `parseFloat` returns `NaN` or 0, a `PARSE_ERROR` is thrown and nothing is written to the DB. This prevents storing empty/wrong data.

**Retry with exponential backoff**: Up to 3 attempts, backoff = 2^attempt × 1000ms (2s, 4s, 8s). Network timeouts and challenge failures are retried; structural errors (`STRUCTURE_CHANGED`, `PARSE_ERROR`) are not (retrying won't help a DOM change).

**Shared browser instance**: During a cron run, all products share one Playwright browser (separate contexts per product). This reduces cold-start overhead from ~3s per product to ~0.3s.

**Honest logging**: Every attempt — including failures and retries — is inserted into `scrape_logs`. The frontend always shows the real picture, never hides failures.

**Change detection**: If `.price-block` disappears or the price selector returns nothing, I throw a `STRUCTURE_CHANGED` error that shows up distinctly in the scrape log, alerting that manual investigation is needed.

### Trade-offs Made

| Decision | Trade-off |
|---|---|
| Playwright over lightweight HTTP | +100% compatibility with JS-rendered pages, −~300MB binary on Render |
| Shared browser per cron run | +Speed, −if browser crashes, whole run fails (mitigated by try/finally cleanup) |
| Sequential scraping with 3s gaps | +Polite to the store, −slower for many products (acceptable for ≤20 products) |
| External cron (cron-job.org) | +Doesn't depend on Render always-on, −extra moving part to configure |
| Supabase service role key in backend | +Simple, −key must be kept secret (mitigated by .env + never exposing to frontend) |

### What AI Got Wrong First, and How I Fixed It

**First attempt — wrong selector strategy**: The AI initially generated selectors like `[data-price]` and `[class="price"]` which don't exist on the store. The store uses hashed Tailwind-style class names (`price-main`, `price-block`, `price-original`) that must be discovered by actually loading the page in a browser.

**Fix**: Ran the headed mode, inspected the rendered DOM, then used descriptive class name substrings with CSS attribute-contains selectors (e.g., `[class*="price-main"]`).

**Second issue — missing mouse dwell**: The first version simulated 3 mouse moves but the button never enabled. I increased to 12 moves with explicit 750ms `waitForTimeout` after the last move. Then added `waitForSelector` for the enabled button state rather than blindly clicking after a fixed delay.

**Third issue — price parse with Indian number format**: `parseFloat("1,03,068")` returns `1` in JavaScript (stops at first comma). Fixed by stripping all commas and currency symbols before parsing.

**Fourth issue — cron response timeout**: cron-job.org has a ~30s response timeout. The full scrape of multiple products takes longer. Fixed by immediately responding `200 OK` and running the scrape asynchronously in the background (`scrapeAll()` without `await` after the response is sent).

**Fifth issue — decoy DOM price obfuscation**: The mock store inserts hidden `<span class="price-value" style="display: none;">` decoy elements inside `.price-main`. Calling `.textContent` on `.price-main` concatenated hidden spans with real price digits (e.g. `₹12,25,52,02...`). Fixed by writing computed visibility checks (`window.getComputedStyle(el).display !== 'none'`) and targeting visible `<b>` or `[class*="pv-"]` elements.

**Sixth issue — store 429 rate limits & hanging timeouts**: Rapid requests triggered store HTTP 429 rate limits, causing Playwright `waitForSelector` to hang for 30s per attempt (total ~96s across retries). Fixed by implementing immediate `.grid-error` / `429` detection within 2-3 seconds, exponential backoff, auto-clicking the store's `TRY AGAIN` button, and returning clean HTTP 422 JSON errors so client requests never exceed 30s.

**Seventh issue — multi-word search string matching**: Searching `"summit dive"` previously checked exact substring `"summit dive"`. Fixed by tokenizing search queries into individual words and ensuring all tokens match across `name`, `category`, `sku`, and `description`.
