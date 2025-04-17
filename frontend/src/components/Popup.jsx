import React, { useEffect } from 'react'
import './Popup.css'

export default function Popup({ open, type = 'success', message, onClose, duration = 3000 }) {
  useEffect(() => {
    if (open && duration > 0) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [open, duration, onClose])

  if (!open) return null

  return (
    <div className={`popup-container ${type}`}>
      <div className="popup-content">
        {type === 'success' && (
          <span className="popup-icon" aria-label="Success">✔️</span>
        )}
        {type === 'error' && (
          <span className="popup-icon" aria-label="Error">❌</span>
        )}
        <span className="popup-message">{message}</span>
        <button className="popup-close" onClick={onClose} aria-label="Close">&times;</button>
      </div>
    </div>
  )
}
