import React, { useState, useEffect, useRef, useCallback } from 'react';
import './RoomUploadForm.css'; // We will create this CSS file next

const MAX_MODEL_SIZE_MB = 250;
const MAX_MODEL_SIZE_BYTES = MAX_MODEL_SIZE_MB * 1024 * 1024;

export default function RoomUploadForm({
  onModelUpload,
  onTextureUpload,
  onAssociatedFilesUpload,
  selectedComponent,
  onTagComponent,
  componentTags = {},
  isRibbonMode = false,
  uploadStage,
  step = 1 // Current step in the workflow (1, 2, or 3)
}) {
  const [modelFile, setModelFile] = useState(null);
  const [modelError, setModelError] = useState('');
  const [wallTextureFiles, setWallTextureFiles] = useState([]);
  const [floorTextureFiles, setFloorTextureFiles] = useState([]);
  const [textureError, setTextureError] = useState('');
  const [showTextureList, setShowTextureList] = useState(false);

  // State for handling associated files for GLTF
  const [associatedFiles, setAssociatedFiles] = useState([]);
  const [isGltfFormat, setIsGltfFormat] = useState(false);

  const modelInputRef = useRef(null);
  const wallTextureInputRef = useRef(null);
  const floorTextureInputRef = useRef(null);
  const associatedFilesInputRef = useRef(null);

  // Enhanced validation for GLTF uploads
  useEffect(() => {
    if (isGltfFormat && modelFile && associatedFiles.length === 0) {
      setModelError('⚠️ This GLTF file may require associated .bin files. Please upload them below.');
    } else if (isGltfFormat && modelFile && associatedFiles.length > 0) {
      setModelError('');
    }
  }, [isGltfFormat, modelFile, associatedFiles.length]);

  // Modified model file handler that provides better guidance
  const handleModelFileChange = useCallback((event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Reset previous state
    setModelError('');
    setAssociatedFiles([]);

    // Check file type
    if (file.name.toLowerCase().endsWith('.gltf')) {
      setIsGltfFormat(true);
      setModelFile(file);
      setModelError('⚠️ GLTF files require associated .bin files. Please upload them below.');
      // Don't upload to viewer yet - wait for associated files
    } else if (file.name.toLowerCase().endsWith('.glb')) {
      setIsGltfFormat(false);
      setModelFile(file);
      // GLB is self-contained, so upload immediately
      onModelUpload(file);
    } else {
      setModelError('Invalid file type. Please upload a .glb or .gltf file.');
      setModelFile(null);
      onModelUpload(null);
      return;
    }

    // Check file size
    if (file.size > MAX_MODEL_SIZE_BYTES) {
      setModelError(`File is too large. Maximum size is ${MAX_MODEL_SIZE_MB}MB.`);
      setModelFile(null);
      onModelUpload(null);
    }
  }, [onModelUpload]);

  // Improved associated files handler with more validation
  const handleAssociatedFilesChange = useCallback((event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    // Filter for .bin files and other supported formats
    const binFiles = files.filter(file =>
      file.name.toLowerCase().endsWith('.bin'));
    const textureFiles = files.filter(file =>
      /\.(jpe?g|png|webp|bmp|tga|dds)$/i.test(file.name));
    const otherFiles = files.filter(file =>
      !binFiles.includes(file) && !textureFiles.includes(file));

    const newAssociatedFiles = [...associatedFiles, ...binFiles, ...textureFiles, ...otherFiles];
    setAssociatedFiles(newAssociatedFiles);

    // Notify parent component of all associated files
    if (onAssociatedFilesUpload) {
      onAssociatedFilesUpload(newAssociatedFiles);
    }

    // Now that we have associated files, we can upload the GLTF model
    if (isGltfFormat && modelFile) {
      const hasBinFiles = binFiles.length > 0 || associatedFiles.some(f => f.name.toLowerCase().endsWith('.bin'));
      if (hasBinFiles) {
        onModelUpload(modelFile);
        setModelError(''); // Clear any error messages
      } else if (newAssociatedFiles.length > 0) {
        onModelUpload(modelFile);
        setModelError('⚠️ No .bin files detected. Your model may not render correctly.');
      }
    }
  }, [isGltfFormat, modelFile, onModelUpload, onAssociatedFilesUpload, associatedFiles]);

  // Handle wall texture file uploads (Step 2)
  const handleWallTextureFilesChange = useCallback((event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length !== files.length) {
        setTextureError('Invalid file type. Please upload image files only for textures.');
      } else {
        setTextureError('');
      }
      setWallTextureFiles(prev => [...prev, ...imageFiles]);
      // Pass the type 'wall' to indicate these are wall textures
      onTextureUpload(imageFiles, 'wall');
    }
  }, [onTextureUpload]);

  // Handle floor texture file uploads (Step 2)
  const handleFloorTextureFilesChange = useCallback((event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length !== files.length) {
        setTextureError('Invalid file type. Please upload image files only for textures.');
      } else {
        setTextureError('');
      }
      setFloorTextureFiles(prev => [...prev, ...imageFiles]);
      // Pass the type 'floor' to indicate these are floor textures
      onTextureUpload(imageFiles, 'floor');
    }
  }, [onTextureUpload]);

  // Toggle texture list visibility
  const toggleTextureList = () => setShowTextureList(prev => !prev);
  
  // Trigger file input clicks
  const triggerModelFileInput = () => modelInputRef.current?.click();
  const triggerWallTextureFileInput = () => wallTextureInputRef.current?.click();
  const triggerFloorTextureFileInput = () => floorTextureInputRef.current?.click();
  const triggerAssociatedFilesInput = () => associatedFilesInputRef.current?.click();

  // Determine if buttons should be disabled based on the current state
  const isStepTwoDisabled = !modelFile || modelError;

  // Handle component tagging
  const handleComponentTagChange = useCallback((event) => {
    const tag = event.target.value;
    if (onTagComponent && selectedComponent) {
      onTagComponent(selectedComponent, tag);
    }
  }, [onTagComponent, selectedComponent]);

  // Render the form for Step 1: Room Upload & Component Tagging
  const renderStep1Form = () => {
    return (
      <>
        {/* Model Upload Section */}
        <div className={`ribbon-section model-upload-section ${uploadStage === 'initial' ? 'active-step' : 'completed-step'}`}>
          <div className="section-header">
            <span className="section-icon">📦</span>
            <label htmlFor="model-upload-input">3D Room Model</label>
          </div>
          <button 
            type="button" 
            onClick={triggerModelFileInput} 
            className={`file-input-button ${modelFile ? 'file-selected' : ''}`}
            aria-label="Upload 3D room model"
          >
            <span className="button-icon">📂</span>
            {modelFile ? modelFile.name.slice(0, 15) + (modelFile.name.length > 15 ? '...' : '') : 'Choose Model (.glb/.gltf)'}
          </button>
          <input
            id="model-upload-input"
            type="file"
            ref={modelInputRef}
            accept=".glb,.gltf"
            onChange={handleModelFileChange}
            aria-describedby="model-error-message"
            style={{ display: 'none' }}
          />
          {modelError && <div id="model-error-message" className="error-message" role="alert">{modelError}</div>}
          
          {/* Add associated files upload option for .gltf files */}
          {isGltfFormat && (
            <div className="associated-files-section">
              <button 
                type="button" 
                onClick={triggerAssociatedFilesInput} 
                className={`file-input-button secondary-button ${associatedFiles.length > 0 ? 'files-selected' : ''}`}
                aria-label="Upload associated files for GLTF model"
              >
                <span className="button-icon">🔗</span>
                {associatedFiles.length > 0 ? 
                  `${associatedFiles.length} file(s) added` : 
                  'Add required .bin files'}
              </button>
              <input
                id="associated-files-input"
                type="file"
                ref={associatedFilesInputRef}
                multiple
                onChange={handleAssociatedFilesChange}
                style={{ display: 'none' }}
              />
              {associatedFiles.length > 0 && (
                <span className="file-info small">
                  <span className="file-count-badge">{associatedFiles.length}</span> file(s) added
                </span>
              )}
            </div>
          )}
        </div>

        {/* Component Tagging Section - only visible when a component is selected */}
        {selectedComponent && (
          <div className="ribbon-section component-tagging-section">
            <div className="section-header">
              <span className="section-icon">🏷️</span>
              <label htmlFor="component-tag-select">Tag Component</label>
            </div>
            <div className="component-tagging-content">
              <div className="selected-component">
                <div className="component-name">{typeof selectedComponent === 'string' ? selectedComponent : 'Component'}</div>
              </div>
              <select 
                id="component-tag-select" 
                value={componentTags[selectedComponent] || ''}
                onChange={handleComponentTagChange}
                className="tag-select"
              >
                <option value="">-- Select Tag --</option>
                <option value="wall">Wall</option>
                <option value="floor">Floor</option>
              </select>
            </div>
          </div>
        )}
      </>
    );
  };

  // Render the form for Step 2: Texture Upload
  const renderStep2Form = () => {
    return (
      <>
        {/* Wall Textures Upload Section */}
        <div className="ribbon-section texture-upload-section wall-texture-section">
          <div className="section-header">
            <span className="section-icon">🧱</span>
            <label htmlFor="wall-texture-upload-input">Wall Textures</label>
          </div>
          <button 
            type="button" 
            onClick={triggerWallTextureFileInput} 
            className={`file-input-button ${wallTextureFiles.length > 0 ? 'files-selected' : ''}`}
            aria-label="Upload wall texture files"
          >
            <span className="button-icon">📤</span>
            {wallTextureFiles.length > 0 ? `${wallTextureFiles.length} wall texture(s)` : 'Upload Wall Textures'}
          </button>
          <input
            id="wall-texture-upload-input"
            type="file"
            ref={wallTextureInputRef}
            multiple
            accept="image/*"
            onChange={handleWallTextureFilesChange}
            aria-describedby="texture-error-message"
            style={{ display: 'none' }}
          />
          
          {wallTextureFiles.length > 0 && (
            <div className="texture-badge wall-texture-badge">
              <span className="texture-count">{wallTextureFiles.length}</span> Wall texture(s)
            </div>
          )}
        </div>
        
        {/* Floor Textures Upload Section */}
        <div className="ribbon-section texture-upload-section floor-texture-section">
          <div className="section-header">
            <span className="section-icon">🔲</span>
            <label htmlFor="floor-texture-upload-input">Floor Textures</label>
          </div>
          <button 
            type="button" 
            onClick={triggerFloorTextureFileInput} 
            className={`file-input-button ${floorTextureFiles.length > 0 ? 'files-selected' : ''}`}
            aria-label="Upload floor texture files"
          >
            <span className="button-icon">📤</span>
            {floorTextureFiles.length > 0 ? `${floorTextureFiles.length} floor texture(s)` : 'Upload Floor Textures'}
          </button>
          <input
            id="floor-texture-upload-input"
            type="file"
            ref={floorTextureInputRef}
            multiple
            accept="image/*"
            onChange={handleFloorTextureFilesChange}
            aria-describedby="texture-error-message"
            style={{ display: 'none' }}
          />
          
          {floorTextureFiles.length > 0 && (
            <div className="texture-badge floor-texture-badge">
              <span className="texture-count">{floorTextureFiles.length}</span> Floor texture(s)
            </div>
          )}
        </div>
        
        {/* Error message for texture uploads */}
        {textureError && <div id="texture-error-message" className="error-message" role="alert">{textureError}</div>}
      </>
    );
  };

  // Render the form based on current step
  if (isRibbonMode) {
    return (
      <form className="room-upload-form ribbon-mode" onSubmit={(e) => e.preventDefault()}>
        {step === 1 && renderStep1Form()}
        {step === 2 && renderStep2Form()}
        {step === 3 && (
          <div className="ribbon-section preview-section">
            <div className="section-header">
              <span className="section-icon">👁️</span>
              <span>Preview Mode</span>
            </div>
            <div className="preview-info">
              Adjust textures and tiling in the preview area below
            </div>
          </div>
        )}
      </form>
    );
  }

  // Original vertical layout if not in ribbon mode
  return (
    <form className="room-upload-form" onSubmit={(e) => e.preventDefault()}>
      {step === 1 && (
        <>
          <div className="form-group">
            <label htmlFor="model-upload-input">3D Room Model (.glb, .gltf)</label>
            <button 
              type="button" 
              onClick={triggerModelFileInput} 
              className={`file-input-button ${modelFile ? 'file-selected' : ''}`} 
              aria-label="Upload 3D room model"
            >
              <span className="button-icon">📂</span>
              {modelFile ? modelFile.name : 'Choose Model File'}
            </button>
            <input
              id="model-upload-input"
              type="file"
              ref={modelInputRef}
              accept=".glb,.gltf"
              onChange={handleModelFileChange}
              aria-describedby="model-error-message"
              style={{ display: 'none' }}
            />
            {modelError && <div id="model-error-message" className="error-message" role="alert">{modelError}</div>}
            {modelFile && (
              <div className="file-info">
                <span className="file-name">{modelFile.name}</span>
                <span className="file-size">({(modelFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
            )}
            
            {/* Add associated files upload for vertical layout as well */}
            {isGltfFormat && modelFile && (
              <div className="associated-files-section">
                <label htmlFor="associated-files-input">Associated Files (.bin, textures)</label>
                <button 
                  type="button" 
                  onClick={triggerAssociatedFilesInput} 
                  className={`file-input-button secondary-button ${associatedFiles.length > 0 ? 'files-selected' : ''}`}
                >
                  <span className="button-icon">🔗</span>
                  {associatedFiles.length > 0 ? 
                    `${associatedFiles.length} associated file(s) added` : 
                    'Upload .bin & texture files'}
                </button>
                <input
                  id="associated-files-input"
                  type="file"
                  ref={associatedFilesInputRef}
                  multiple
                  onChange={handleAssociatedFilesChange}
                  style={{ display: 'none' }}
                />
                <p className="help-text">
                  For .gltf files, please upload the associated .bin files and textures that are referenced in the .gltf file.
                  Alternatively, convert your model to .glb format which contains all resources in a single file.
                </p>
                {associatedFiles.length > 0 && (
                  <ul className="texture-list">
                    {associatedFiles.map((file, index) => (
                      <li key={index}>{file.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {selectedComponent && (
            <div className="form-group">
              <label htmlFor="component-tag-select">Tag Selected Component</label>
              <div className="selected-component-info">
                <span className="label">Selected:</span>
                <span className="value">{typeof selectedComponent === 'string' ? selectedComponent : 'Component'}</span>
              </div>
              <select 
                id="component-tag-select" 
                value={componentTags[selectedComponent] || ''}
                onChange={handleComponentTagChange}
                className="tag-select-vertical"
              >
                <option value="">-- Select Tag --</option>
                <option value="wall">Wall</option>
                <option value="floor">Floor</option>
              </select>
              <p className="help-text">
                Tag each component of your room model as either a wall or floor to enable texture application in the next steps.
              </p>
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <div className="form-group">
            <label htmlFor="wall-texture-upload-input" className="wall-texture-label">Wall Texture Files</label>
            <button 
              type="button" 
              onClick={triggerWallTextureFileInput} 
              className={`file-input-button wall-texture-button ${wallTextureFiles.length > 0 ? 'files-selected' : ''}`} 
              aria-label="Upload wall texture files"
            >
              <span className="button-icon">🧱</span>
              {wallTextureFiles.length > 0 ? `${wallTextureFiles.length} wall texture(s) selected` : 'Choose Wall Texture Files'}
            </button>
            <input
              id="wall-texture-upload-input"
              type="file"
              ref={wallTextureInputRef}
              multiple
              accept="image/*"
              onChange={handleWallTextureFilesChange}
              aria-describedby="texture-error-message"
              style={{ display: 'none' }}
            />
            {wallTextureFiles.length > 0 && (
              <ul className="texture-list wall-textures" aria-label="Selected wall textures">
                {wallTextureFiles.map((file, index) => (
                  <li key={index}>{file.name}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="floor-texture-upload-input" className="floor-texture-label">Floor Texture Files</label>
            <button 
              type="button" 
              onClick={triggerFloorTextureFileInput} 
              className={`file-input-button floor-texture-button ${floorTextureFiles.length > 0 ? 'files-selected' : ''}`} 
              aria-label="Upload floor texture files"
            >
              <span className="button-icon">🔲</span>
              {floorTextureFiles.length > 0 ? `${floorTextureFiles.length} floor texture(s) selected` : 'Choose Floor Texture Files'}
            </button>
            <input
              id="floor-texture-upload-input"
              type="file"
              ref={floorTextureInputRef}
              multiple
              accept="image/*"
              onChange={handleFloorTextureFilesChange}
              aria-describedby="texture-error-message"
              style={{ display: 'none' }}
            />
            {floorTextureFiles.length > 0 && (
              <ul className="texture-list floor-textures" aria-label="Selected floor textures">
                {floorTextureFiles.map((file, index) => (
                  <li key={index}>{file.name}</li>
                ))}
              </ul>
            )}
          </div>
          
          {textureError && <div id="texture-error-message" className="error-message" role="alert">{textureError}</div>}
        </>
      )}

      {step === 3 && (
        <div className="form-group">
          <h3>Preview & Adjust Textures</h3>
          <p className="help-text">
            Use the preview panel below to apply textures to your room components and adjust tiling settings.
          </p>
        </div>
      )}
      
      {/* Help tip */}
      {step === 1 && modelFile && !selectedComponent && (
        <div className="help-tip">
          <span className="tip-icon">💡</span> 
          <span className="tip-text">Click on any part of the 3D model to select it</span>
        </div>
      )}
    </form>
  );
}
