
import React, { useRef, useEffect, useState, useMemo, Suspense, useCallback } from 'react'; // Added useCallback
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Bounds } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as THREE from 'three';
import Loading from '../../components/Loading'; // Import Loading
import ErrorBoundary from '../../components/ErrorBoundary'; // Import ErrorBoundary

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

        // --- Scaling Logic (same as before, consider centering as well) ---
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
          setObject(parsedObj); // Set the final object
        };

        // --- Texture Loading Logic (same as before, using textureUrl) ---
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
        // --- End Texture Loading ---

      } catch (error) {
        if (!cancelled) {
          console.error("Error processing OBJ blob:", error);
          setObject(null);
        }
      }
    }

    loadObjFromBlob();

    loadObjFromBlob();

    // Cleanup function
    return () => {
      cancelled = true;
      if (currentMaterial) {
        if (currentMaterial.map) currentMaterial.map.dispose();
        currentMaterial.dispose();
      }
      // No need to explicitly dispose geometry/object here if managed by parent/React
    };
  }, [objBlob, textureUrl, targetWidth, targetHeight, targetLength]);

  return object ? <primitive object={object} /> : null;
});

// FurniturePreview component
export default function FurniturePreview({ objFile, textures, dimensions, initialObjUrl = null, initialTextureUrls = [] }) {
  const [selectedTextureIndex, setSelectedTextureIndex] = useState(0);
  const [localTextureUrls, setLocalTextureUrls] = useState([]);
  const [initialObjBlob, setInitialObjBlob] = useState(null);
  const [isLoadingInitialObj, setIsLoadingInitialObj] = useState(false);
  const prevLocalUrlsRef = useRef([]);
  const canvasRef = useRef();
  const [isContextLost, setIsContextLost] = useState(false);
  const [forceUpdateKey, setForceUpdateKey] = useState(0);

  // Effect to create/revoke URLs for user-uploaded textures
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
      setSelectedTextureIndex(0);
    }

    return () => {
      prevLocalUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      prevLocalUrlsRef.current = [];
    };
  }, [textures]); // Rerun only when user-provided textures change

  useEffect(() => {
    let isActive = true;
    if (initialObjUrl && !objFile) {
      setIsLoadingInitialObj(true);
      setInitialObjBlob(null);
      fetch(initialObjUrl)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch initial OBJ file');
          return res.blob();
        })
        .then(blob => {
          if (isActive) {
            setInitialObjBlob(blob);
          }
        })
        .catch(err => {
          if (isActive) {
            console.error("Error fetching initial OBJ blob:", err);
            setInitialObjBlob(null);
          }
        })
        .finally(() => {
          if (isActive) {
            setIsLoadingInitialObj(false);
          }
        });
    } else {
      setInitialObjBlob(null);
      setIsLoadingInitialObj(false);
    }
    return () => { isActive = false; };
  }, [initialObjUrl, objFile]);

  const displayObjBlob = objFile instanceof Blob ? objFile : initialObjBlob;
  const displayTextureUrls = localTextureUrls.length > 0 ? localTextureUrls : initialTextureUrls;

  const currentTextureUrl = useMemo(() => {
    return displayTextureUrls[selectedTextureIndex] || null;
  }, [displayTextureUrls, selectedTextureIndex]);

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

  return (
    <div className="furniture-preview" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
      <h2 style={{ marginLeft: 0, marginRight: 0, textAlign: 'left' }}>3D Preview</h2>
      <div
        className="preview-container"
        style={{
          marginLeft: 0,
          marginRight: 0,
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {showLoading ? (
           <div style={{ textAlign: 'center', color: 'var(--text-light)' }}>
             <Loading size={40} />
             <p style={{ marginTop: '10px' }}>Loading Initial Model...</p>
           </div>
        ) : canPreview ? (
          <ErrorBoundary fallbackMessage="Failed to render 3D preview.">
            {isContextLost && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, textAlign: 'center', padding: '1rem', borderRadius: 'inherit' }}>
                WebGL Context Lost. Please wait or try reloading the model.
              </div>
            )}
            <Canvas
              ref={canvasRef}
              key={forceUpdateKey}
              style={{ background: '#9ACBD0', width: '100%', height: '100%', display: 'block', opacity: isContextLost ? 0.5 : 1 }}
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
                   <meshStandardMaterial color="orange" />
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
      </div>
      {canPreview && !isContextLost && displayTextureUrls.length > 1 && (
        <div className="texture-controls">
          <h3>Available Textures</h3>
          <div className="texture-switcher">
            {displayTextureUrls.map((url, index) => (
              <button
                key={index}
                className={index === selectedTextureIndex ? 'selected' : ''}
                onClick={() => setSelectedTextureIndex(index)}
                title={`Texture ${index + 1}`}
              >
                <img src={url} alt={`Texture ${index + 1}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}