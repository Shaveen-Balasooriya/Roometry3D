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
  activeWallTexture,
  activeFloorTexture
}) {
  // Keep track of active textures
  const [selectedWallTexture, setSelectedWallTexture] = useState(null);
  const [selectedFloorTexture, setSelectedFloorTexture] = useState(null);

  // Update local state when props change
  useEffect(() => {
    if (activeWallTexture) setSelectedWallTexture(activeWallTexture);
  }, [activeWallTexture]);

  useEffect(() => {
    if (activeFloorTexture) setSelectedFloorTexture(activeFloorTexture);
  }, [activeFloorTexture]);

  // Handle wall texture selection
  const handleWallTextureSelect = (texture) => {
    setSelectedWallTexture(texture);
    if (onApplyWallTexture) onApplyWallTexture(texture);
  };

  // Handle floor texture selection
  const handleFloorTextureSelect = (texture) => {
    setSelectedFloorTexture(texture);
    if (onApplyFloorTexture) onApplyFloorTexture(texture);
  };

  return (
    <div className="texture-applier-container">
      {/* Wall textures section */}
      <div className="texture-section">
        <h3>Wall Textures</h3>
        <div className="texture-grid">
          {wallTextures.length > 0 ? (
            wallTextures.map((texture, index) => (
              <div 
                key={`wall-${index}`}
                className={`texture-card ${texture === selectedWallTexture ? 'active' : ''}`}
                onClick={() => handleWallTextureSelect(texture)}
              >
                <div className="texture-preview">
                  <img 
                    src={URL.createObjectURL(texture)} 
                    alt={`Wall texture ${index + 1}`} 
                    onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                  />
                  {texture === selectedWallTexture && (
                    <div className="active-badge">Applied</div>
                  )}
                </div>
                <div className="texture-name">{texture.name}</div>
              </div>
            ))
          ) : (
            <div className="no-textures-message">
              No wall textures available. Please upload some in Step 2.
            </div>
          )}
        </div>
      </div>

      {/* Floor textures section */}
      <div className="texture-section">
        <h3>Floor Textures</h3>
        <div className="texture-grid">
          {floorTextures.length > 0 ? (
            floorTextures.map((texture, index) => (
              <div 
                key={`floor-${index}`}
                className={`texture-card ${texture === selectedFloorTexture ? 'active' : ''}`}
                onClick={() => handleFloorTextureSelect(texture)}
              >
                <div className="texture-preview">
                  <img 
                    src={URL.createObjectURL(texture)} 
                    alt={`Floor texture ${index + 1}`} 
                    onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                  />
                  {texture === selectedFloorTexture && (
                    <div className="active-badge">Applied</div>
                  )}
                </div>
                <div className="texture-name">{texture.name}</div>
              </div>
            ))
          ) : (
            <div className="no-textures-message">
              No floor textures available. Please upload some in Step 2.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}