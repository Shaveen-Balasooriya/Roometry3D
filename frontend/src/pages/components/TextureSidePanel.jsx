import React, { useState, useEffect } from 'react';
import TextureCategory from './TextureCategory';
import TextureService from '../../services/textureService';
import './TextureSidePanel.css';

/**
 * Component for displaying and managing available textures
 */
function TextureSidePanel({
  roomId,
  selectedWallTexture, // This is the URL string of the selected texture
  selectedFloorTexture, // This is the URL string of the selected texture
  onWallTextureSelect,
  onFloorTextureSelect,
  onClose
}) {
  const [wallTextures, setWallTextures] = useState([]); // Array of texture objects {id, url, name, type}
  const [floorTextures, setFloorTextures] = useState([]); // Array of texture objects
  const [loadingWallTextures, setLoadingWallTextures] = useState(true);
  const [loadingFloorTextures, setLoadingFloorTextures] = useState(true);
  const [error, setError] = useState(null);
  const [preloadedTextures, setPreloadedTextures] = useState(new Set());

  // Find the selected texture objects based on the URL for UI highlighting
  const selectedWallTextureObj = wallTextures.find(texture => texture.url === selectedWallTexture);
  const selectedFloorTextureObj = floorTextures.find(texture => texture.url === selectedFloorTexture);

  // Preload a texture image to ensure it's cached and ready for immediate use
  const preloadTexture = async (url) => {
    return new Promise((resolve, reject) => {
      if (preloadedTextures.has(url)) {
        console.log(`Texture already preloaded: ${url}`);
        resolve(true);
        return;
      }

      const img = new Image();
      img.onload = () => {
        console.log(`Preloaded texture: ${url}`);
        setPreloadedTextures(prev => new Set(prev).add(url));
        resolve(true);
      };
      img.onerror = (err) => {
        console.warn(`Failed to preload texture: ${url}`, err);
        resolve(false); // Resolve with false instead of rejecting to avoid breaking Promise.all
      };
      img.src = url;
    });
  };

  // Fetch textures from the database and preload their images
  useEffect(() => {
    const fetchAllTextures = async () => {
      if (!roomId) {
        setError("Room ID is required to fetch textures.");
        setLoadingWallTextures(false);
        setLoadingFloorTextures(false);
        return;
      }
      
      setError(null); // Clear previous errors
      try {
        // Fetch wall textures metadata
        setLoadingWallTextures(true);
        const wallTexturesData = await TextureService.fetchTexturesForRoom(roomId, 'wall');
        console.log("TextureSidePanel: Fetched wall textures:", wallTexturesData);
        
        // Fetch floor textures metadata
        setLoadingFloorTextures(true);
        const floorTexturesData = await TextureService.fetchTexturesForRoom(roomId, 'floor');
        console.log("TextureSidePanel: Fetched floor textures:", floorTexturesData);
        
        // Update state with metadata so UI can start showing the texture options
        setWallTextures(wallTexturesData);
        setFloorTextures(floorTexturesData);
        
        // Now preload all the texture images in parallel
        console.log("TextureSidePanel: Preloading all texture images...");
        const preloadPromises = [
          ...wallTexturesData.map(texture => preloadTexture(texture.url)),
          ...floorTexturesData.map(texture => preloadTexture(texture.url))
        ];
        
        // Wait for all textures to be preloaded
        await Promise.all(preloadPromises);
        console.log("TextureSidePanel: All textures preloaded and cached");
        
        // Mark loading as complete
        setLoadingWallTextures(false);
        setLoadingFloorTextures(false);
      } catch (err) {
        console.error('TextureSidePanel: Error fetching or preloading textures:', err);
        setError('Failed to load textures. Please try again.');
        setLoadingWallTextures(false);
        setLoadingFloorTextures(false);
      }
    };
    
    fetchAllTextures();
  }, [roomId]); 
  
  // Handle wall texture selection from TextureCategory/TextureItem
  const handleWallTextureSelect = (texture) => { // texture is an object {id, url, name, type}
    console.log("TextureSidePanel: Wall texture selected by user:", texture);
    onWallTextureSelect(texture.url); // Pass the URL up to the parent
  };
  
  // Handle floor texture selection from TextureCategory/TextureItem
  const handleFloorTextureSelect = (texture) => { // texture is an object {id, url, name, type}
    console.log("TextureSidePanel: Floor texture selected by user:", texture);
    onFloorTextureSelect(texture.url); // Pass the URL up to the parent
  };
  
  return (
    <div className="texture-side-panel">
      <div className="texture-panel-header">
        <h2>Room Textures</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      {error && (
        <div className="texture-error-message">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}
      
      <div className="textures-container">
        <TextureCategory
          title="Wall Textures"
          textures={wallTextures}
          selectedTexture={selectedWallTextureObj}
          onTextureSelect={handleWallTextureSelect}
          loading={loadingWallTextures}
        />
        
        <TextureCategory
          title="Floor Textures"
          textures={floorTextures}
          selectedTexture={selectedFloorTextureObj}
          onTextureSelect={handleFloorTextureSelect}
          loading={loadingFloorTextures}
        />
      </div>
    </div>
  );
}

export default TextureSidePanel;