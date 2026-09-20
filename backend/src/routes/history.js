/**
 * History API routes
 * - GET /api/history/:productId/prices   Price history for chart
 * - GET /api/history/:productId/logs     Scrape log for product
 */

const express = require('express');
const router = express.Router();
const supabase = require('../db');
const logger = require('../logger');

// ── Price history ─────────────────────────────────────────────────────────────
router.get('/:productId/prices', async (req, res) => {
  const { productId } = req.params;
  const limit = parseInt(req.query.limit) || 100;
  const days = parseInt(req.query.days) || 30;

  try {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data, error } = await supabase
      .from('price_history')
      .select('price, mrp, discount_pct, stock_text, in_stock, stock_count, scraped_at')
      .eq('product_id', productId)
      .gte('scraped_at', since.toISOString())
      .order('scraped_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    res.json({ history: data || [] });
  } catch (err) {
    logger.error(`Failed to fetch price history for ${productId}: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

// ── Scrape logs ───────────────────────────────────────────────────────────────
router.get('/:productId/logs', async (req, res) => {
  const { productId } = req.params;
  const limit = parseInt(req.query.limit) || 50;

  try {
    const { data, error } = await supabase
      .from('scrape_logs')
      .select('*')
      .eq('product_id', productId)
      .order('logged_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({ logs: data || [] });
  } catch (err) {
    logger.error(`Failed to fetch scrape logs for ${productId}: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch scrape logs' });
  }
});

module.exports = router;
