import React, { useRef, useEffect, useState, useMemo, Suspense, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Bounds, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import Loading from '../../components/Loading';
import ErrorBoundary from '../../components/ErrorBoundary';
import { auth } from '../../services/firebase';
import './FurniturePreview.css';
const API_URL = import.meta.env.VITE_BACKEND_URL;

// ModelLoader component
const ModelLoader = React.memo(function ModelLoader({ modelBlob, textureUrl, dimensions }) {
  const [object, setObject] = useState(null);
  const [error, setError] = useState(null);
  const { width: rawWidth = 1, height: rawHeight = 1, length: rawLength = 1 } = dimensions || {};
  const targetWidth = Math.max(Number(rawWidth) || 0, 0.001);
  const targetHeight = Math.max(Number(rawHeight) || 0, 0.001);
  const targetLength = Math.max(Number(rawLength) || 0, 0.001);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    
    setObject(null);
    setError(null);

    if (!modelBlob) {
      console.log("ModelLoader: No model blob provided");
      return;
    }

    console.log("ModelLoader: Loading model from blob", 
      modelBlob.type, 
      modelBlob.size, 
      modelBlob instanceof File ? modelBlob.name : 'unnamed blob'
    );

    const loadModel = async () => {
      try {
        // Create a blob URL for the GLB file
        objectUrl = URL.createObjectURL(modelBlob);
        console.log("ModelLoader: Created blob URL", objectUrl);
        
        if (cancelled) return;

        // Create a new instance of GLTFLoader
        const loader = new GLTFLoader();
        
        // Load the model using a Promise to handle async loading
        const gltf = await new Promise((resolve, reject) => {
          loader.load(
            objectUrl,
            resolve,
            (progress) => {
              const percent = Math.round((progress.loaded / progress.total) * 100);
              console.log(`ModelLoader: Loading progress ${percent}%`);
            },
            reject
          );
        });
        
        console.log("ModelLoader: Successfully loaded gltf:", gltf);

        if (!gltf.scene) {
          throw new Error("Loaded model doesn't have a scene");
        }

        // Clone the scene to avoid mutating the cached original
        const modelScene = gltf.scene.clone();
        console.log("ModelLoader: Scene cloned");

        // Calculate bounding box and size
        const box = new THREE.Box3().setFromObject(modelScene);
        const originalSize = box.getSize(new THREE.Vector3());
        const originalCenter = box.getCenter(new THREE.Vector3());

        console.log("ModelLoader: Original dimensions", originalSize);
        console.log("ModelLoader: Target dimensions", targetWidth, targetHeight, targetLength);

        const originalWidth = Math.max(originalSize.x, 0.001);
        const originalHeight = Math.max(originalSize.y, 0.001);
        const originalLength = Math.max(originalSize.z, 0.001);

        // Calculate scale factors to match target dimensions
        const scaleX = targetWidth / originalWidth;
        const scaleY = targetHeight / originalHeight;
        const scaleZ = targetLength / originalLength;

        console.log("ModelLoader: Scale factors", scaleX, scaleY, scaleZ);

        // Apply scaling to the model
        modelScene.scale.set(scaleX, scaleY, scaleZ);

        // Center the model
        const scaledBox = new THREE.Box3().setFromObject(modelScene);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
        modelScene.position.sub(scaledCenter);
        
        // Apply material if texture is available
        if (textureUrl) {
          console.log("ModelLoader: Attempting to apply texture:", textureUrl);
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load(
            textureUrl,
            (texture) => {
              if (cancelled) return;
              console.log("ModelLoader: Texture loaded successfully");
              texture.wrapS = THREE.RepeatWrapping;
              texture.wrapT = THREE.RepeatWrapping;
              texture.repeat.set(1, 1); // Changed from 2,2 to 1,1 for proper texture scale
              
              // Create material with texture
              const material = new THREE.MeshStandardMaterial({
                map: texture,
                side: THREE.DoubleSide,
                metalness: 0.1,
                roughness: 0.8
              });
              
              // Apply material to all meshes in the scene
              modelScene.traverse((child) => {
                if (child.isMesh) {
                  // Dispose of old material to prevent memory leaks
                  if (child.material) {
                    if (Array.isArray(child.material)) {
                      child.material.forEach(mat => mat.dispose());
                    } else {
                      child.material.dispose();
                    }
                  }
                  // Apply new material
                  child.material = material;
                }
              });
              
              console.log("ModelLoader: Setting object with texture applied");
              setObject(modelScene);
            },
            // Progress callback
            (progress) => {
              console.log(`ModelLoader: Texture loading progress: ${Math.round((progress.loaded / progress.total) * 100)}%`);
            },
            // Error callback
            (err) => {
              console.error('ModelLoader: Failed to load texture:', err);
              // Still set the object even if texture fails
              setObject(modelScene);
            }
          );
        } else {
          // Just set the object with its original materials
          console.log("ModelLoader: No texture provided, using original materials");
          setObject(modelScene);
        }
      } catch (error) {
        console.error("ModelLoader: Error processing model:", error);
        setError(error.message || "Failed to load 3D model");
      }
    };

    loadModel();

    return () => {
      cancelled = true;
      if (objectUrl) {
        console.log("ModelLoader: Cleaning up blob URL");
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [modelBlob, textureUrl, targetWidth, targetHeight, targetLength]);

  if (error) {
    return (
      <Html center>
        <div style={{ 
          background: 'rgba(255, 0, 0, 0.1)', 
          padding: '10px', 
          borderRadius: '5px',
          color: '#c53030',
          maxWidth: '80%',
          textAlign: 'center'
        }}>
          <p>Error loading model: {error}</p>
        </div>
      </Html>
    );
  }

  return object ? <primitive object={object} /> : null;
});

// FurniturePreview component
export default function FurniturePreview({ objFile, textures, dimensions, initialObjUrl = null, initialTextureUrls = [], furnitureId, isEditMode = false }) {
  const [selectedTextureIndex, setSelectedTextureIndex] = useState(0);
  const [localTextureUrls, setLocalTextureUrls] = useState([]);
  const [initialModelBlob, setInitialModelBlob] = useState(null);
  const [isLoadingInitialModel, setIsLoadingInitialModel] = useState(false);
  const [isUploadingTextures, setIsUploadingTextures] = useState(false);
  const [isDeletingTexture, setIsDeletingTexture] = useState(false);
  const [combinedTextureUrls, setCombinedTextureUrls] = useState([]);
  const prevLocalUrlsRef = useRef([]);
  const canvasRef = useRef();
  const [isContextLost, setIsContextLost] = useState(false);
  const [forceUpdateKey, setForceUpdateKey] = useState(0);
  const fileInputRef = useRef(null);
  const isUpdateMode = initialObjUrl || initialTextureUrls.length > 0;
  
  // Debug logging for props
  useEffect(() => {
    console.log("FurniturePreview: Received objFile prop:", objFile);
    console.log("FurniturePreview: objFile type:", objFile ? typeof objFile : 'none');
    console.log("FurniturePreview: objFile instance of File:", objFile instanceof File);
    console.log("FurniturePreview: objFile instance of Blob:", objFile instanceof Blob);
    if (objFile) {
      console.log("FurniturePreview: objFile name:", objFile.name);
      console.log("FurniturePreview: objFile type:", objFile.type);
      console.log("FurniturePreview: objFile size:", objFile.size);
    }
    console.log("FurniturePreview: textures prop:", textures);
    console.log("FurniturePreview: dimensions prop:", dimensions);
  }, [objFile, textures, dimensions]);

  useEffect(() => {
    const validTextures = textures?.filter(t => t instanceof Blob) || [];
    if (validTextures.length > 0) {
      const newUrls = validTextures.map(textureFile => URL.createObjectURL(textureFile));
      
      // Cleanup previous URLs before setting new ones
      prevLocalUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      
      setLocalTextureUrls(newUrls);
      // Reset selected index safely when we have new textures
      setSelectedTextureIndex(0);
      
      prevLocalUrlsRef.current = newUrls;
    } else if (prevLocalUrlsRef.current.length > 0 && validTextures.length === 0) {
      // Only clean up if we previously had URLs but now don't
      prevLocalUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      prevLocalUrlsRef.current = [];
      setLocalTextureUrls([]);
    }

    return () => {
      prevLocalUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, [textures]);

  // Effect to combine local and initial texture URLs
  useEffect(() => {
    const texturesToUse = localTextureUrls.length > 0 
      ? [...localTextureUrls] 
      : [...initialTextureUrls];
    
    if (JSON.stringify(texturesToUse) !== JSON.stringify(combinedTextureUrls)) {
      setCombinedTextureUrls(texturesToUse);
    }
  }, [localTextureUrls, initialTextureUrls]);

  // Safety check for selectedTextureIndex
  useEffect(() => {
    if (combinedTextureUrls.length > 0 && selectedTextureIndex >= combinedTextureUrls.length) {
      setSelectedTextureIndex(0);
    }
  }, [combinedTextureUrls, selectedTextureIndex]);

  // Define displayModelBlob and canPreview at the top level to avoid reference errors
  const [displayModelBlob, setDisplayModelBlob] = useState(null);
  const canPreview = !!displayModelBlob;

  useEffect(() => {
    let isActive = true;
    
    // Update displayModelBlob whenever objFile or initialModelBlob changes
    const newDisplayModelBlob = (objFile instanceof Blob || objFile instanceof File) ? objFile : initialModelBlob;
    setDisplayModelBlob(newDisplayModelBlob);
    
    // Debug info
    console.log("FurniturePreview: displayModelBlob determined:", newDisplayModelBlob);
    console.log("FurniturePreview: canPreview value:", !!newDisplayModelBlob);

    if (initialObjUrl && !objFile) {
      setIsLoadingInitialModel(true);
      setInitialModelBlob(null);
      
      const fetchInitialModel = async () => {
        try {
          const user = auth.currentUser;
          if (!user) {
            throw new Error('You must be logged in to access this model');
          }
          
          const idToken = await user.getIdToken();
          
          const response = await fetch(initialObjUrl, {
            headers: {
              'Authorization': `Bearer ${idToken}`
            }
          });
          
          if (!response.ok) throw new Error('Failed to fetch initial model file');
          const blob = await response.blob();
          if (isActive) {
            setInitialModelBlob(blob);
            // Update displayModelBlob when initialModelBlob changes
            setDisplayModelBlob(blob);
            console.log("FurniturePreview: initialModelBlob loaded:", blob);
          }
        } catch (err) {
          if (isActive) {
            console.error("Error fetching initial model blob:", err);
            setInitialModelBlob(null);
            setDisplayModelBlob(null);
          }
        } finally {
          if (isActive) {
            setIsLoadingInitialModel(false);
          }
        }
      };
      
      fetchInitialModel();
    } else {
      setInitialModelBlob(null);
      setIsLoadingInitialModel(false);
    }
    return () => { isActive = false; };
  }, [initialObjUrl, objFile, initialModelBlob]);

  const currentTextureUrl = useMemo(() => {
    return combinedTextureUrls.length > 0 ? 
      combinedTextureUrls[selectedTextureIndex] || null : 
      null;
  }, [combinedTextureUrls, selectedTextureIndex]);

  const numericDimensions = useMemo(() => ({
    width: Number(dimensions?.width) || 1,
    height: Number(dimensions?.height) || 1,
    length: Number(dimensions?.length) || 1,
  }), [dimensions]);

  const showLoading = isLoadingInitialModel && !objFile;

  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const handleContextLost = (event) => {
      event.preventDefault();
      console.warn('WebGL Context Lost!');
      setIsContextLost(true);
    };

    const handleContextRestored = () => {
      console.log('WebGL Context Restored.');
      setIsContextLost(false);
      setForceUpdateKey(prev => prev + 1);
    };

    canvasElement.addEventListener('webglcontextlost', handleContextLost, false);
    canvasElement.addEventListener('webglcontextrestored', handleContextRestored, false);

    return () => {
      canvasElement.removeEventListener('webglcontextlost', handleContextLost);
      canvasElement.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, []);

  const handleAddTextures = useCallback(async (e) => {
    const files = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
    
    if (files.length === 0 || !furnitureId) return;
    
    setIsUploadingTextures(true);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to add textures');
      }
      
      const idToken = await user.getIdToken();
      
      const formData = new FormData();
      files.forEach(file => {
        formData.append('textures', file);
      });
      
      const response = await fetch(`${API_URL}/api/furniture/${furnitureId}/textures`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${idToken}`
        },
        body: formData
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload textures');
      }
      
      const result = await response.json();
      
      prevLocalUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      prevLocalUrlsRef.current = [];
      setLocalTextureUrls([]);
      
      if (result.textureUrls && Array.isArray(result.textureUrls)) {
        console.log("Texture upload successful, refreshing page to display new textures");
        window.location.reload();
        setCombinedTextureUrls(result.textureUrls);
        if (result.newTextureUrls && result.newTextureUrls.length > 0) {
          const firstNewTextureUrl = result.newTextureUrls[0];
          const newIndex = result.textureUrls.findIndex(url => url === firstNewTextureUrl);
          setSelectedTextureIndex(newIndex >= 0 ? newIndex : 0);
        }
        setForceUpdateKey(prev => prev + 1);
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Error uploading textures:', error);
      alert('Failed to upload textures: ' + error.message);
    } finally {
      setIsUploadingTextures(false);
    }
  }, [furnitureId]);

  const handleDeleteTexture = useCallback(async () => {
    if (combinedTextureUrls.length <= 1) {
      alert("Cannot delete the last texture. At least one texture is required.");
      return;
    }
    
    if (!furnitureId || selectedTextureIndex < 0 || selectedTextureIndex >= combinedTextureUrls.length) {
      return;
    }
    
    const textureToDelete = combinedTextureUrls[selectedTextureIndex];
    
    setIsDeletingTexture(true);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to delete textures');
      }
      
      const idToken = await user.getIdToken();
      
      const response = await fetch(`${API_URL}/api/furniture/${furnitureId}/textures/delete`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          textureUrl: textureToDelete
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete texture');
      }
      
      const result = await response.json();
      
      if (result.success) {
        console.log("Texture deleted successfully, refreshing page");
        window.location.reload();
        const updatedTextures = combinedTextureUrls.filter((_, index) => index !== selectedTextureIndex);
        setCombinedTextureUrls(updatedTextures);
        if (selectedTextureIndex >= updatedTextures.length) {
          setSelectedTextureIndex(Math.max(0, updatedTextures.length - 1));
        }
      }
      
    } catch (error) {
      console.error('Error deleting texture:', error);
      alert('Failed to delete texture: ' + error.message);
    } finally {
      setIsDeletingTexture(false);
    }
  }, [furnitureId, combinedTextureUrls, selectedTextureIndex]);

  return (
    <div className="furniture-preview">
      <div style={{ 
        color: '#00474C',
        position: 'relative',
        paddingBottom: '0.5rem',
        marginBottom: '1rem',
        borderBottom: '2px solid #66B2B8',
      }}>
        <h2 style={{ 
          marginLeft: 0, 
          marginRight: 0, 
          textAlign: 'left',
          fontSize: '1.5rem',
          fontWeight: 600,
          margin: 0,
        }}>
          3D Preview
        </h2>
        <span style={{
          position: 'absolute',
          bottom: '-2px',
          left: '0',
          width: '60px',
          height: '2px',
          backgroundColor: '#ECC94B'
        }}></span>
      </div>

      <div className="preview-container">
        {showLoading ? (
           <div style={{ 
             textAlign: 'center',
             display: 'flex',
             flexDirection: 'column',
             alignItems: 'center',
             justifyContent: 'center',
             height: '100%',
             color: '#718096'
           }}>
             <Loading size={40} />
             <p style={{ marginTop: '10px' }}>Loading Model...</p>
           </div>
        ) : canPreview ? (
          <ErrorBoundary fallbackMessage="Failed to render 3D preview. Please ensure you're uploading a valid GLB file.">
            {isContextLost && (
              <div style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                background: 'rgba(0,0,0,0.7)', 
                color: 'white', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                zIndex: 10, 
                textAlign: 'center', 
                padding: '1rem', 
                borderRadius: 'inherit' 
              }}>
                WebGL Context Lost. Please wait or try reloading the model.
              </div>
            )}
            <Canvas
              ref={canvasRef}
              key={`canvas-${forceUpdateKey}-${displayModelBlob?.name || 'model'}`}
              style={{ 
                background: '#E2F0F1',
                width: '100%', 
                height: '100%', 
                display: 'block', 
                opacity: isContextLost ? 0.5 : 1 
              }}
              camera={{ position: [0, 1, 5], fov: 50 }}
              frameloop="demand"
              dpr={[1, 2]}
              shadows
              gl={{ 
                antialias: true, 
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance',
                failIfMajorPerformanceCaveat: false
              }}
              onCreated={({ gl }) => {
                console.log("Canvas created");
                if (gl.getContext().isContextLost()) {
                  console.warn('WebGL Context Lost immediately after creation!');
                  setIsContextLost(true);
                }
              }}
              onError={(error) => {
                console.error("Canvas error:", error);
              }}
            >
              <ambientLight intensity={0.6} />
              <directionalLight position={[3, 5, 4]} intensity={1.0} castShadow />
              <directionalLight position={[-3, -5, -4]} intensity={0.4} />
              <Environment preset="city" />

              <Suspense fallback={
                <mesh position={[0,0,0]}>
                   <boxGeometry args={[1, 1, 1]} />
                   <meshStandardMaterial color="#66B2B8" />
                </mesh>
              }>
                <Bounds fit clip observe margin={1.5}>
                  <ModelLoader
                    key={`model-${displayModelBlob?.name || 'unnamed'}`}
                    modelBlob={displayModelBlob}
                    textureUrl={currentTextureUrl}
                    dimensions={numericDimensions}
                  />
                </Bounds>
              </Suspense>

              <OrbitControls
                makeDefault
                minDistance={0.5}
                maxDistance={15}
                enableDamping={true}
                dampingFactor={0.1}
                enabled={!isContextLost}
              />
            </Canvas>
          </ErrorBoundary>
        ) : (
          <div className="empty-preview">
            <span>{initialObjUrl ? 'Could not load initial model' : 'Upload a 3D model (.glb) to see preview'}</span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleAddTextures}
        />
        
        {isUploadingTextures && (
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,71,76,0.5)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 20 
          }}>
            <div style={{ 
              background: 'white', 
              padding: '20px', 
              borderRadius: '8px', 
              textAlign: 'center',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              borderLeft: '3px solid #ECC94B'
            }}>
              <Loading size={30} />
              <p style={{ marginTop: '10px', color: '#00474C' }}>Uploading textures...</p>
            </div>
          </div>
        )}
        
        {isDeletingTexture && (
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(0,71,76,0.5)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 20 
          }}>
            <div style={{ 
              background: 'white', 
              padding: '20px', 
              borderRadius: '8px', 
              textAlign: 'center',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              borderLeft: '3px solid #ECC94B'
            }}>
              <Loading size={30} />
              <p style={{ marginTop: '10px', color: '#00474C' }}>Deleting texture...</p>
            </div>
          </div>
        )}
      </div>
      {canPreview && !isContextLost && (
        <div className="texture-controls">
          <div className="texture-controls-header">
            <h3>Available Textures{combinedTextureUrls.length > 0 ? ` (${combinedTextureUrls.length})` : ''}</h3>
            {isUpdateMode && furnitureId && (
              <div className="texture-control-buttons">
                <button 
                  className="add-texture-button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingTextures || isDeletingTexture}
                  title="Add new texture"
                >
                  <span>+</span> Add Texture
                </button>
                {isUpdateMode && combinedTextureUrls.length > 0 && (
                  <button 
                    className="delete-texture-button"
                    onClick={handleDeleteTexture}
                    disabled={isUploadingTextures || isDeletingTexture || combinedTextureUrls.length <= 1}
                    title="Delete selected texture"
                  >
                    <span>-</span> Delete Texture
                  </button>
                )}
              </div>
            )}
          </div>
          {combinedTextureUrls.length > 0 ? (
            <div className="texture-switcher">
              {combinedTextureUrls.map((url, index) => (
                <button
                  key={`texture-${index}`}
                  className={index === selectedTextureIndex ? 'selected' : ''}
                  onClick={() => setSelectedTextureIndex(index)}
                  title={`Texture ${index + 1}`}
                >
                  <img src={url} alt={`Texture ${index + 1}`} />
                </button>
              ))}
            </div>
          ) : (
            <p className="no-textures-message">No textures available</p>
          )}
        </div>
      )}
    </div>
  );
}