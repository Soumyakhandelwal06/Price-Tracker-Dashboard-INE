/**
 * Catalog search route — separate from the products router
 * GET /api/catalog/search?q=...
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const logger = require('../logger');

const STORE_BASE_URL = process.env.STORE_BASE_URL || 'https://demo.inelabteamdev.com';
const CACHE_FILE = path.join(__dirname, '../data/catalog_cache.json');

let cachedCatalog = [];
let isFetchingCatalog = false;

// Load persisted cache on startup if present
try {
  if (fs.existsSync(CACHE_FILE)) {
    const data = fs.readFileSync(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      cachedCatalog = parsed;
      logger.info(`Loaded ${cachedCatalog.length} catalog items from local cache file.`);
    }
  }
} catch (e) {
  logger.warn(`Failed to read local catalog cache file: ${e.message}`);
}

async function refreshCatalog() {
  if (isFetchingCatalog) return;
  isFetchingCatalog = true;

  try {
    const allItems = [];
    const uniqueSeen = new Set();
    const pageSize = 50; // Store supports pageSize=50 (20 total pages for 1000 items)
    let totalPages = 20;

    for (let page = 1; page <= totalPages; page++) {
      let pageFetched = false;
      for (let attempt = 1; attempt <= 8; attempt++) {
        try {
          const url = `${STORE_BASE_URL}/api/catalog?page=${page}&pageSize=${pageSize}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

          if (res.status === 429 || res.status === 503) {
            await new Promise((r) => setTimeout(r, 1200 * attempt));
            continue;
          }

          if (!res.ok) {
            await new Promise((r) => setTimeout(r, 800 * attempt));
            continue;
          }

          const data = await res.json();
          if (data.error === 'rate_limited') {
            await new Promise((r) => setTimeout(r, 1500 * attempt));
            continue;
          }

          if (data.total && data.pageSize) {
            totalPages = Math.ceil(data.total / data.pageSize);
          }

          const items = data.items || data.products || data.data || [];
          if (!Array.isArray(items) || items.length === 0) {
            pageFetched = true;
            break;
          }

          for (const p of items) {
            const id = p.id || p.productId;
            if (id && !uniqueSeen.has(id)) {
              uniqueSeen.add(id);
              allItems.push({
                storeId: id,
                name: p.name || p.title,
                category: p.category || p.brand,
                sku: p.sku,
                image: p.image || p.imageUrl || p.img,
                description: p.description || p.desc,
              });
            }
          }

          pageFetched = true;
          break; // Success for this page
        } catch {
          if (attempt < 8) await new Promise((r) => setTimeout(r, 800 * attempt));
        }
      }

      await new Promise((r) => setTimeout(r, 800)); // Polite delay to stay within rate limits
    }

    if (allItems.length >= cachedCatalog.length || cachedCatalog.length === 0) {
      cachedCatalog = allItems;
      logger.info(`All ${cachedCatalog.length} catalog products pre-fetched into memory`);

      // Persist to disk cache
      try {
        const dir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cachedCatalog, null, 2), 'utf8');
        logger.info(`Persisted ${cachedCatalog.length} catalog items to ${CACHE_FILE}`);
      } catch (err) {
        logger.warn(`Failed to write catalog cache file: ${err.message}`);
      }
    }
  } catch (err) {
    logger.warn(`Catalog pre-fetch warning: ${err.message}`);
  } finally {
    isFetchingCatalog = false;
  }
}

// Pre-fetch catalog on server startup
setTimeout(refreshCatalog, 200);

// Periodically refresh catalog every 15 minutes
setInterval(refreshCatalog, 15 * 60 * 1000);

router.get('/search', async (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  if (!query || query.length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  try {
    const results = await searchCatalog(query);
    res.json({ results, count: results.length });
  } catch (err) {
    logger.error(`Catalog search failed: ${err.message}`);
    res.status(502).json({ error: 'Failed to fetch catalog from store', detail: err.message });
  }
});

async function searchCatalog(query) {
  // If cache is empty in memory, try reading from disk cache file immediately
  if (cachedCatalog.length === 0) {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const data = fs.readFileSync(CACHE_FILE, 'utf8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedCatalog = parsed;
        }
      }
    } catch (e) {}
  }

  // If cache is still empty and not fetching, trigger refresh
  if (cachedCatalog.length === 0 && !isFetchingCatalog) {
    refreshCatalog();
  }

  // If cache is empty on cold start, wait up to 2.5 seconds for first items to arrive
  if (cachedCatalog.length === 0) {
    let waited = 0;
    while (cachedCatalog.length === 0 && waited < 2500) {
      await new Promise((r) => setTimeout(r, 100));
      waited += 100;
    }
  }

  const rawQ = query.trim().toLowerCase();
  const tokens = rawQ.split(/\s+/).filter(Boolean);

  const scored = cachedCatalog.map((p) => {
    const name = (p.name || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    const sku = (p.sku || '').toLowerCase();
    const desc = (p.description || '').toLowerCase();
    const fullText = `${name} ${category} ${sku} ${desc}`;

    let score = 0;
    let matchedTokens = 0;

    if (name === rawQ) score += 100;
    else if (name.includes(rawQ)) score += 50;
    else if (fullText.includes(rawQ)) score += 30;

    tokens.forEach((token) => {
      if (name.includes(token)) {
        score += 15;
        matchedTokens++;
      } else if (fullText.includes(token)) {
        score += 8;
        matchedTokens++;
      }
    });

    if (tokens.length > 1 && matchedTokens === tokens.length) {
      score += 40;
    } else if (tokens.length > 2 && matchedTokens >= tokens.length - 1) {
      score += 20;
    }

    return { product: p, score, matchedTokens };
  });

  const minRequiredTokens = Math.min(tokens.length, tokens.length >= 3 ? tokens.length - 1 : Math.ceil(tokens.length / 2));

  let matches = scored
    .filter((item) => item.score > 0 && item.matchedTokens >= minRequiredTokens)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.product);

  // If no matches found in current cache, scan pages on demand
  if (matches.length === 0) {
    const uniqueSeen = new Set(cachedCatalog.map((p) => p.storeId));
    for (let page = 1; page <= 20; page++) {
      try {
        const url = `${STORE_BASE_URL}/api/catalog?page=${page}&pageSize=50`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) continue;

        const data = await res.json();
        const items = data.items || data.products || data.data || [];
        if (!Array.isArray(items) || items.length === 0) continue;

        for (const p of items) {
          const id = p.id || p.productId;
          if (id && !uniqueSeen.has(id)) {
            uniqueSeen.add(id);
            const itemObj = {
              storeId: id,
              name: p.name || p.title,
              category: p.category || p.brand,
              sku: p.sku,
              image: p.image || p.imageUrl || p.img,
              description: p.description || p.desc,
            };
            cachedCatalog.push(itemObj);

            const fullText = `${p.name || ''} ${p.category || ''} ${p.sku || ''} ${p.description || ''}`.toLowerCase();
            let count = 0;
            tokens.forEach((t) => {
              if (fullText.includes(t)) count++;
            });
            if (fullText.includes(rawQ) || count >= minRequiredTokens) {
              matches.push(itemObj);
            }
          }
        }

        if (matches.length >= 10) break;
      } catch {
        // Continue scanning
      }
    }
  }

  return matches.slice(0, 30);
}

module.exports = router;

