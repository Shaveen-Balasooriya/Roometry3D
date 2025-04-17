import React, { useRef, useEffect, useState, useMemo, Suspense } from 'react'; // Added Suspense
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Bounds } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as THREE from 'three';
import Loading from '../../components/Loading'; // Import Loading

// Keep ModelLoader mostly the same, but ensure it handles Blob URLs correctly
const ModelLoader = React.memo(function ModelLoader({ objBlob, textureUrl, dimensions }) {
  const [object, setObject] = useState(null);
  const loaderRef = useRef(new OBJLoader());
  const { width = 1, height = 1, length = 1 } = dimensions || {};

  useEffect(() => {
    let currentMaterial = null;
    let cancelled = false;
    setObject(null); // Reset object on change

    if (!objBlob) {
      return; // Exit if no blob is provided
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

        // Use max dimension scaling for uniform scaling based on target dimensions
        const maxObjDim = Math.max(originalSize.x, originalSize.y, originalSize.z, 0.001);
        const maxTargetDim = Math.max(width, height, length, 0.001);
        const scale = maxTargetDim / maxObjDim;

        parsedObj.scale.set(scale, scale, scale);

        // Recalculate bounds and center after scaling
        const scaledBox = new THREE.Box3().setFromObject(parsedObj);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        // Apply translation to center the model
        parsedObj.position.sub(scaledCenter);
        // --- End Scaling & Centering ---


        const applyMaterial = (material) => {
          if (cancelled) return; // Check cancellation before applying
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
              mapTexture.encoding = THREE.sRGBEncoding; // Use sRGB for color textures
              mapTexture.needsUpdate = true;
              applyMaterial(new THREE.MeshStandardMaterial({
                  map: mapTexture,
                  side: THREE.DoubleSide, // Render both sides
                  metalness: 0.1, // Adjust as needed
                  roughness: 0.8  // Adjust as needed
              }));
            },
            undefined, // Progress callback (optional)
            (err) => { // Error callback
              if (cancelled) return;
              console.error('Error loading texture:', err);
              applyMaterial(new THREE.MeshStandardMaterial({
                  color: '#999999', // Fallback color
                  side: THREE.DoubleSide,
                  metalness: 0.1,
                  roughness: 0.8
              }));
            }
          );
        } else {
          // Apply default material if no textureUrl
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
          setObject(null); // Clear object on error
        }
      }
    }

    loadObjFromBlob();

    // Cleanup function
    return () => {
      cancelled = true; // Mark as cancelled
      if (currentMaterial) {
        if (currentMaterial.map) currentMaterial.map.dispose();
        currentMaterial.dispose();
      }
      // No need to explicitly dispose geometry/object here if managed by parent/React
    };
  }, [objBlob, textureUrl, width, height, length]); // Dependencies

  // Render the primitive if object exists
  return object ? <primitive object={object} /> : null;
});


// Added initialObjUrl, initialTextureUrls props
export default function FurniturePreview({ objFile, textures, dimensions, initialObjUrl = null, initialTextureUrls = [] }) {
  const [selectedTextureIndex, setSelectedTextureIndex] = useState(0);
  const [localTextureUrls, setLocalTextureUrls] = useState([]); // URLs from user-uploaded textures
  const [initialObjBlob, setInitialObjBlob] = useState(null); // Fetched initial OBJ
  const [isLoadingInitialObj, setIsLoadingInitialObj] = useState(false);
  const prevLocalUrlsRef = useRef([]);

  // Effect to create/revoke URLs for user-uploaded textures
  useEffect(() => {
    const validTextures = textures?.filter(t => t instanceof Blob) || [];
    if (validTextures.length > 0) {
      const newUrls = validTextures.map(textureFile => URL.createObjectURL(textureFile));
      setLocalTextureUrls(newUrls);
      setSelectedTextureIndex(0); // Reset index when new textures are added

      // Revoke previous local URLs
      prevLocalUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      prevLocalUrlsRef.current = newUrls;
    } else {
      // If user removes all textures, clear local URLs
      prevLocalUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      prevLocalUrlsRef.current = [];
      setLocalTextureUrls([]);
      setSelectedTextureIndex(0); // Reset index
    }

    // Cleanup on unmount
    return () => {
      prevLocalUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      prevLocalUrlsRef.current = [];
    };
  }, [textures]); // Rerun only when user-provided textures change

  // Effect to fetch the initial OBJ model if provided and no user file exists
  useEffect(() => {
    let isActive = true;
    if (initialObjUrl && !objFile) { // Only fetch if initial URL exists and no user file
      setIsLoadingInitialObj(true);
      setInitialObjBlob(null); // Clear previous blob
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
      setInitialObjBlob(null); // Clear initial blob if user provides a file or no initial URL
      setIsLoadingInitialObj(false);
    }
    return () => { isActive = false; };
  }, [initialObjUrl, objFile]); // Rerun if initial URL changes or user adds/removes objFile

  // Determine which source to use for preview
  const displayObjBlob = objFile instanceof Blob ? objFile : initialObjBlob;
  const displayTextureUrls = localTextureUrls.length > 0 ? localTextureUrls : initialTextureUrls;

  // Determine the current texture URL based on the selected index and available URLs
  const currentTextureUrl = useMemo(() => {
    return displayTextureUrls[selectedTextureIndex] || null;
  }, [displayTextureUrls, selectedTextureIndex]);

  const showLoading = isLoadingInitialObj && !objFile;
  const canPreview = !!displayObjBlob;

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
          display: 'flex', // Added for centering loading/empty states
          alignItems: 'center', // Added
          justifyContent: 'center', // Added
        }}
      >
        {showLoading ? (
           <div style={{ textAlign: 'center', color: 'var(--text-light)' }}>
             <Loading size={40} />
             <p style={{ marginTop: '10px' }}>Loading Initial Model...</p>
           </div>
        ) : canPreview ? (
          <Canvas
            style={{ background: '#9ACBD0', width: '100%', height: '100%', display: 'block' }}
            camera={{ position: [0, 1, 5], fov: 50 }}
            frameloop="demand" // Use demand to only render on changes/controls
            dpr={[1, 2]} // Pixel ratio
            shadows // Enable shadows
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
                  objBlob={displayObjBlob} // Pass the determined blob
                  textureUrl={currentTextureUrl} // Pass the determined texture URL
                  dimensions={dimensions}
                />
              </Bounds>
            </Suspense>

            <OrbitControls
              makeDefault
              minDistance={0.5}
              maxDistance={15} // Increased max distance
              enableDamping={true}
              dampingFactor={0.1}
            />
          </Canvas>
        ) : (
          <div className="empty-preview">
            <span>{initialObjUrl ? 'Could not load initial model' : 'Upload a 3D model to see preview'}</span>
          </div>
        )}
      </div>
      {/* Texture Switcher - uses displayTextureUrls */}
      {canPreview && displayTextureUrls.length > 1 && (
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