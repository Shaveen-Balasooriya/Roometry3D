import React, { Suspense, useRef, useEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Html, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import './RoomViewer.css';
import ErrorBoundary from './ErrorBoundary';

// Loading indicator component
function Loader() {
  return (
    <Html center>
      <div className="loading-spinner-container">
        <div className="loading-spinner"></div>
        <p>Loading Model...</p>
      </div>
    </Html>
  );
}

// Custom Model component that handles both GLB and GLTF with associated resources
const Model = forwardRef(function Model({ 
  modelFile, 
  associatedFiles = [], 
  onComponentSelect, 
  textures, 
  onInitialLoad, 
  selectedComponent,
  componentTags = {}, 
  textureRepeatSettings,
  allowComponentSelection = true, // New prop to control whether components can be selected
  showTagHighlighting = true // New prop to control highlighting in different steps
}, ref) {
  const [scene, setScene] = useState(null);
  const { camera, raycaster, gl } = useThree();
  const [loadError, setLoadError] = useState(null);
  const [selectedMesh, setSelectedMesh] = useState(null);
  const [originalMaterials, setOriginalMaterials] = useState(new Map());
  const [allMeshes, setAllMeshes] = useState([]);
  const objectsRef = useRef([]);
  
  // Create a map of associated files by name for easy lookup
  const fileMap = useMemo(() => {
    const map = new Map();
    if (associatedFiles && associatedFiles.length > 0) {
      associatedFiles.forEach(file => {
        map.set(file.name, file);
      });
    }
    return map;
  }, [associatedFiles]);

  // Load the model when the file or associated files change
  useEffect(() => {
    if (!modelFile) return;
    
    const loader = new GLTFLoader();
    const isGLTF = modelFile.name.toLowerCase().endsWith('.gltf');
    
    // Handle GLTF with external resources
    if (isGLTF) {
      // Create a resource manager for the loader to handle file references
      loader.setResourcePath('');
      
      // Override the file loading manager to use our uploaded files
      const manager = new THREE.LoadingManager();
      manager.setURLModifier((url) => {
        // Extract the filename from the URL
        const filename = url.split('/').pop();
        
        // Check if we have this file in our associated files
        if (fileMap.has(filename)) {
          return URL.createObjectURL(fileMap.get(filename));
        }
        
        console.warn(`Referenced file not found: ${filename}`);
        return url; // Return the original URL if not found
      });
      
      loader.manager = manager;
    }
    
    // Create a blob URL for the model file
    const modelUrl = URL.createObjectURL(modelFile);
    
    // Load the model
    loader.load(
      modelUrl,
      (gltf) => {
        setScene(gltf.scene);
        setLoadError(null);
        
        // Store original materials and set up the scene
        const originalMats = new Map();
        const meshList = [];
        
        // Process the loaded scene
        if (gltf.scene) {
          gltf.scene.traverse((child) => {
            if (child.isMesh) {
              // Store the original material for resetting later
              originalMats.set(child.uuid, child.material.clone());
              
              // Ensure meshes have names
              if (!child.name) {
                child.name = `Mesh_${child.uuid.substring(0, 8)}`;
              }
              
              // Make material unique to this mesh to avoid affecting other meshes
              child.material = child.material.clone();
              
              // Add to list of selectable meshes
              meshList.push(child);
              
              // Make all meshes selectable by raycasting
              child.userData.selectable = true;
            }
          });
          
          setOriginalMaterials(originalMats);
          setAllMeshes(meshList);
          objectsRef.current = meshList;
          
          if (onInitialLoad) {
            onInitialLoad(gltf.scene);
          }
        }
      },
      // Progress callback
      (xhr) => {
        console.log(`${(xhr.loaded / xhr.total * 100).toFixed(2)}% loaded`);
      },
      // Error callback
      (error) => {
        console.error('Error loading model:', error);
        setLoadError(`Failed to load model: ${error.message}`);
      }
    );
    
    // Cleanup function to revoke the object URL
    return () => {
      URL.revokeObjectURL(modelUrl);
      
      // Also revoke any blob URLs created for associated files
      if (loader.manager && loader.manager._urlModifier) {
        // We would ideally track and revoke all created URLs here
      }
    };
  }, [modelFile, fileMap, onInitialLoad]);

  // Update visual appearance based on component tags
  useEffect(() => {
    if (!scene) return;

    // Reset any existing tag-based styling first
    scene.traverse((child) => {
      if (child.isMesh) {
        // Remove any tag-based outline effect
        child.userData.isTagged = false;
        
        // Keep the selected highlight separate from tag styling
        if (child.name === selectedComponent || child.uuid === selectedComponent) {
          // Don't reset the selected component's styling here
        } else {
          // Reset non-selected meshes to their default appearance
          child.material.emissive = new THREE.Color(0x000000);
          child.material.emissiveIntensity = 0;
        }
      }
    });
    
    // Apply styling based on tags
    if (showTagHighlighting) {
      Object.entries(componentTags).forEach(([componentId, tag]) => {
        scene.traverse((child) => {
          if (child.isMesh && (child.name === componentId || child.uuid === componentId)) {
            // Mark as tagged
            child.userData.isTagged = true;
            child.userData.tagType = tag;
            
            // Apply visual styling based on tag type
            if (tag === 'wall') {
              // For walls: subtle blue outline when not selected
              if (child.name !== selectedComponent && child.uuid !== selectedComponent) {
                child.material.emissive = new THREE.Color(0x3a87f2);
                child.material.emissiveIntensity = 0.15;
              }
            } else if (tag === 'floor') {
              // For floors: subtle green outline when not selected
              if (child.name !== selectedComponent && child.uuid !== selectedComponent) {
                child.material.emissive = new THREE.Color(0x4caf50);
                child.material.emissiveIntensity = 0.15;
              }
            }
          }
        });
      });
    }
  }, [scene, componentTags, selectedComponent, showTagHighlighting]);

  // Reset highlight on all meshes
  const resetMeshHighlights = useCallback(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh && child.material) {
          // Check if this mesh is tagged, and preserve its tag-based styling
          if (child.userData.isTagged && showTagHighlighting) {
            if (child.userData.tagType === 'wall') {
              child.material.emissive = new THREE.Color(0x3a87f2);
              child.material.emissiveIntensity = 0.15;
            } else if (child.userData.tagType === 'floor') {
              child.material.emissive = new THREE.Color(0x4caf50);
              child.material.emissiveIntensity = 0.15;
            }
          } else {
            // Not tagged, reset completely
            child.material.emissive = new THREE.Color(0x000000);
            child.material.emissiveIntensity = 0;
          }
        }
      });
    }
  }, [scene, showTagHighlighting]);

  // Highlight a specific mesh (with stronger highlight than tag styling)
  const highlightMesh = useCallback((mesh) => {
    if (!mesh || !mesh.material) return;
    
    if (mesh.userData.isTagged && showTagHighlighting) {
      // If tagged, use a brighter version of the tag color
      if (mesh.userData.tagType === 'wall') {
        mesh.material.emissive = new THREE.Color(0x3a87f2); // Blue
      } else if (mesh.userData.tagType === 'floor') {
        mesh.material.emissive = new THREE.Color(0x4caf50); // Green
      } else {
        mesh.material.emissive = new THREE.Color(0x4285F4); // Default highlight
      }
    } else {
      mesh.material.emissive = new THREE.Color(0x4285F4); // Google blue color
    }
    
    // Always make selection highlight stronger than tag styling
    mesh.material.emissiveIntensity = 0.5;
  }, [showTagHighlighting]);

  // Handle click events for component selection
  const handleClick = useCallback((event) => {
    if (!scene || !allowComponentSelection) return; // Skip if component selection is disabled
    
    event.stopPropagation();
    
    // Calculate normalized device coordinates
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const mouse = new THREE.Vector2(x, y);
    
    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);
    
    // Calculate objects intersecting the picking ray, use the meshes array directly for better performance
    const intersects = raycaster.intersectObjects(objectsRef.current, true);
    
    // Reset all mesh highlights
    resetMeshHighlights();
    
    // If we intersected with something
    if (intersects.length > 0) {
      // Find the first mesh that is selectable
      const selectable = intersects.find(intersect => 
        intersect.object && 
        intersect.object.isMesh && 
        intersect.object.userData.selectable
      );
      
      if (selectable) {
        const selectedObj = selectable.object;
        
        // Highlight the selected mesh
        highlightMesh(selectedObj);
        setSelectedMesh(selectedObj.uuid);
        
        // Pass the selection to parent
        onComponentSelect(selectedObj.name || selectedObj.uuid);
        
        // Log selection for debugging
        console.log('Selected component:', selectedObj.name || selectedObj.uuid);
        
        return; // Exit after handling selection
      }
    }
    
    // If we get here, we either didn't hit anything or the object wasn't selectable
    setSelectedMesh(null);
    onComponentSelect(null); // Deselect
    
  }, [camera, raycaster, scene, onComponentSelect, gl.domElement, resetMeshHighlights, highlightMesh, allowComponentSelection]);

  // Effect to highlight the selected component when it changes externally
  useEffect(() => {
    if (!scene || !selectedComponent) return;
    
    // Reset all highlights first
    resetMeshHighlights();
    
    // Find the mesh with the matching name or UUID
    let meshToSelect = null;
    scene.traverse((child) => {
      if (child.isMesh) {
        if (child.name === selectedComponent || child.uuid === selectedComponent) {
          meshToSelect = child;
        }
      }
    });
    
    if (meshToSelect) {
      // Highlight new selection
      highlightMesh(meshToSelect);
      setSelectedMesh(meshToSelect.uuid);
    }
  }, [scene, selectedComponent, resetMeshHighlights, highlightMesh]);

  // Expose the applyTexture method to the parent component
  useEffect(() => {
    if (!window.RoomViewerAPI) {
      window.RoomViewerAPI = {};
    }
    
    window.RoomViewerAPI.applyTexture = (componentId, texture, repeatSettings) => {
      // Find the mesh with the matching name or UUID
      let targetMesh = null;
      if (scene) {
        scene.traverse((child) => {
          if (child.isMesh) {
            if (child.name === componentId || child.uuid === componentId) {
              targetMesh = child;
            }
          }
        });
      }
      
      if (!targetMesh) {
        console.warn("Could not find selected component for texture application:", componentId);
        return;
      }
      
      // Create a texture loader and load the texture
      const textureLoader = new THREE.TextureLoader();
      const textureUrl = URL.createObjectURL(texture);
      
      textureLoader.load(
        textureUrl, 
        (loadedTexture) => {
          // Configure texture repeating
          loadedTexture.wrapS = THREE.RepeatWrapping;
          loadedTexture.wrapT = THREE.RepeatWrapping;
          const rX = repeatSettings?.x || 2;
          const rY = repeatSettings?.y || 2;
          loadedTexture.repeat.set(rX, rY);

          // Create a new material with the loaded texture
          const newMaterial = new THREE.MeshStandardMaterial({
            map: loadedTexture,
            color: targetMesh.material.color,
            roughness: targetMesh.material.roughness || 0.7,
            metalness: targetMesh.material.metalness || 0.2
          });
          
          // Apply the new material to the mesh
          targetMesh.material.dispose(); // Clean up old material
          targetMesh.material = newMaterial;
          targetMesh.material.needsUpdate = true; // Ensure the material updates
          
          // Only highlight the mesh if highlighting is enabled
          if (showTagHighlighting && targetMesh === selectedComponent) {
            highlightMesh(targetMesh);
          }
          
          // Cleanup URL after loading
          URL.revokeObjectURL(textureUrl);
        },
        undefined, // Progress callback
        (error) => {
          console.error('Error loading texture:', error);
          URL.revokeObjectURL(textureUrl);
        }
      );
    };
    
    // Cleanup function for applyTexture
    return () => {
      if (window.RoomViewerAPI) {
        window.RoomViewerAPI.applyTexture = undefined;
      }
    };
  }, [scene, highlightMesh, showTagHighlighting, selectedComponent]);
  
  // Add a new function to apply textures to all components with a specific tag
  useEffect(() => {
    if (!window.RoomViewerAPI) {
      window.RoomViewerAPI = {};
    }
    
    window.RoomViewerAPI.applyTextureToTag = (tag, textureFile, repeatSettings = { x: 2, y: 2 }, componentTagsMapping = {}) => {
      if (!scene || !textureFile || !tag) {
        console.warn("Missing required parameters for applyTextureToTag");
        return;
      }
      
      // Find all components with the specified tag
      const targetComponents = Object.entries(componentTagsMapping)
        .filter(([_, componentTag]) => componentTag === tag)
        .map(([componentId]) => componentId);
      
      console.log(`Applying texture to all ${tag} components:`, targetComponents);
      
      // Apply texture to each matching component
      targetComponents.forEach(componentId => {
        // Find the mesh with the matching name or UUID
        let targetMesh = null;
        if (scene) {
          scene.traverse((child) => {
            if (child.isMesh) {
              if (child.name === componentId || child.uuid === componentId) {
                targetMesh = child;
              }
            }
          });
        }
        
        if (!targetMesh) {
          console.warn(`Could not find component ${componentId} for texture application`);
          return;
        }
        
        // Create a texture loader and load the texture
        const textureLoader = new THREE.TextureLoader();
        const textureUrl = URL.createObjectURL(textureFile);
        
        textureLoader.load(
          textureUrl, 
          (loadedTexture) => {
            // Configure texture repeating
            loadedTexture.wrapS = THREE.RepeatWrapping;
            loadedTexture.wrapT = THREE.RepeatWrapping;
            const rX = repeatSettings?.x || 2;
            const rY = repeatSettings?.y || 2;
            loadedTexture.repeat.set(rX, rY);
            
            // Create a new material with the loaded texture but WITHOUT highlighting
            const newMaterial = new THREE.MeshStandardMaterial({
              map: loadedTexture,
              color: targetMesh.material.color,
              roughness: targetMesh.material.roughness || 0.7,
              metalness: targetMesh.material.metalness || 0.2
            });
            
            // If we're not showing tag highlighting, ensure emissive is black (no highlighting)
            if (!showTagHighlighting) {
              newMaterial.emissive = new THREE.Color(0x000000);
              newMaterial.emissiveIntensity = 0;
            }
            
            // Apply the new material to the mesh
            if (targetMesh.material) targetMesh.material.dispose(); // Clean up old material
            targetMesh.material = newMaterial;
            targetMesh.material.needsUpdate = true; // Ensure the material updates
            
            // Cleanup URL after loading
            URL.revokeObjectURL(textureUrl);
          },
          undefined, // Progress callback
          (error) => {
            console.error('Error loading texture:', error);
            URL.revokeObjectURL(textureUrl);
          }
        );
      });
    };
    
    // Cleanup function
    return () => {
      if (window.RoomViewerAPI) {
        window.RoomViewerAPI.applyTextureToTag = undefined;
      }
    };
  }, [scene, showTagHighlighting]);

  // New function to remove texture from a component
  const removeTextureFromComponent = useCallback((componentId) => {
    if (!scene || !componentId) return;

    // Find the mesh with the matching name or UUID
    let targetMesh = null;
    scene.traverse((child) => {
      if (child.isMesh) {
        if (child.name === componentId || child.uuid === componentId) {
          targetMesh = child;
        }
      }
    });
    
    if (!targetMesh) {
      console.warn("Could not find component to remove texture from:", componentId);
      return;
    }
    
    // Get the original material
    const originalMaterial = originalMaterials.get(targetMesh.uuid);
    if (!originalMaterial) {
      console.warn("Could not find original material for component:", componentId);
      return;
    }
    
    // Clean up current material
    if (targetMesh.material) {
      if (targetMesh.material.map) targetMesh.material.map.dispose();
      targetMesh.material.dispose();
    }
    
    // Apply the original material
    targetMesh.material = originalMaterial.clone();
    
    // Re-highlight the mesh
    highlightMesh(targetMesh);
    
    console.log("Texture removed from component:", componentId);
  }, [scene, originalMaterials, highlightMesh]);
  
  // New function to remove textures from all components with a specific tag
  const removeTexturesForTag = useCallback((tag, componentTagsMapping = {}) => {
    if (!scene || !tag) return;
    
    // Find all components with the specified tag
    const targetComponents = Object.entries(componentTagsMapping)
      .filter(([_, componentTag]) => componentTag === tag)
      .map(([componentId]) => componentId);
    
    console.log(`Removing textures from all ${tag} components:`, targetComponents);
    
    // Remove textures from each matching component
    targetComponents.forEach(componentId => {
      removeTextureFromComponent(componentId);
    });
  }, [scene, removeTextureFromComponent]);

  // Expose the removeTextureFromComponent function to the parent
  useEffect(() => {
    if (!window.RoomViewerAPI) {
      window.RoomViewerAPI = {};
    }
    
    window.RoomViewerAPI.removeTexture = removeTextureFromComponent;
    window.RoomViewerAPI.removeTexturesForTag = removeTexturesForTag;
    
    return () => {
      if (window.RoomViewerAPI) {
        window.RoomViewerAPI.removeTexture = undefined;
        window.RoomViewerAPI.removeTexturesForTag = undefined;
      }
    };
  }, [removeTextureFromComponent, removeTexturesForTag]);

  // Reset component materials to original state
  const resetMaterials = useCallback(() => {
    if (!scene) return;
    
    scene.traverse((child) => {
      if (child.isMesh && originalMaterials.has(child.uuid)) {
        child.material.dispose(); // Clean up current material
        child.material = originalMaterials.get(child.uuid).clone();
      }
    });
    
    // Also reset selection
    setSelectedMesh(null);
    onComponentSelect(null);
    resetMeshHighlights();
  }, [scene, originalMaterials, onComponentSelect, resetMeshHighlights]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    resetMeshHighlights,
    highlightMesh,
    resetMaterials,
    scene
  }));

  if (loadError) {
    return (
      <Html center>
        <div className="loading-error">
          <p>{loadError}</p>
          <p>If using GLTF format, make sure to include all referenced files (.bin, textures).</p>
        </div>
      </Html>
    );
  }

  return scene ? (
    <>
      <primitive object={scene} onClick={handleClick} />
      {scene && selectedMesh === null && allowComponentSelection && (
        <Html position={[0, 1, 0]} center>
          <div className="selection-hint">
            Click on any part of the model to select it
          </div>
        </Html>
      )}
    </>
  ) : null;
});

