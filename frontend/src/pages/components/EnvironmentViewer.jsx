/* eslint-disable no-unused-vars */
/* spell-checker: disable */
/* stylelint-disable */
import React, { useEffect, useState, useRef, Suspense, useCallback, lazy } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, PerspectiveCamera, Html } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import './EnvironmentViewer.css';
import Loading from '../../components/Loading';
import FurnitureControlsHelp from './FurnitureControlsHelp';

// Component for displaying loading status inside the Canvas
const LoadingIndicator = () => {
  return (
    <Html center>
      <div className="canvas-loading-indicator">
        <Loading size={40} />
        <p>Loading 3D model...</p>
      </div>
    </Html>
  );
};

// Component to render the 3D model with textures
const Model = ({ modelUrl, selectedWallTexture, selectedFloorTexture, onLoaded }) => {
  const [model, setModel] = useState(null);
  const [error, setError] = useState(null);
  const gltfLoaderRef = useRef(new GLTFLoader());
  const loadedRef = useRef(false);
  const textureCache = useRef(new Map());

  const wallComponentsRef = useRef([]);
  const floorComponentsRef = useRef([]);

  // Preload a Three.js texture to ensure it's ready when needed
  const preloadThreeTexture = useCallback((url) => {
    if (!url) return null;

    // Return from cache if already loaded
    if (textureCache.current.has(url)) {
      console.log(`Using cached Three.js texture: ${url}`);
      return textureCache.current.get(url);
    }

    console.log(`Preloading Three.js texture: ${url}`);
    const textureLoader = new THREE.TextureLoader();
    const texture = textureLoader.load(
      url,
      (loadedTexture) => {
        console.log(`Three.js texture loaded successfully: ${url}`);
        loadedTexture.wrapS = loadedTexture.wrapT = THREE.RepeatWrapping;
        textureCache.current.set(url, loadedTexture);
      },
      undefined,
      (err) => console.error(`Error loading Three.js texture: ${url}`, err)
    );
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    textureCache.current.set(url, texture);
    return texture;
  }, []);

  // Preload textures when they're provided as props, even if not applied yet
  useEffect(() => {
    // Preload wall texture if available
    if (selectedWallTexture) {
      preloadThreeTexture(selectedWallTexture);
    }

    // Preload floor texture if available
    if (selectedFloorTexture) {
      preloadThreeTexture(selectedFloorTexture);
    }
  }, [selectedWallTexture, selectedFloorTexture, preloadThreeTexture]);

  // Identify walls and floors in the model
  const identifyComponents = useCallback((scene) => {
    const walls = [];
    const floors = [];
    const wallPatterns = [/wall/i, /partition/i, /divider/i, /^Wall/i, /_Wall/i];
    const floorPatterns = [/floor/i, /ground/i, /base/i, /^Floor/i, /_Floor/i];

    scene.traverse((child) => {
      if (!child.isMesh) return;

      let isWall = wallPatterns.some(pattern => pattern.test(child.name));
      let isFloor = floorPatterns.some(pattern => pattern.test(child.name));

      if (!isWall && !isFloor && child.geometry) {
        const boundingBox = new THREE.Box3().setFromObject(child);
        const size = new THREE.Vector3();
        boundingBox.getSize(size);

        const minDim = Math.min(size.x, size.y, size.z);
        const maxDim = Math.max(size.x, size.y, size.z);

        if (minDim > 0 && maxDim > 0 && minDim < maxDim * 0.15) {
          if (size.y === maxDim && (size.x < maxDim * 0.15 || size.z < maxDim * 0.15)) {
          } else if (size.y === minDim && (size.x > minDim && size.z > minDim)) {
          }
        }
      }

      if (isWall) walls.push(child);
      if (isFloor) floors.push(child);
    });

    wallComponentsRef.current = walls;
    floorComponentsRef.current = floors;
    console.log(`Model: Identified ${walls.length} wall components and ${floors.length} floor components.`);
  }, []);

  // Load the model
  useEffect(() => {
    if (!modelUrl) {
      console.warn("Model component: No modelUrl provided. Clearing model.");
      setModel(null);
      setError(null);
      if (onLoaded && !loadedRef.current) {
        loadedRef.current = true;
        setTimeout(() => onLoaded(), 50);
      }
      return;
    }

    let isActive = true;
    loadedRef.current = false;
    setModel(null);
    setError(null);
    console.log(`Model: Attempting to load ${modelUrl}`);

    try {
      gltfLoaderRef.current.load(
        modelUrl,
        (gltf) => {
          if (!isActive) {
            console.log("Model: Load completed but component unmounted or URL changed.");
            return;
          }
          console.log("Model: GLTF loaded successfully from", modelUrl);
          try {
            const scene = gltf.scene;
            let box = new THREE.Box3().setFromObject(scene);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = maxDim > 0 ? 2 / maxDim : 1;

            scene.scale.set(scale, scale, scale);
            box = new THREE.Box3().setFromObject(scene);
            const scaledCenter = box.getCenter(new THREE.Vector3());

            scene.position.x -= scaledCenter.x;
            scene.position.y -= box.min.y;
            scene.position.z -= scaledCenter.z;

            identifyComponents(scene);
            setModel(scene);

            if (onLoaded && !loadedRef.current) {
              loadedRef.current = true;
              console.log("Model: Processed and notifying onLoaded for", modelUrl);
              setTimeout(() => onLoaded(), 100);
            }
          } catch (processingError) {
            console.error("Model: Error processing GLTF:", processingError);
            setError("Failed to process 3D model.");
            if (onLoaded && !loadedRef.current) {
              loadedRef.current = true;
              onLoaded();
            }
          }
        },
        (xhr) => {
          if (xhr.loaded && xhr.total) {
            console.log(`Model: Loading ${modelUrl} - ${Math.round((xhr.loaded / xhr.total) * 100)}%`);
          }
        },
        (loadingError) => {
          if (!isActive) return;
          console.error(`Model: Error loading GLTF from ${modelUrl}:`, loadingError);
          setError(`Failed to load 3D model. ${loadingError.message || ''}`);
          if (onLoaded && !loadedRef.current) {
            loadedRef.current = true;
            onLoaded();
          }
        }
      );
    } catch (e) {
      console.error("Model: Synchronous error during .load() setup:", e);
      setError("Failed to initiate model loading.");
      if (onLoaded && !loadedRef.current) {
        loadedRef.current = true;
        onLoaded();
      }
    }

    return () => {
      isActive = false;
      console.log("Model: Cleanup effect for", modelUrl);
    };
  }, [modelUrl, onLoaded, identifyComponents]);

  // Apply wall textures using the cached texture if possible
  useEffect(() => {
    if (!selectedWallTexture || wallComponentsRef.current.length === 0 || !model) return;
    console.log(`Applying wall texture: ${selectedWallTexture}`);

    // Use the preloaded texture if available
    let texture = textureCache.current.get(selectedWallTexture);

    if (texture) {
      console.log("Using cached wall texture");
      texture.repeat.set(2, 2); // Ensure texture repeat is set
      const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide });

      wallComponentsRef.current.forEach(wall => {
        if (wall.material && wall.material.map) wall.material.map.dispose();
        if (wall.material) wall.material.dispose();
        wall.material = material;
      });
    } else {
      // Fall back to direct loading (but this shouldn't happen)
      console.warn("Wall texture not preloaded, loading directly");
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        selectedWallTexture,
        (texture) => {
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(2, 2);
          const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide });

          wallComponentsRef.current.forEach(wall => {
            if (wall.material && wall.material.map) wall.material.map.dispose();
            if (wall.material) wall.material.dispose();
            wall.material = material;
          });

          // Cache the texture for future use
          textureCache.current.set(selectedWallTexture, texture);
        },
        undefined,
        (err) => console.error('Error loading wall texture:', err)
      );
    }
  }, [selectedWallTexture, model]);

  // Apply floor textures using the cached texture if possible
  useEffect(() => {
    if (!selectedFloorTexture || floorComponentsRef.current.length === 0 || !model) return;
    console.log(`Applying floor texture: ${selectedFloorTexture}`);

    // Use the preloaded texture if available
    let texture = textureCache.current.get(selectedFloorTexture);

    if (texture) {
      console.log("Using cached floor texture");
      texture.repeat.set(3, 3); // Ensure texture repeat is set
      const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide });

      floorComponentsRef.current.forEach(floor => {
        if (floor.material && floor.material.map) floor.material.map.dispose();
        if (floor.material) floor.material.dispose();
        floor.material = material;
      });
    } else {
      // Fall back to direct loading (but this shouldn't happen)
      console.warn("Floor texture not preloaded, loading directly");
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        selectedFloorTexture,
        (texture) => {
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(3, 3);
          const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide });

          floorComponentsRef.current.forEach(floor => {
            if (floor.material && floor.material.map) floor.material.map.dispose();
            if (floor.material) floor.material.dispose();
            floor.material = material;
          });

          // Cache the texture for future use
          textureCache.current.set(selectedFloorTexture, texture);
        },
        undefined,
        (err) => console.error('Error loading floor texture:', err)
      );
    }
  }, [selectedFloorTexture, model]);

  if (error) {
    return (
      <Html center>
        <div className="model-error" style={{ color: 'red', background: 'rgba(255,0,0,0.1)', padding: '10px', borderRadius: '5px' }}>
          <h3>Error Loading Model</h3>
          <p>{error}</p>
        </div>
      </Html>
    );
  }

  return model ? <primitive object={model} /> : null;
};

