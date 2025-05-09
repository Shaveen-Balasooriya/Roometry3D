import React, { useEffect, useState } from 'react';
import './TexturePanel.css';

export default function TexturePanel({
  selectedComponent,
  wallTextures,
  floorTextures,
  componentTextures,
  activeTextureIndices,
  onApplyTexture,
  onSwitchActiveTexture,
  onRemoveSpecificTexture,
  onRemoveAllTextures,
  togglePanel,
  onUploadTexture,
  componentTextureRepeat,
  onTextureRepeatChange,
  componentTags,
  onApplyTextureToTag
}) {
  const [tileX, setTileX] = useState(2);
  const [tileY, setTileY] = useState(2);
  const [activeTab, setActiveTab] = useState('walls');
  
  // Reset tiling values when selected component changes
  useEffect(() => {
    if (selectedComponent && componentTextureRepeat[selectedComponent]) {
      setTileX(componentTextureRepeat[selectedComponent].x);
      setTileY(componentTextureRepeat[selectedComponent].y);
    } else {
      // Default values
      setTileX(2);
      setTileY(2);
    }
  }, [selectedComponent, componentTextureRepeat]);

  // Apply texture repeat changes
  const handleRepeatChange = () => {
    if (selectedComponent) {
      onTextureRepeatChange(selectedComponent, tileX, tileY);
    }
  };

  // Get the component's tag (wall or floor)
  const selectedComponentTag = selectedComponent ? componentTags[selectedComponent] : null;
  
  // Determine which textures to show based on component tag
  const getApplicableTextures = () => {
    if (!selectedComponentTag) return [];
    
    if (selectedComponentTag === 'wall') {
      return wallTextures;
    } else if (selectedComponentTag === 'floor') {
      return floorTextures;
    }
    
    return [];
  };
  
  // Get textures already applied to the component
  const getComponentTextures = () => {
    if (!selectedComponent || !componentTextures[selectedComponent]) {
      return [];
    }
    return componentTextures[selectedComponent];
  };
  
  // Check if a specific texture is active for the component
  const isActiveTexture = (index) => {
    if (!selectedComponent || activeTextureIndices[selectedComponent] === undefined) {
      return false;
    }
    return activeTextureIndices[selectedComponent] === index;
  };

  // Handle apply texture to all components with same tag
  const handleApplyToAll = (texture) => {
    if (selectedComponentTag) {
      if (window.RoomViewerAPI?.applyTextureToTag) {
        window.RoomViewerAPI.applyTextureToTag(
          selectedComponentTag, 
          texture, 
          { x: tileX, y: tileY },
          componentTags
        );
      }
      
      // Also update the component textures state
      Object.entries(componentTags).forEach(([id, tag]) => {
        if (tag === selectedComponentTag) {
          onApplyTexture(id, texture);
        }
      });
    }
  };

  // Handle removing textures from all components with same tag
  const handleRemoveFromAll = () => {
    if (selectedComponentTag && window.confirm(`Remove all textures from all ${selectedComponentTag}s?`)) {
      if (window.RoomViewerAPI?.removeTexturesForTag) {
        window.RoomViewerAPI.removeTexturesForTag(selectedComponentTag, componentTags);
      }
      
      // Update component textures state
      Object.entries(componentTags).forEach(([id, tag]) => {
        if (tag === selectedComponentTag) {
          onRemoveAllTextures(id);
        }
      });
    }
  };

  // Count how many components have each tag
  const tagCounts = Object.values(componentTags).reduce((counts, tag) => {
    counts[tag] = (counts[tag] || 0) + 1;
    return counts;
  }, {});

  return (
    <div className="texture-panel-container">
      <div className="texture-panel-header">
        <h3>Texture Panel</h3>
        <button 
          className="close-panel-button" 
          onClick={togglePanel} 
          aria-label="Close texture panel"
        >
          ×
        </button>
      </div>
      
      {!selectedComponent ? (
        <div className="no-selection-message">
          <p>Select a component in the 3D viewer to apply textures</p>
        </div>
      ) : !selectedComponentTag ? (
        <div className="no-tag-message">
          <p>Selected component has no tag</p>
          <p>Go back to Step 1 to tag this component</p>
        </div>
      ) : (
        <div className="texture-panel-content">
          <div className="component-info">
            <div className="component-name">
              Selected: <span className="name-value">{selectedComponent}</span>
            </div>
            <div className={`component-tag ${selectedComponentTag}`}>
              Type: <span className="tag-value">{selectedComponentTag}</span>
            </div>
          </div>
          
          <div className="texture-tabs">
            <button 
              className={`texture-tab ${activeTab === 'walls' ? 'active' : ''} ${selectedComponentTag === 'wall' ? 'applicable' : ''}`}
              onClick={() => setActiveTab('walls')}
              disabled={selectedComponentTag !== 'wall'}
            >
              Wall Textures ({wallTextures.length})
            </button>
            <button 
              className={`texture-tab ${activeTab === 'floors' ? 'active' : ''} ${selectedComponentTag === 'floor' ? 'applicable' : ''}`}
              onClick={() => setActiveTab('floors')}
              disabled={selectedComponentTag !== 'floor'}
            >
              Floor Textures ({floorTextures.length})
            </button>
          </div>
          
          <div className="texture-content">
            <div className="applicable-textures">
              <div className="section-header">
                <h4>Available {selectedComponentTag === 'wall' ? 'Wall' : 'Floor'} Textures</h4>
                <button 
                  className="upload-texture-button"
                  onClick={() => onUploadTexture(selectedComponentTag)}
                >
                  + Upload More
                </button>
              </div>
              
              {getApplicableTextures().length > 0 ? (
                <div className="textures-grid">
                  {getApplicableTextures().map((texture, index) => (
                    <div key={index} className="texture-card">
                      <div 
                        className="texture-preview"
                        onClick={() => onApplyTexture(selectedComponent, texture)}
                      >
                        <img 
                          src={URL.createObjectURL(texture)} 
                          alt={texture.name}
                          onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                        />
                      </div>
                      <div className="texture-name">{texture.name}</div>
                      <div className="texture-actions">
                        <button 
                          className="apply-button"
                          onClick={() => onApplyTexture(selectedComponent, texture)}
                        >
                          Apply
                        </button>
                        <button 
                          className="apply-all-button"
                          onClick={() => handleApplyToAll(texture)}
                          title={`Apply to all ${selectedComponentTag}s (${tagCounts[selectedComponentTag] || 0})`}
                        >
                          Apply to All
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-textures-message">
                  <p>No {selectedComponentTag} textures available.</p>
                  <button 
                    className="upload-now-button"
                    onClick={() => onUploadTexture(selectedComponentTag)}
                  >
                    Upload Now
                  </button>
                </div>
              )}
            </div>
            
            <div className="applied-textures">
              <div className="section-header">
                <h4>Textures Applied to This Component</h4>
                {getComponentTextures().length > 0 && (
                  <button 
                    className="remove-all-button"
                    onClick={() => onRemoveAllTextures(selectedComponent)}
                  >
                    Remove All
                  </button>
                )}
              </div>
              
              {getComponentTextures().length > 0 ? (
                <div className="applied-textures-list">
                  {getComponentTextures().map((texture, index) => (
                    <div 
                      key={index} 
                      className={`applied-texture ${isActiveTexture(index) ? 'active' : ''}`}
                      onClick={() => onSwitchActiveTexture(selectedComponent, index)}
                    >
                      <div className="applied-texture-preview">
                        <img 
                          src={URL.createObjectURL(texture)} 
                          alt={texture.name}
                          onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                        />
                        {isActiveTexture(index) && (
                          <div className="active-indicator">
                            Active
                          </div>
                        )}
                      </div>
                      <div className="applied-texture-info">
                        <div className="applied-texture-name">{texture.name}</div>
                        {isActiveTexture(index) && (
                          <div className="texture-repeat-controls">
                            <div className="repeat-control">
                              <label>Tile X:</label>
                              <input 
                                type="number" 
                                min="0.1" 
                                max="20" 
                                step="0.1"
                                value={tileX}
                                onChange={(e) => setTileX(parseFloat(e.target.value))}
                                onBlur={handleRepeatChange}
                              />
                            </div>
                            <div className="repeat-control">
                              <label>Tile Y:</label>
                              <input 
                                type="number" 
                                min="0.1" 
                                max="20" 
                                step="0.1"
                                value={tileY}
                                onChange={(e) => setTileY(parseFloat(e.target.value))}
                                onBlur={handleRepeatChange}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <button 
                        className="remove-texture-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSpecificTexture(selectedComponent, index);
                        }}
                        aria-label="Remove texture"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-applied-textures-message">
                  <p>No textures applied to this component yet.</p>
                  <p>Click a texture above to apply it.</p>
                </div>
              )}
            </div>
            
            {getComponentTextures().length > 0 && tagCounts[selectedComponentTag] > 1 && (
              <div className="bulk-actions">
                <button 
                  className="bulk-remove-button danger-button"
                  onClick={handleRemoveFromAll}
                >
                  Remove All Textures from All {selectedComponentTag === 'wall' ? 'Walls' : 'Floors'} ({tagCounts[selectedComponentTag]})
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}