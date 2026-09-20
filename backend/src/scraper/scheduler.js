/**
 * Scheduler — handles scraping all tracked products on the cron trigger.
 *
 * Called by POST /api/scrape/run (triggered by cron-job.org every 2 hours)
 * Also called by POST /api/scrape/run/:id for a single product.
 *
 * Scrapes products sequentially with a small delay between each to avoid
 * hammering the store. Records every attempt in scrape_logs.
 */

require('dotenv').config();
const { chromium } = require('playwright');
const { scrapeWithRetry } = require('./engine');
const supabase = require('../db');
const logger = require('../logger');
const { maybeSendAlerts } = require('../alerts');

const BETWEEN_PRODUCT_DELAY_MS = 3000; // 3s between products

/**
 * Scrape all tracked products (called by cron).
 * @returns {Promise<{ total, succeeded, failed, results }>}
 */
async function scrapeAll() {
  logger.info('═'.repeat(50));
  logger.info('Cron scrape job started');
  logger.info('═'.repeat(50));

  // Fetch all tracked products
  const { data: products, error } = await supabase
    .from('tracked_products')
    .select('id, store_id, name')
    .order('created_at', { ascending: true });

  if (error) {
    logger.error('Failed to fetch tracked products from DB', { error });
    throw error;
  }

  if (!products || products.length === 0) {
    logger.info('No tracked products found — nothing to scrape');
    return { total: 0, succeeded: 0, failed: 0, results: [] };
  }

  logger.info(`Found ${products.length} tracked product(s) to scrape`);

  // Launch a single shared browser for efficiency
  const browser = await chromium.launch({
    headless: process.env.SCRAPER_HEADLESS !== 'false',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const results = [];
  let succeeded = 0;
  let failed = 0;

  try {
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      logger.info(`Scraping [${i + 1}/${products.length}]: ${product.name} (store_id=${product.store_id})`);

      const result = await scrapeOne({ productId: product.id, storeId: product.store_id, browser });
      results.push(result);

      if (result.status === 'failed') {
        failed++;
      } else {
        succeeded++;
      }

      // Delay between products (not after the last one)
      if (i < products.length - 1) {
        await new Promise((r) => setTimeout(r, BETWEEN_PRODUCT_DELAY_MS));
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  logger.info(`Scrape job complete: ${succeeded} succeeded, ${failed} failed out of ${products.length}`);
  return { total: products.length, succeeded, failed, results };
}

/**
 * Scrape a single product and record the result in DB.
 * @param {{ productId: string, storeId: number, browser?: object }} options
 */
async function scrapeOne({ productId, storeId, browser }) {
  const startTime = Date.now();
  let logEntry = {
    product_id: productId,
    status: 'failed',
    attempts: 1,
    error_msg: null,
    duration_ms: 0,
  };

  try {
    const { data, attempts, status } = await scrapeWithRetry({ storeId, browser });

    logEntry.status = status; // 'success' or 'retried'
    logEntry.attempts = attempts;
    logEntry.duration_ms = Date.now() - startTime;

    // Insert price history record
    const { error: histError } = await supabase.from('price_history').insert({
      product_id: productId,
      price: data.price,
      mrp: data.mrp,
      discount_pct: data.discountPct,
      stock_text: data.stockText,
      in_stock: data.inStock,
      stock_count: data.stockCount,
    });

    if (histError) {
      logger.error(`Failed to insert price_history for product ${productId}`, { histError });
    }

    // Update last_scraped timestamp
    await supabase
      .from('tracked_products')
      .update({ last_scraped: new Date().toISOString() })
      .eq('id', productId);

    // Check and send price-drop / back-in-stock alerts
    await maybeSendAlerts({ productId, storeId, data }).catch((e) =>
      logger.warn(`Alert send failed (non-fatal): ${e.message}`)
    );

    logger.info(`✅ Product ${storeId} done: price=${data.price}, status=${status}`);
    return { productId, storeId, status, data };
  } catch (err) {
    logEntry.status = 'failed';
    logEntry.error_msg = `[${err.code || 'ERROR'}] ${err.message}`;
    logEntry.duration_ms = Date.now() - startTime;

    logger.error(`❌ Product ${storeId} failed: ${logEntry.error_msg}`);
    return { productId, storeId, status: 'failed', error: logEntry.error_msg };
  } finally {
    // Always record the scrape attempt — even failures (honest logging)
    const { error: logError } = await supabase.from('scrape_logs').insert(logEntry);
    if (logError) {
      logger.error(`Failed to insert scrape_log for product ${productId}`, { logError });
    }
  }
}

module.exports = { scrapeAll, scrapeOne };
