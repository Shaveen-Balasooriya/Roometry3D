import React, { useState, useEffect } from 'react';
import './Model.css';

export default function Model({ 
  wallTextures, 
  floorTextures, 
  onApplyWallTexture,
  onApplyFloorTexture 
}) {
  // State to track active textures
  const [activeWallTextureIndex, setActiveWallTextureIndex] = useState(-1);
  const [activeFloorTextureIndex, setActiveFloorTextureIndex] = useState(-1);

  // Handle wall texture selection
  const handleWallTextureSelect = (index) => {
    setActiveWallTextureIndex(index);
    if (wallTextures[index]) {
      // Apply the selected wall texture
      onApplyWallTexture(wallTextures[index]);
      
      // Notify the 3D viewer via the RoomViewer API
      if (window.RoomViewerAPI?.applyWallTexture) {
        window.RoomViewerAPI.applyWallTexture(wallTextures[index], { x: 1, y: 1 });
      }
    }
  };

  // Handle floor texture selection
  const handleFloorTextureSelect = (index) => {
    setActiveFloorTextureIndex(index);
    if (floorTextures[index]) {
      // Apply the selected floor texture
      onApplyFloorTexture(floorTextures[index]);
      
      // Notify the 3D viewer via the RoomViewer API
      if (window.RoomViewerAPI?.applyFloorTexture) {
        window.RoomViewerAPI.applyFloorTexture(floorTextures[index], { x: 1, y: 1 });
      }
    }
  };

  // Generate preview URLs for textures
  const getTexturePreviewUrl = (texture) => {
    if (!texture) return null;
    return URL.createObjectURL(texture);
  };

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      // Revoke all object URLs to prevent memory leaks
      wallTextures.forEach(texture => {
        if (texture) URL.revokeObjectURL(getTexturePreviewUrl(texture));
      });
      floorTextures.forEach(texture => {
        if (texture) URL.revokeObjectURL(getTexturePreviewUrl(texture));
      });
    };
  }, [wallTextures, floorTextures]);

  return (
    <div className="model-texture-container">
      <div className="texture-sections">
        <div className="texture-section">
          <h3>Wall Textures</h3>
          {wallTextures.length === 0 ? (
            <div className="no-textures-message">No wall textures available</div>
          ) : (
            <div className="texture-grid">
              {wallTextures.map((texture, index) => (
                <div 
                  key={`wall-${index}`} 
                  className={`texture-item ${activeWallTextureIndex === index ? 'active' : ''}`}
                  onClick={() => handleWallTextureSelect(index)}
                >
                  <div className="texture-preview">
                    <img 
                      src={getTexturePreviewUrl(texture)} 
                      alt={texture ? texture.name : 'Wall texture'} 
                    />
                  </div>
                  <div className="texture-name">{texture ? texture.name : 'Unnamed'}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="texture-section">
          <h3>Floor Textures</h3>
          {floorTextures.length === 0 ? (
            <div className="no-textures-message">No floor textures available</div>
          ) : (
            <div className="texture-grid">
              {floorTextures.map((texture, index) => (
                <div 
                  key={`floor-${index}`} 
                  className={`texture-item ${activeFloorTextureIndex === index ? 'active' : ''}`}
                  onClick={() => handleFloorTextureSelect(index)}
                >
                  <div className="texture-preview">
                    <img 
                      src={getTexturePreviewUrl(texture)} 
                      alt={texture ? texture.name : 'Floor texture'} 
                    />
                  </div>
                  <div className="texture-name">{texture ? texture.name : 'Unnamed'}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}