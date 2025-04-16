import React from 'react';
import '../../styles/components/loading.css';

const ProgressBar = ({ progress, showPercentage = true }) => {
  return (
    <div className="upload-progress">
      <div className="progress-container">
        <div 
          className="progress-bar" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      {showPercentage && (
        <div className="progress-text">{Math.round(progress)}% complete</div>
      )}
    </div>
  );
};

export default ProgressBar;
