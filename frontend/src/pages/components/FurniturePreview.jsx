import React, { useRef, useEffect, useState, useMemo, Suspense, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Bounds } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as THREE from 'three';
import Loading from '../../components/Loading';
import ErrorBoundary from '../../components/ErrorBoundary';
import { auth } from '../../services/firebase';
import './FurniturePreview.css';

// ModelLoader component
const ModelLoader = React.memo(function ModelLoader({ objBlob, textureUrl, dimensions }) {
  const [object, setObject] = useState(null);
  const loaderRef = useRef(new OBJLoader());
  const { width: rawWidth = 1, height: rawHeight = 1, length: rawLength = 1 } = dimensions || {};
  const targetWidth = Math.max(Number(rawWidth) || 0, 0.001);
  const targetHeight = Math.max(Number(rawHeight) || 0, 0.001);
  const targetLength = Math.max(Number(rawLength) || 0, 0.001);

  useEffect(() => {
    let currentMaterial = null;
    let cancelled = false;
    setObject(null);

    if (!objBlob) {
      return;
    }

    async function loadObjFromBlob() {
      try {
        const objText = await objBlob.text();
        if (cancelled) return;

        const parsedObj = loaderRef.current.parse(objText);

        const box = new THREE.Box3().setFromObject(parsedObj);
        const originalSize = box.getSize(new THREE.Vector3());
        const originalCenter = box.getCenter(new THREE.Vector3());

        const originalWidth = Math.max(originalSize.x, 0.001);
        const originalHeight = Math.max(originalSize.y, 0.001);
        const originalLength = Math.max(originalSize.z, 0.001);

        const scaleX = targetWidth / originalWidth;
        const scaleY = targetHeight / originalHeight;
        const scaleZ = targetLength / originalLength;

        const scaledBox = new THREE.Box3().setFromObject(parsedObj);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        parsedObj.position.sub(scaledCenter);

        const applyMaterial = (material) => {
          if (cancelled) return;
          if (currentMaterial) {
            if (currentMaterial.map) currentMaterial.map.dispose();
            currentMaterial.dispose();
          }
          currentMaterial = material;

          parsedObj.traverse(child => {
            if (child.isMesh) {
              child.material = material;
              child.material.needsUpdate = true;
            }
          });
          setObject(parsedObj);
        };

        if (textureUrl) {
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load(
            textureUrl,
            (mapTexture) => {
              if (cancelled) return;
              mapTexture.wrapS = mapTexture.wrapT = THREE.RepeatWrapping;
              mapTexture.encoding = THREE.sRGBEncoding;
              mapTexture.needsUpdate = true;
              applyMaterial(new THREE.MeshStandardMaterial({
                  map: mapTexture,
                  side: THREE.DoubleSide,
                  metalness: 0.1,
                  roughness: 0.8
              }));
            },
            undefined,
            (err) => {
              if (cancelled) return;
              console.error('Error loading texture:', err);
              applyMaterial(new THREE.MeshStandardMaterial({
                  color: '#999999',
                  side: THREE.DoubleSide,
                  metalness: 0.1,
                  roughness: 0.8
              }));
            }
          );
        } else {
          applyMaterial(new THREE.MeshStandardMaterial({
              color: '#999999',
              side: THREE.DoubleSide,
              metalness: 0.1,
              roughness: 0.8
          }));
        }

      } catch (error) {
        if (!cancelled) {
          console.error("Error processing OBJ blob:", error);
          setObject(null);
        }
      }
    }

    loadObjFromBlob();

    return () => {
      cancelled = true;
      if (currentMaterial) {
        if (currentMaterial.map) currentMaterial.map.dispose();
        currentMaterial.dispose();
      }
    };
  }, [objBlob, textureUrl, targetWidth, targetHeight, targetLength]);

  return object ? <primitive object={object} /> : null;
});

