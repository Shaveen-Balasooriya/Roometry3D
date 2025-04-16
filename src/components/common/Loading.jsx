import React from 'react';
import '../../styles/components/loading.css';

const Loading = ({ size = 'medium', text = 'Loading...', overlay = false }) => {
  const sizeClass = `spinner-${size}`;
  
  if (overlay) {
    return (
      <div className="loading-overlay">
        <div className="loading-container">
          <div className={`loading-spinner ${sizeClass}`}></div>
          <p className="loading-text">{text}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="loading-container">
      <div className={`loading-spinner ${sizeClass}`}></div>
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
};

export default Loading;
