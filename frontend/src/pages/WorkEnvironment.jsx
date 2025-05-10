import React, { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, useProgress, Html, Stats, PerspectiveCamera, ContactShadows } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { TextureLoader, RepeatWrapping } from 'three';
import * as THREE from 'three';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { getStorage, ref, listAll, getDownloadURL } from 'firebase/storage';
import { db } from '../services/firebase';
import Loading from '../components/Loading';
import ErrorBoundary from '../components/ErrorBoundary';
import TextureApplier from './components/TextureApplier';
import './WorkEnvironment.css';
import './components/TextureApplier.css';

// Loader component to show progress
function LoadingIndicator() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="loading-progress">
        <div className="spinner" style={{ width: 40, height: 40 }} />
        <p style={{ marginTop: 10, fontWeight: 500 }}>{progress.toFixed(0)}% loaded</p>
      </div>
    </Html>
  );
}

// Component to display the model
function RoomModel({ modelUrl, onLoaded, componentTags, selectedWallTexture, selectedFloorTexture }) {
  const [model, setModel] = useState(null);
  const [error, setError] = useState(null);
  const loaderRef = useRef(new GLTFLoader());
  const textureLoaderRef = useRef(new TextureLoader());
  const loadedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    setModel(null);
    setError(null);
    loadedRef.current = false;

    const loadModel = async () => {
      if (!modelUrl) {
        setError("Model URL is missing.");
        if (isMounted) onLoaded();
        return;
      }
      try {
        loaderRef.current.load(
          modelUrl,
          (gltf) => {
            if (isMounted) {
              gltf.scene.traverse((child) => {
                if (child.isMesh) {
                  child.castShadow = true;
                  child.receiveShadow = true;
                  if (componentTags && componentTags[child.name]) {
                    child.userData.tag = componentTags[child.name];
                  }
                }
              });
              setModel(gltf.scene);
              if (!loadedRef.current) {
                onLoaded();
                loadedRef.current = true;
              }
            }
          },
          undefined,
          (err) => {
            if (isMounted) {
              console.error("Error loading GLTF model:", err);
              setError(err.message || "Failed to load model");
              onLoaded();
              loadedRef.current = true;
            }
          }
        );
      } catch (err) {
        if (isMounted) {
          console.error("Error in loadModel:", err);
          setError(err.message || "An unexpected error occurred");
          onLoaded();
          loadedRef.current = true;
        }
      }
    };

    loadModel();

    return () => {
      isMounted = false;
      if (model) {
        model.traverse(child => {
          if (child.isMesh && child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        });
      }
    };
  }, [modelUrl, onLoaded, componentTags]);

  useEffect(() => {
    if (!model) return;

    const applyTexture = (textureUrl, tag) => {
      if (!textureUrl) return;
      textureLoaderRef.current.load(textureUrl, (texture) => {
        // Set texture tiling properties
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1); // Apply 1,1 tiling for both X and Y coordinates
        
        model.traverse((child) => {
          if (child.isMesh && child.userData.tag === tag) {
            if (child.material.map) child.material.map.dispose();
            child.material.map = texture;
            texture.needsUpdate = true;
            child.material.needsUpdate = true;
          }
        });
      });
    };

    if (selectedWallTexture) {
      applyTexture(selectedWallTexture, 'wall');
    }
    if (selectedFloorTexture) {
      applyTexture(selectedFloorTexture, 'floor');
    }
  }, [model, selectedWallTexture, selectedFloorTexture]);

  if (error) {
    return (
      <Html center>
        <div className="model-error">
          <p>❌ Error loading model</p>
          <small>{error}</small>
        </div>
      </Html>
    );
  }

  return model ? <primitive object={model} /> : null;
}

// Statistics panel that can be toggled
const StatsPanel = ({ show }) => {
  return show ? <Stats className="stats-panel" /> : null;
};

