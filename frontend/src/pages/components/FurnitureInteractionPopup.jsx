import React, { useState, useEffect } from 'react';
import './FurnitureModel.css';

const FurnitureInteractionPopup = ({ show, timeout = 8000 }) => {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, timeout);
      
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [show, timeout]);
  
  if (!visible) return null;
  
  return (
    <div className="furniture-interaction-popup">
      <div className="popup-heading">Furniture Controls</div>
      <div className="popup-item">
        <span className="popup-key">Click + Drag</span>
        <span className="popup-action">Move furniture</span>
      </div>
      <div className="popup-item">
        <span className="popup-key">Shift + Drag</span>
        <span className="popup-action">Rotate furniture</span>
      </div>
      <div className="popup-item">
        <span className="popup-key">Delete key</span>
        <span className="popup-action">Remove furniture</span>
      </div>
    </div>
  );
};

export default FurnitureInteractionPopup;
