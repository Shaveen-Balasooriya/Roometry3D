import React from 'react';
import './TextureUploadPanel.css';

// Texture icon component for placeholders
const TextureIcon = () => <span className="texture-icon" role="img" aria-label="texture">🖼️</span>;

export default function TextureUploadPanel({
  texture,
  type, // 'wall' or 'floor'
  isActive,
  onSelect,
  onDelete
}) {
  // Generate preview URL for the texture
  const previewUrl = texture ? URL.createObjectURL(texture) : null;
  
  // Get texture file size in human-readable format
  const getFileSize = (file) => {
    if (!file) return '0 KB';
    
    const bytes = file.size;
    if (bytes === 0) return '0 KB';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };
  
  // Clean up the preview URL when component unmounts
  React.useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className={`texture-panel ${type}-texture ${isActive ? 'active' : ''}`}>
      <div className="texture-preview">
        {previewUrl ? (
          <img src={previewUrl} alt={texture.name} />
        ) : (
          <div className="texture-placeholder">
            <TextureIcon />
          </div>
        )}
        
        {isActive && (
          <div className="active-indicator">Active</div>
        )}
      </div>
      
      <div className="texture-details">
        <div className="texture-name" title={texture.name}>
          {texture.name}
        </div>
        
        <div className="texture-info">
          <span className="texture-size">{getFileSize(texture)}</span>
          <span className="texture-type">{type}</span>
        </div>
      </div>
      
      <div className="texture-actions">
        <button 
          className={`select-texture-button ${isActive ? 'active' : ''}`}
          onClick={() => onSelect(texture, type)}
          disabled={isActive}
        >
          {isActive ? 'Selected' : 'Select'}
        </button>
        
        <button 
          className="delete-texture-button"
          onClick={() => onDelete(texture, type)}
          aria-label={`Delete ${texture.name}`}
        >
          <span className="delete-icon">×</span>
        </button>
      </div>
    </div>
  );
}