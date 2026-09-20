/**
 * Headed scraper runner — for observable demo mode.
 * Runs the scraper against a product with a visible browser window
 * so you can watch the full anti-scraping bypass in action.
 *
 * Usage:
 *   node src/scraper/headed.js [product_id]
 *   node src/scraper/headed.js 495
 */

require('dotenv').config();
const { chromium } = require('playwright');
const { scrapeWithRetry } = require('./engine');
const logger = require('../logger');

const storeId = parseInt(process.argv[2] || '495', 10);

(async () => {
  logger.info(`\n${'═'.repeat(60)}`);
  logger.info(`  INE Price Tracker — Headed (Observable) Scraper Run`);
  logger.info(`  Product ID: ${storeId}`);
  logger.info(`${'═'.repeat(60)}\n`);

  // Launch a SHARED headed browser so you can watch
  const browser = await chromium.launch({
    headless: false,
    slowMo: 150, // extra slow for visibility
    args: ['--start-maximized'],
  });

  try {
    const result = await scrapeWithRetry({
      storeId,
      browser,
      headed: true,
    });

    logger.info('\n✅ Scrape succeeded!');
    logger.info(`   Product ID : ${result.data.storeId}`);
    logger.info(`   Price      : ₹${result.data.price?.toLocaleString('en-IN')}`);
    logger.info(`   MRP        : ₹${result.data.mrp?.toLocaleString('en-IN') || 'N/A'}`);
    logger.info(`   Discount   : ${result.data.discountPct ?? 'N/A'}%`);
    logger.info(`   Stock      : ${result.data.stockText}`);
    logger.info(`   In Stock   : ${result.data.inStock}`);
    logger.info(`   Stock Count: ${result.data.stockCount ?? 'N/A'}`);
    logger.info(`   Attempts   : ${result.attempts}`);
    logger.info(`   Status     : ${result.status}`);
    logger.info(`   Duration   : ${result.data.durationMs}ms`);
    logger.info(`   Loaded in  : ${result.data.loadedIn || 'N/A'}`);
    logger.info(`   Seller     : ${result.data.seller || 'N/A'}`);
    logger.info(`   Delivery   : ${result.data.delivery || 'N/A'}`);

    logger.info('\nBrowser will stay open for 10 seconds so you can inspect the result...');
    await new Promise((r) => setTimeout(r, 10000));
  } catch (err) {
    logger.error(`\n❌ Scrape failed after all retries:`);
    logger.error(`   Code   : ${err.code || 'UNKNOWN'}`);
    logger.error(`   Message: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