// Component for making walls and roofs transparent when camera is close
const TransparentWalls = () => {
  const { camera, scene } = useThree();
  const surfacesRef = useRef([]);
  const materialsMapRef = useRef(new Map());
  const initializedRef = useRef(false);
  const tempVec3 = useRef(new THREE.Vector3());
  
  // Find all surfaces (walls, ceilings, roofs) and store their original materials
  useEffect(() => {
    if (initializedRef.current || !scene || !scene.children.length) return;
    
    // Patterns to identify walls, ceilings, and roofs
    const surfacePatterns = [
      /wall/i, /partition/i, /divider/i, /^Wall/i, /_Wall/i, 
      /ceiling/i, /roof/i, /^Roof/i, /_Roof/i, /^Ceiling/i, /_Ceiling/i
    ];
    const surfaces = [];
    materialsMapRef.current.clear();
    
    scene.traverse((object) => {
      if (!object.isMesh) return;
      
      const isSurface = surfacePatterns.some(pattern => pattern.test(object.name));
      
      // If not identified by name, try to detect by geometry (flat surface)
      let isDetectedAsSurface = false;
      if (!isSurface && object.geometry) {
        // Get bounding box dimensions
        const bbox = new THREE.Box3().setFromObject(object);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        
        // If one dimension is much smaller than the others, it might be a wall/ceiling
        const minDim = Math.min(size.x, size.y, size.z);
        const maxDim = Math.max(size.x, size.y, size.z);
        
        if (minDim > 0 && minDim < maxDim * 0.15) { // Thin along one dimension
          isDetectedAsSurface = true;
          // Set a property to help identify for debugging
          object.userData.detectedAsSurface = true;
        }
      }
      
      if (isSurface || isDetectedAsSurface) {
        surfaces.push(object);
        
        // Ensure material is cloneable and has necessary properties
        const originalMaterial = object.material;
        if (originalMaterial && typeof originalMaterial.clone === 'function') {
          // Create transparent version of the material
          const transparentMaterial = originalMaterial.clone();
          transparentMaterial.transparent = true;
          transparentMaterial.opacity = 0.1; // Very transparent
          transparentMaterial.depthWrite = false; // Better for transparency
          transparentMaterial.side = THREE.DoubleSide; // Visible from both sides
          
          materialsMapRef.current.set(object.uuid, {
            original: originalMaterial,
            transparent: transparentMaterial,
            mesh: object
          });
        } else {
          console.warn("Surface object has no material or material is not cloneable:", object.name);
        }
      }
    });
    
    surfacesRef.current = surfaces;
    if (surfaces.length > 0) {
      initializedRef.current = true;
      console.log(`TransparentWalls: Found ${surfaces.length} surfaces (walls/ceilings/roofs)`);
    } else {
      console.log("TransparentWalls: No surfaces found for transparency effect.");
    }
    
    return () => {
      // Cleanup: Revert materials
      surfacesRef.current.forEach(surface => {
        const materialInfo = materialsMapRef.current.get(surface.uuid);
        if (materialInfo && surface.material !== materialInfo.original) {
          surface.material = materialInfo.original;
        }
      });
      initializedRef.current = false;
      console.log("TransparentWalls: Cleaned up materials.");
    };
  }, [scene, scene.children]);
  
  // Update surface transparency based on camera position
  useFrame(() => {
    if (!initializedRef.current || surfacesRef.current.length === 0) return;
    
    const cameraPosition = camera.position;
    
    // Calculate approximate room center (average of all surface positions)
    const roomCenter = new THREE.Vector3();
    let count = 0;
    
    surfacesRef.current.forEach(surface => {
      if (surface.geometry && surface.geometry.boundingSphere) {
        const posWorld = new THREE.Vector3()
          .copy(surface.geometry.boundingSphere.center)
          .applyMatrix4(surface.matrixWorld);
        roomCenter.add(posWorld);
        count++;
      }
    });
    
    if (count > 0) {
      roomCenter.divideScalar(count);
    }
    
    // For each surface, check if it should be transparent
    surfacesRef.current.forEach(surface => {
      const materialInfo = materialsMapRef.current.get(surface.uuid);
      if (!materialInfo || !materialInfo.mesh) return;
      
      // Calculate distance to surface
      let distance = Infinity;
      let shouldBeTransparent = false;
      
      if (surface.geometry && surface.geometry.boundingSphere) {
        const surfaceCenter = new THREE.Vector3()
          .copy(surface.geometry.boundingSphere.center)
          .applyMatrix4(surface.matrixWorld);
        
        distance = cameraPosition.distanceTo(surfaceCenter);
        const threshold = surface.geometry.boundingSphere.radius * 1.5; // Increased range
        
        // Make transparent if camera is close to surface
        if (distance < threshold) {
          shouldBeTransparent = true;
        } else {
          // Check if surface is between camera and room center
          const camToSurface = tempVec3.current.subVectors(surfaceCenter, cameraPosition);
          const surfaceToRoomCenter = new THREE.Vector3().subVectors(roomCenter, surfaceCenter);
          
          // If these directions are roughly aligned (dot product > 0),
          // the surface is between the camera and the room center
          if (camToSurface.dot(surfaceToRoomCenter) > 0) {
            shouldBeTransparent = true;
          }
        }
      }
      
      // Apply the appropriate material
      if (shouldBeTransparent) {
        if (surface.material !== materialInfo.transparent) {
          surface.material = materialInfo.transparent;
        }
      } else {
        if (surface.material !== materialInfo.original) {
          surface.material = materialInfo.original;
        }
      }
    });
  });
  
  return null;
};