// Tool panel component
const ToolPanel = ({ onSave }) => {
  return (
    <div className="tool-panel">
      <div className="tool-panel-header">
        <h3>Tools</h3>
      </div>
      <div className="tool-buttons">
        <button className="tool-button" title="Move object">
          <span>Move</span>
        </button>
        <button className="tool-button" title="Rotate object">
          <span>Rotate</span>
        </button>
        <button className="tool-button" title="Scale object">
          <span>Scale</span>
        </button>
        <button className="tool-button" title="Add furniture">
          <span>Add Item</span>
        </button>
      </div>
      <div className="tool-panel-actions">
        <button className="action-button primary" onClick={onSave}>
          Save Scene
        </button>
      </div>
    </div>
  );
};

// Main WorkEnvironment component
export default function WorkEnvironment() {
  const [roomData, setRoomData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const canvasRef = useRef(null);
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [wallTextures, setWallTextures] = useState([]);
  const [floorTextures, setFloorTextures] = useState([]);
  const [selectedWallTexture, setSelectedWallTexture] = useState(null);
  const [selectedFloorTexture, setSelectedFloorTexture] = useState(null);
  const [componentTags, setComponentTags] = useState({});
  
  const roomId = params.roomId || location.state?.roomId;

  const fetchTextureUrls = useCallback(async (currentRoomId, textureType) => {
    if (!currentRoomId) return [];
    const storage = getStorage();
    const texturesPath = `rooms/${currentRoomId}/textures/${textureType}`;
    const texturesRef = ref(storage, texturesPath);
    try {
      const res = await listAll(texturesRef);
      const urls = await Promise.all(res.items.map((itemRef) => getDownloadURL(itemRef)));
      return urls;
    } catch (err) {
      console.warn(`Could not list ${textureType} textures for room ${currentRoomId}:`, err);
      return [];
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    setRoomData(null); // Reset room data on ID change
    setWallTextures([]);
    setFloorTextures([]);
    setSelectedWallTexture(null);
    setSelectedFloorTexture(null);
    setComponentTags({});

    if (!roomId) {
      if (isMounted) {
        setError("No Room ID provided. Cannot load environment.");
        setIsLoading(false);
      }
      return;
    }
    
    const fetchRoomData = async () => {
      try {
        const roomDocRef = doc(db, 'rooms', roomId);
        const roomDoc = await getDoc(roomDocRef);

        if (isMounted) {
          if (roomDoc.exists()) {
            const data = roomDoc.data();
            let finalUsableModelUrl = null;
            console.log("Original modelUrl from Firestore:", data.modelUrl);

            // According to backend code, we need to check if there's already a modelUrl in Firebase
            // If not, we need to try to construct it based on the format used in the upload endpoint
            
            // Looking at the backend endpoint, modelUrl would be in files.model
            const modelUrlFromFiles = data.files && data.files.model ? data.files.model : null;
            
            if (modelUrlFromFiles) {
              console.log("Found model URL in data.files.model:", modelUrlFromFiles);
              data.modelUrl = modelUrlFromFiles;
            } else if (!data.modelUrl && roomId) {
              // According to the backend code, model is uploaded to:
              // `rooms/${roomId}/model.${modelFileExt}` 
              // The modelFileExt could be glb, gltf, obj, etc. from the original file
              console.log("No modelUrl found in data, constructing path based on backend storage pattern");
              
              // We need to try each possible extension
              const modelExtensions = ['glb', 'gltf', 'obj', 'fbx'];
              data.modelUrl = `rooms/${roomId}/model`;  // Base path without extension
            }
            
            // Resolve the modelUrl to a downloadable HTTPS URL
            if (data.modelUrl) {
              if (typeof data.modelUrl === 'string') {
                if (data.modelUrl.startsWith('http://') || data.modelUrl.startsWith('https://') || data.modelUrl.startsWith('blob:')) {
                  console.log("Using direct URL from data:", data.modelUrl);
                  finalUsableModelUrl = data.modelUrl; // Already a usable URL
                } else { 
                  // Handle various storage path formats
                  let storagePathToUse = data.modelUrl;
                  
                  // If it's a gs:// URI, convert it to a storage path
                  if (data.modelUrl.startsWith('gs://')) {
                    const gsUri = data.modelUrl;
                    console.log("Converting gs:// URI to storage path:", gsUri);
                    // Extract path from gs://bucket-name/path/to/file format
                    const pathParts = gsUri.split('/');
                    pathParts.splice(0, 3); // Remove gs:// and bucket name
                    storagePathToUse = pathParts.join('/');
                    console.log("Converted storage path:", storagePathToUse);
                  }
                  
                  const storage = getStorage();
                  let modelFound = false;
                  
                  // First try the exact path provided (may be a direct download URL)
                  try {
                    console.log("Trying exact path:", storagePathToUse);
                    const exactPathRef = ref(storage, storagePathToUse);
                    finalUsableModelUrl = await getDownloadURL(exactPathRef);
                    console.log("Exact path resolved successfully:", finalUsableModelUrl);
                    modelFound = true;
                  } catch (exactPathError) {
                    console.log("Exact path not found, trying with extensions...");
                  }
                  
                  // Check for the path with extensions, exactly matching the backend upload pattern
                  if (!modelFound) {
                    const modelExtensions = ['glb', 'gltf', 'obj', 'fbx'];
                    for (const ext of modelExtensions) {
                      if (modelFound) break;
                      
                      try {
                        const pathWithExt = `${storagePathToUse}.${ext}`;
                        console.log("Trying path with extension:", pathWithExt);
                        const fileWithExtRef = ref(storage, pathWithExt);
                        finalUsableModelUrl = await getDownloadURL(fileWithExtRef);
                        modelFound = true;
                        console.log("Found model with extension:", ext);
                        console.log("Resolved model URL:", finalUsableModelUrl);
                      } catch (extError) {
                        // Continue to next extension
                      }
                    }
                  }
                  
                  // If still not found, try path + `/model` + extensions
                  if (!modelFound) {
                    const modelExtensions = ['glb', 'gltf', 'obj', 'fbx'];
                    for (const ext of modelExtensions) {
                      if (modelFound) break;
                      
                      try {
                        const modelSubdirPath = `${storagePathToUse}/model.${ext}`;
                        console.log("Trying model in subdirectory:", modelSubdirPath);
                        const modelSubdirRef = ref(storage, modelSubdirPath);
                        finalUsableModelUrl = await getDownloadURL(modelSubdirRef);
                        modelFound = true;
                        console.log("Found model in subdirectory with extension:", ext);
                        console.log("Resolved model URL:", finalUsableModelUrl);
                      } catch (subdirError) {
                        // Continue to next extension
                      }
                    }
                  }
                  
                  // If still not found, try listing the directory
                  if (!modelFound) {
                    try {
                      console.log("Trying to list directory contents:", storagePathToUse);
                      const directoryRef = ref(storage, storagePathToUse);
                      const dirContents = await listAll(directoryRef);
                      
                      if (dirContents.items.length > 0) {
                        console.log(`Found ${dirContents.items.length} items in directory:`, 
                          dirContents.items.map(i => i.name));
                        
                        // Look for model.* files first (matching backend upload pattern)
                        const modelFile = dirContents.items.find(item => 
                          item.name.startsWith('model.')
                        );
                        
                        if (modelFile) {
                          console.log("Found model file in directory:", modelFile.name);
                          finalUsableModelUrl = await getDownloadURL(modelFile);
                          modelFound = true;
                          console.log("Resolved model URL from directory listing:", finalUsableModelUrl);
                        } else {
                          // If no model.* file, look for any .glb or .gltf file
                          const glbOrGltfFile = dirContents.items.find(item => 
                            item.name.toLowerCase().endsWith('.glb') || 
                            item.name.toLowerCase().endsWith('.gltf') ||
                            item.name.toLowerCase().endsWith('.obj') ||
                            item.name.toLowerCase().endsWith('.fbx')
                          );
                          
                          if (glbOrGltfFile) {
                            console.log("Found 3D model file in directory:", glbOrGltfFile.name);
                            finalUsableModelUrl = await getDownloadURL(glbOrGltfFile);
                            modelFound = true;
                            console.log("Resolved 3D model URL from directory listing:", finalUsableModelUrl);
                          }
                        }
                      }
                    } catch (listError) {
                      console.log("Could not list directory:", listError.message);
                    }
                  }
                  
                  if (!modelFound) {
                    console.error("Tried all approaches but could not find the model file");
                  }
                }
              } else if (typeof data.modelUrl === 'object' && data.modelUrl !== null) {
                if (data.modelUrl.url && typeof data.modelUrl.url === 'string') {
                  // It's an object like { url: "some_url_string" }, assume it's usable
                  console.log("Using URL from object property:", data.modelUrl.url);
                  finalUsableModelUrl = data.modelUrl.url;
                } else if (data.modelUrl.path && typeof data.modelUrl.path === 'string') {
                  // Try using a path property if it exists
                  console.log("Using path from object property:", data.modelUrl.path);
                  try {
                    const storage = getStorage();
                    const modelFileRef = ref(storage, data.modelUrl.path);
                    finalUsableModelUrl = await getDownloadURL(modelFileRef);
                    console.log("Resolved path from object to URL:", finalUsableModelUrl);
                  } catch (pathError) {
                    console.error("Error resolving path from object:", pathError);
                  }
                }
              } else {
                console.warn("Unsupported modelUrl format in Firestore:", data.modelUrl);
              }
            }

            const processedData = { ...data, modelUrl: finalUsableModelUrl };
            console.log("Final processed data with resolved URL:", processedData.modelUrl);

            setRoomData(processedData);
            setComponentTags(processedData.componentTags || {});

            // Fetch textures
            const fetchedWallTextures = await fetchTextureUrls(roomId, 'wall');
            const fetchedFloorTextures = await fetchTextureUrls(roomId, 'floor');
            
            if (isMounted) {
              setWallTextures(fetchedWallTextures);
              setFloorTextures(fetchedFloorTextures);
            }

            if (!processedData.modelUrl) {
              setIsLoading(false);
              console.log("Loading finished without a valid model URL");
            }
          } else {
            setError(`Room with ID ${roomId} not found.`);
            setIsLoading(false); // No room, so loading is done.
          }
        }
      } catch (err) {
        console.error("Error fetching room data:", err);
        if (isMounted) {
          setError(err.message || "Failed to fetch room data.");
          setIsLoading(false); // Error occurred, loading is done.
        }
      }
    };
    
    fetchRoomData();
    
    return () => {
      isMounted = false;
    };
  }, [roomId, navigate, location.state, fetchTextureUrls]);
  
  const handleSaveScene = () => {
    alert('Scene saving functionality will be implemented in future updates');
  };
  
  const handleModelLoaded = useCallback(() => {
    setIsLoading(false);
  }, []);
  
  const handleToggleStats = () => setShowStats(prev => !prev);
  
  const handleBackToRooms = () => {
    if (location.state?.fromProject) {
      navigate(`/view-project/${location.state.fromProject}`);
    } else {
      navigate('/room-scaper');
    }
  };

  const handleApplyWallTexture = useCallback((textureUrl) => {
    setSelectedWallTexture(textureUrl);
  }, []);

  const handleApplyFloorTexture = useCallback((textureUrl) => {
    setSelectedFloorTexture(textureUrl);
  }, []);

  if (error && !roomData) { // Only show full page error if roomData couldn't be fetched at all
    return (
      <div className="error-container work-environment-page">
        <h2>Error Loading Environment</h2>
        <p>{error}</p>
        <button onClick={handleBackToRooms} className="button-primary">
          Go Back
        </button>
      </div>
    );
  }

  // modelUrl is now directly from roomData state, pre-processed during fetch.
  const modelUrlToPass = roomData?.modelUrl;
  
  const roomName = roomData?.name || location.state?.name || 'Sample Room';

  return (
    <div className="work-environment-page">
      <div className="work-environment-header">
        <div className="header-left">
          <button onClick={handleBackToRooms} className="back-button">
            ← Back
          </button>
          <h1>{roomName}</h1>
        </div>
        <div className="header-right">
          <button 
            className={`toggle-button ${showStats ? 'active' : ''}`}
            onClick={handleToggleStats}
            title="Toggle performance stats"
          >
            Stats
          </button>
        </div>
      </div>

      <div className="work-environment-content">
        <ToolPanel onSave={handleSaveScene} />
        
        <div className="canvas-container">
          {isLoading && !modelUrlToPass && ( // Show loading only if there's no model URL yet and we are fetching room data
            <div className="canvas-loading-overlay">
              <Loading size={60} />
              <p>Fetching room details...</p>
            </div>
          )}
          {isLoading && modelUrlToPass && ( // Show loading for model if modelUrl is present
             <div className="canvas-loading-overlay">
              <Loading size={60} />
              <p>Loading 3D environment...</p>
            </div>
          )}
          {!isLoading && !modelUrlToPass && roomData && ( // If done loading room data but no model
            <div className="canvas-loading-overlay">
              <p>No 3D model available for this room.</p>
            </div>
          )}
          {error && roomData && ( // If there was an error but some roomData (like name) loaded
             <div className="canvas-loading-overlay">
               <p>Error loading model: {error}</p> {/* This error is the general fetch error, RoomModel has its own error display */}
             </div>
          )}
          
          {modelUrlToPass && ( // Only render canvas if modelUrlToPass is available
            <ErrorBoundary fallbackMessage="Failed to render 3D environment">
              <Canvas
                ref={canvasRef}
                shadows
                gl={{ 
                  antialias: true, 
                  preserveDrawingBuffer: true,
                  alpha: false
                }}
                style={{ background: '#ffffff' }}
                dpr={[1, 2]}
              >
                <StatsPanel show={showStats} />
                
                <PerspectiveCamera 
                  makeDefault 
                  position={[1.5, 1.7, 1.5]} 
                  fov={75} 
                  near={0.01} 
                  far={1000} 
                />
                
                <ambientLight intensity={0.8} />
                <directionalLight 
                  position={[10, 10, 10]} 
                  intensity={1.2} 
                  castShadow 
                  shadow-mapSize={[2048, 2048]}
                  shadow-camera-left={-10}
                  shadow-camera-right={10}
                  shadow-camera-top={10}
                  shadow-camera-bottom={-10}
                />
                <directionalLight position={[-10, 10, -10]} intensity={0.6} />
                <pointLight position={[0, 6, 0]} intensity={0.7} />
                
                <Environment preset="apartment" background={false} />
                <ContactShadows 
                  position={[0, -0.01, 0]} 
                  opacity={0.4} 
                  width={10} 
                  height={10} 
                  blur={1.5} 
                  far={0.8} 
                />
                
                <Suspense fallback={<LoadingIndicator />}>
                  <RoomModel 
                    modelUrl={modelUrlToPass}
                    onLoaded={handleModelLoaded}
                    componentTags={componentTags}
                    selectedWallTexture={selectedWallTexture}
                    selectedFloorTexture={selectedFloorTexture}
                  />
                </Suspense>
                
                <OrbitControls
                  makeDefault
                  minDistance={0.1}
                  maxDistance={50}
                  enableDamping={true}
                  dampingFactor={0.05}
                  rotateSpeed={0.5}
                />
              </Canvas>
            </ErrorBoundary>
          )}
        </div>
        
        <div className="properties-panel">
          <div className="properties-panel-header">
            <h3>Properties</h3>
          </div>
          <div className="properties-content">
            <div className="property-group">
              <label>Room Type</label>
              <div className="property-value">{roomData?.type || 'Standard'}</div>
            </div>
            <div className="property-group">
              <label>Description</label>
              <div className="property-value description">
                {roomData?.description || 'No description available'}
              </div>
            </div>
          </div>
        </div>
      </div>
      { (wallTextures.length > 0 || floorTextures.length > 0) && (
        <div className="texture-applier-section">
          <TextureApplier
            wallTextures={wallTextures}
            floorTextures={floorTextures}
            onApplyWallTexture={handleApplyWallTexture}
            onApplyFloorTexture={handleApplyFloorTexture}
            activeWallTexture={selectedWallTexture}
            activeFloorTexture={selectedFloorTexture}
          />
        </div>
      )}
    </div>
  );
}