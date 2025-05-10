import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EnvironmentViewer } from './components/TextureEnvironmentComponents';
import TextureSidePanel from './components/TextureSidePanel';
import './RoomEnvironment.css';

function RoomEnvironment() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [roomData, setRoomData] = useState(null);
  const [selectedWallTexture, setSelectedWallTexture] = useState(null);
  const [selectedFloorTexture, setSelectedFloorTexture] = useState(null);
  const [showTextureSidePanel, setShowTextureSidePanel] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  // Get room data from navigation state
  const { roomId: urlRoomId, roomData: navigationRoomData, projectId, projectData } = location.state || {};

  useEffect(() => {
    // Check for room data in location state
    console.log("Location state:", location.state);
    
    // If no room data is provided, redirect back to room selection
    if (!roomData && (!location.state || !navigationRoomData)) {
      console.error("No room data provided");
      navigate("/room-scaper");
      return;
    }
    
    // Use room data from state if component state is not set yet
    if (!roomData && location.state && navigationRoomData) {
      console.log("Setting roomData from navigation state");
      setRoomData(navigationRoomData);
      
      if (navigationRoomData.modelUrl) {
        console.log("Model URL from navigation state:", navigationRoomData.modelUrl);
      } else {
        console.error("No model URL in room data:", navigationRoomData);
      }
    }
    
    console.log("Room Environment loaded with room:", roomData || navigationRoomData);
    
    // Default textures will be set by the TextureSidePanel component
    // after fetching from Firebase
  }, [roomData, navigate, location.state, navigationRoomData]);

  const handleWallTextureSelect = (textureUrl) => {
    console.log("Selected wall texture:", textureUrl);
    setSelectedWallTexture(textureUrl);
  };

  const handleFloorTextureSelect = (textureUrl) => {
    console.log("Selected floor texture:", textureUrl);
    setSelectedFloorTexture(textureUrl);
  };

  const handleModelLoaded = () => {
    console.log("Model loaded callback received");
    setIsLoading(false);
  };

  const toggleTextureSidePanel = () => {
    setShowTextureSidePanel(prev => !prev);
  };

  const handleBack = () => {
    navigate(-1);
  };

  // Display a loading state while we're waiting for data
  if (isLoading && !roomData && !navigationRoomData) {
    return (
      <div className="room-environment-container loading-state">
        <div className="loading-spinner"></div>
        <p>Loading room environment...</p>
      </div>
    );
  }

  // Get the actual room data to use (either from state or location)
  const currentRoomData = roomData || navigationRoomData;
  const modelUrl = currentRoomData?.modelUrl;
  const actualRoomId = currentRoomData?.id || urlRoomId;

  return (
    <div className="room-environment-container">
      <div className="room-environment-header">
        <button className="back-button" onClick={handleBack}>
          ← Back to Room Selection
        </button>
        <h1>{currentRoomData?.name || 'Room Environment'}</h1>
        <div className="header-actions">
          <button className="toggle-textures-button" onClick={toggleTextureSidePanel}>
            {showTextureSidePanel ? 'Hide Textures' : 'Show Textures'}
          </button>
        </div>
      </div>

      <div className={`room-environment-content ${showTextureSidePanel ? 'with-sidebar' : ''}`}>
        {/* Debug info */}
        {!modelUrl && (
          <div className="debug-info">
            <h3>Debug Information</h3>
            <p>Model URL is missing! Check the console for details.</p>
            <p>Room data available: {currentRoomData ? 'Yes' : 'No'}</p>
            <pre>{JSON.stringify(currentRoomData, null, 2)}</pre>
          </div>
        )}

        {/* 3D Environment Viewer */}
        <div className="environment-viewer-container">
          <EnvironmentViewer 
            modelUrl={modelUrl}
            selectedWallTexture={selectedWallTexture}
            selectedFloorTexture={selectedFloorTexture}
            onModelLoaded={handleModelLoaded}
          />
          
          {isLoading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <p>Loading 3D environment...</p>
            </div>
          )}
        </div>

        {/* Texture Side Panel */}
        {showTextureSidePanel && (
          <div className="texture-sidebar">
            <TextureSidePanel
              roomId={actualRoomId}
              selectedWallTexture={selectedWallTexture}
              selectedFloorTexture={selectedFloorTexture}
              onWallTextureSelect={handleWallTextureSelect}
              onFloorTextureSelect={handleFloorTextureSelect}
              onClose={toggleTextureSidePanel}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default RoomEnvironment;