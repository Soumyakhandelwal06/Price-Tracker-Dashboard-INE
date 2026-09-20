import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger', // 'danger' | 'warning' | 'primary'
  loading = false,
  onConfirm,
  onClose,
}) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const btnVariantClass =
    variant === 'danger'
      ? 'btn-danger'
      : variant === 'warning'
      ? 'btn-warning'
      : 'btn-primary';

  return createPortal(
    <div
      className="modal-overlay confirm-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="modal confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <button
          className="btn btn-ghost btn-icon confirm-modal-close"
          onClick={onClose}
          disabled={loading}
          aria-label="Close modal"
        >
          <X size={16} />
        </button>

        <div className="confirm-modal-content">
          <div className={`confirm-modal-icon confirm-modal-icon-${variant}`}>
            <AlertTriangle size={24} />
          </div>

          <h3 id="confirm-modal-title" className="confirm-modal-title">
            {title}
          </h3>

          {message && <div className="confirm-modal-message">{message}</div>}

          <div className="confirm-modal-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className={`btn ${btnVariantClass}`}
              onClick={onConfirm}
              disabled={loading}
              id="confirm-modal-submit-btn"
            >
              {loading && <div className="spinner" style={{ width: 14, height: 14 }} />}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

