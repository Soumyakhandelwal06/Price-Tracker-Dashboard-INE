import { useState, useEffect, useCallback } from 'react';
import { X, Search, Plus, Check } from 'lucide-react';
import { searchCatalog, trackProduct } from '../api';
import toast from 'react-hot-toast';

export default function SearchModal({ onClose, onTracked }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState({}); // productId -> 'loading' | 'done'
  const [error, setError] = useState(null);

  // Debounced search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await searchCatalog(query.trim());
        setResults(res.data.results || []);
        if (res.data.results.length === 0) {
          setError('No products found. Try a different name.');
        }
      } catch (err) {
        setError('Failed to search: ' + (err.response?.data?.error || err.message));
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleTrack = async (product) => {
    const key = product.storeId;
    setTracking((t) => ({ ...t, [key]: 'loading' }));

    try {
      const res = await trackProduct({
        storeId: product.storeId,
        name: product.name,
        category: product.category,
        sku: product.sku,
        description: product.description,
        imageUrl: product.image,
      });
      setTracking((t) => ({ ...t, [key]: 'done' }));
      toast.success(`Now tracking "${product.name}"`);
      setTimeout(() => {
        onClose();
        onTracked?.(res.data.product);
      }, 600);
    } catch (err) {
      setTracking((t) => ({ ...t, [key]: null }));
      const msg = err.response?.data?.error || err.message;
      if (msg.includes('already being tracked')) {
        toast('Already tracking this product!', { icon: 'ℹ️' });
      } else {
        toast.error('Failed to track: ' + msg);
      }
    }
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Search products">
        <div className="modal-header">
          <Search size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            id="product-search-input"
            autoFocus
            className="input modal-search-input"
            placeholder="Search by product name (e.g. laptop, phone)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: '12px 8px' }}
          />
          <button className="btn btn-ghost btn-icon modal-close-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-results">
          {loading && (
            <div className="search-loading">
              <div className="spinner" />
              <span>Searching catalog…</span>
            </div>
          )}

          {!loading && error && (
            <div className="search-empty">
              <div className="empty-state-icon">🔍</div>
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && results.length === 0 && query.trim().length >= 2 && (
            <div className="search-empty">
              <div className="empty-state-icon">📦</div>
              <p style={{ color: 'var(--text-muted)' }}>No products found for "{query}"</p>
            </div>
          )}

          {!loading && results.length === 0 && query.trim().length < 2 && (
            <div className="search-empty">
              <div className="empty-state-icon">✨</div>
              <p style={{ color: 'var(--text-muted)' }}>Type at least 2 characters to search</p>
            </div>
          )}

          {!loading && results.map((product) => {
            const state = tracking[product.storeId];
            return (
              <div key={product.storeId} className="search-result-item">
                <div className="search-result-info">
                  <div className="search-result-name">{product.name}</div>
                  <div className="search-result-meta">
                    {product.category && <span>{product.category}</span>}
                    {product.sku && <span> · SKU {product.sku}</span>}
                  </div>
                </div>
                <button
                  id={`track-btn-${product.storeId}`}
                  className={`btn btn-sm ${state === 'done' ? 'btn-ghost' : 'btn-primary'}`}
                  disabled={!!state}
                  onClick={() => handleTrack(product)}
                  style={{ flexShrink: 0 }}
                >
                  {state === 'loading' && <div className="spinner" style={{ width: 14, height: 14 }} />}
                  {state === 'done' && <Check size={14} />}
                  {!state && <Plus size={14} />}
                  {state === 'done' ? 'Tracked!' : 'Track'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
