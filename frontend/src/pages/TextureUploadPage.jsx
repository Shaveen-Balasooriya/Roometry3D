import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage, auth } from '../services/firebase';
import { ref, uploadBytesResumable, getDownloadURL, listAll } from 'firebase/storage';
import Loading from '../components/Loading';
import './TextureUploadPage.css';

export default function TextureUploadPage() {
  const [textures, setTextures] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [category, setCategory] = useState('wall'); // Default category is 'wall'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  
  const navigate = useNavigate();
  
  // Load textures on component mount
  useEffect(() => {
    fetchTextures();
  }, [category]);
  
  const fetchTextures = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to view textures');
      }
      
      // Reference to the textures folder in storage
      const texturesFolderRef = ref(storage, `textures/${category}`);
      
      // List all textures in the category
      const texturesList = await listAll(texturesFolderRef);
      
      // Get download URLs and metadata for all textures
      const texturesData = await Promise.all(
        texturesList.items.map(async (item) => {
          try {
            const url = await getDownloadURL(item);
            // Get last modified date from metadata or use current date
            const dateCreated = new Date().toISOString();
            
            return {
              name: item.name,
              path: item.fullPath,
              url,
              dateCreated,
              type: category
            };
          } catch (err) {
            console.error(`Error getting texture ${item.name}:`, err);
            return null;
          }
        })
      );
      
      // Filter out any failed texture retrievals
      const filteredTextures = texturesData.filter(texture => texture !== null);
      setTextures(filteredTextures);
    } catch (err) {
      console.error('Error fetching textures:', err);
      setErrorMessage('Failed to load textures: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setIsUploading(true);
    
    // Track upload progress for each file
    const newUploadProgress = {};
    files.forEach(file => {
      newUploadProgress[file.name] = 0;
    });
    setUploadProgress(newUploadProgress);
    
    try {
      for (const file of files) {
        // Check if file type is valid (image)
        if (!file.type.match('image.*')) {
          alert(`File ${file.name} is not a valid image file.`);
          continue;
        }
        
        // Create a reference to the texture in Firebase Storage
        const textureRef = ref(storage, `textures/${category}/${file.name}`);
        
        // Upload the file
        const uploadTask = uploadBytesResumable(textureRef, file);
        
        // Listen for state changes, including progress
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // Update progress
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress(prev => ({
              ...prev,
              [file.name]: progress
            }));
          },
          (error) => {
            // Handle upload error
            console.error(`Error uploading ${file.name}:`, error);
            alert(`Failed to upload ${file.name}: ${error.message}`);
          }
        );
        
        // Wait for the upload to complete
        await uploadTask;
      }
      
      // Refresh the list after all uploads are complete
      fetchTextures();
    } catch (err) {
      console.error('Error uploading textures:', err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      // Reset the file input
      event.target.value = '';
    }
  };
  
  const handleDeleteTexture = async (texture) => {
    if (!window.confirm(`Are you sure you want to delete ${texture.name}?`)) {
      return;
    }
    
    try {
      // Get reference to the texture file
      const textureRef = ref(storage, texture.path);
      
      // Delete the file
      await deleteObject(textureRef);
      
      // Update the state by filtering out the deleted texture
      setTextures(prevTextures => 
        prevTextures.filter(t => t.path !== texture.path)
      );
    } catch (err) {
      console.error('Error deleting texture:', err);
      alert(`Failed to delete texture: ${err.message}`);
    }
  };
  
  // Filter textures based on search term
  const filteredTextures = textures.filter(texture =>
    texture.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Sort textures based on selected sort option
  const sortedTextures = [...filteredTextures].sort((a, b) => {
    switch(sortBy) {
      case 'newest':
        return new Date(b.dateCreated) - new Date(a.dateCreated);
      case 'oldest':
        return new Date(a.dateCreated) - new Date(b.dateCreated);
      case 'nameAZ':
        return a.name.localeCompare(b.name);
      case 'nameZA':
        return b.name.localeCompare(a.name);
      default:
        return 0;
    }
  });

  return (
    <div className="texture-upload-container">
      <div className="texture-header">
        <h1>Texture Library</h1>
        <p>Upload and manage textures for walls and floors</p>
      </div>
      
      <div className="texture-controls">
        <div className="control-row">
          <div className="category-toggle">
            <button 
              className={`category-btn ${category === 'wall' ? 'active' : ''}`}
              onClick={() => setCategory('wall')}
            >
              Wall Textures
            </button>
            <button 
              className={`category-btn ${category === 'floor' ? 'active' : ''}`}
              onClick={() => setCategory('floor')}
            >
              Floor Textures
            </button>
          </div>
          
          <div className="upload-btn-wrapper">
            <button className="upload-btn">
              {isUploading ? 'Uploading...' : `Upload ${category === 'wall' ? 'Wall' : 'Floor'} Texture`}
            </button>
            <input 
              type="file"
              accept="image/*" 
              multiple
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </div>
        </div>
        
        <div className="filter-row">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search textures..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="sort-container">
            <label htmlFor="sort-select">Sort by:</label>
            <select 
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="nameAZ">Name (A-Z)</option>
              <option value="nameZA">Name (Z-A)</option>
            </select>
          </div>
        </div>
      </div>
      
      {isUploading && (
        <div className="upload-progress-container">
          <h3>Uploading Textures...</h3>
          {Object.entries(uploadProgress).map(([fileName, progress]) => (
            <div key={fileName} className="progress-item">
              <div className="progress-name">{fileName}</div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="progress-percentage">{progress}%</div>
            </div>
          ))}
        </div>
      )}
      
      {isLoading ? (
        <div className="textures-loading">
          <Loading />
          <p>Loading textures...</p>
        </div>
      ) : errorMessage ? (
        <div className="error-message">
          <p>{errorMessage}</p>
          <button onClick={fetchTextures}>Try Again</button>
        </div>
      ) : sortedTextures.length === 0 ? (
        <div className="no-textures">
          <h3>No {category} textures found</h3>
          <p>Upload some textures to get started.</p>
        </div>
      ) : (
        <div className="textures-grid">
          {sortedTextures.map(texture => (
            <div key={texture.path} className="texture-item">
              <div className="texture-preview">
                <img src={texture.url} alt={texture.name} />
              </div>
              <div className="texture-info">
                <div className="texture-name" title={texture.name}>
                  {texture.name}
                </div>
                <div className="texture-actions">
                  <button 
                    className="texture-btn preview-btn"
                    onClick={() => window.open(texture.url, '_blank')}
                  >
                    Preview
                  </button>
                  <button 
                    className="texture-btn delete-btn"
                    onClick={() => handleDeleteTexture(texture)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}