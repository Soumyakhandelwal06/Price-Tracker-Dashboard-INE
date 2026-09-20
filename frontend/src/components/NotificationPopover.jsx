import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Info,
  TrendingDown,
  XCircle,
  CheckCheck,
  Trash2,
  X,
  ExternalLink
} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

function formatPrice(price) {
  if (price == null) return '';
  return '₹' + Number(price).toLocaleString('en-IN');
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 30) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export default function NotificationPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
    removeNotification,
  } = useNotifications();
  const popoverRef = useRef(null);
  const navigate = useNavigate();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleItemClick = (notif) => {
    markAsRead(notif.id);
    if (notif.productId) {
      navigate(`/product/${notif.productId}`);
      setIsOpen(false);
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={16} className="notif-icon notif-icon-success" />;
      case 'alert':
        return <TrendingDown size={16} className="notif-icon notif-icon-alert" />;
      case 'error':
        return <XCircle size={16} className="notif-icon notif-icon-error" />;
      case 'info':
      default:
        return <Info size={16} className="notif-icon notif-icon-info" />;
    }
  };

  return (
    <div className="notification-bell-wrapper" ref={popoverRef}>
      <button
        id="notification-bell-btn"
        className={`btn btn-ghost btn-icon notification-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-popover animate-fade-in">
          <div className="notification-popover-header">
            <div className="notification-title-group">
              <Bell size={16} className="text-accent" />
              <span className="notification-popover-title">Notifications</span>
              {unreadCount > 0 && (
                <span className="unread-count-pill">{unreadCount} unread</span>
              )}
            </div>

            <div className="notification-header-actions">
              {unreadCount > 0 && (
                <button
                  className="btn-text-action"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                >
                  <CheckCheck size={14} />
                  Mark read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  className="btn-text-action danger"
                  onClick={clearAll}
                  title="Clear all notifications"
                >
                  <Trash2 size={14} />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="notification-popover-body">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                <Bell size={32} className="empty-bell-icon" />
                <p className="empty-title">No notifications yet</p>
                <p className="empty-subtitle">
                  Price updates, scrapes, and alerts will appear here.
                </p>
              </div>
            ) : (
              <div className="notification-list">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notification-item ${!n.read ? 'unread' : ''} ${n.productId ? 'clickable' : ''}`}
                    onClick={() => handleItemClick(n)}
                  >
                    <div className="notification-item-icon">{getIcon(n.type)}</div>

                    <div className="notification-item-content">
                      <div className="notification-item-header">
                        <span className="notification-item-title">{n.title}</span>
                        <span className="notification-item-time">{timeAgo(n.timestamp)}</span>
                      </div>

                      {n.productName && (
                        <p className="notification-item-product">{n.productName}</p>
                      )}

                      {n.message && (
                        <p className="notification-item-message">{n.message}</p>
                      )}

                      {(n.price != null || n.discountPct != null) && (
                        <div className="notification-item-details">
                          {n.price != null && (
                            <span className="notif-price-badge">{formatPrice(n.price)}</span>
                          )}
                          {n.discountPct != null && n.discountPct > 0 && (
                            <span className="notif-discount-badge">{n.discountPct}% OFF</span>
                          )}
                          {n.stockText && (
                            <span className="notif-stock-badge">{n.stockText}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      className="notif-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNotification(n.id);
                      }}
                      title="Remove notification"
                    >
                      <X size={12} />
                    </button>

                    {!n.read && <div className="unread-dot" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
