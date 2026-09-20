import { Link, useNavigate } from 'react-router-dom';
import { BarChart2, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import SearchModal from './SearchModal';
import { triggerScrapeAll } from '../api';
import toast from 'react-hot-toast';

export default function Navbar() {
  const [showSearch, setShowSearch] = useState(false);
  const [scraping, setScraping] = useState(false);
  const navigate = useNavigate();

  const handleScrapeAll = async () => {
    setScraping(true);
    try {
      await triggerScrapeAll();
      toast.success('Scrape job triggered! Data will update shortly.');
    } catch (err) {
      toast.error('Failed to trigger scrape: ' + (err.response?.data?.error || err.message));
    } finally {
      setScraping(false);
    }
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-logo" style={{ textDecoration: 'none' }}>
            <div className="logo-icon">📈</div>
            <span>PriceTracker</span>
          </Link>

          <div className="navbar-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleScrapeAll}
              disabled={scraping}
              title="Trigger scrape for all tracked products"
            >
              <RefreshCw size={14} className={scraping ? 'spin-icon' : ''} />
              {scraping ? 'Scraping…' : 'Scrape All'}
            </button>

            <button
              id="add-product-btn"
              className="btn btn-primary btn-sm"
              onClick={() => setShowSearch(true)}
            >
              <Plus size={14} />
              Track Product
            </button>
          </div>
        </div>
      </nav>

      {showSearch && (
        <SearchModal
          onClose={() => setShowSearch(false)}
          onTracked={(product) => {
            navigate(`/product/${product.id}`);
          }}
        />
      )}
    </>
  );
}
