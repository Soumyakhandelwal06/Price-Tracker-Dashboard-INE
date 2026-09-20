import { useState } from 'react';
import { Bell, Mail, TrendingDown, Package } from 'lucide-react';
import { updateAlerts } from '../api';
import toast from 'react-hot-toast';

export default function AlertForm({ product, onUpdated }) {
  const [alertPrice, setAlertPrice] = useState(product.alert_price || '');
  const [alertEmail, setAlertEmail] = useState(product.alert_email || '');
  const [alertBackInStock, setAlertBackInStock] = useState(product.alert_back_in_stock || false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (alertEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(alertEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSaving(true);
    try {
      await updateAlerts(product.id, {
        alertPrice: alertPrice ? Number(alertPrice) : null,
        alertEmail: alertEmail || null,
        alertBackInStock,
      });
      toast.success('Alert settings saved!');
      onUpdated?.();
    } catch (err) {
      toast.error('Failed to save: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="alert-form" onSubmit={handleSave} id="alert-form">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Bell size={16} style={{ color: 'var(--accent)' }} />
        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Price & Stock Alerts</span>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
        Get notified via email when conditions are met.
      </p>

      <div className="alert-form-row">
        <div>
          <label className="form-label" htmlFor="alert-email">
            <Mail size={11} style={{ display: 'inline', marginRight: 4 }} />
            Email Address
          </label>
          <input
            id="alert-email"
            type="email"
            className="input"
            placeholder="you@example.com"
            value={alertEmail}
            onChange={(e) => setAlertEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="alert-price">
            <TrendingDown size={11} style={{ display: 'inline', marginRight: 4 }} />
            Alert Price (₹)
          </label>
          <input
            id="alert-price"
            type="number"
            className="input"
            placeholder="e.g. 50000"
            value={alertPrice}
            onChange={(e) => setAlertPrice(e.target.value)}
            min="0"
            step="1"
          />
          <p style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: 4 }}>
            Alert when price drops at or below this
          </p>
        </div>
      </div>

      <div className="toggle-row">
        <div>
          <div className="toggle-label">
            <Package size={13} style={{ display: 'inline', marginRight: 6 }} />
            Back-in-Stock Alert
          </div>
          <div className="toggle-desc">Notify when product comes back in stock</div>
        </div>
        <label className="toggle">
          <input
            id="alert-back-in-stock"
            type="checkbox"
            checked={alertBackInStock}
            onChange={(e) => setAlertBackInStock(e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={saving}
        id="save-alerts-btn"
        style={{ alignSelf: 'flex-start' }}
      >
        {saving ? 'Saving…' : 'Save Alerts'}
      </button>
    </form>
  );
}
