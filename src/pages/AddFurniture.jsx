import React, { useState, useEffect, useRef } from 'react';
import { createFurniture } from '../services/furnitureService';
import { ModelViewer } from '../utils/threeJsUtils';
import Loading from '../components/common/Loading';
import ProgressBar from '../components/common/ProgressBar';
import '../styles/furniture.css';

// Icons as SVG components
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const DimensionsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"></path>
    <path d="M18 3l-6 6-6-6"></path>
    <path d="M6 15l6-6 6 6"></path>
  </svg>
);

const CubeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
    <line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
);

const TextureIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
    <circle cx="8.5" cy="8.5" r="1.5"></circle>
    <polyline points="21 15 16 10 5 21"></polyline>
  </svg>
);

const FileIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
    <polyline points="13 2 13 9 20 9"></polyline>
  </svg>
);

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
    <polyline points="22 4 12 14.01 9 11.01"></polyline>
  </svg>
);

const AddFurniture = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    quantity: '1',
    width: '',
    length: '',
    height: '',
  });
  
  const [files, setFiles] = useState({
    model: null,
    thumbnail: null,
    textures: []
  });
  
  const [textureNames, setTextureNames] = useState([]);
  const [activeTexture, setActiveTexture] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  
  const modelViewerRef = useRef(null);
  const modelViewerInstance = useRef(null);
  
  // Initialize Three.js model viewer
  useEffect(() => {
    if (modelViewerRef.current && !modelViewerInstance.current) {
      modelViewerInstance.current = new ModelViewer(modelViewerRef.current);
    }
    
    return () => {
      if (modelViewerInstance.current) {
        modelViewerInstance.current.dispose();
        modelViewerInstance.current = null;
      }
    };
  }, []);
  
  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error when user edits a field
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    // If dimensions are changed and we have a model loaded, update its scale
    if (['width', 'length', 'height'].includes(name) && files.model && modelViewerInstance.current) {
      const dimensions = {
        width: name === 'width' ? parseFloat(value) || 0.1 : parseFloat(formData.width) || 0.1,
        length: name === 'length' ? parseFloat(value) || 0.1 : parseFloat(formData.length) || 0.1,
        height: name === 'height' ? parseFloat(value) || 0.1 : parseFloat(formData.height) || 0.1
      };
      
      modelViewerInstance.current.loadModel(files.model, dimensions);
    }
  };
  
  // Handle model file upload
  const handleModelUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFiles(prev => ({ ...prev, model: file }));
      
      // Clear model validation error
      if (validationErrors.model) {
        setValidationErrors(prev => ({...prev, model: ''}));
      }
      
      if (modelViewerInstance.current) {
        const dimensions = {
          width: parseFloat(formData.width) || 0.1,
          length: parseFloat(formData.length) || 0.1,
          height: parseFloat(formData.height) || 0.1
        };
        
        modelViewerInstance.current.loadModel(file, dimensions);
      }
    }
  };
  
  // Handle drag events for file uploads
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e, fileType) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    
    if (fileType === 'model' && droppedFiles[0]) {
      // Handle model file
      const file = droppedFiles[0];
      if (file.name.toLowerCase().endsWith('.obj')) {
        setFiles(prev => ({ ...prev, model: file }));
        
        if (validationErrors.model) {
          setValidationErrors(prev => ({...prev, model: ''}));
        }
        
        if (modelViewerInstance.current) {
          const dimensions = {
            width: parseFloat(formData.width) || 0.1,
            length: parseFloat(formData.length) || 0.1,
            height: parseFloat(formData.height) || 0.1
          };
          
          modelViewerInstance.current.loadModel(file, dimensions);
        }
      }
    } else if (fileType === 'thumbnail' && droppedFiles[0]) {
      // Handle thumbnail
      const file = droppedFiles[0];
      if (file.type.startsWith('image/')) {
        setFiles(prev => ({ ...prev, thumbnail: file }));
      }
    } else if (fileType === 'textures') {
      // Handle texture files
      const imageFiles = droppedFiles.filter(file => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        handleTextureFiles(imageFiles);
      }
    }
  };
  
  // Handle thumbnail upload
  const handleThumbnailUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFiles(prev => ({ ...prev, thumbnail: file }));
    }
  };
  
  // Handle texture files upload
  const handleTextureUpload = (e) => {
    const uploadedTextures = Array.from(e.target.files);
    if (uploadedTextures.length > 0) {
      handleTextureFiles(uploadedTextures);
    }
  };
  
  const handleTextureFiles = (textureFiles) => {
    setFiles(prev => ({
      ...prev,
      textures: [...prev.textures, ...textureFiles]
    }));
    
    // Add texture names and load into viewer
    const newTextureNames = textureFiles.map(file => {
      const textureName = file.name.split('.')[0];
      
      if (modelViewerInstance.current) {
        modelViewerInstance.current.loadTexture(textureName, file);
      }
      
      return textureName;
    });
    
    setTextureNames(prev => [...prev, ...newTextureNames]);
    
    // Set the first texture as active if none is active yet
    if (!activeTexture && newTextureNames.length > 0) {
      setActiveTexture(newTextureNames[0]);
    }
  };
  
  // Change the active texture
  const handleTextureChange = (textureName) => {
    setActiveTexture(textureName);
    if (modelViewerInstance.current) {
      modelViewerInstance.current.applyTexture(textureName);
    }
  };
  
  // Remove a texture
  const handleRemoveTexture = (index) => {
    const updatedTextures = [...files.textures];
    updatedTextures.splice(index, 1);
    setFiles(prev => ({
      ...prev,
      textures: updatedTextures
    }));
    
    const updatedTextureNames = [...textureNames];
    const removedTextureName = updatedTextureNames.splice(index, 1)[0];
    setTextureNames(updatedTextureNames);
    
    // If the active texture was removed, set a new active texture
    if (activeTexture === removedTextureName && updatedTextureNames.length > 0) {
      setActiveTexture(updatedTextureNames[0]);
      if (modelViewerInstance.current) {
        modelViewerInstance.current.applyTexture(updatedTextureNames[0]);
      }
    }
  };
  
  // Validate the form
  const validateForm = () => {
    const errors = {};
    
    // Required fields
    if (!formData.name.trim()) errors.name = 'Name is required';
    if (!formData.description.trim()) errors.description = 'Description is required';
    if (!formData.price) errors.price = 'Price is required';
    if (parseFloat(formData.price) <= 0) errors.price = 'Price must be greater than zero';
    if (!formData.quantity) errors.quantity = 'Quantity is required';
    if (parseInt(formData.quantity) < 0) errors.quantity = 'Quantity cannot be negative';
    
    // Dimensions
    if (!formData.width) errors.width = 'Width is required';
    if (parseFloat(formData.width) <= 0) errors.width = 'Width must be greater than zero';
    if (!formData.length) errors.length = 'Length is required';
    if (parseFloat(formData.length) <= 0) errors.length = 'Length must be greater than zero';
    if (!formData.height) errors.height = 'Height is required';
    if (parseFloat(formData.height) <= 0) errors.height = 'Height must be greater than zero';
    
    // Files
    if (!files.model) errors.model = '3D model file is required';
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validate form
    if (!validateForm()) {
      setError('Please fix the errors in the form');
      return;
    }
    
    setLoading(true);
    setUploadProgress(0);
    
    try {
      // Create FormData object for file upload
      const formDataObj = new FormData();
      
      // Add form fields
      Object.entries(formData).forEach(([key, value]) => {
        formDataObj.append(key, value);
      });
      
      // Add files
      formDataObj.append('model', files.model);
      if (files.thumbnail) {
        formDataObj.append('thumbnail', files.thumbnail);
      }
      
      files.textures.forEach(texture => {
        formDataObj.append('textures', texture);
      });
      
      // Submit the form with progress tracking
      await createFurniture(formDataObj, (progress) => {
        setUploadProgress(progress);
      });
      
      setSuccess('Furniture added successfully!');
      
      // Reset form after successful submission
      setFormData({
        name: '',
        description: '',
        price: '',
        quantity: '1',
        width: '',
        length: '',
        height: '',
      });
      
      setFiles({
        model: null,
        thumbnail: null,
        textures: []
      });
      
      setTextureNames([]);
      setActiveTexture('');
      setUploadProgress(0);
      
      // Reset the file inputs
      document.getElementById('model').value = '';
      document.getElementById('thumbnail').value = '';
      document.getElementById('textures').value = '';
      
      // Clear the model viewer
      if (modelViewerInstance.current) {
        if (modelViewerInstance.current.model) {
          modelViewerInstance.current.scene.remove(modelViewerInstance.current.model);
          modelViewerInstance.current.model = null;
        }
        modelViewerInstance.current.textures = {};
        modelViewerInstance.current.currentTexture = null;
      }
      
    } catch (err) {
      setError(err.message || 'An error occurred while adding the furniture');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <header className="header">
        <h1>Roometry3D</h1>
      </header>
      
      <div className="furniture-container">
        <h2 className="page-title">Add New Furniture</h2>
        
        {error && (
          <div className="message error-message">
            <AlertIcon />
            {error}
          </div>
        )}
        
        {success && (
          <div className="message success-message">
            <CheckIcon />
            {success}
          </div>
        )}
        
        <div className="furniture-form-container">
          <form className="furniture-form" onSubmit={handleSubmit}>
            <h3 className="section-title">Basic Information</h3>
            
            <div className="form-group">
              <label htmlFor="name">Furniture Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter furniture name"
                className={validationErrors.name ? 'input-error' : ''}
              />
              {validationErrors.name && (
                <div className="error-text">{validationErrors.name}</div>
              )}
            </div>
            
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter a detailed description"
                className={validationErrors.description ? 'input-error' : ''}
              ></textarea>
              {validationErrors.description && (
                <div className="error-text">{validationErrors.description}</div>
              )}
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="price">Price ($)</label>
                <input
                  type="number"
                  id="price"
                  name="price"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  className={validationErrors.price ? 'input-error' : ''}
                />
                {validationErrors.price && (
                  <div className="error-text">{validationErrors.price}</div>
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="quantity">Quantity in Stock</label>
                <input
                  type="number"
                  id="quantity"
                  name="quantity"
                  min="0"
                  step="1"
                  value={formData.quantity}
                  onChange={handleChange}
                  placeholder="1"
                  className={validationErrors.quantity ? 'input-error' : ''}
                />
                {validationErrors.quantity && (
                  <div className="error-text">{validationErrors.quantity}</div>
                )}
              </div>
            </div>
            
            <div className="dimensions-section">
              <div className="dimensions-title">
                <DimensionsIcon />
                Dimensions (meters)
              </div>
              
              <div className="form-row three-columns">
                <div className="form-group">
                  <label htmlFor="width">Width</label>
                  <input
                    type="number"
                    id="width"
                    name="width"
                    min="0.01"
                    step="0.01"
                    value={formData.width}
                    onChange={handleChange}
                    placeholder="0.00"
                    className={validationErrors.width ? 'input-error' : ''}
                  />
                  {validationErrors.width && (
                    <div className="error-text">{validationErrors.width}</div>
                  )}
                </div>
                
                <div className="form-group">
                  <label htmlFor="length">Length</label>
                  <input
                    type="number"
                    id="length"
                    name="length"
                    min="0.01"
                    step="0.01"
                    value={formData.length}
                    onChange={handleChange}
                    placeholder="0.00"
                    className={validationErrors.length ? 'input-error' : ''}
                  />
                  {validationErrors.length && (
                    <div className="error-text">{validationErrors.length}</div>
                  )}
                </div>
                
                <div className="form-group">
                  <label htmlFor="height">Height</label>
                  <input
                    type="number"
                    id="height"
                    name="height"
                    min="0.01"
                    step="0.01"
                    value={formData.height}
                    onChange={handleChange}
                    placeholder="0.00"
                    className={validationErrors.height ? 'input-error' : ''}
                  />
                  {validationErrors.height && (
                    <div className="error-text">{validationErrors.height}</div>
                  )}
                </div>
              </div>
            </div>
            
            <h3 className="section-title">3D Model & Textures</h3>
            
            <div className="file-input-container">
              <label 
                htmlFor="model" 
                className={`file-input-label ${isDragging ? 'dragging' : ''} ${validationErrors.model ? 'file-input-error' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'model')}
              >
                <CubeIcon className="icon" />
                <span className="label-text">Upload 3D Model</span>
                <span className="label-help">Drag & drop or click to browse (.obj files)</span>
              </label>
              <input
                type="file"
                id="model"
                name="model"
                onChange={handleModelUpload}
                accept=".obj"
                className="file-input"
              />
              {files.model && (
                <div className="file-info">
                  <FileIcon />
                  <span className="file-name">{files.model.name}</span>
                  <span>{(files.model.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              )}
              {validationErrors.model && (
                <div className="error-text">{validationErrors.model}</div>
              )}
            </div>
            
            <div className="file-input-container">
              <label 
                htmlFor="thumbnail" 
                className={`file-input-label ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'thumbnail')}
              >
                <TextureIcon className="icon" />
                <span className="label-text">Upload Thumbnail (optional)</span>
                <span className="label-help">Image to represent the furniture</span>
              </label>
              <input
                type="file"
                id="thumbnail"
                name="thumbnail"
                onChange={handleThumbnailUpload}
                accept="image/*"
                className="file-input"
              />
              {files.thumbnail && (
                <div className="file-info">
                  <FileIcon />
                  <span className="file-name">{files.thumbnail.name}</span>
                  <span>{(files.thumbnail.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              )}
            </div>
            
            <div className="file-input-container">
              <label 
                htmlFor="textures" 
                className={`file-input-label ${isDragging ? 'dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'textures')}
              >
                <TextureIcon className="icon" />
                <span className="label-text">Upload Textures</span>
                <span className="label-help">Select multiple texture files</span>
              </label>
              <input
                type="file"
                id="textures"
                name="textures"
                onChange={handleTextureUpload}
                accept="image/*"
                multiple
                className="file-input"
              />
            </div>
            
            {files.textures.length > 0 && (
              <div className="textures-list">
                <h4>Uploaded Textures</h4>
                <ul>
                  {files.textures.map((texture, index) => (
                    <li key={index}>
                      <div className="texture-filename">
                        <FileIcon />
                        {texture.name}
                      </div>
                      <button 
                        type="button"
                        onClick={() => handleRemoveTexture(index)}
                        className="btn btn-small btn-danger"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="actions">
              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="loading-inline">
                      <div className="loading-spinner spinner-small"></div>
                      <span>Adding...</span>
                    </div>
                  </>
                ) : (
                  <>
                    <UploadIcon />
                    Add Furniture
                  </>
                )}
              </button>
            </div>
            
            {loading && uploadProgress > 0 && (
              <div className="upload-progress-container">
                <ProgressBar progress={uploadProgress} />
              </div>
            )}
          </form>
          
          <div className="model-preview-container">
            <h3 className="section-title">3D Preview</h3>
            
            <div className="model-viewer" ref={modelViewerRef}>
              {!files.model && (
                <div className="model-viewer-placeholder">
                  <CubeIcon />
                  <p>Upload a 3D model to preview</p>
                </div>
              )}
            </div>
            
            {textureNames.length > 0 && (
              <div className="texture-selector">
                <h3 className="section-title">Texture Preview</h3>
                <div className="texture-options">
                  {textureNames.map((name, index) => (
                    <div
                      key={index}
                      className={`texture-option ${activeTexture === name ? 'active' : ''}`}
                      onClick={() => handleTextureChange(name)}
                    >
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Full-screen loading overlay for major operations */}
      {loading && (
        <Loading overlay={true} text="Uploading furniture model and textures..." />
      )}
    </>
  );
};

export default AddFurniture;
