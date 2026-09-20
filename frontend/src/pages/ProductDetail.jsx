import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, RefreshCw, Package, Tag, Calendar,
  TrendingDown, Star, Truck, Store
} from 'lucide-react';
import PriceChart from '../components/PriceChart';
import ScrapeLog from '../components/ScrapeLog';
import AlertForm from '../components/AlertForm';
import { getProduct, getPriceHistory, getScrapeLogs, triggerScrapeOne } from '../api';
import toast from 'react-hot-toast';

function formatPrice(price) {
  if (price == null) return '—';
  return '₹' + Number(price).toLocaleString('en-IN');
}

function formatDate(str) {
  if (!str) return 'Never';
  return new Date(str).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const TABS = ['Price History', 'Scrape Log', 'Alerts'];

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Price History');
  const [scraping, setScraping] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [prodRes, histRes, logsRes] = await Promise.all([
        getProduct(id),
        getPriceHistory(id, 30),
        getScrapeLogs(id, 50),
      ]);
      setProduct(prodRes.data.product);
      setHistory(histRes.data.history || []);
      setLogs(logsRes.data.logs || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleScrapeNow = async () => {
    setScraping(true);
    try {
      const res = await triggerScrapeOne(id);
      toast.success(`Scraped! Price: ${formatPrice(res.data.data?.price)}`);
      await fetchAll();
    } catch (err) {
      let msg = err.response?.data?.error || err.response?.data?.message || err.message;
      if (err.code === 'ECONNABORTED' || (msg && msg.includes('timeout'))) {
        msg = 'Store is currently busy or rate-limited. Please wait a few seconds and try again.';
      }
      toast.error('Scrape failed: ' + msg);
      await fetchAll(); // Still refresh to show failure in logs
    } finally {
      setScraping(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ paddingTop: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
        <p>Loading product…</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container" style={{ paddingTop: 60 }}>
        <div style={{ color: 'var(--danger)', marginBottom: 16 }}>
          ⚠️ {error || 'Product not found'}
        </div>
        <Link to="/" className="btn btn-ghost btn-sm">← Back to Dashboard</Link>
      </div>
    );
  }

  const latest = product.latest;

  return (
    <main className="container" style={{ paddingBottom: 60 }}>
      {/* Back link */}
      <div style={{ paddingTop: 24, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={14} />
          Back
        </button>
      </div>

      {/* Product hero */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 250 }}>
            {/* Category + SKU */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              {product.category && (
                <span className="badge badge-blue">
                  <Tag size={10} />
                  {product.category}
                </span>
              )}
              {product.sku && (
                <span className="badge" style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  SKU: {product.sku}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
              {product.name}
            </h1>

            {product.description && (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.7 }}>
                {product.description}
              </p>
            )}

            {/* Last scraped */}
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={12} />
              Last scraped: {formatDate(product.last_scraped)}
            </div>
          </div>

          {/* Current price panel */}
          {latest && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius)',
              padding: '24px 28px',
              minWidth: 240,
            }}>
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                Current Price
              </div>

              <div style={{ fontSize: '2.4rem', fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--accent)', marginBottom: 4 }}>
                {formatPrice(latest.price)}
              </div>

              {latest.mrp && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                    {formatPrice(latest.mrp)}
                  </span>
                  {latest.discount_pct && (
                    <span className="badge badge-success">{latest.discount_pct}% off</span>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className={`badge ${latest.in_stock ? 'badge-success' : 'badge-danger'}`} style={{ alignSelf: 'flex-start' }}>
                  <Package size={11} />
                  {latest.stock_text || (latest.in_stock ? 'In Stock' : 'Out of Stock')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Scrape now button */}
        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            id="scrape-now-btn"
            className="btn btn-primary"
            onClick={handleScrapeNow}
            disabled={scraping}
          >
            <RefreshCw size={14} className={scraping ? 'spin-icon' : ''} />
            {scraping ? 'Scraping…' : 'Scrape Now'}
          </button>
          <a
            href={`https://demo.inelabteamdev.com/product/${product.store_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
          >
            <Store size={14} />
            View on Store ↗
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border-color)', paddingBottom: 0 }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            id={`tab-${tab.toLowerCase().replace(/ /g, '-')}`}
            className="chart-tab"
            onClick={() => setActiveTab(tab)}
            style={{
              borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
              borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
              ...(activeTab === tab ? { color: 'var(--accent)', background: 'var(--accent-glow)' } : {}),
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="card fade-in" key={activeTab}>
        {activeTab === 'Price History' && (
          <>
            <div className="section-header" style={{ marginBottom: 16 }}>
              <div className="section-title">Price History</div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {history.length} data point{history.length !== 1 ? 's' : ''}
              </span>
            </div>
            <PriceChart history={history} />

            {/* Price summary table */}
            {history.length > 0 && (
              <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid var(--border-color)' }}>
                <div className="section-title" style={{ marginBottom: 12 }}>Recent Data Points</div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="log-table">
                    <thead>
                      <tr>
                        <th>Date/Time</th>
                        <th>Price</th>
                        <th>MRP</th>
                        <th>Discount</th>
                        <th>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...history].reverse().slice(0, 20).map((h, i) => (
                        <tr key={i}>
                          <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            {formatDate(h.scraped_at)}
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{formatPrice(h.price)}</td>
                          <td style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>{formatPrice(h.mrp)}</td>
                          <td>{h.discount_pct ? <span className="badge badge-success">{h.discount_pct}%</span> : '—'}</td>
                          <td>
                            <span className={`badge ${h.in_stock ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                              {h.stock_text || (h.in_stock ? 'In Stock' : 'Out')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'Scrape Log' && (
          <>
            <div className="section-header" style={{ marginBottom: 16 }}>
              <div className="section-title">Scrape Log</div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Showing last {logs.length} attempts
              </span>
            </div>
            <ScrapeLog logs={logs} />
          </>
        )}

        {activeTab === 'Alerts' && (
          <>
            <div className="section-header" style={{ marginBottom: 20 }}>
              <div className="section-title">Email Alerts</div>
            </div>
            <AlertForm product={product} onUpdated={fetchAll} />
          </>
        )}
      </div>
    </main>
  );
}
