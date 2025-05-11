import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Environment, PerspectiveCamera, Html } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { DragControls } from 'three/examples/jsm/controls/DragControls';
import * as THREE from 'three';
import Loading from '../../components/Loading';
import { getFileTypeFromUrl, prepareModelScene, applyTextureToModel } from './FurnitureModelUtils';
import { debugModelStructure, transformDebug } from './FurnitureModelDebug';

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

// Component to handle room furniture placement
export const FurnitureItem = ({ 
  item, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0], 
  selected, 
  onSelect, 
  onPositionChange 
}) => {
  const [model, setModel] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const meshRef = useRef();
  const { gl, camera, scene } = useThree();
  const transformControlsRef = useRef();
  const dragControlsRef = useRef();    // Load furniture model
  useEffect(() => {
    if (!item || (!item.modelUrl && !item.objFileUrl)) {
      setError("No model URL provided");
      setIsLoading(false);
      return;
    }

    const modelUrl = item.modelUrl || item.objFileUrl;
    console.log(`Loading furniture model from URL: ${modelUrl}`);
    
    // Determine file type using our utility function
    const fileType = getFileTypeFromUrl(modelUrl);
    console.log(`Detected file type: ${fileType} for model: ${modelUrl}`);
    
    // Choose the appropriate loader based on file type
    let loader;
    if (fileType === 'obj') {
      loader = new OBJLoader();
    } else {
      // Default to GLTFLoader for other types (gltf, glb)
      loader = new GLTFLoader();
    }
    
    setIsLoading(true);
    loader.load(
      modelUrl,      (loadedModel) => {
        try {
          // Handle different model types - OBJ returns an Object3D, GLTF returns {scene}
          const sceneToUse = loadedModel.scene || loadedModel;
          
          // Debug the loaded model
          console.log(`Successfully loaded ${item.name || 'furniture'} model:`);
          debugModelStructure(sceneToUse, "Loaded furniture model");
          
          // Add furniture metadata to the model
          prepareModelScene(sceneToUse, item.instanceId || item.id);
          
          // Scale and center the model
          const box = new THREE.Box3().setFromObject(sceneToUse);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = maxDim > 0 ? 1 / maxDim : 1;
          
          sceneToUse.scale.set(scale, scale, scale);
          sceneToUse.position.x = position[0];
          sceneToUse.position.y = position[1];
          sceneToUse.position.z = position[2];
          sceneToUse.rotation.set(rotation[0], rotation[1], rotation[2]);
          
          console.log(`Model positioned at:`, transformDebug(position, rotation));
          
          // Apply texture if available
          if (item.selectedTextureUrl) {
            console.log(`Applying initial texture: ${item.selectedTextureUrl}`);
            const texture = new THREE.TextureLoader().load(item.selectedTextureUrl);
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(1, 1);
            
            sceneToUse.traverse((child) => {
              if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                  map: texture,
                  side: THREE.DoubleSide
                });
              }
            });
          }
          
          setModel(sceneToUse);
          setIsLoading(false);
          console.log("Furniture model loaded successfully:", item.name || "Unknown furniture");
        } catch (err) {
          console.error("Error processing furniture model:", err);
          setError(`Failed to process model: ${err.message}`);
          setIsLoading(false);
        }
      },
      undefined,
      (err) => {
        console.error("Error loading furniture model:", err);
        setError(`Failed to load model: ${err.message}`);
        setIsLoading(false);
      }
    );
    
    return () => {
      // Clean up model on unmount
      if (model) {
        model.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => {
                if (material.map) material.map.dispose();
                material.dispose();
              });
            } else {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          }
        });
      }
    };
  }, [item, item.objFileUrl, item.selectedTextureUrl, position, rotation]);
  useEffect(() => {
    if (!model || !selected) return;
    
    const transformControls = new THREE.TransformControls(camera, gl.domElement);
    transformControls.attach(model);
    transformControls.setMode('translate');
    transformControls.showX = true;
    transformControls.showY = true;
    transformControls.showZ = true;
    transformControls.size = 0.75;
    
    transformControls.addEventListener('dragging-changed', event => {
      // Disable orbit controls while dragging
      const controls = scene.getObjectByName('orbit-controls');
      if (controls) controls.enabled = !event.value;
    });
    
    transformControls.addEventListener('objectChange', () => {
      if (onPositionChange) {
        onPositionChange([model.position.x, model.position.y, model.position.z], 
                         [model.rotation.x, model.rotation.y, model.rotation.z]);
      }
    });
    
    scene.add(transformControls);
    transformControlsRef.current = transformControls;
    
    return () => {
      // Clean up
      if (transformControlsRef.current) {
        transformControlsRef.current.detach();
        scene.remove(transformControlsRef.current);
      }
    };
  }, [model, selected, gl, camera, scene, onPositionChange]);  // Function for applying a texture to the model
  const updateTexture = useCallback((textureUrl) => {
    if (!model) return;
    if (!textureUrl) {
      console.warn('No texture URL provided to update texture');
      return;
    }
    
    console.log(`Applying texture ${textureUrl} to furniture model`);
    
    try {
      const texture = new THREE.TextureLoader().load(textureUrl);
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      
      model.traverse((child) => {
        if (child.isMesh) {
          const newMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.DoubleSide
          });
          child.material = newMaterial;
        }
      });
    } catch (err) {
      console.error("Error applying texture to furniture:", err);
    }
  }, [model]);
  
  // Watch for changes to the selected texture
  useEffect(() => {
    if (item?.selectedTextureUrl) {
      updateTexture(item.selectedTextureUrl);
    }
  }, [item?.selectedTextureUrl, updateTexture]);
  
  // Handle click to select
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (onSelect) onSelect();
  }, [onSelect]);

  // Loading indicator while the model is being loaded
  if (isLoading) {
    return (
      <Html center>
        <div style={{ 
          color: 'white', 
          background: 'rgba(0,0,0,0.5)', 
          padding: '10px', 
          borderRadius: '5px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px'
        }}>
          <div style={{ 
            width: '20px', 
            height: '20px', 
            borderRadius: '50%', 
            border: '2px solid #fff', 
            borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite' 
          }}></div>
          <span>Loading furniture...</span>
        </div>
      </Html>
    );
  }
  
  if (error) {
    return (
      <Html center>
        <div style={{ 
          color: 'white', 
          background: 'rgba(255,0,0,0.3)', 
          padding: '10px',
          borderRadius: '5px',
          maxWidth: '200px',
          textAlign: 'center'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Error</div>
          <div style={{ fontSize: '12px' }}>{error}</div>
        </div>
      </Html>
    );
  }

  if (!model) {
    return (
      <mesh position={position} onClick={handleClick}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#ff0000" />
        <Html position={[0, 0.5, 0]} center>
          <div style={{ 
            background: 'rgba(255,0,0,0.5)', 
            color: 'white', 
            padding: '3px 5px', 
            borderRadius: '3px',
            fontSize: '10px'
          }}>
            Model not loaded
          </div>
        </Html>
      </mesh>
    );
  }

  return (
    <group onClick={handleClick}>
      <primitive object={model} />
    </group>
  );
};

// Component to handle furniture texture changes
export const FurnitureTextureApplier = ({ furniture, newTexture }) => {  useEffect(() => {
    if (!furniture || !furniture.model || !newTexture) return;
    
    console.log("Applying new texture to furniture:", newTexture);
    applyTextureToModel(furniture.model, newTexture);
  }, [furniture, newTexture]);
  
  return null;
};

// Component to render the room model with furniture and textures
export const EnvironmentViewer = ({ 
  modelUrl, 
  selectedWallTexture, 
  selectedFloorTexture, 
  furnitureItems = [], 
  selectedFurnitureId = null, 
  onSelectFurniture, 
  onFurniturePositionChange,
  onModelLoaded 
}) => {
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const canvasRef = useRef(null);
  const modelUrlRef = useRef(modelUrl);

  useEffect(() => {
    console.log("EnvironmentViewer received modelUrl:", modelUrl);

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
  }, [modelUrl, onModelLoaded]);

  const handleModelLoaded = () => {
    console.log("Model loaded successfully");
    setIsModelLoaded(true);
    if (onModelLoaded) onModelLoaded();
  };

  // Component to render the room model with textures
  const RoomModel = ({ modelUrl, selectedWallTexture, selectedFloorTexture, onLoaded }) => {
    const [model, setModel] = useState(null);
    const [error, setError] = useState(null);
    const gltfLoaderRef = useRef(new GLTFLoader());
    const loadedRef = useRef(false);
    const textureCache = useRef(new Map());

    const wallComponentsRef = useRef([]);
    const floorComponentsRef = useRef([]);
    
    // Preload a texture
    const preloadThreeTexture = useCallback((url) => {
      if (!url) return null;
      
      if (textureCache.current.has(url)) {
        return textureCache.current.get(url);
      }
      
      const textureLoader = new THREE.TextureLoader();
      const texture = textureLoader.load(
        url,
        (loadedTexture) => {
          loadedTexture.wrapS = loadedTexture.wrapT = THREE.RepeatWrapping;
          textureCache.current.set(url, loadedTexture);
        },
        undefined,
        (err) => console.error(`Error loading texture: ${url}`, err)
      );
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      textureCache.current.set(url, texture);
      return texture;
    }, []);

    // Preload textures
    useEffect(() => {
      if (selectedWallTexture) {
        preloadThreeTexture(selectedWallTexture);
      }
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
          // Try to detect walls/floors by geometry
          const boundingBox = new THREE.Box3().setFromObject(child);
          const size = new THREE.Vector3();
          boundingBox.getSize(size);

          const minDim = Math.min(size.x, size.y, size.z);
          const maxDim = Math.max(size.x, size.y, size.z);

          // Detect vertical planes (walls)
          if (size.y > size.x * 1.5 && size.y > size.z * 1.5) {
            isWall = true;
          }
          
          // Detect horizontal planes (floors)
          if (size.y < size.x * 0.2 && size.y < size.z * 0.2) {
            isFloor = true;
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
        console.warn("No modelUrl provided. Clearing model.");
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

      try {
        gltfLoaderRef.current.load(
          modelUrl,
          (gltf) => {
            if (!isActive) return;
            
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
                setTimeout(() => onLoaded(), 100);
              }
            } catch (err) {
              console.error("Error processing 3D model:", err);
              setError("Failed to process 3D model.");
              if (onLoaded && !loadedRef.current) {
                loadedRef.current = true;
                onLoaded();
              }
            }
          },
          undefined,
          (err) => {
            if (!isActive) return;
            console.error(`Error loading GLTF from ${modelUrl}:`, err);
            setError(`Failed to load 3D model. ${err.message || ''}`);
            if (onLoaded && !loadedRef.current) {
              loadedRef.current = true;
              onLoaded();
            }
          }
        );
      } catch (e) {
        console.error("Error during .load() setup:", e);
        setError("Failed to initiate model loading.");
        if (onLoaded && !loadedRef.current) {
          loadedRef.current = true;
          onLoaded();
        }
      }

      return () => {
        isActive = false;
      };
    }, [modelUrl, onLoaded, identifyComponents]);

    // Apply wall textures
    useEffect(() => {
      if (!selectedWallTexture || wallComponentsRef.current.length === 0 || !model) return;
      
      let texture = textureCache.current.get(selectedWallTexture);

      if (texture) {
        texture.repeat.set(2, 2);
        const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide });

        wallComponentsRef.current.forEach(wall => {
          if (wall.material && wall.material.map) wall.material.map.dispose();
          if (wall.material) wall.material.dispose();
          wall.material = material;
        });
      } else {
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

            textureCache.current.set(selectedWallTexture, texture);
          },
          undefined,
          (err) => console.error('Error loading wall texture:', err)
        );
      }
    }, [selectedWallTexture, model]);

    // Apply floor textures
    useEffect(() => {
      if (!selectedFloorTexture || floorComponentsRef.current.length === 0 || !model) return;
      
      let texture = textureCache.current.get(selectedFloorTexture);

      if (texture) {
        texture.repeat.set(3, 3);
        const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide });

        floorComponentsRef.current.forEach(floor => {
          if (floor.material && floor.material.map) floor.material.map.dispose();
          if (floor.material) floor.material.dispose();
          floor.material = material;
        });
      } else {
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
  
  // Component to handle floor click for furniture placement
  const FloorClickHandler = ({ furnitureItems, onSelectFurniture }) => {
    const { camera, raycaster, scene, gl } = useThree();
    
    // Handle mouse click on the floor
    useEffect(() => {
      const handleClick = (event) => {
        // Only handle clicks on the canvas
        if (event.target !== gl.domElement) return;
        
        // Calculate mouse position in normalized device coordinates
        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / gl.domElement.clientWidth) * 2 - 1;
        mouse.y = -(event.clientY / gl.domElement.clientHeight) * 2 + 1;
        
        // Update the picking ray
        raycaster.setFromCamera(mouse, camera);
        
        // Find all furniture items
        const furnitureObjects = [];
        scene.traverse((object) => {
          if (object.userData && object.userData.isFurniture) {
            furnitureObjects.push(object);
          }
        });
        
        // Check for intersections with furniture
        const furnitureIntersects = raycaster.intersectObjects(furnitureObjects, true);
        if (furnitureIntersects.length > 0) {
          // Find the furniture item that was clicked
          const clickedObject = furnitureIntersects[0].object;
          let furniture = null;
          
          clickedObject.traverseAncestors((ancestor) => {
            if (ancestor.userData && ancestor.userData.furnitureId) {
              furniture = furnitureItems.find(item => item.id === ancestor.userData.furnitureId);
              return;
            }
          });
          
          if (furniture && onSelectFurniture) {
            onSelectFurniture(furniture.id);
          }
          return;
        }
        
        // Get all meshes in the scene
        const meshes = [];
        scene.traverse(object => {
          if (object.isMesh) meshes.push(object);
        });
        
        // Check for intersections with floor
        const intersects = raycaster.intersectObjects(meshes);
        if (intersects.length > 0) {
          const intersect = intersects[0];
          console.log("Floor click detected at", intersect.point);
          // You could use this for placing new furniture at this position
        }
      };
      
      gl.domElement.addEventListener('click', handleClick);
      
      return () => {
        gl.domElement.removeEventListener('click', handleClick);
      };
    }, [camera, raycaster, scene, gl, furnitureItems, onSelectFurniture]);
    
    return null;
  };

  return (
    <div className="environment-viewer">
      {!modelUrl ? (
        <div className="no-model-message">
          <h3>No 3D Model Available</h3>
          <p>This room does not have a 3D model to display.</p>
        </div>
      ) : (
        <>
          <Canvas
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
            <PerspectiveCamera name="camera" makeDefault position={[3, 3, 3]} fov={50} near={0.1} far={100} />
            <OrbitControls 
              name="orbit-controls"
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
            
            <React.Suspense fallback={<LoadingIndicator />}>
              {/* Room Model */}
              <RoomModel 
                modelUrl={modelUrl}
                selectedWallTexture={selectedWallTexture}
                selectedFloorTexture={selectedFloorTexture}
                onLoaded={handleModelLoaded}
              />
              
              {/* Furniture Items */}
              {furnitureItems.map((item) => (
                <FurnitureItem
                  key={item.id}
                  item={item}
                  position={item.position || [0, 0, 0]}
                  rotation={item.rotation || [0, 0, 0]}
                  selected={selectedFurnitureId === item.id}
                  onSelect={() => onSelectFurniture(item.id)}
                  onPositionChange={(newPosition, newRotation) => 
                    onFurniturePositionChange && onFurniturePositionChange(item.id, newPosition, newRotation)
                  }
                />
              ))}
              
              {/* Floor click handler */}
              <FloorClickHandler 
                furnitureItems={furnitureItems}
                onSelectFurniture={onSelectFurniture}
              />
            </React.Suspense>
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
              <li><strong>Select:</strong> Click on furniture</li>
              <li><strong>Move:</strong> Drag selected furniture</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
