import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Bounds, Html, PerspectiveCamera, useProgress } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import * as THREE from 'three';
import ErrorBoundary from '../../components/ErrorBoundary';
import Loading from '../../components/Loading';
import { auth } from '../../services/firebase';
import './ProjectModelViewer.css';

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

// The actual model loader component
const ModelLoader = React.memo(function ModelLoader({ objBlob, textureUrl }) {
  const [object, setObject] = useState(null);
  const [error, setError] = useState(null);
  const loaderRef = useRef(new OBJLoader());
  const API_URL = import.meta.env.VITE_BACKEND_URL;
  useEffect(() => {
    let currentMaterial = null;
    let cancelled = false;

    async function loadObj() {
      try {
        // Reset states
        setObject(null);
        setError(null);
        
        if (!objBlob) return;

        // Parse blob to text
        const objText = await objBlob.text();
        if (cancelled) return;

        // Parse OBJ text to 3D object
        const parsedObj = loaderRef.current.parse(objText);
        
        // Calculate bounding box to center and normalize the model
        const box = new THREE.Box3().setFromObject(parsedObj);
        const center = box.getCenter(new THREE.Vector3());
        
        // Center the model
        parsedObj.position.x = -center.x;
        parsedObj.position.y = -center.y;
        parsedObj.position.z = -center.z;

        // Apply material with or without texture
        const applyMaterial = (material) => {
          if (currentMaterial) {
            if (currentMaterial.map) currentMaterial.map.dispose();
            currentMaterial.dispose();
          }
          currentMaterial = material;

          parsedObj.traverse(child => {
            if (child.isMesh) {
              child.material = material;
              child.material.needsUpdate = true;
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          setObject(parsedObj);
        };

        // Handle texture loading if provided
        if (textureUrl) {
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load(
            textureUrl,
            (mapTexture) => {
              if (cancelled) return;
              
              mapTexture.wrapS = mapTexture.wrapT = THREE.RepeatWrapping;
              mapTexture.encoding = THREE.sRGBEncoding;
              mapTexture.flipY = false;
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
              
              // Fallback material if texture fails
              applyMaterial(new THREE.MeshStandardMaterial({
                color: '#B2DFDB',
                side: THREE.DoubleSide,
                metalness: 0.1,
                roughness: 0.6
              }));
            }
          );
        } else {
          // Default material if no texture provided
          applyMaterial(new THREE.MeshStandardMaterial({
            color: '#B2DFDB',
            side: THREE.DoubleSide, 
            metalness: 0.1,
            roughness: 0.6
          }));
        }
      } catch (err) {
        console.error('Error processing model:', err);
        setError(err.message);
      }
    }

    loadObj();

    // Cleanup
    return () => {
      cancelled = true;
      if (currentMaterial) {
        if (currentMaterial.map) currentMaterial.map.dispose();
        currentMaterial.dispose();
      }
    };
  }, [objBlob, textureUrl]);

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

  return object ? <primitive object={object} /> : null;
});

// Component to rotate model slowly for better showcase
function RotatingModel({ children, isRotating }) {
  const groupRef = useRef();

  useFrame((state, delta) => {
    if (groupRef.current && isRotating) {
      groupRef.current.rotation.y += delta * 0.15; // Slow rotation
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

// Main exported component
export default function ProjectModelViewer({ projectId, texturePath = null, hasControls = true }) {
  const [objBlob, setObjBlob] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [isRotating, setIsRotating] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isContextLost, setIsContextLost] = useState(false);
  const [forceUpdateKey, setForceUpdateKey] = useState(0);
  const canvasRef = useRef();

  // Monitor WebGL context to handle browser issues
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

  // Handle full screen mode
  const handleFullScreenToggle = () => {
    if (!document.fullscreenElement) {
      const container = document.querySelector('.model-viewer-container');
      if (container?.requestFullscreen) {
        container.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullScreenChange);
    };
  }, []);

  // Fetch the OBJ model
  useEffect(() => {
    let isActive = true;
    setObjBlob(null);
    
    const fetchModel = async () => {
      if (!projectId) return;
      
      try {
        setIsLoading(true);
        setLoadError(null);
        
        // Get current user's auth token
        const user = auth.currentUser;
        if (!user) {
          throw new Error('You must be logged in to access this model');
        }
        
        const idToken = await user.getIdToken();
        
        // Fetch the model using our backend proxy instead of direct Firebase Storage URL
        const proxyUrl = `${API_URL}/api/projects/${projectId}/model`;
        
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Accept': 'application/octet-stream'
          },
        });
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Failed to fetch model: ${response.status} ${errorText}`);
        }
        
        const blob = await response.blob();
        if (isActive) {
          setObjBlob(blob);
        }
      } catch (err) {
        if (isActive) {
          console.error("Error fetching model blob:", err);
          setLoadError(err.message);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };
    
    fetchModel();
    
    return () => { isActive = false; };
  }, [projectId]);

  return (
    <div className={`model-viewer-container ${isFullScreen ? 'fullscreen' : ''}`}>
      {isLoading ? (
        <div className="model-loading">
          <Loading size={48} />
          <p>Loading 3D model...</p>
        </div>
      ) : loadError ? (
        <div className="model-error">
          <p>❌ Could not load model</p>
          <small>{loadError}</small>
          <button className="button-secondary" onClick={() => window.location.reload()}>
            Try Again
          </button>
        </div>
      ) : objBlob ? (
        <ErrorBoundary fallbackMessage="Failed to render 3D preview">
          {isContextLost && (
            <div className="webgl-error-overlay">
              WebGL context lost. Please wait or try reloading the page.
            </div>
          )}
          
          <div className="canvas-controls">
            <button 
              className="control-button"
              onClick={() => setIsRotating(!isRotating)} 
              title={isRotating ? "Pause rotation" : "Start rotation"}
            >
              {isRotating ? '⏸️' : '▶️'}
            </button>
            
            <button 
              className="control-button" 
              onClick={handleFullScreenToggle}
              title={isFullScreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullScreen ? '⤓' : '⤢'}
            </button>
          </div>
          
          <Canvas
            ref={canvasRef}
            key={forceUpdateKey}
            style={{ 
              background: 'linear-gradient(to bottom, #e6f7ff, #ffffff)',
              width: '100%',
              height: '100%',
              display: 'block',
              opacity: isContextLost ? 0.5 : 1
            }}
            dpr={[1, 2]}
            shadows
            gl={{ 
              antialias: true,
              preserveDrawingBuffer: true,
              alpha: true
            }}
            camera={{ position: [0, 1, 5], fov: 45 }}
            frameloop={isRotating ? "always" : "demand"}
          >
            <PerspectiveCamera makeDefault position={[0, 1, 5]} fov={45} />
            
            {/* Lighting */}
            <color attach="background" args={['#f5f5f5']} />
            <ambientLight intensity={0.7} />
            <directionalLight 
              position={[5, 10, 5]} 
              intensity={1.2} 
              castShadow 
              shadow-mapSize={[1024, 1024]} 
            />
            <directionalLight 
              position={[-5, 5, -5]} 
              intensity={0.5} 
              castShadow={false} 
            />
            <pointLight position={[0, 6, 0]} intensity={0.5} />
            
            {/* Environment and subtle ground */}
            <Environment preset="sunset" background={false} />
            <mesh 
              rotation={[-Math.PI / 2, 0, 0]} 
              position={[0, -1, 0]} 
              receiveShadow
            >
              <planeGeometry args={[50, 50]} />
              <meshStandardMaterial 
                color="#f0f0f0" 
                roughness={1} 
                metalness={0} 
                opacity={0.6} 
                transparent 
              />
            </mesh>
            
            {/* The model */}
            <Suspense fallback={<LoadingIndicator />}>
              <Bounds fit clip observe margin={1.2}>
                <RotatingModel isRotating={isRotating}>
                  <ModelLoader objBlob={objBlob} textureUrl={texturePath} />
                </RotatingModel>
              </Bounds>
            </Suspense>
            
            {/* Camera controls */}
            {hasControls && (
              <OrbitControls
                makeDefault
                minDistance={1.5}
                maxDistance={20}
                enableDamping={true}
                dampingFactor={0.05}
                enableZoom={true}
                enablePan={true}
                rotateSpeed={0.5}
                enabled={!isContextLost}
              />
            )}
          </Canvas>
        </ErrorBoundary>
      ) : (
        <div className="model-placeholder">
          <div className="placeholder-content">
            <span className="model-icon">📦</span>
            <p>No 3D model available</p>
          </div>
        </div>
      )}
    </div>
  );
}