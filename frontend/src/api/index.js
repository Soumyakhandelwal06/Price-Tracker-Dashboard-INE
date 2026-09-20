import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 45000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Products ──────────────────────────────────────────────────────────────────

export const searchCatalog = (q) => api.get(`/api/catalog/search?q=${encodeURIComponent(q)}`);

export const getProducts = () => api.get('/api/products');

export const getProduct = (id) => api.get(`/api/products/${id}`);

export const trackProduct = (productData) => api.post('/api/products/track', productData);

export const untrackProduct = (id) => api.delete(`/api/products/${id}/untrack`);

export const updateAlerts = (id, alertData) => api.patch(`/api/products/${id}/alerts`, alertData);

// ── History & Logs ────────────────────────────────────────────────────────────

export const getPriceHistory = (productId, days = 30) =>
  api.get(`/api/history/${productId}/prices?days=${days}`);

export const getScrapeLogs = (productId, limit = 50) =>
  api.get(`/api/history/${productId}/logs?limit=${limit}`);

// ── Scrape Triggers ───────────────────────────────────────────────────────────

export const triggerScrapeAll = () => api.post('/api/scrape/run');

export const triggerScrapeOne = (id) => api.post(`/api/scrape/run/${id}`, {}, { timeout: 45000 });

export const getScrapeStatus = () => api.get('/api/scrape/status');

export default api;
