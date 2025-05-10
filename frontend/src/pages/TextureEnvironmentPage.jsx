import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { ref, getDownloadURL, listAll } from 'firebase/storage';
import { db, storage } from '../services/firebase';
import { EnvironmentViewer, TextureSidePanel } from './components/TextureEnvironmentComponents';
import Loading from '../components/Loading';
import './TextureEnvironmentPage.css';

export default function TextureEnvironmentPage() {
  const [roomData, setRoomData] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // isLoading will be true until model and initial textures are processed
  const [error, setError] = useState(null);

  // Initialize selected textures to null, so nothing is applied by default
  const [selectedWallTexture, setSelectedWallTexture] = useState(null);
  const [selectedFloorTexture, setSelectedFloorTexture] = useState(null);

  const [showTextureSidePanel, setShowTextureSidePanel] = useState(true);

  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const roomId = params.roomId || location.state?.roomId;

  // This useEffect now primarily handles fetching room data and setting up the model.
  // Texture fetching and initial selection are handled by TextureSidePanel or user interaction.
  useEffect(() => {
    let isMounted = true;
    setError(null);

    const roomDataFromNav = location.state?.roomData;
    if (roomDataFromNav && roomDataFromNav.modelUrl) {
      if (isMounted) {
        console.log("TextureEnvironmentPage: Using room data from navigation:", roomDataFromNav);
        setRoomData(roomDataFromNav);
      }
      return;
    }

    if (!roomId) {
      if (isMounted) {
        setError("No Room ID provided. Cannot load environment.");
        setIsLoading(false);
      }
      return;
    }

    const fetchRoomData = async () => {
      if (!isMounted) return;
      setIsLoading(true); // Set loading true before async fetch
      try {
        const roomDocRef = doc(db, 'rooms', roomId);
        const roomDoc = await getDoc(roomDocRef);

        if (isMounted) {
          if (roomDoc.exists()) {
            const data = roomDoc.data();
            let modelUrl = null;
            const modelDataField = data.modelPath || data.modelUrl || data.model || (data.files && data.files.model);

            if (modelDataField) {
              if (typeof modelDataField === 'object' && modelDataField.url) {
                modelUrl = modelDataField.url;
              } else if (typeof modelDataField === 'string') {
                modelUrl = modelDataField.startsWith('http') ? modelDataField : await getDownloadURL(ref(storage, modelDataField));
              }
            }
            console.log("TextureEnvironmentPage: Fetched room data with model URL:", modelUrl);
            setRoomData({ ...data, id: roomDoc.id, modelUrl });
          } else {
            setError("Room not found.");
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error("TextureEnvironmentPage: Error fetching room data:", err);
        if (isMounted) {
          setError(err.message || "Failed to fetch room data.");
          setIsLoading(false);
        }
      }
    };

    fetchRoomData();

    return () => {
      isMounted = false;
    };
  }, [roomId, location.state?.roomData?.id]);

  const handleWallTextureSelect = (textureUrl) => {
    console.log("TextureEnvironmentPage: Wall texture selected:", textureUrl);
    setSelectedWallTexture(textureUrl);
  };

  const handleFloorTextureSelect = (textureUrl) => {
    console.log("TextureEnvironmentPage: Floor texture selected:", textureUrl);
    setSelectedFloorTexture(textureUrl);
  };

  const handleModelLoaded = () => {
    console.log("TextureEnvironmentPage: Model loaded callback received.");
    setIsLoading(false); // Model is ready, main loading is done.
  };

  const toggleTextureSidePanel = () => {
    setShowTextureSidePanel(prev => !prev);
  };

  const handleGoBack = () => {
    if (location.state?.fromProject) {
      navigate(`/view-project/${location.state.fromProject}`);
    } else {
      navigate('/room-scaper');
    }
  };

  if (isLoading) {
    return (
      <div className="texture-environment-container loading-state">
        <Loading size={50} />
        <p>Loading environment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="texture-environment-container error-state">
        <div className="error-message">
          <h2>Error Loading Environment</h2>
          <p>{error}</p>
          <button className="button-primary" onClick={handleGoBack}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="texture-environment-container">
      <header className="texture-environment-header">
        <div className="header-left">
          <button onClick={handleGoBack} className="back-button">
            ← Back
          </button>
          <h1>{roomData?.name || 'Room Environment'}</h1>
        </div>
        <div className="header-right">
          <button 
            onClick={toggleTextureSidePanel} 
            className="toggle-textures-button"
            title={showTextureSidePanel ? "Hide Textures Panel" : "Show Textures Panel"}
          >
            {showTextureSidePanel ? 'Hide Textures' : 'Show Textures'}
          </button>
        </div>
      </header>

      <div className={`texture-environment-content ${showTextureSidePanel ? 'with-sidebar' : ''}`}>
        <div className="environment-viewer-container">
          <EnvironmentViewer 
            modelUrl={roomData?.modelUrl}
            selectedWallTexture={selectedWallTexture}
            selectedFloorTexture={selectedFloorTexture}
            onModelLoaded={handleModelLoaded}
          />
        </div>

        {showTextureSidePanel && (
          <div className="texture-sidebar">
            <TextureSidePanel
              wallTextures={[]}
              floorTextures={[]}
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