// Component to manage furniture items
const Furniture = ({ 
  furnitureItems, 
  selectedFurnitureId, 
  onSelectFurniture, 
  onPositionChange 
}) => {
  // Import FurnitureModel dynamically to avoid circular dependencies
  const [FurnitureModel, setFurnitureModel] = useState(null);
  
  useEffect(() => {
    // Dynamic import of FurnitureModel
    import('./FurnitureModel').then(module => {
      setFurnitureModel(() => module.default);
    }).catch(err => {
      console.error("Failed to load FurnitureModel component:", err);
    });
  }, []);
  
  if (!furnitureItems || furnitureItems.length === 0 || !FurnitureModel) {
    return null;
  }
  
  return (
    <>
      {furnitureItems.map(item => (
        <FurnitureModel
          key={item.instanceId}
          item={item}
          selected={selectedFurnitureId === item.instanceId}
          onSelect={onSelectFurniture}
          onPositionChange={onPositionChange}
        />
      ))}
    </>
  );
};

// The main exported component
export default function EnvironmentViewer({ 
  modelUrl, 
  selectedWallTexture, 
  selectedFloorTexture, 
  furnitureItems = [], 
  selectedFurnitureId, 
  onSelectFurniture, 
  onFurniturePositionChange, 
  onModelLoaded 
}) {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const canvasRef = useRef(null);
  const modelUrlRef = useRef(modelUrl);

  useEffect(() => {
    console.log("EnvironmentViewer received modelUrl:", modelUrl);
    console.log("Furniture items:", furnitureItems?.length || 0);

    if (!modelUrl) {
      console.error("No model URL provided to EnvironmentViewer");
      if (onModelLoaded) {
        setTimeout(() => {
          onModelLoaded();
        }, 500);
      }
      return;
    }

    if (modelUrl !== modelUrlRef.current) {
      setIsModelLoaded(false);
      modelUrlRef.current = modelUrl;
    }
  }, [modelUrl, furnitureItems, onModelLoaded]);

  const handleModelLoaded = () => {
    console.log("Model loaded successfully");
    setIsModelLoaded(true);
    if (onModelLoaded) onModelLoaded();
  };

  return (
    <div className="environment-viewer">
      {!modelUrl ? (
        <div className="no-model-message">
          <h3>No 3D Model Available</h3>
          <p>This room does not have a 3D model to display.</p>
        </div>
      ) : (
        <>          <Canvas
            ref={canvasRef}
            shadows
            dpr={[1, 2]}
            gl={{
              antialias: true,
              powerPreference: 'high-performance',
              alpha: false,
              preserveDrawingBuffer: true
            }}
            camera={{ position: [3, 3, 3], fov: 50 }}
          >
            <PerspectiveCamera makeDefault position={[3, 3, 3]} fov={50} near={0.1} far={100} />
            <OrbitControls 
              makeDefault
              enableDamping
              dampingFactor={0.05}
              minDistance={1}
              maxDistance={20}
            />
            
            <color attach="background" args={["#f0f0f0"]} />
            <ambientLight intensity={0.9} />
            <directionalLight 
              position={[5, 10, 7]} 
              intensity={1.2} 
              castShadow 
              shadow-mapSize={[2048, 2048]} 
            />
            <directionalLight position={[-5, 8, -5]} intensity={0.7} />
            
            <Environment preset="city" background={false} />
            
            <Suspense fallback={<LoadingIndicator />}>
              <Model 
                modelUrl={modelUrl}
                selectedWallTexture={selectedWallTexture}
                selectedFloorTexture={selectedFloorTexture}
                onLoaded={handleModelLoaded}
              />
              <TransparentWalls />
              
              {/* Render furniture items */}
              {furnitureItems && furnitureItems.length > 0 && (
                <Furniture 
                  furnitureItems={furnitureItems}
                  selectedFurnitureId={selectedFurnitureId}
                  onSelectFurniture={onSelectFurniture}
                  onPositionChange={onFurniturePositionChange}
                />
              )}
            </Suspense>
          </Canvas>
          
          {!isModelLoaded && (
            <div className="model-loading-overlay">
              <div className="loading-spinner"></div>
              <p>Loading 3D model...</p>
            </div>
          )}
        </>
      )}
              <div className="camera-controls-help">
        <div className="help-tooltip">
          <span className="help-icon">?</span>
          <div className="tooltip-content">
            <h4>Camera Controls</h4>
            <ul>
              <li><strong>Rotate:</strong> Left-click + drag</li>
              <li><strong>Pan:</strong> Right-click + drag</li>
              <li><strong>Zoom:</strong> Scroll wheel</li>
            </ul>
            
            {furnitureItems && furnitureItems.length > 0 && (
              <>
                <h4>Furniture Controls</h4>
                <ul>
                  <li><strong>Select:</strong> Click on furniture</li>
                  <li><strong>Move:</strong> Click and drag selected furniture</li>
                  <li><strong>Rotate:</strong> Hold Shift while dragging</li>
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}