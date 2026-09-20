-- INE Price Tracker — Supabase Database Schema
-- Run this entire script in Supabase SQL Editor to create all tables.

-- ── Enable extensions ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Tracked products ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tracked_products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id          INTEGER UNIQUE NOT NULL,     -- product ID from INE store /api/catalog
  name              TEXT NOT NULL,
  category          TEXT,
  sku               TEXT,
  description       TEXT,
  image_url         TEXT,
  scrape_every      INTEGER NOT NULL DEFAULT 120, -- minutes between scrapes (configurable)
  alert_price       NUMERIC,                      -- send alert when price ≤ this
  alert_email       TEXT,                         -- send alerts to this email
  alert_back_in_stock BOOLEAN DEFAULT FALSE,      -- alert when back in stock
  last_scraped      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookup by store_id
CREATE INDEX IF NOT EXISTS idx_tracked_products_store_id ON tracked_products(store_id);

-- ── Price and stock history ───────────────────────────────────────────────────
-- One row per SUCCESSFUL scrape (never stores empty/wrong data)
CREATE TABLE IF NOT EXISTS price_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  price         NUMERIC NOT NULL,           -- current/sale price
  mrp           NUMERIC,                    -- original/MRP price
  discount_pct  INTEGER,                    -- discount percentage
  stock_text    TEXT,                       -- raw stock string from store
  in_stock      BOOLEAN NOT NULL DEFAULT TRUE,
  stock_count   INTEGER,                    -- parsed number (e.g., 140 from "140 left")
  scraped_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient chart queries
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_scraped_at ON price_history(scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_product_time ON price_history(product_id, scraped_at DESC);

-- ── Scrape logs ───────────────────────────────────────────────────────────────
-- Every attempt recorded honestly (successes, retries, AND failures)
CREATE TABLE IF NOT EXISTS scrape_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('success', 'retried', 'failed')),
  attempts      INTEGER NOT NULL DEFAULT 1,
  error_msg     TEXT,                       -- NULL on success, error details on failure
  duration_ms   INTEGER,                    -- total time for this scrape
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast log retrieval per product
CREATE INDEX IF NOT EXISTS idx_scrape_logs_product_id ON scrape_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_logged_at ON scrape_logs(logged_at DESC);

-- ── Row Level Security (RLS) ──────────────────────────────────────────────────
-- Enable RLS (backend uses service role key which bypasses RLS)
ALTER TABLE tracked_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (backend)
CREATE POLICY "service_role_all_tracked_products" ON tracked_products
  FOR ALL USING (true);
CREATE POLICY "service_role_all_price_history" ON price_history
  FOR ALL USING (true);
CREATE POLICY "service_role_all_scrape_logs" ON scrape_logs
  FOR ALL USING (true);

-- ── Sample data (optional, for testing) ──────────────────────────────────────
-- Uncomment to insert a test product after running the schema:
-- INSERT INTO tracked_products (store_id, name, category, sku, description, scrape_every)
-- VALUES (495, 'Ironwood Slimbook Two', 'Ironwood', 'IRO-10495', 'A dependable laptops pick.', 120);
