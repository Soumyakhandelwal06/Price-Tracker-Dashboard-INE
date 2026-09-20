import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useState, useMemo } from 'react';

const COLORS = {
  price: '#4f8ef7',
  mrp: '#4a5a7a',
};

function formatPrice(v) {
  if (v == null) return '—';
  return '₹' + Number(v).toLocaleString('en-IN');
}

function formatDate(dateStr, range) {
  const d = new Date(dateStr);
  if (range <= 1) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-sm)',
      padding: '12px 16px',
      fontSize: '0.83rem',
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 8, fontSize: '0.75rem' }}>{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 4 }}>
          <span style={{ color: p.color }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{formatPrice(p.value)}</span>
        </div>
      ))}
      {payload[0]?.payload?.stockText && (
        <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          Stock: {payload[0].payload.stockText}
        </div>
      )}
    </div>
  );
};

export default function PriceChart({ history }) {
  const [days, setDays] = useState(7);

  const filtered = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return history
      .filter((h) => new Date(h.scraped_at) >= cutoff)
      .map((h) => ({
        ...h,
        label: formatDate(h.scraped_at, days),
        price: h.price ? Number(h.price) : null,
        mrp: h.mrp ? Number(h.mrp) : null,
      }));
  }, [history, days]);

  const minPrice = filtered.length
    ? Math.min(...filtered.filter((d) => d.price != null).map((d) => d.price))
    : 0;

  if (!history || history.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>📉</div>
        <p>No price history yet. Trigger a scrape to see data.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="chart-tabs">
        {[1, 7, 14, 30].map((d) => (
          <button
            key={d}
            className={`chart-tab ${days === d ? 'active' : ''}`}
            onClick={() => setDays(d)}
            id={`chart-tab-${d}d`}
          >
            {d === 1 ? '24h' : `${d}d`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          No data in this range
        </div>
      ) : (
        <div className="chart-container">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filtered} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => '₹' + Number(v / 1000).toFixed(0) + 'k'}
                width={55}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '0.8rem', paddingTop: '16px' }}
                formatter={(value) => <span style={{ color: 'var(--text-secondary)' }}>{value}</span>}
              />
              {minPrice > 0 && (
                <ReferenceLine
                  y={minPrice}
                  stroke="rgba(52,211,153,0.3)"
                  strokeDasharray="4 4"
                  label={{ value: 'Low', position: 'right', fill: 'var(--success)', fontSize: 10 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="price"
                name="Price"
                stroke={COLORS.price}
                strokeWidth={2.5}
                dot={{ r: 3, fill: COLORS.price, strokeWidth: 0 }}
                activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="mrp"
                name="MRP"
                stroke={COLORS.mrp}
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