// Use forwardRef to properly handle the ref passed from parent component
const RoomViewer = forwardRef(function RoomViewer({ 
  modelFile, 
  associatedFiles = [], 
  textures, 
  onComponentSelect, 
  selectedComponent,
  componentTags = {}, 
  textureRepeatSettings,
  allowComponentSelection = true, // New prop to control component selection
  showTagHighlighting = true, // New prop to control highlighting in different steps
  showTagLegend = true // New prop to control visibility of the tag legend
}, ref) {
  const [error, setError] = useState(null);
  const controlsRef = useRef();
  const [selectedComponentState, setSelectedComponentState] = useState(null);
  const modelRef = useRef(null);
  
  // Pass the selection up to parent and store locally
  const handleComponentSelect = useCallback((component) => {
    setSelectedComponentState(component);
    if (onComponentSelect) {
      onComponentSelect(component);
    }
  }, [onComponentSelect]);

  const handleInitialModelLoad = useCallback((loadedScene) => {
    const controls = controlsRef.current;
    if (!loadedScene || !controls || !controls.object) {
      console.warn("Attempted to initialize model view without scene or controls.");
      return;
    }

    const camera = controls.object;
    const box = new THREE.Box3().setFromObject(loadedScene);
    const center = new THREE.Vector3();
    box.getCenter(center);

    controls.target.copy(center);

    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const effectiveRadius = Math.max(sphere.radius, 0.1);
    const distance = Math.max(effectiveRadius * 2.5, 5);

    let direction = new THREE.Vector3().subVectors(camera.position, controls.target);
    if (direction.lengthSq() < 0.0001) {
        direction.set(1, 0.7, 1);
    }
    direction.normalize();
    
    camera.position.copy(controls.target).addScaledVector(direction, distance);
    
    camera.near = Math.max(0.01, distance / 100);
    camera.far = distance * 100;
    camera.updateProjectionMatrix();

    controls.update();
    controls.saveState();
  }, []);

  const handleBoundaryError = useCallback((err, errorInfo) => {
    console.error("RoomViewer ErrorBoundary caught:", err, errorInfo);
    setError(`Failed to render 3D model. ${err.message}`);
  }, []);

  // Function to reset view back to default position
  const resetView = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  // Expose the modelRef to parent component via the forwarded ref
  useImperativeHandle(ref, () => ({
    resetView: () => {
      if (controlsRef.current) {
        controlsRef.current.reset();
      }
    },
    getModelRef: () => modelRef.current
  }));

  return (
    <div className="room-viewer-container" role="application" aria-label="3D Room Preview">
      {!modelFile && !error && (
        <div className="viewer-placeholder">
          <p>Upload a 3D model to see the preview here.</p>
        </div>
      )}
      {error && (
        <div className="viewer-error" role="alert">
          <p>{error}</p>
        </div>
      )}
      {modelFile && !error && (
        <ErrorBoundary 
            onError={handleBoundaryError} 
            fallback={<div className="viewer-error" role="alert">
              <p>Could not display 3D model. It might be corrupted or unsupported.</p>
              <p>For GLTF files, make sure to include all associated files (.bin, textures).</p>
            </div>}
        >
          <Canvas shadows>
            <PerspectiveCamera 
              makeDefault 
              position={[10, 10, 10]} 
              fov={45} 
              near={0.1} 
              far={1000} 
            />
            <ambientLight intensity={0.7} />
            <directionalLight 
              position={[10, 10, 5]} 
              intensity={1.0} 
              castShadow 
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            <Suspense fallback={<Loader />}>
              <Model 
                  ref={modelRef}
                  key={modelFile?.name} // Use name as part of key to force remount
                  modelFile={modelFile}
                  associatedFiles={associatedFiles}
                  onComponentSelect={handleComponentSelect}
                  selectedComponent={selectedComponentState}
                  componentTags={componentTags} 
                  textureRepeatSettings={textureRepeatSettings}
                  textures={textures} 
                  onInitialLoad={handleInitialModelLoad}
                  allowComponentSelection={allowComponentSelection} // Pass the prop to the Model component
                  showTagHighlighting={showTagHighlighting} // Pass the prop to the Model component
              />
            </Suspense>
            <OrbitControls 
              ref={controlsRef} 
              enableDamping 
              dampingFactor={0.1}
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              zoomSpeed={1.2}
              panSpeed={1.2}
              rotateSpeed={1.0}
              minDistance={0.1}
              maxDistance={1000}
              minPolarAngle={0}
              maxPolarAngle={Math.PI}
            />
          </Canvas>
          <div className="viewer-controls">
            <button onClick={resetView} className="control-button" aria-label="Reset view">
              Reset View
            </button>
            {selectedComponentState && allowComponentSelection && (
              <div className="selected-component-info">
                <span>Selected: </span>
                <strong>{typeof selectedComponentState === 'string' ? selectedComponentState : 'Component'}</strong>
                {componentTags[selectedComponentState] && (
                  <span className="component-tag-badge">({componentTags[selectedComponentState]})</span>
                )}
              </div>
            )}
          </div>
          
          {/* Legend for color-coded tags */}
          {showTagLegend && Object.keys(componentTags).length > 0 && (
            <div className="component-tag-legend">
              <div className="legend-title">Component Tags</div>
              <div className="legend-item">
                <div className="color-swatch wall"></div>
                <span>Wall</span>
              </div>
              <div className="legend-item">
                <div className="color-swatch floor"></div>
                <span>Floor</span>
              </div>
            </div>
          )}
        </ErrorBoundary>
      )}
    </div>
  );
});

export default RoomViewer;
