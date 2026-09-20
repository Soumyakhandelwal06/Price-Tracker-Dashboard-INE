import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

const NotificationContext = createContext();

const STORAGE_KEY = 'price_tracker_notifications_v1';

const INITIAL_NOTIFICATIONS = [
  {
    id: 'init-1',
    title: 'Welcome to PriceTracker',
    message: 'System active. Track products from INE Store and track live price updates.',
    type: 'info',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    read: false,
  },
  {
    id: 'init-2',
    title: 'Price Scraped',
    message: 'Larkspur Stream Controller Plus',
    type: 'success',
    productName: 'Larkspur Stream Controller Plus',
    price: 16624,
    discountPct: 23,
    stockText: 'Only 71 left',
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    read: false,
  },
];

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load notifications from localStorage:', e);
    }
    return INITIAL_NOTIFICATIONS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch (e) {
      console.error('Failed to save notifications to localStorage:', e);
    }
  }, [notifications]);

  const addNotification = useCallback((notif) => {
    const newNotif = {
      id: notif.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: notif.title || 'Notification',
      message: notif.message || '',
      type: notif.type || 'info', // 'success' | 'error' | 'info' | 'alert'
      productId: notif.productId || null,
      productName: notif.productName || null,
      price: notif.price ?? null,
      discountPct: notif.discountPct ?? null,
      stockText: notif.stockText ?? null,
      timestamp: notif.timestamp || new Date().toISOString(),
      read: false,
    };

    setNotifications((prev) => [newNotif, ...prev.slice(0, 99)]);

    // Display top-right toast as well (retaining current toast behavior)
    if (notif.showToast !== false) {
      const toastText = notif.price != null
        ? `${notif.productName ? notif.productName + ': ' : ''}₹${Number(notif.price).toLocaleString('en-IN')}`
        : `${notif.title}${notif.message ? ': ' + notif.message : ''}`;

      if (notif.type === 'success') toast.success(toastText);
      else if (notif.type === 'error') toast.error(toastText);
      else toast(toastText, { icon: notif.type === 'alert' ? '🔔' : 'ℹ️' });
    }

    return newNotif;
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearAll,
        removeNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
