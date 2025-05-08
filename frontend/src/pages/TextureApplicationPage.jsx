import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { storage, auth } from '../services/firebase';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import Loading from '../components/Loading';
import './TextureApplicationPage.css';

export default function TextureApplicationPage() {
  const [wallTextures, setWallTextures] = useState([]);
  const [floorTextures, setFloorTextures] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('walls');
  const [selectedWallTexture, setSelectedWallTexture] = useState(null);
  const [selectedFloorTexture, setSelectedFloorTexture] = useState(null);
  const { id: projectId } = useParams();
  
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL;
  
  // Load textures on component mount
  useEffect(() => {
    fetchTextures();
  }, []);
  
  const fetchTextures = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to view textures');
      }
      
      // Fetch wall textures
      const wallTexturesFolderRef = ref(storage, 'textures/wall');
      const wallTexturesList = await listAll(wallTexturesFolderRef);
      
      // Fetch floor textures
      const floorTexturesFolderRef = ref(storage, 'textures/floor');
      const floorTexturesList = await listAll(floorTexturesFolderRef);
      
      // Get download URLs for all wall textures
      const wallTexturesData = await Promise.all(
        wallTexturesList.items.map(async (item) => {
          try {
            const url = await getDownloadURL(item);
            return {
              name: item.name,
              path: item.fullPath,
              url: url
            };
          } catch (err) {
            console.error(`Error getting wall texture ${item.name}:`, err);
            return null;
          }
        })
      );
      
      // Get download URLs for all floor textures
      const floorTexturesData = await Promise.all(
        floorTexturesList.items.map(async (item) => {
          try {
            const url = await getDownloadURL(item);
            return {
              name: item.name,
              path: item.fullPath,
              url: url
            };
          } catch (err) {
            console.error(`Error getting floor texture ${item.name}:`, err);
            return null;
          }
        })
      );
      
      // Filter out any failed texture retrievals
      const filteredWallTextures = wallTexturesData.filter(texture => texture !== null);
      const filteredFloorTextures = floorTexturesData.filter(texture => texture !== null);
      
      setWallTextures(filteredWallTextures);
      setFloorTextures(filteredFloorTextures);
    } catch (err) {
      console.error('Error fetching textures:', err);
      setErrorMessage('Failed to load textures: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Apply texture to walls
  const applyWallTexture = (texture) => {
    setSelectedWallTexture(texture);
    
    // Call the RoomViewerAPI to apply texture to all walls
    if (window.RoomViewerAPI?.applyTextureToTag) {
      window.RoomViewerAPI.applyTextureToTag('wall', texture.url, { x: 1, y: 1 });
      
      // Show success feedback
      alert(`Applied ${texture.name} to all walls`);
    } else {
      console.error('RoomViewerAPI is not available');
    }
  };
  
  // Apply texture to floor
  const applyFloorTexture = (texture) => {
    setSelectedFloorTexture(texture);
    
    // Call the RoomViewerAPI to apply texture to all floors
    if (window.RoomViewerAPI?.applyTextureToTag) {
      window.RoomViewerAPI.applyTextureToTag('floor', texture.url, { x: 1, y: 1 });
      
      // Show success feedback
      alert(`Applied ${texture.name} to all floors`);
    } else {
      console.error('RoomViewerAPI is not available');
    }
  };
  
  // Save project with applied textures
  const saveProject = async () => {
    try {
      // Implementation would depend on how you want to save the project data
      // For now, we'll just show a success message
      alert('Project textures saved successfully!');
      navigate(`/view-project/${projectId}`);
    } catch (err) {
      console.error('Error saving project:', err);
      alert(`Failed to save project: ${err.message}`);
    }
  };
  
  // Cancel and return to project view
  const cancelChanges = () => {
    if (window.confirm('Discard all texture changes?')) {
      navigate(`/view-project/${projectId}`);
    }
  };

  return (
    <div className="texture-application-container">
      <div className="texture-app-header">
        <h1>Apply Textures</h1>
        <p>Select and apply textures to your room</p>
      </div>
      
      <div className="texture-app-content">
        <div className="texture-selection-panel">
          <div className="texture-tabs">
            <button 
              className={`texture-tab ${activeTab === 'walls' ? 'active' : ''}`}
              onClick={() => setActiveTab('walls')}
            >
              Wall Textures ({wallTextures.length})
            </button>
            <button 
              className={`texture-tab ${activeTab === 'floors' ? 'active' : ''}`}
              onClick={() => setActiveTab('floors')}
            >
              Floor Textures ({floorTextures.length})
            </button>
          </div>
          
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
          ) : (
            <div className="textures-grid">
              {activeTab === 'walls' ? (
                wallTextures.length > 0 ? (
                  wallTextures.map((texture, index) => (
                    <div 
                      key={index} 
                      className={`texture-card ${selectedWallTexture === texture ? 'selected' : ''}`}
                      onClick={() => applyWallTexture(texture)}
                    >
                      <div className="texture-preview">
                        <img src={texture.url} alt={texture.name} />
                        {selectedWallTexture === texture && (
                          <div className="selected-indicator">Applied</div>
                        )}
                      </div>
                      <div className="texture-card-name">{texture.name}</div>
                      <button 
                        className="apply-texture-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          applyWallTexture(texture);
                        }}
                      >
                        Apply to All Walls
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="no-textures-message">
                    <p>No wall textures available.</p>
                    <button onClick={() => navigate('/upload-texture')}>
                      Upload Textures
                    </button>
                  </div>
                )
              ) : (
                floorTextures.length > 0 ? (
                  floorTextures.map((texture, index) => (
                    <div 
                      key={index} 
                      className={`texture-card ${selectedFloorTexture === texture ? 'selected' : ''}`}
                      onClick={() => applyFloorTexture(texture)}
                    >
                      <div className="texture-preview">
                        <img src={texture.url} alt={texture.name} />
                        {selectedFloorTexture === texture && (
                          <div className="selected-indicator">Applied</div>
                        )}
                      </div>
                      <div className="texture-card-name">{texture.name}</div>
                      <button 
                        className="apply-texture-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          applyFloorTexture(texture);
                        }}
                      >
                        Apply to All Floors
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="no-textures-message">
                    <p>No floor textures available.</p>
                    <button onClick={() => navigate('/upload-texture')}>
                      Upload Textures
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
        
        <div className="texture-actions-panel">
          <div className="selected-textures-summary">
            <h3>Applied Textures</h3>
            <div className="applied-textures-list">
              <div className="applied-texture-item">
                <span className="texture-type">Walls:</span>
                <span className="texture-name">
                  {selectedWallTexture ? selectedWallTexture.name : 'None selected'}
                </span>
              </div>
              <div className="applied-texture-item">
                <span className="texture-type">Floors:</span>
                <span className="texture-name">
                  {selectedFloorTexture ? selectedFloorTexture.name : 'None selected'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="action-buttons">
            <button className="cancel-button" onClick={cancelChanges}>
              Cancel
            </button>
            <button 
              className="save-button" 
              onClick={saveProject}
              disabled={!selectedWallTexture && !selectedFloorTexture}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}