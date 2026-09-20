import { CheckCircle, XCircle, AlertTriangle, Clock, Zap } from 'lucide-react';

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function StatusBadge({ status }) {
  const configs = {
    success: { icon: CheckCircle, label: 'Success', cls: 'badge-success' },
    retried: { icon: AlertTriangle, label: 'Retried', cls: 'badge-retried' },
    failed: { icon: XCircle, label: 'Failed', cls: 'badge-danger' },
  };
  const cfg = configs[status] || { icon: Zap, label: status, cls: 'badge-blue' };
  const Icon = cfg.icon;

  return (
    <span className={`badge ${cfg.cls}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

export default function ScrapeLog({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>📋</div>
        <p>No scrape logs yet.</p>
      </div>
    );
  }

  const successCount = logs.filter((l) => l.status === 'success').length;
  const retriedCount = logs.filter((l) => l.status === 'retried').length;
  const failedCount = logs.filter((l) => l.status === 'failed').length;

  return (
    <div>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <span className="badge badge-success">✓ {successCount} succeeded</span>
        {retriedCount > 0 && <span className="badge badge-retried">⚠ {retriedCount} retried</span>}
        {failedCount > 0 && <span className="badge badge-danger">✗ {failedCount} failed</span>}
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Last {logs.length} attempts
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="log-table" id="scrape-log-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Duration</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={12} style={{ opacity: 0.5 }} />
                    {formatDate(log.logged_at)}
                  </span>
                </td>
                <td><StatusBadge status={log.status} /></td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>{log.attempts}</td>
                <td style={{ fontSize: '0.8rem' }}>
                  {log.duration_ms != null ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}
                </td>
                <td>
                  {log.error_msg ? (
                    <span className="log-error-msg" title={log.error_msg}>
                      {log.error_msg}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
