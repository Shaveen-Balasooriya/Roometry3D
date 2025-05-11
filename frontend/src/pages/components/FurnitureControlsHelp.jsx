import React, { useState, useEffect } from 'react';
import './FurnitureModel.css';

const FurnitureControlsHelp = ({ isVisible, selectedFurniture }) => {
  const [showHelp, setShowHelp] = useState(false);
  
  useEffect(() => {
    // Show help message for 8 seconds when furniture is first selected
    if (isVisible && selectedFurniture) {
      setShowHelp(true);
      const timer = setTimeout(() => {
        setShowHelp(false);
      }, 8000);
      
      return () => clearTimeout(timer);
    } else {
      setShowHelp(false);
    }
  }, [isVisible, selectedFurniture]);
  
  if (!isVisible || !showHelp) return null;
  
  return (
    <div className="furniture-help-tooltip">
      <div><strong>Furniture Controls:</strong></div>
      <div>• Click and drag to move furniture</div>
      <div>• Hold <span className="key">Shift</span> while dragging to rotate</div>
      <div>• Press <span className="key">Delete</span> to remove furniture</div>
    </div>
  );
};

export default FurnitureControlsHelp;
