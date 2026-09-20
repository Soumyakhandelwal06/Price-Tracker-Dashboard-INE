import { useNavigate } from 'react-router-dom';
import { Trash2, RefreshCw, TrendingDown, TrendingUp, Package } from 'lucide-react';
import { untrackProduct, triggerScrapeOne } from '../api';
import toast from 'react-hot-toast';
import { useState } from 'react';

function formatPrice(price) {
  if (price == null) return '—';
  return '₹' + Number(price).toLocaleString('en-IN');
}

function formatDate(dateStr) {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function ProductCard({ product, onDeleted, onScraped }) {
  const navigate = useNavigate();
  const [scraping, setScraping] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const latest = product.latest;
  const price = latest?.price;
  const mrp = latest?.mrp;
  const discount = latest?.discount_pct;
  const inStock = latest?.in_stock;
  const stockText = latest?.stock_text;

  const handleScrape = async (e) => {
    e.stopPropagation();
    setScraping(true);
    try {
      const res = await triggerScrapeOne(product.id);
      toast.success(`Scraped: ${formatPrice(res.data.data?.price)}`);
      onScraped?.();
    } catch (err) {
      let msg = err.response?.data?.error || err.response?.data?.message || err.message;
      if (err.code === 'ECONNABORTED' || (msg && msg.includes('timeout'))) {
        msg = 'Store is currently busy or rate-limited. Please wait a few seconds and try again.';
      }
      toast.error('Scrape failed: ' + msg);
    } finally {
      setScraping(false);
    }
  };

  const handleUntrack = async (e) => {
    e.stopPropagation();
    if (!confirm(`Stop tracking "${product.name}"?`)) return;
    setDeleting(true);
    try {
      await untrackProduct(product.id);
      toast.success(`Stopped tracking "${product.name}"`);
      onDeleted?.();
    } catch (err) {
      toast.error('Failed to untrack: ' + (err.response?.data?.error || err.message));
      setDeleting(false);
    }
  };

  return (
    <div
      className="product-card fade-in"
      onClick={() => navigate(`/product/${product.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/product/${product.id}`)}
      id={`product-card-${product.id}`}
    >
      <div className="product-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="product-card-name truncate">{product.name}</div>
          <div className="product-card-category">
            {product.category || 'Uncategorized'}
            {product.sku && <span> · {product.sku}</span>}
          </div>
        </div>
        {inStock != null && (
          <span className={`badge ${inStock ? 'badge-success' : 'badge-danger'}`}>
            <Package size={10} />
            {inStock ? 'In Stock' : 'Out'}
          </span>
        )}
      </div>

      <div className="product-card-price-row">
        {price != null ? (
          <>
            <span className="product-card-price">{formatPrice(price)}</span>
            {mrp && mrp !== price && (
              <span className="product-card-mrp">{formatPrice(mrp)}</span>
            )}
            {discount != null && (
              <span className="badge badge-success" style={{ marginLeft: 'auto' }}>
                {discount}% off
              </span>
            )}
          </>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Not yet scraped
          </span>
        )}
      </div>

      {stockText && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          {stockText}
        </div>
      )}

      <div className="product-card-meta">
        <span className="product-card-scraped">
          Last scraped: {formatDate(product.last_scraped || latest?.scraped_at)}
        </span>
      </div>

      <div className="product-card-actions">
        <button
          id={`scrape-btn-${product.id}`}
          className="btn btn-ghost btn-sm"
          onClick={handleScrape}
          disabled={scraping || deleting}
          title="Scrape now"
        >
          <RefreshCw size={13} />
          {scraping ? 'Scraping…' : 'Scrape'}
        </button>
        <button
          id={`untrack-btn-${product.id}`}
          className="btn btn-danger btn-sm"
          onClick={handleUntrack}
          disabled={deleting || scraping}
          title="Stop tracking"
        >
          <Trash2 size={13} />
          {deleting ? '…' : 'Untrack'}
        </button>
      </div>
    </div>
  );
}
