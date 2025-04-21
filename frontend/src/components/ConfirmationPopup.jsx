import React from 'react';
import './ConfirmationPopup.css'; // We'll create this CSS file next

export default function ConfirmationPopup({
  open,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonClass = 'button-primary', // Default class for confirm
  cancelButtonClass = 'button-secondary' // Default class for cancel
}) {
  if (!open) return null;

  return (
    <div className="confirmation-popup-overlay">
      <div className="confirmation-popup-content">
        <p className="confirmation-popup-message">{message}</p>
        <div className="confirmation-popup-actions">
          <button
            onClick={onCancel}
            className={cancelButtonClass}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={confirmButtonClass}
            style={confirmButtonClass === 'button-primary' ? { background: 'var(--error)', borderColor: 'var(--error)' } : {}} // Specific style for danger confirmation
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
