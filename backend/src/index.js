require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./logger');

const productsRouter = require('./routes/products');
const catalogRouter = require('./routes/catalog');
const historyRouter = require('./routes/history');
const scrapeRouter = require('./routes/scrape');

const app = express();
const PORT = process.env.PORT || 4000;

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://ine-price-tracker.vercel.app',
  // Add your Vercel preview URLs here
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., curl, mobile apps)
      if (!origin || allowedOrigins.some((o) => origin.startsWith(o.replace('*', '')))) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret'],
  })
);

app.use(express.json({ limit: '1mb' }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down' },
});
app.use('/api', limiter);

// Stricter limit for scrape triggers (prevent accidental DDoS of the store)
const scrapeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many scrape requests' },
});
app.use('/api/scrape', scrapeLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/catalog', catalogRouter);
app.use('/api/products', productsRouter);
app.use('/api/history', historyRouter);
app.use('/api/scrape', scrapeRouter);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Keep-alive endpoint for Render free tier (called by cron-job.org every 14 min)
app.get('/ping', (req, res) => res.send('pong'));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`INE Price Tracker backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Supabase URL: ${process.env.SUPABASE_URL ? '✓ configured' : '✗ MISSING'}`);
  logger.info(`SendGrid: ${process.env.SENDGRID_API_KEY ? '✓ configured' : '○ not configured (alerts disabled)'}`);
});

module.exports = app;
