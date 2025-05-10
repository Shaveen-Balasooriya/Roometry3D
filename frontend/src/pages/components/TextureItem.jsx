import React, { useState } from 'react';
import './TextureItem.css';

/**
 * Component for displaying an individual texture option
 */
function TextureItem({ texture, isSelected, onSelect }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  const handleImageLoad = () => {
    setLoaded(true);
  };
  
  const handleImageError = () => {
    console.error(`Error loading texture image: ${texture.url}`);
    setError(true);
  };
  
  return (
    <div 
      className={`texture-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(texture)}
      title={texture.name}
    >
      {!loaded && !error && (
        <div className="texture-loading">
          <div className="texture-spinner"></div>
        </div>
      )}
      
      {error && (
        <div className="texture-error">
          <span className="error-icon">!</span>
          <span>Failed to load</span>
        </div>
      )}
      
      <img 
        src={texture.url} 
        alt={texture.name}
        className={`texture-image ${loaded ? 'loaded' : ''}`}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      
      <div className="texture-name">{texture.name}</div>
      
      {isSelected && (
        <div className="texture-selected-indicator">
          <div className="checkmark">✓</div>
        </div>
      )}
    </div>
  );
}

export default TextureItem;