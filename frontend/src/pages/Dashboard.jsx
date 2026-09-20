import { useState, useEffect, useCallback } from 'react';
import { Package, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { getProducts, getScrapeStatus } from '../api';

function StatCard({ label, value, sub, icon: Icon }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function formatDate(str) {
  if (!str) return 'Never';
  const d = new Date(str);
  const now = new Date();
  const diff = Math.floor((now - d) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scrapeStatus, setScrapeStatus] = useState(null);

  const fetchProducts = useCallback(async () => {
    try {
      const [prodRes, statusRes] = await Promise.all([
        getProducts(),
        getScrapeStatus().catch(() => null),
      ]);
      setProducts(prodRes.data.products || []);
      setScrapeStatus(statusRes?.data || null);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    // Auto-refresh every 30s
    const interval = setInterval(fetchProducts, 30000);
    return () => clearInterval(interval);
  }, [fetchProducts]);

  // Stats
  const totalTracked = products.length;
  const inStockCount = products.filter((p) => p.latest?.in_stock === true).length;
  const successfulScrapes = scrapeStatus?.lastRun?.succeeded ?? '—';
  const lastRun = scrapeStatus?.lastRun?.finishedAt
    ? formatDate(scrapeStatus.lastRun.finishedAt)
    : 'Never';

  return (
    <main className="container" style={{ paddingTop: 0, paddingBottom: 60 }}>
      <div className="page-header">
        <h1 className="page-title">Price Tracker Dashboard</h1>
        <p className="page-subtitle">
          Real-time price and stock monitoring for INE Store products.
          Scrapes automatically every 2 hours.
        </p>
      </div>

      {/* Stats bar */}
      <div className="stats-bar">
        <StatCard
          label="Tracked Products"
          value={totalTracked}
          sub="actively monitored"
          icon={Package}
        />
        <StatCard
          label="In Stock"
          value={inStockCount}
          sub={`of ${totalTracked} tracked`}
          icon={CheckCircle}
        />
        <StatCard
          label="Last Scrape"
          value={lastRun}
          sub={
            scrapeStatus?.running
              ? '🟡 scraping now…'
              : scrapeStatus?.lastRun
              ? `${scrapeStatus.lastRun.succeeded ?? 0} succeeded`
              : 'awaiting first run'
          }
          icon={Clock}
        />
        <StatCard
          label="Scrape Schedule"
          value="2h"
          sub="via cron-job.org"
          icon={RefreshCw}
        />
      </div>

      {/* Product grid */}
      <div className="section">
        <div className="section-header">
          <div>
            <div className="section-title">Tracked Products</div>
            <div className="section-sub">Click any card to view price history and scrape logs</div>
          </div>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)', padding: 40 }}>
            <div className="spinner" />
            Loading products…
          </div>
        )}

        {!loading && error && (
          <div style={{
            background: 'var(--danger-bg)',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: 'var(--radius)',
            padding: 20,
            color: 'var(--danger)',
          }}>
            ⚠️ Failed to load products: {error}
          </div>
        )}

        {!loading && !error && products.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <div className="empty-state-title">No products tracked yet</div>
            <div className="empty-state-desc">
              Click "Track Product" in the navbar to search and add products from the INE store.
            </div>
          </div>
        )}

        {!loading && products.length > 0 && (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onDeleted={fetchProducts}
                onScraped={fetchProducts}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
