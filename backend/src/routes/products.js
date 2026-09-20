/**
 * Products API routes
 * - GET    /api/catalog/search?q=...     Search store catalog by partial name
 * - POST   /api/products/track           Track a product
 * - DELETE /api/products/:id/untrack     Stop tracking a product
 * - PATCH  /api/products/:id/alerts      Update alert settings
 * - GET    /api/products                 List all tracked products with latest price
 * - GET    /api/products/:id             Get single tracked product with latest price
 */

const express = require('express');
const router = express.Router();
const supabase = require('../db');
const logger = require('../logger');

const STORE_BASE_URL = process.env.STORE_BASE_URL || 'https://demo.inelabteamdev.com';
const PAGE_SIZE = 20;

// ── Search catalog ───────────────────────────────────────────────────────────
// Fetches all catalog pages from the store API and filters by name
router.get('/catalog/search', async (req, res) => {
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
  const q = query.trim().toLowerCase();
  const results = [];
  const uniqueSeen = new Set();
  const pageSize = 60;

  // Scan catalog pages with pageSize=60 (up to 5 pages / 300 items)
  for (let page = 1; page <= 5; page++) {
    try {
      const url = `${STORE_BASE_URL}/api/catalog?page=${page}&pageSize=${pageSize}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;

      const data = await res.json();
      const items = data.items || data.products || data.data || [];
      if (!Array.isArray(items) || items.length === 0) break;

      for (const p of items) {
        const id = p.id || p.productId;
        const name = (p.name || p.title || '').toLowerCase();
        const brand = (p.brand || '').toLowerCase();
        const category = (p.category || '').toLowerCase();
        const sku = (p.sku || '').toLowerCase();

        if (
          (name.includes(q) || brand.includes(q) || category.includes(q) || sku.includes(q)) &&
          !uniqueSeen.has(id)
        ) {
          uniqueSeen.add(id);
          results.push({
            storeId: id,
            name: p.name || p.title,
            category: p.category || p.brand,
            sku: p.sku,
            image: p.image || p.imageUrl || p.img,
            description: p.description || p.desc,
          });
        }
      }

      if (results.length >= 20) break;
    } catch (err) {
      logger.warn(`Catalog page ${page} fetch error: ${err.message}`);
    }
  }

  return results;
}

// ── List all tracked products ────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    // Get all tracked products
    const { data: products, error } = await supabase
      .from('tracked_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // For each product, get the latest price history entry
    const enriched = await Promise.all(
      products.map(async (p) => {
        const { data: latest } = await supabase
          .from('price_history')
          .select('price, mrp, discount_pct, stock_text, in_stock, stock_count, scraped_at')
          .eq('product_id', p.id)
          .order('scraped_at', { ascending: false })
          .limit(1)
          .single();

        return { ...p, latest: latest || null };
      })
    );

    res.json({ products: enriched });
  } catch (err) {
    logger.error(`Failed to list products: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch tracked products' });
  }
});

// ── Get single tracked product ───────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { data: product, error } = await supabase
      .from('tracked_products')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { data: latest } = await supabase
      .from('price_history')
      .select('price, mrp, discount_pct, stock_text, in_stock, stock_count, scraped_at')
      .eq('product_id', product.id)
      .order('scraped_at', { ascending: false })
      .limit(1)
      .single();

    res.json({ product: { ...product, latest: latest || null } });
  } catch (err) {
    logger.error(`Failed to get product ${req.params.id}: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// ── Track a product ──────────────────────────────────────────────────────────
router.post('/track', async (req, res) => {
  const { storeId, name, category, sku, description, imageUrl, scrapeEvery } = req.body;

  if (!storeId || !name) {
    return res.status(400).json({ error: 'storeId and name are required' });
  }

  try {
    // Check if already tracked
    const { data: existing } = await supabase
      .from('tracked_products')
      .select('id')
      .eq('store_id', storeId)
      .single();

    if (existing) {
      return res.status(409).json({ error: 'Product is already being tracked', id: existing.id });
    }

    const { data, error } = await supabase
      .from('tracked_products')
      .insert({
        store_id: storeId,
        name,
        category: category || null,
        sku: sku || null,
        description: description || null,
        image_url: imageUrl || null,
        scrape_every: scrapeEvery || 120,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info(`New product tracked: ${name} (store_id=${storeId})`);
    res.status(201).json({ product: data });
  } catch (err) {
    logger.error(`Failed to track product: ${err.message}`);
    res.status(500).json({ error: 'Failed to track product' });
  }
});

// ── Untrack a product ────────────────────────────────────────────────────────
router.delete('/:id/untrack', async (req, res) => {
  try {
    const { error } = await supabase
      .from('tracked_products')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    logger.info(`Product untracked: ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`Failed to untrack product: ${err.message}`);
    res.status(500).json({ error: 'Failed to untrack product' });
  }
});

// ── Update alert settings ────────────────────────────────────────────────────
router.patch('/:id/alerts', async (req, res) => {
  const { alertPrice, alertEmail, alertBackInStock } = req.body;

  try {
    const updateData = {};
    if (alertPrice !== undefined) updateData.alert_price = alertPrice || null;
    if (alertEmail !== undefined) updateData.alert_email = alertEmail || null;
    if (alertBackInStock !== undefined) updateData.alert_back_in_stock = !!alertBackInStock;

    const { data, error } = await supabase
      .from('tracked_products')
      .update(updateData)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    logger.info(`Alert settings updated for product ${req.params.id}`);
    res.json({ product: data });
  } catch (err) {
    logger.error(`Failed to update alerts: ${err.message}`);
    res.status(500).json({ error: 'Failed to update alert settings' });
  }
});

module.exports = router;
