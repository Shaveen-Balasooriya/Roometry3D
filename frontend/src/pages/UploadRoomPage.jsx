import React, { useState, useRef, useEffect, useMemo } from 'react';
import RoomViewer from './components/RoomViewer';
import RoomUploadForm from './components/RoomUploadForm';
import ErrorBoundary from './components/ErrorBoundary';
import './UploadRoomPage.css';

export default function UploadRoomPage() {
  const [step, setStep] = useState(1); // Current step (1, 2, or 3)
  const [modelFile, setModelFile] = useState(null);
  const [associatedFiles, setAssociatedFiles] = useState([]);
  const [wallTextureFiles, setWallTextureFiles] = useState([]);
  const [floorTextureFiles, setFloorTextureFiles] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [componentTags, setComponentTags] = useState({});
  const [showTips, setShowTips] = useState(true);
  const [componentTextures, setComponentTextures] = useState({});
  const [activeTextureIndices, setActiveTextureIndices] = useState({});
  const [componentTextureRepeat, setComponentTextureRepeat] = useState({});
  const [activeWallTexture, setActiveWallTexture] = useState(null);
  const [activeFloorTexture, setActiveFloorTexture] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [roomCategory, setRoomCategory] = useState(''); // New state for room category
  
  const viewerRef = useRef(null);

  // Count of walls and floors tagged
  const tagCounts = useMemo(() => {
    return Object.values(componentTags).reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {});
  }, [componentTags]);
  
  // Handler for uploading model file
  const handleModelUpload = (file) => {
    setModelFile(file);
  };
  
  // Handler for uploading associated files (for GLTF models)
  const handleAssociatedFilesUpload = (files) => {
    setAssociatedFiles(files);
  };
  
  // Handler for uploading texture files
  const handleTextureUpload = (files, type) => {
    if (type === 'wall') {
      setWallTextureFiles(prev => [...prev, ...files]);
    } else if (type === 'floor') {
      setFloorTextureFiles(prev => [...prev, ...files]);
    }
  };
  
  // Handler for removing wall texture file
  const handleRemoveWallTexture = (indexToRemove) => {
    setWallTextureFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };
  
  // Handler for removing floor texture file
  const handleRemoveFloorTexture = (indexToRemove) => {
    setFloorTextureFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  // Handler for component selection in the room viewer
  const handleComponentSelect = (component) => {
    setSelectedComponent(component);
  };
  
  // Handler for tagging components (wall, floor)
  const handleTagComponent = (component, tag) => {
    if (component && tag) {
      setComponentTags(prev => ({ ...prev, [component]: tag }));
    } else if (component && !tag) {
      // Remove tag if tag is empty
      const newTags = { ...componentTags };
      delete newTags[component];
      setComponentTags(newTags);
    }
  };

  // Handler for step navigation
  const handleNextStep = () => {
    if (step < 3) {
      setStep(step + 1);
    }
  };

  const handlePreviousStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Handler for starting over (resetting the form)
  const handleStartOver = () => {
    if (window.confirm("Are you sure you want to start over? All progress will be lost.")) {
      setStep(1);
      setModelFile(null);
      setAssociatedFiles([]);
      setWallTextureFiles([]);
      setFloorTextureFiles([]);
      setSelectedComponent(null);
      setComponentTags({});
      setComponentTextures({});
      setActiveTextureIndices({});
      setComponentTextureRepeat({});
    }
  };

  // Check if we can proceed to the next step
  const canProceedToStep2 = roomName.trim() && roomDescription.trim() && roomCategory && modelFile && Object.keys(componentTags).length > 0;
  const canProceedToStep3 =
    (wallTextureFiles.length > 0 || floorTextureFiles.length > 0) && // At least one texture overall
    (!tagCounts.wall || wallTextureFiles.length > 0) &&             // If walls tagged, wall textures needed
    (!tagCounts.floor || floorTextureFiles.length > 0);            // If floors tagged, floor textures needed
  
  // Apply texture to a component
  const handleApplyTexture = (componentId, texture) => {
    // Make a copy of the current textures array for this component, or create a new one
    const currentTextures = componentTextures[componentId] ? [...componentTextures[componentId]] : [];
    
    // Add the texture to the array
    currentTextures.push(texture);
    
    // Update the component textures state
    setComponentTextures(prev => ({
      ...prev,
      [componentId]: currentTextures
    }));
    
    // Set this texture as active
    setActiveTextureIndices(prev => ({
      ...prev,
      [componentId]: currentTextures.length - 1
    }));
    
    // Default texture repeat settings
    if (!componentTextureRepeat[componentId]) {
      setComponentTextureRepeat(prev => ({
        ...prev,
        [componentId]: { x: 1, y: 1 }  // Default to 1x1 tiling
      }));
    }
    
    // Use the RoomViewer API to apply the texture
    if (window.RoomViewerAPI?.applyTexture) {
      window.RoomViewerAPI.applyTexture(
        componentId, 
        texture, 
        componentTextureRepeat[componentId] || { x: 1, y: 1 }
      );
    }
  };
  
  // Switch active texture for a component
  const handleSwitchActiveTexture = (componentId, index) => {
    setActiveTextureIndices(prev => ({
      ...prev,
      [componentId]: index
    }));
    
    // Use the RoomViewer API to apply the active texture
    if (window.RoomViewerAPI?.applyTexture && componentTextures[componentId]?.[index]) {
      window.RoomViewerAPI.applyTexture(
        componentId, 
        componentTextures[componentId][index], 
        componentTextureRepeat[componentId] || { x: 1, y: 1 }
      );
    }
  };
  
  // Remove a specific texture from a component
  const handleRemoveSpecificTexture = (componentId, index) => {
    if (!componentTextures[componentId] || index >= componentTextures[componentId].length) return;
    
    // Make a copy of the current textures array for this component
    const currentTextures = [...componentTextures[componentId]];
    
    // Remove the texture at the specified index
    currentTextures.splice(index, 1);
    
    // Update the component textures state
    setComponentTextures(prev => ({
      ...prev,
      [componentId]: currentTextures.length > 0 ? currentTextures : undefined
    }));
    
    // Update active texture index if needed
    if (activeTextureIndices[componentId] === index) {
      // If the active texture was removed, set the last texture as active or remove the active index
      if (currentTextures.length > 0) {
        setActiveTextureIndices(prev => ({
          ...prev,
          [componentId]: currentTextures.length - 1
        }));
        
        // Apply the new active texture
        if (window.RoomViewerAPI?.applyTexture) {
          window.RoomViewerAPI.applyTexture(
            componentId, 
            currentTextures[currentTextures.length - 1], 
            componentTextureRepeat[componentId] || { x: 1, y: 1 }
          );
        }
      } else {
        // No textures left, remove active index
        const newActiveIndices = { ...activeTextureIndices };
        delete newActiveIndices[componentId];
        setActiveTextureIndices(newActiveIndices);
        
        // Remove texture from the component
        if (window.RoomViewerAPI?.removeTexture) {
          window.RoomViewerAPI.removeTexture(componentId);
        }
      }
    } else if (activeTextureIndices[componentId] > index) {
      // If the active texture was after the removed one, decrement the active index
      setActiveTextureIndices(prev => ({
        ...prev,
        [componentId]: prev[componentId] - 1
      }));
    }
  };
  
  // Remove all textures from a component
  const handleRemoveAllTextures = (componentId) => {
    // Update the component textures state
    const newComponentTextures = { ...componentTextures };
    delete newComponentTextures[componentId];
    setComponentTextures(newComponentTextures);
    
    // Remove active texture index
    const newActiveIndices = { ...activeTextureIndices };
    delete newActiveIndices[componentId];
    setActiveTextureIndices(newActiveIndices);
    
    // Use the RoomViewer API to remove the texture
    if (window.RoomViewerAPI?.removeTexture) {
      window.RoomViewerAPI.removeTexture(componentId);
    }
  };
  
  // Update texture repeat settings for a component
  const handleTextureRepeatChange = (componentId, x, y) => {
    // Update the component texture repeat state
    setComponentTextureRepeat(prev => ({
      ...prev,
      [componentId]: { x, y }
    }));
    
    // Apply the updated texture with new repeat settings
    const activeIndex = activeTextureIndices[componentId];
    if (
      typeof activeIndex === 'number' && 
      componentTextures[componentId]?.[activeIndex] && 
      window.RoomViewerAPI?.applyTexture
    ) {
      window.RoomViewerAPI.applyTexture(
        componentId, 
        componentTextures[componentId][activeIndex], 
        { x, y }
      );
    }
  };
  
  // Apply texture to all components with a specific tag (wall or floor)
  const handleApplyTextureToTag = (tag, texture) => {
    if (window.RoomViewerAPI?.applyTextureToTag) {
      // For the final step, always use 1x1 tiling
      const repeatSettings = { x: 1, y: 1 };
      
      window.RoomViewerAPI.applyTextureToTag(tag, texture, repeatSettings, componentTags);
      
      // Save the active texture
      if (tag === 'wall') {
        setActiveWallTexture(texture);
      } else if (tag === 'floor') {
        setActiveFloorTexture(texture);
      }
    }
  };
  
  // Function to finish the room upload process
  const handleFinish = () => {
    // Here you would typically save the uploaded room to your backend
    // For now, just show an alert
    alert('Room upload successful!');
    // Reset the form for a new upload
    handleStartOver();
  };
  
  return (
    <div className="upload-room-page-container">
      {/* Header with step indicator */}
      <div className="upload-room-header">
        <h1>Upload Room</h1>
        
        <div className="stepper-indicator">
          <div className={`step ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <div className="step-number">{step > 1 ? '✓' : '1'}</div>
            <span className="step-label">Room Upload & Tagging</span>
          </div>
          
          <div className="step-connector"></div>
          
          <div className={`step ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <div className="step-number">{step > 2 ? '✓' : '2'}</div>
            <span className="step-label">Texture Upload</span>
          </div>
          
          <div className="step-connector"></div>
          
          <div className={`step ${step === 3 ? 'active' : ''}`}>
            <div className="step-number">3</div>
            <span className="step-label">Preview & Finalize</span>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            className="tips-toggle-button" 
            onClick={() => setShowTips(!showTips)} 
            type="button"
          >
            <span className="tips-icon">💡</span>
            {showTips ? 'Hide Tips' : 'Show Tips'}
          </button>
          
          <button 
            className="start-over-button" 
            onClick={handleStartOver} 
            type="button"
          >
            <span className="tips-icon">↺</span>
            Start Over
          </button>
        </div>
      </div>
      
      {/* Main content area */}
      <div className="upload-room-content">
        <div className="step-container">
          {/* Help tips panel */}
          {showTips && (
            <div className="help-tips-panel">
              <h3 className="tips-heading">
                <span className="tip-icon">💡</span>
                Helpful Tips for Step {step}
              </h3>
              <ul className="tips-list">
                {step === 1 && (
                  <>
                    <li>Upload a <strong>GLB or GLTF</strong> model of your room.</li>
                    <li>For GLTF models, upload the <strong>associated files</strong> (.bin files and textures).</li>
                    <li>After uploading, <strong>click on each component</strong> of your room and tag it as either a wall or floor.</li>
                    <li>Make sure to tag <strong>all walls and floors</strong> for the best texture application.</li>
                  </>
                )}
                {step === 2 && (
                  <>
                    <li>Upload <strong>texture images</strong> for your walls and floors.</li>
                    <li>Common formats like <strong>JPG, PNG, and WebP</strong> are supported.</li>
                    <li>For best results, use <strong>seamless textures</strong> that can tile well.</li>
                    <li>You need at least one texture for each component type you've tagged (wall or floor).</li>
                  </>
                )}
                {step === 3 && (
                  <>
                    <li><strong>Select different textures</strong> from the panels on the right to preview how they look.</li>
                    <li>Clicking a texture will automatically apply it to <strong>all components of that type</strong>.</li>
                    <li>You can <strong>rotate and zoom</strong> the model to see all angles.</li>
                    <li>When you're satisfied with the textures, click the <strong>Finish</strong> button.</li>
                  </>
                )}
              </ul>
            </div>
          )}
          
          {/* Step header */}
          <div className="step-header">
            <h2>Step {step}: {step === 1 ? 'Room Upload & Component Tagging' : step === 2 ? 'Texture Upload' : 'Preview & Finalize'}</h2>
            <p className="step-description">
              {step === 1 ? 'Upload your 3D room model and tag walls and floors.' : 
               step === 2 ? 'Upload texture images for walls and floors.' : 
               'Preview your room with textures and complete the upload process.'}
            </p>
          </div>
          
          {/* Step 1: Room Upload & Component Tagging */}
          {step === 1 && (
            <div className="work-area">
              {/* Room details form */}
              <div className="room-details-form">
                <h3>Room Details</h3>
                <div className="form-group">
                  <label htmlFor="room-name">Room Name</label>
                  <input 
                    id="room-name" 
                    type="text" 
                    value={roomName} 
                    onChange={(e) => setRoomName(e.target.value)} 
                    placeholder="Enter room name (e.g. Living Room, Kitchen)" 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="room-description">Room Description</label>
                  <textarea 
                    id="room-description" 
                    value={roomDescription} 
                    onChange={(e) => setRoomDescription(e.target.value)} 
                    placeholder="Enter a brief description of this room" 
                    rows="3" 
                    required 
                  ></textarea>
                </div>
                <div className="form-group">
                  <label htmlFor="room-category">Room Category</label>
                  <select 
                    id="room-category" 
                    value={roomCategory} 
                    onChange={(e) => setRoomCategory(e.target.value)} 
                    required
                  >
                    <option value="">Select a category</option>
                    <option value="living-room">Living Room</option>
                    <option value="kitchen">Kitchen</option>
                    <option value="bedroom">Bedroom</option>
                    <option value="bathroom">Bathroom</option>
                    <option value="office">Office</option>
                  </select>
                </div>
              </div>

              <div className="upload-controls-ribbon">
                <ErrorBoundary>
                  <RoomUploadForm
                    onModelUpload={handleModelUpload}
                    onAssociatedFilesUpload={handleAssociatedFilesUpload}
                    selectedComponent={selectedComponent}
                    onTagComponent={handleTagComponent}
                    componentTags={componentTags}
                    isRibbonMode={true}
                    step={1}
                    uploadStage="model"
                  />
                </ErrorBoundary>
              </div>
              
              <div className="room-viewer-section">
                <div className="viewer-header">
                  <h2>Room Preview</h2>
                </div>
                <ErrorBoundary>
                  {!modelFile ? (
                    <div className="instruction-message">
                      <div className="instruction-icon">📂</div>
                      <div className="instruction-content">
                        <p>Upload a room model to begin</p>
                        <p className="instruction-detail">Supported formats: GLB, GLTF</p>
                      </div>
                    </div>
                  ) : (
                    <RoomViewer
                      ref={viewerRef}
                      modelFile={modelFile}
                      associatedFiles={associatedFiles}
                      onComponentSelect={handleComponentSelect}
                      selectedComponent={selectedComponent}
                      textureRepeatSettings={componentTextureRepeat[selectedComponent]}
                      componentTags={componentTags} // Add this prop to show highlighting in Step 1
                    />
                  )}
                </ErrorBoundary>
                
                {modelFile && Object.keys(componentTags).length === 0 && (
                  <div className="component-status-bar">
                    <div className="status-hint prominent">
                      Click on components in the 3D model and tag them as walls or floors
                    </div>
                  </div>
                )}
                
                {modelFile && Object.keys(componentTags).length > 0 && (
                  <div className="component-status-bar">
                    <div className="status-hint">
                      Tagged {Object.keys(componentTags).length} components ({tagCounts.wall || 0} walls, {tagCounts.floor || 0} floors)
                    </div>
                  </div>
                )}
              </div>
              
              {modelFile && Object.keys(componentTags).length > 0 && (
                <div className="tagging-summary">
                  <h3>Component Tags Summary</h3>
                  <div className="tag-counts">
                    <div className="tag-count">
                      <span className="tag-label">Walls:</span>
                      <span className="tag-value">{tagCounts.wall || 0}</span>
                    </div>
                    <div className="tag-count">
                      <span className="tag-label">Floors:</span>
                      <span className="tag-value">{tagCounts.floor || 0}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Step 2: Texture Upload */}
          {step === 2 && (
            <div className="work-area">
              <div className="upload-controls-ribbon">
                <ErrorBoundary>
                  <RoomUploadForm
                    onTextureUpload={handleTextureUpload}
                    wallTextureFiles={wallTextureFiles}
                    floorTextureFiles={floorTextureFiles}
                    isRibbonMode={true}
                    step={2}
                    uploadStage="textures"
                  />
                </ErrorBoundary>
              </div>
              
              <div className="textures-container">
                <div className="textures-container">
                  <div className="texture-category">
                    <h3>Wall Textures ({wallTextureFiles.length})</h3>
                    {wallTextureFiles.length > 0 ? (
                      <div className="texture-grid">
                        {wallTextureFiles.map((texture, index) => (
                          <div 
                            key={`wall-${index}`} 
                            className="texture-card"
                          >
                            <div className="texture-preview">
                              <img 
                                src={URL.createObjectURL(texture)} 
                                alt={texture.name} 
                                onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                              />
                            </div>
                            <div className="texture-details">
                              <div className="texture-name">{texture.name}</div>
                              <div className="texture-size">{(texture.size / 1024).toFixed(1)} KB</div>
                            </div>
                            <button 
                              className="remove-texture-button" 
                              onClick={() => handleRemoveWallTexture(index)}
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : tagCounts.wall ? (
                      <div className="no-textures-message">
                        <p>No wall textures uploaded yet.</p>
                        <p>Please upload at least one wall texture.</p>
                      </div>
                    ) : (
                      <div className="no-textures-message">
                        <p>No walls tagged in your model.</p>
                        <p>Go back to Step 1 to tag walls first.</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="texture-category">
                    <h3>Floor Textures ({floorTextureFiles.length})</h3>
                    {floorTextureFiles.length > 0 ? (
                      <div className="texture-grid">
                        {floorTextureFiles.map((texture, index) => (
                          <div 
                            key={`floor-${index}`} 
                            className="texture-card"
                          >
                            <div className="texture-preview">
                              <img 
                                src={URL.createObjectURL(texture)} 
                                alt={texture.name} 
                                onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                              />
                            </div>
                            <div className="texture-details">
                              <div className="texture-name">{texture.name}</div>
                              <div className="texture-size">{(texture.size / 1024).toFixed(1)} KB</div>
                            </div>
                            <button 
                              className="remove-texture-button" 
                              onClick={() => handleRemoveFloorTexture(index)}
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : tagCounts.floor ? (
                      <div className="no-textures-message">
                        <p>No floor textures uploaded yet.</p>
                        <p>Please upload at least one floor texture.</p>
                      </div>
                    ) : (
                      <div className="no-textures-message">
                        <p>No floors tagged in your model.</p>
                        <p>Go back to Step 1 to tag floors first.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Step 3: Preview & Finalize */}
          {step === 3 && (
            <div className="preview-layout">
              <div className="preview-room-viewer-section">
                <div className="viewer-header">
                  <h2>Room Preview with Textures</h2>
                </div>
                <ErrorBoundary>
                  <RoomViewer
                    ref={viewerRef}
                    modelFile={modelFile}
                    associatedFiles={associatedFiles}
                    componentTags={componentTags}
                    allowComponentSelection={false} // Disable component selection in step 3
                    showTagHighlighting={false} // Disable tag highlighting in step 3
                    showTagLegend={false} // Disable tag legend in step 3
                  />
                </ErrorBoundary>
                <div className="component-status-bar">
                  <div className="status-hint">
                    Select textures from the panels on the right to apply them to all walls or floors
                  </div>
                </div>
              </div>
              
              <div className="preview-texture-panels">
                {tagCounts.wall > 0 && (
                  <div className="preview-texture-panel">
                    <h3 className="panel-heading">Wall Textures</h3>
                    {wallTextureFiles.length > 0 ? (
                      <div className="preview-textures-grid">
                        {wallTextureFiles.map((texture, index) => (
                          <div 
                            key={`preview-wall-${index}`} 
                            className={`preview-texture-card ${texture === activeWallTexture ? 'active' : ''}`}
                            onClick={() => handleApplyTextureToTag('wall', texture)}
                          >
                            <div className="preview-texture-image">
                              <img src={URL.createObjectURL(texture)} alt={texture.name} />
                              {texture === activeWallTexture && (
                                <div className="active-texture-indicator">Active</div>
                              )}
                            </div>
                            <div className="preview-texture-name">{texture.name}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-preview-textures">
                        <p>No wall textures available.</p>
                        <p>Go back to Step 2 to upload textures.</p>
                      </div>
                    )}
                  </div>
                )}
                
                {tagCounts.floor > 0 && (
                  <div className="preview-texture-panel">
                    <h3 className="panel-heading">Floor Textures</h3>
                    {floorTextureFiles.length > 0 ? (
                      <div className="preview-textures-grid">
                        {floorTextureFiles.map((texture, index) => (
                          <div 
                            key={`preview-floor-${index}`} 
                            className={`preview-texture-card ${texture === activeFloorTexture ? 'active' : ''}`}
                            onClick={() => handleApplyTextureToTag('floor', texture)}
                          >
                            <div className="preview-texture-image">
                              <img src={URL.createObjectURL(texture)} alt={texture.name} />
                              {texture === activeFloorTexture && (
                                <div className="active-texture-indicator">Active</div>
                              )}
                            </div>
                            <div className="preview-texture-name">{texture.name}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-preview-textures">
                        <p>No floor textures available.</p>
                        <p>Go back to Step 2 to upload textures.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Step navigation */}
          <div className="step-navigation">
            {step > 1 && (
              <button 
                className="previous-step-button" 
                onClick={handlePreviousStep}
                type="button"
              >
                ← Previous Step
              </button>
            )}
            
            <div className="step-spacer"></div>
            
            {step === 1 && (
              <>
                <p className="step-requirement-hint">
                  {!modelFile ? 'Upload a room model to continue' : 
                   !Object.keys(componentTags).length ? 'Tag at least one component to continue' : ''}
                </p>
                <button 
                  className="next-step-button" 
                  onClick={handleNextStep}
                  disabled={!canProceedToStep2}
                  type="button"
                >
                  Next Step →
                </button>
              </>
            )}
            
            {step === 2 && (
              <>
                <p className="step-requirement-hint">
                  {(wallTextureFiles.length === 0 && floorTextureFiles.length === 0) ? 
                    'Upload at least one texture to continue' : 
                   (tagCounts.wall && wallTextureFiles.length === 0) ?
                    'Upload at least one wall texture to continue' :
                   (tagCounts.floor && floorTextureFiles.length === 0) ?
                    'Upload at least one floor texture to continue' : ''}
                </p>
                <button 
                  className="next-step-button" 
                  onClick={handleNextStep}
                  disabled={!canProceedToStep3}
                  type="button"
                >
                  Next Step →
                </button>
              </>
            )}
            
            {step === 3 && (
              <>
                <p className="step-requirement-hint">
                  {!activeWallTexture && !activeFloorTexture ? 
                    'Select at least one texture to apply' : ''}
                </p>
                <button 
                  className="finish-button" 
                  onClick={handleFinish}
                  disabled={!activeWallTexture && !activeFloorTexture}
                  type="button"
                >
                  Finish Room Upload ✓
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