// FurniturePreview component
export default function FurniturePreview({ objFile, textures, dimensions, initialObjUrl = null, initialTextureUrls = [], furnitureId, isEditMode = false }) {
  const [selectedTextureIndex, setSelectedTextureIndex] = useState(0);
  const [localTextureUrls, setLocalTextureUrls] = useState([]);
  const [initialObjBlob, setInitialObjBlob] = useState(null);
  const [isLoadingInitialObj, setIsLoadingInitialObj] = useState(false);
  const [isUploadingTextures, setIsUploadingTextures] = useState(false);
  const [isDeletingTexture, setIsDeletingTexture] = useState(false);
  const [combinedTextureUrls, setCombinedTextureUrls] = useState([]);
  const prevLocalUrlsRef = useRef([]);
  const canvasRef = useRef();
  const [isContextLost, setIsContextLost] = useState(false);
  const [forceUpdateKey, setForceUpdateKey] = useState(0);
  const fileInputRef = useRef(null);
  const isUpdateMode = initialObjUrl || initialTextureUrls.length > 0;

  useEffect(() => {
    const validTextures = textures?.filter(t => t instanceof Blob) || [];
    if (validTextures.length > 0) {
      const newUrls = validTextures.map(textureFile => URL.createObjectURL(textureFile));
      setLocalTextureUrls(newUrls);
      setSelectedTextureIndex(0);

      prevLocalUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      prevLocalUrlsRef.current = newUrls;
    } else {
      prevLocalUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      prevLocalUrlsRef.current = [];
      setLocalTextureUrls([]);
    }

    return () => {
      prevLocalUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      prevLocalUrlsRef.current = [];
    };
  }, [textures]);

  useEffect(() => {
    if (localTextureUrls.length > 0) {
      setCombinedTextureUrls([...localTextureUrls]);
      if (localTextureUrls.length > 0 && selectedTextureIndex >= localTextureUrls.length) {
        setSelectedTextureIndex(0);
      }
    } else {
      setCombinedTextureUrls([...initialTextureUrls]);
      if (initialTextureUrls.length > 0 && selectedTextureIndex >= initialTextureUrls.length) {
        setSelectedTextureIndex(0);
      }
    }
  }, [localTextureUrls, initialTextureUrls, selectedTextureIndex]);

  useEffect(() => {
    let isActive = true;
    if (initialObjUrl && !objFile) {
      setIsLoadingInitialObj(true);
      setInitialObjBlob(null);
      
      const fetchInitialObj = async () => {
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
          
          if (!response.ok) throw new Error('Failed to fetch initial OBJ file');
          const blob = await response.blob();
          if (isActive) {
            setInitialObjBlob(blob);
          }
        } catch (err) {
          if (isActive) {
            console.error("Error fetching initial OBJ blob:", err);
            setInitialObjBlob(null);
          }
        } finally {
          if (isActive) {
            setIsLoadingInitialObj(false);
          }
        }
      };
      
      fetchInitialObj();
    } else {
      setInitialObjBlob(null);
      setIsLoadingInitialObj(false);
    }
    return () => { isActive = false; };
  }, [initialObjUrl, objFile]);

  const displayObjBlob = objFile instanceof Blob ? objFile : initialObjBlob;

  const currentTextureUrl = useMemo(() => {
    return combinedTextureUrls[selectedTextureIndex] || null;
  }, [combinedTextureUrls, selectedTextureIndex]);

  const numericDimensions = useMemo(() => ({
    width: Number(dimensions?.width) || 1,
    height: Number(dimensions?.height) || 1,
    length: Number(dimensions?.length) || 1,
  }), [dimensions]);

  const showLoading = isLoadingInitialObj && !objFile;
  const canPreview = !!displayObjBlob;

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
      
      const response = await fetch(`http://localhost:3001/api/furniture/${furnitureId}/textures`, {
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
      
      const response = await fetch(`http://localhost:3001/api/furniture/${furnitureId}/textures/delete`, {
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
             <p style={{ marginTop: '10px' }}>Loading Initial Model...</p>
           </div>
        ) : canPreview ? (
          <ErrorBoundary fallbackMessage="Failed to render 3D preview.">
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
              key={forceUpdateKey}
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
              gl={{ antialias: true }}
              onCreated={({ gl }) => {
                if (gl.getContext().isContextLost()) {
                  console.warn('WebGL Context Lost immediately after creation!');
                  setIsContextLost(true);
                }
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
                    objBlob={displayObjBlob}
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
            <span>{initialObjUrl ? 'Could not load initial model' : 'Upload a 3D model to see preview'}</span>
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