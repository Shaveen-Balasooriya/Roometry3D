import React, { useState, useEffect } from 'react';
import './TextureApplier.css';

/**
 * TextureApplier component - Handles the application of textures to walls and floors
 */
export default function TextureApplier({
  wallTextures = [],
  floorTextures = [],
  onApplyWallTexture,
  onApplyFloorTexture,
  activeWallTexture, // This prop will receive the currently active wall texture URL
  activeFloorTexture // This prop will receive the currently active floor texture URL
}) {
  // Local state to track selection for UI feedback, synced with props
  const [selectedWallTexture, setSelectedWallTexture] = useState(null);
  const [selectedFloorTexture, setSelectedFloorTexture] = useState(null);

  // Update local state when props change (e.g. parent component sets an active texture)
  useEffect(() => {
    setSelectedWallTexture(activeWallTexture);
  }, [activeWallTexture]);

  useEffect(() => {
    setSelectedFloorTexture(activeFloorTexture);
  }, [activeFloorTexture]);

  // Handle wall texture selection
  const handleWallTextureSelect = (textureUrl) => {
    if (onApplyWallTexture) onApplyWallTexture(textureUrl);
  };

  // Handle floor texture selection
  const handleFloorTextureSelect = (textureUrl) => {
    if (onApplyFloorTexture) onApplyFloorTexture(textureUrl);
  };

  return (
    <div className="texture-applier-container">
      {/* Wall textures section */}
      {wallTextures.length > 0 && (
        <div className="texture-section">
          <h3>Wall Textures</h3>
          <div className="texture-grid">
            {wallTextures.map((textureUrl, index) => (
              <div 
                key={`wall-${textureUrl}-${index}`} // Use URL in key for better stability
                className={`texture-card ${textureUrl === selectedWallTexture ? 'active' : ''}`}
                onClick={() => handleWallTextureSelect(textureUrl)}
                title={textureUrl.substring(textureUrl.lastIndexOf('/') + 1)} // Show filename as tooltip
              >
                <div className="texture-preview">
                  <img 
                    src={textureUrl} // Directly use the URL
                    alt={`Wall texture ${index + 1}`} 
                  />
                  {textureUrl === selectedWallTexture && (
                    <div className="active-badge">Applied</div>
                  )}
                </div>
                <div className="texture-name">
                  {decodeURIComponent(textureUrl.substring(textureUrl.lastIndexOf('/') + 1).split('?')[0])}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floor textures section */}
      {floorTextures.length > 0 && (
        <div className="texture-section">
          <h3>Floor Textures</h3>
          <div className="texture-grid">
            {floorTextures.map((textureUrl, index) => (
              <div 
                key={`floor-${textureUrl}-${index}`} // Use URL in key
                className={`texture-card ${textureUrl === selectedFloorTexture ? 'active' : ''}`}
                onClick={() => handleFloorTextureSelect(textureUrl)}
                title={textureUrl.substring(textureUrl.lastIndexOf('/') + 1)} // Show filename as tooltip
              >
                <div className="texture-preview">
                  <img 
                    src={textureUrl} // Directly use the URL
                    alt={`Floor texture ${index + 1}`}
                  />
                  {textureUrl === selectedFloorTexture && (
                    <div className="active-badge">Applied</div>
                  )}
                </div>
                <div className="texture-name">
                  {decodeURIComponent(textureUrl.substring(textureUrl.lastIndexOf('/') + 1).split('?')[0])}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {wallTextures.length === 0 && floorTextures.length === 0 && (
        <div className="no-textures-message-global">
          <p>No textures available for this room.</p>
          <p className="small-text">Textures can be uploaded during the room creation process.</p>
        </div>
      )}
    </div>
  );
}