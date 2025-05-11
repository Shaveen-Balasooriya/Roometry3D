import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EnvironmentViewer } from './components/TextureEnvironmentComponents';
import TextureSidePanel from './components/TextureSidePanel';
import FurnitureCatalogSidebar from './components/FurnitureCatalogSidebar';
import './RoomEnvironment.css';
import './components/FurnitureControls.css';

function RoomEnvironment() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [roomData, setRoomData] = useState(null);
  const [selectedWallTexture, setSelectedWallTexture] = useState(null);
  const [selectedFloorTexture, setSelectedFloorTexture] = useState(null);
  const [showTextureSidePanel, setShowTextureSidePanel] = useState(false);
  const [showFurnitureSidebar, setShowFurnitureSidebar] = useState(true);  const [isLoading, setIsLoading] = useState(true);
  const [furnitureItems, setFurnitureItems] = useState([]);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);
  const [activeSectionIndex, setActiveSectionIndex] = useState(0); // Used to control texture tab selection
  
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
    // If both panels would be open, close the furniture sidebar
    if (!showTextureSidePanel && showFurnitureSidebar) {
      setShowFurnitureSidebar(false);
    }
  };

  const toggleFurnitureSidebar = () => {
    setShowFurnitureSidebar(prev => !prev);
    // If both panels would be open, close the texture panel
    if (!showFurnitureSidebar && showTextureSidePanel) {
      setShowTextureSidePanel(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };  const handleSelectFurniture = (furniture) => {
    console.log("Selected furniture from catalog:", furniture);
    
    // Generate a unique ID for this furniture instance
    const furnitureId = `${furniture.id}-${Date.now()}`;
    
    // Add the furniture item to the room with initial position
    const newFurnitureItem = {
      ...furniture,
      id: furniture.id,         // Original ID
      instanceId: furnitureId,  // Instance-specific ID
      position: [0, 0, 0],      // Default position at room center
      rotation: [0, 0, 0],      // Default rotation
      scale: [1, 1, 1]          // Default scale
    };
    
    // Make sure we have a valid model URL
    if (!newFurnitureItem.modelUrl) {
      if (newFurnitureItem.objFileUrl) {
        newFurnitureItem.modelUrl = newFurnitureItem.objFileUrl;
      } else if (newFurnitureItem.modelEndpoint) {
        newFurnitureItem.modelUrl = newFurnitureItem.modelEndpoint;
      } else {
        console.error("No model URL found for furniture:", furniture);
        return;
      }
    }
    
    console.log("Adding furniture to room with model URL:", newFurnitureItem.modelUrl);
    
    setFurnitureItems(prev => [...prev, newFurnitureItem]);
    setSelectedFurnitureId(furnitureId);
    
    // Log for debugging
    console.log("Added furniture to room:", newFurnitureItem);
    console.log("Current furniture items:", [...furnitureItems, newFurnitureItem]);
  };

  const handleFurnitureSelect = (furnitureId) => {
    setSelectedFurnitureId(furnitureId);
  };

  const handleFurniturePositionChange = (furnitureId, newPosition, newRotation) => {
    setFurnitureItems(prev => 
      prev.map(item => 
        item.instanceId === furnitureId 
          ? { ...item, position: newPosition, rotation: newRotation } 
          : item
      )
    );
  };
  const handleFurnitureTextureChange = (furnitureId, textureUrl) => {
    console.log(`Applying texture ${textureUrl} to furniture with ID: ${furnitureId}`);
    
    setFurnitureItems(prev => {
      const updatedItems = prev.map(item => {
        if (item.instanceId === furnitureId) {
          console.log(`Found matching furniture: ${item.name || 'Unnamed'}`);
          return { ...item, selectedTextureUrl: textureUrl };
        }
        return item;
      });
      
      console.log("Updated furniture items:", updatedItems);
      return updatedItems;
    });
  };

  const handleDeleteFurniture = (furnitureId) => {
    setFurnitureItems(prev => prev.filter(item => item.instanceId !== furnitureId));
    if (selectedFurnitureId === furnitureId) {
      setSelectedFurnitureId(null);
    }
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
          <button 
            className={`toggle-furniture-button ${showFurnitureSidebar ? 'active' : ''}`} 
            onClick={toggleFurnitureSidebar}
          >
            {showFurnitureSidebar ? 'Hide Furniture' : 'Show Furniture'}
          </button>
          <button 
            className={`toggle-textures-button ${showTextureSidePanel ? 'active' : ''}`} 
            onClick={toggleTextureSidePanel}
          >
            {showTextureSidePanel ? 'Hide Textures' : 'Show Textures'}
          </button>
        </div>
      </div>

      <div className="room-environment-content">
        {/* Debug info */}
        {!modelUrl && (
          <div className="debug-info">
            <h3>Debug Information</h3>
            <p>Model URL is missing! Check the console for details.</p>
            <p>Room data available: {currentRoomData ? 'Yes' : 'No'}</p>
            <pre>{JSON.stringify(currentRoomData, null, 2)}</pre>
          </div>
        )}

        {/* Furniture Catalog Sidebar */}
        {showFurnitureSidebar && (
          <div className="furniture-sidebar">
            <FurnitureCatalogSidebar
              onSelectFurniture={handleSelectFurniture}
              onClose={toggleFurnitureSidebar}
            />
          </div>
        )}

        {/* 3D Environment Viewer */}
        <div className={`environment-viewer-container ${showFurnitureSidebar || showTextureSidePanel ? 'with-sidebar' : ''}`}>          <EnvironmentViewer 
            modelUrl={modelUrl}
            selectedWallTexture={selectedWallTexture}
            selectedFloorTexture={selectedFloorTexture}
            furnitureItems={furnitureItems}
            selectedFurnitureId={selectedFurnitureId}
            onSelectFurniture={handleFurnitureSelect}
            onFurniturePositionChange={handleFurniturePositionChange}
            onModelLoaded={handleModelLoaded}
          />
          
          {isLoading && (
            <div className="loading-overlay">
              <div className="loading-spinner"></div>
              <p>Loading 3D environment...</p>
            </div>
          )}          {/* Furniture Control Panel when a furniture is selected */}
          {selectedFurnitureId && (
            <div className="furniture-controls">
              <h3>Furniture Controls</h3>
              <div className="furniture-actions">
                <button 
                  className="delete-furniture-btn" 
                  onClick={() => handleDeleteFurniture(selectedFurnitureId)}
                >
                  Delete
                </button>
                <button 
                  className="texture-furniture-btn" 
                  onClick={() => {
                    setShowTextureSidePanel(true);
                    setActiveSectionIndex(2); // Switch to the furniture textures tab
                  }}
                >
                  Change Texture
                </button>
              </div>
            </div>
          )}
        </div>        {/* Texture Side Panel */}
        {showTextureSidePanel && (
          <div className="texture-sidebar">
            <TextureSidePanel
              roomId={actualRoomId}
              selectedWallTexture={selectedWallTexture}
              selectedFloorTexture={selectedFloorTexture}
              onWallTextureSelect={handleWallTextureSelect}
              onFloorTextureSelect={handleFloorTextureSelect}
              onClose={toggleTextureSidePanel}
              // Pass selected furniture for texture application
              selectedFurniture={selectedFurnitureId ? 
                furnitureItems.find(item => item.instanceId === selectedFurnitureId) : null}
              onFurnitureTextureSelect={handleFurnitureTextureChange}
              activeSectionIndex={activeSectionIndex}
              setActiveSectionIndex={setActiveSectionIndex}
            />
  
          </div>
        )}
      </div>
    </div>
  );
}

export default RoomEnvironment;