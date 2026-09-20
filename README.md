# INE Product Price Tracker & Scraping Dashboard

A full-stack product price tracking system designed to bypass multi-layered anti-scraping challenges, track price and stock changes over time, send automatic email alerts, and present interactive analytics via a web dashboard.

🔗 **Live Application URL**: [https://price-tracker-dashboard-ine.vercel.app/](https://price-tracker-dashboard-ine.vercel.app/)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Environment Variables](#environment-variables)
- [Scraping Schedule](#scraping-schedule)
- [Setup & Installation Instructions](#setup--installation-instructions)
- [API Endpoints](#api-endpoints)
- [Anti-Scraping Handling & Design Notes](#anti-scraping-handling--design-notes)

---

## 🌟 Overview

The INE Price Tracker monitors e-commerce products from modern web applications containing client-side challenge gates (cookie banners, mouse tracking telemetry, proof-of-work challenges, and dynamic DOM rendering).

### Key Features
- **Anti-Scraping Bypass**: Playwright engine simulates human mouse movement (`≥8` events, `>600ms` dwell) and handles dynamic DOM price rendering.
- **Automated Scraping Schedule**: Configured for 2-hour recurring scrapes with exponential backoff retries.
- **Price & Stock History**: Historical tracking of price changes, MRP, discounts, and inventory status.
- **Real-Time Email Alerts**: SendGrid integration for price drops below target threshold and back-in-stock notifications.
- **Transparent Logging**: Audit log (`scrape_logs`) capturing attempt counts, durations, and diagnostic failure reasons (`PARSE_ERROR`, `STRUCTURE_CHANGED`, `TIMEOUT`, `STORE_429`).
- **Interactive Dashboard**: Modern React dashboard with price history charts, search filter, catalog sync, and manual scrape triggers.

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: React (Vite), Tailwind CSS / Custom Styling, Lucide Icons, Recharts.
- **Backend**: Node.js, Express, Playwright (Chromium), Winston Logger.
- **Database**: Supabase (PostgreSQL with Row Level Security).
- **Notifications**: SendGrid Mail API.

### Repository Structure

```
INE_Assignment/
├── DESIGN_NOTE.md              # Detailed design decisions & anti-scraping strategy
├── README.md                   # Setup instructions, schedule, and environment guide
├── backend/
│   ├── package.json            # Dependencies and scripts for backend service
│   ├── .env.example            # Environment variables template for backend
│   ├── render.yaml             # Render deployment configuration
│   ├── supabase/
│   │   └── schema.sql          # Database schema and SQL migrations
│   └── src/
│       ├── index.js            # Express server initialization & interval scheduler
│       ├── db.js               # Supabase database client configuration
│       ├── logger.js           # Winston logging system setup
│       ├── alerts.js           # SendGrid alert trigger handler
│       ├── routes/             # Express API route modules
│       │   ├── catalog.js      # Store catalog proxy routes
│       │   ├── products.js     # Tracked product management endpoints
│       │   ├── history.js      # Price history and log queries
│       │   └── scrape.js       # Scrape execution endpoints
│       └── scraper/            # Playwright scraping engine
│           ├── engine.js       # Mouse simulation & DOM parsing logic
│           ├── scheduler.js    # Batch scraping execution controller
│           └── headed.js       # Local headed browser test script
└── frontend/
    ├── package.json            # Dependencies and scripts for frontend application
    ├── .env.example            # Environment variables template for frontend
    ├── vite.config.js          # Vite build config
    └── src/                    # UI components, dashboard, and API clients
```

---

## 🔑 Environment Variables

### 1. Backend Environment Variables (`backend/.env`)

Create a `backend/.env` file by copying `backend/.env.example`:

| Variable | Description | Required / Default | Example |
|---|---|---|---|
| `SUPABASE_URL` | Base URL of your Supabase database project | **Required** | `https://xyzcompany.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase Service Role Key (bypasses RLS for backend operations) | **Required** | `eyJhbGciOi...` |
| `STORE_BASE_URL` | Base target URL of the store to be scraped | **Required** | `https://demo.inelabteamdev.com` |
| `PORT` | Local port number for Express backend | Optional (Default: `4000`) | `4000` |
| `NODE_ENV` | Application environment state | Optional (Default: `development`) | `development` |
| `FRONTEND_URL` | Client URL permitted for CORS requests | Optional | `http://localhost:5173` |
| `SENDGRID_API_KEY` | API key for SendGrid email alerts | Optional | `SG.your_sendgrid_key` |
| `SENDGRID_FROM_EMAIL` | Verified sender email address for email alerts | Optional | `alerts@yourapp.com` |
| `SCRAPER_TIMEOUT_MS` | Max wait time (ms) per Playwright page operation | Optional (Default: `30000`) | `30000` |
| `SCRAPER_MAX_RETRIES` | Max attempts for retriable scrape failures | Optional (Default: `3`) | `3` |
| `SCRAPER_HEADLESS` | Whether to run Playwright Chromium in headless mode | Optional (Default: `true`) | `true` |
| `CRON_SECRET` | Secret token to authorize external HTTP cron requests | Optional | `my-secret-cron-key` |

#### `backend/.env.example` reference:
```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here

# SendGrid (Price-drop & Back-in-stock Email Alerts)
SENDGRID_API_KEY=SG.your-sendgrid-api-key
SENDGRID_FROM_EMAIL=alerts@yourapp.com

# Backend Application Settings
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Target E-Commerce Store
STORE_BASE_URL=https://demo.inelabteamdev.com

# Scraper Settings
SCRAPER_TIMEOUT_MS=30000
SCRAPER_MAX_RETRIES=3
SCRAPER_HEADLESS=true
CRON_SECRET=your-optional-cron-secret
```

---

### 2. Frontend Environment Variables (`frontend/.env`)

Create a `frontend/.env` file by copying `frontend/.env.example`:

| Variable | Description | Required / Default | Example |
|---|---|---|---|
| `VITE_API_URL` | HTTP endpoint URL of the Express backend API | **Required** | `http://localhost:4000` |

#### `frontend/.env.example` reference:
```env
VITE_API_URL=http://localhost:4000
```

---

## ⏰ Scraping Schedule

The price tracker supports **four complementary scheduling methods**:

### 1. In-Server Automated Schedule (2 Hours)
- **Mechanism**: An in-memory JavaScript timer ([`setInterval`](file:///Users/soumyakhandelwal/Desktop/INE_Assignment/backend/src/index.js#L104-L111)) running inside the Node.js backend.
- **Frequency**: Every **2 hours** (`7,200,000 ms`).
- **Behavior**: Automatically fetches all active products from `tracked_products` table and executes `scrapeAll()` sequentially with 3-second delays between items.

### 2. External HTTP Cron Endpoint
- **Mechanism**: `POST /api/scrape/run`
- **Frequency**: Configured externally via services like **cron-job.org** or GitHub Actions to run every **2 hours**.
- **Authorization**: Supports an `x-cron-secret` header or `?secret=` query parameter matched against `process.env.CRON_SECRET`.
- **Response Handling**: Responds immediately with `200 OK` (`{ message: "Scrape job started" }`) to satisfy HTTP timeout limits (e.g. 30s timeouts on cron providers), then runs the job asynchronously in the background.

### 3. On-Demand Single Product Rescrape (UI Dashboard)
- **Mechanism**: `POST /api/scrape/run/:id`
- **Trigger**: Click **"Scrape Now"** on any product card in the frontend dashboard.
- **Behavior**: Executes synchronous scraping for that single product and returns the updated status immediately.

### 4. CLI Manual Execution Commands
For debugging or ad-hoc batch execution from the terminal:
```bash
# Execute scrape job for all tracked products from terminal
npm --prefix backend run scrape:all

# Run scraper in headed (visible GUI) browser mode for visual debugging
npm --prefix backend run scrape:headed
```

---

## 🛠️ Setup & Installation Instructions

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **Supabase Account**: For PostgreSQL database hosting
- **SendGrid Account** *(Optional)*: For sending price drop emails

---

### Step 1: Database Setup (Supabase)

1. Log into your [Supabase Dashboard](https://supabase.com) and create a new project.
2. Open the **SQL Editor** in your project dashboard.
3. Copy the contents of [`backend/supabase/schema.sql`](file:///Users/soumyakhandelwal/Desktop/INE_Assignment/backend/supabase/schema.sql) and paste into the editor.
4. Click **Run** to generate the required tables and indexes:
   - `tracked_products`: Stores items selected for tracking.
   - `price_history`: Stores price, MRP, discount, and inventory logs over time.
   - `scrape_logs`: Maintains an audit trail of every scrape attempt (successes & failures).
5. Obtain your project's **URL** and **Service Role Key** from **Project Settings > API**.

---

### Step 2: Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Install Playwright browser binaries:
   ```bash
   npx playwright install chromium
   ```
4. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```
5. Edit `.env` with your Supabase credentials and store URL:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-supabase-service-role-key
   STORE_BASE_URL=https://demo.inelabteamdev.com
   PORT=4000
   ```
6. Start the development backend server:
   ```bash
   npm run dev
   ```
   *The server runs at `http://localhost:4000`.*

---

### Step 3: Frontend Setup

1. Open a new terminal tab and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```
4. Confirm `VITE_API_URL` points to your backend:
   ```env
   VITE_API_URL=http://localhost:4000
   ```
5. Start the frontend Vite development server:
   ```bash
   npm run dev
   ```
   *The dashboard will be available at `http://localhost:5173`.*

---

## 📡 API Endpoints

### Store Catalog
- `GET /api/catalog` — Fetch store catalog with pagination (`page`, `limit`) and search query (`search`).

### Tracked Products
- `GET /api/products` — List all tracked products with latest scraped price and stock status.
- `POST /api/products` — Add a product to tracked list (`store_id`, `alert_price`, `alert_email`, `alert_back_in_stock`).
- `PATCH /api/products/:id` — Update alert settings for a product.
- `DELETE /api/products/:id` — Untrack and remove product from monitoring.

### Price History & Audit Logs
- `GET /api/history/:productId` — Retrieve price history data points for charting (`days` limit).
- `GET /api/history/:productId/logs` — Fetch scrape execution logs for troubleshooting.

### Scraping Operations
- `POST /api/scrape/run` — Run background batch scrape for all tracked products.
- `POST /api/scrape/run/:id` — Trigger immediate manual scrape for a specific product.
- `GET /api/scrape/status` — Check active scrape progress status.

---

## 🛡️ Anti-Scraping Handling & Design Notes

For deep architectural details, consult [`DESIGN_NOTE.md`](file:///Users/soumyakhandelwal/Desktop/INE_Assignment/DESIGN_NOTE.md).

### Reverse-Engineered Challenges Bypassed:
1. **Cookie Consent Gate**: Automatically dismissed before attempting price element interaction.
2. **Mouse Dwell & Telemetry**: Generates 12 distinct human-like cursor moves over `.price-block` followed by `750ms` continuous dwell to pass telemetry thresholds.
3. **Decoy Obfuscation**: Ignores hidden `<span class="price-value" style="display: none;">` elements to avoid parsing concatenated decoy digits.
4. **Number Formatting**: Sanitizes Indian currency formatting (e.g., converting `"₹1,03,068"` to numeric `103068`).
5. **Rate-Limit Resilience**: Immediate detection of store 429 pages with exponential backoff retry.