/**
 * Scrape trigger routes
 * - POST /api/scrape/run         Trigger scrape for ALL tracked products (cron endpoint)
 * - POST /api/scrape/run/:id     Trigger scrape for ONE product (by tracked_product UUID)
 * - GET  /api/scrape/status      Get last scrape status summary
 */

const express = require('express');
const router = express.Router();
const { scrapeAll, scrapeOne } = require('../scraper/scheduler');
const supabase = require('../db');
const logger = require('../logger');

// Simple in-memory lock to prevent overlapping cron runs
let isRunning = false;
let lastRunResult = null;

// ── Trigger all ───────────────────────────────────────────────────────────────
// Called by cron-job.org every 2 hours
// Protected by a simple API key to prevent abuse
router.post('/run', async (req, res) => {
  // Validate cron secret for external cron jobs unless request is from frontend dashboard
  const cronSecret = process.env.CRON_SECRET;
  const origin = req.headers.origin || req.headers.referer || '';
  const isFrontendRequest =
    !origin ||
    origin.includes('localhost') ||
    origin.includes('vercel.app') ||
    origin.includes('inelabteamdev.com');

  if (cronSecret && !isFrontendRequest) {
    const provided = req.headers['x-cron-secret'] || req.query.secret;
    if (provided !== cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  if (isRunning) {
    logger.warn('Cron triggered while scrape already in progress — skipping');
    return res.status(409).json({ error: 'Scrape already in progress', running: true });
  }

  // Respond immediately so cron-job.org doesn't timeout
  res.json({ message: 'Scrape job started', started: true });

  // Run async (don't await — response already sent)
  isRunning = true;
  scrapeAll()
    .then((result) => {
      lastRunResult = { ...result, finishedAt: new Date().toISOString() };
      logger.info(`Cron job completed: ${result.succeeded}/${result.total} succeeded`);
    })
    .catch((err) => {
      logger.error(`Cron job failed: ${err.message}`);
      lastRunResult = { error: err.message, finishedAt: new Date().toISOString() };
    })
    .finally(() => {
      isRunning = false;
    });
});

// ── Trigger single product ───────────────────────────────────────────────────
// id = UUID of tracked_product in our DB
router.post('/run/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { data: product, error } = await supabase
      .from('tracked_products')
      .select('id, store_id, name')
      .eq('id', id)
      .single();

    if (error || !product) {
      return res.status(404).json({ error: 'Tracked product not found' });
    }

    // Run synchronously for single-product trigger (user wants to see result)
    const result = await scrapeOne({ productId: product.id, storeId: product.store_id });

    if (result.status === 'failed') {
      return res.status(422).json({
        message: 'Scrape failed',
        status: 'failed',
        error: result.error,
        productId: id,
      });
    }

    res.json({
      message: 'Scrape complete',
      status: result.status,
      data: result.data,
      productId: id,
    });
  } catch (err) {
    logger.error(`Manual scrape trigger failed for ${id}: ${err.message}`);
    res.status(500).json({ error: 'Scrape trigger failed', detail: err.message });
  }
});

// ── Status endpoint ──────────────────────────────────────────────────────────
router.get('/status', (req, res) => {
  res.json({
    running: isRunning,
    lastRun: lastRunResult,
  });
});

module.exports = router;
