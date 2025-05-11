import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { getFileTypeFromUrl, prepareModelScene, applyTextureToModel, checkModelFileSize } from './FurnitureModelUtils';
import { debugModelStructure } from './FurnitureModelDebug';
import './FurnitureModel.css';
import FurnitureControlsHelp from './FurnitureControlsHelp';

// Component to render a draggable furniture model
const FurnitureModel = ({ 
  item, 
  selected, 
  onSelect, 
  onPositionChange,
  onDelete
}) => {
  const { scene, camera, gl } = useThree();
  const modelRef = useRef();
  const [model, setModel] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLargeFile, setIsLargeFile] = useState(false);
  const [loadTimeout, setLoadTimeout] = useState(false);

  // Keep track of mouse position for dragging
  const mouse = useRef({ x: 0, y: 0 });
  const mouseDown = useRef({ x: 0, y: 0 });
  const initialPosition = useRef(item.position || [0, 0, 0]);
  const initialRotation = useRef(item.rotation || [0, 0, 0]);

  // Setup raycaster for drag and drop
  const raycaster = useRef(new THREE.Raycaster());
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0)));
  const planeNormal = useRef(new THREE.Vector3(0, 1, 0));
  const intersectionPoint = useRef(new THREE.Vector3());
  // Cancel loading if it takes too long (potentially a very large file)
  useEffect(() => {
    if (loading && item.modelUrl) {
      const timer = setTimeout(() => {
        setLoadTimeout(true);
      }, 30000); // 30 second timeout for loading

      return () => clearTimeout(timer);
    }
  }, [loading, item.modelUrl]);
    const dragInfo = useRef({
    isDragging: false,
    previousMousePosition: { x: 0, y: 0 },
    offset: new THREE.Vector3(),
    plane: new THREE.Plane(new THREE.Vector3(0, 1, 0)) // XZ plane
  });
  
  const intersection = useRef(new THREE.Vector3());
  
  // Load the appropriate model based on file type
  useEffect(() => {
    if (!item.modelUrl) {
      console.error(`No model URL provided for furniture: ${item.name || 'unnamed'}`);
      setError('No model URL available');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setModel(null);
    setError(null);
    
    const fileType = getFileTypeFromUrl(item.modelUrl);
    console.log(`Loading furniture model: ${item.modelUrl} (${fileType})`);
    
    let isActive = true;
      const handleError = (err) => {
      if (!isActive) return;
      
      // Check if it's a network error
      const isNetworkError = err.message && 
        (err.message.includes('Failed to fetch') || 
         err.message.includes('NetworkError') ||
         err.message.includes('timeout') ||
         err.message.includes('aborted'));
      
      // Check if it's a progress event with a large file
      const isLargeFile = err.type === 'progress' && err.total > 15000000; // 15MB threshold
      
      if (isLargeFile || isNetworkError || loadTimeout) {
        let errorMessage = "Unknown error loading model";
        
        if (isLargeFile) {
          errorMessage = `Model is very large (${Math.round(err.total / 1024 / 1024)}MB)`;
          console.warn(`${errorMessage}, using fallback cube instead`);
          setIsLargeFile(true);
        } else if (isNetworkError) {
          errorMessage = `Network error: ${err.message || 'Failed to load model'}`;
          console.warn(`${errorMessage}, using fallback cube instead`);
        } else if (loadTimeout) {
          errorMessage = "Loading timed out";
          console.warn(`${errorMessage}, using fallback cube instead`);
        }
        
        // Create a simple cube mesh as a fallback with item name
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ 
          color: 0x999999,
          roughness: 0.7,
          metalness: 0.2
        });
        const cube = new THREE.Mesh(geometry, material);
        const group = new THREE.Group();
        group.add(cube);
        
        // Add metadata for the fallback
        group.userData.isFallback = true;
        group.userData.originalError = errorMessage;
        group.userData.originalName = item.name || 'unnamed';
        
        // Add a label with the item name
        const processedModel = prepareModelScene(group, item.instanceId);
        
        // Apply texture if available
        if (item.selectedTextureUrl) {
          applyTextureToModel(processedModel, item.selectedTextureUrl);
        }
        
        setModel(processedModel);
        setLoading(false);
        return;
      }
      
      console.error(`Error loading furniture model (${fileType}):`, err);
      setError(`Failed to load model: ${err.message || 'Unknown error'}`);
      setLoading(false);
    };
    
    try {
      if (fileType === 'obj') {
        const objLoader = new OBJLoader();
        
        // Set a timeout - abort loading if it takes too long
        const timeoutId = setTimeout(() => {
          if (loading && isActive) {
            console.warn(`Loading timeout for model: ${item.modelUrl}`);
            handleError(new Error("Loading timeout"));
          }
        }, 20000); // 20 seconds timeout
        
        objLoader.load(
          item.modelUrl,
          (obj) => {
            clearTimeout(timeoutId);
            if (!isActive) return;
            console.log(`OBJ model loaded: ${item.name || 'unnamed'}`);
            debugModelStructure(obj, `Loaded OBJ: ${item.name || 'unnamed'}`);
            
            const processedModel = prepareModelScene(obj, item.instanceId);
            
            // Apply texture if available
            if (item.selectedTextureUrl) {
              applyTextureToModel(processedModel, item.selectedTextureUrl);
            }
            
            setModel(processedModel);
            setLoading(false);
          },
          (xhr) => {
            if (xhr.loaded && xhr.total) {
              console.log(`Loading OBJ: ${Math.round((xhr.loaded / xhr.total) * 100)}%`);
              // Check for oversized models
              if (xhr.total > 15000000 && isActive) { // 15MB threshold
                clearTimeout(timeoutId);
                handleError(xhr);
              }
            }
          },
          (err) => {
            clearTimeout(timeoutId);
            handleError(err);
          }
        );
      } else if (fileType === 'gltf' || fileType === 'glb') {
        const gltfLoader = new GLTFLoader();
        
        // Set a timeout - abort loading if it takes too long
        const timeoutId = setTimeout(() => {
          if (loading && isActive) {
            console.warn(`Loading timeout for model: ${item.modelUrl}`);
            handleError(new Error("Loading timeout"));
          }
        }, 20000); // 20 seconds timeout
        
        gltfLoader.load(
          item.modelUrl,
          (gltf) => {
            clearTimeout(timeoutId);
            if (!isActive) return;            console.log(`GLTF/GLB model loaded: ${item.name || 'unnamed'}`);
            debugModelStructure(gltf, `Loaded GLTF: ${item.name || 'unnamed'}`);
            
            const processedModel = prepareModelScene(gltf.scene, item.instanceId);
            
            // Apply texture if available
            if (item.selectedTextureUrl) {
              applyTextureToModel(processedModel, item.selectedTextureUrl);
            }
            
            setModel(processedModel);
            setLoading(false);
          },
          (xhr) => {
            if (xhr.loaded && xhr.total) {
              console.log(`Loading GLTF/GLB: ${Math.round((xhr.loaded / xhr.total) * 100)}%`);
              // Check for oversized models
              if (xhr.total > 15000000 && isActive) { // 15MB threshold
                clearTimeout(timeoutId);
                handleError(xhr);
              }
            }
          },
          (err) => {
            clearTimeout(timeoutId);
            handleError(err);
          }
        );
      } else {
        console.error(`Unsupported model type: ${fileType}`);
        setError(`Unsupported model type: ${fileType}`);
        setLoading(false);
      }
    } catch (err) {
      handleError(err);
    }
    
    return () => {
      isActive = false;
    };
  }, [item.modelUrl, item.instanceId, item.name, item.selectedTextureUrl]);
    // Apply texture when it changes
  useEffect(() => {
    if (model && item.selectedTextureUrl) {
      console.log(`Applying texture to model: ${item.selectedTextureUrl}`);
      try {
        applyTextureToModel(model, item.selectedTextureUrl, (success) => {
          if (success) {
            console.log('Texture applied successfully');
          } else {
            console.warn('Texture applied, but some meshes may not have received it properly');
          }
        });
      } catch (error) {
        console.error('Error applying texture:', error);
      }
    }
  }, [model, item.selectedTextureUrl]);
  
  // Setup mouse event handlers for dragging
  useEffect(() => {
    const dom = gl.domElement;
    
    const onMouseDown = (event) => {
      if (!modelRef.current || !model) return;
      
      // Calculate mouse position in normalized device coordinates
      const rect = dom.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Raycasting to check if we're clicking on this furniture
      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObject(modelRef.current, true);
      
      if (intersects.length > 0) {
        // Prevent orbit controls from interfering
        event.stopPropagation();
        
        // Select this furniture
        if (onSelect) {
          onSelect(item.instanceId);
        }
        
        if (selected) {
          // Start dragging
          setDragging(true);
          dragInfo.current.isDragging = true;
          dragInfo.current.previousMousePosition = { x: event.clientX, y: event.clientY };
          
          // Set the drag plane to pass through the model's current position
          dragInfo.current.plane.constant = -modelRef.current.position.y;
          
          // Calculate the offset from the intersection point to the model's position
          raycaster.current.setFromCamera(mouse.current, camera);
          raycaster.current.ray.intersectPlane(dragInfo.current.plane, intersection.current);
          dragInfo.current.offset.copy(modelRef.current.position).sub(intersection.current);
          
          dom.style.cursor = 'move';
        }
      }
    };
    
    const onMouseMove = (event) => {
      if (!dragInfo.current.isDragging || !modelRef.current) return;
      
      // Calculate mouse position in normalized device coordinates
      const rect = dom.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Project the new position onto the drag plane
      raycaster.current.setFromCamera(mouse.current, camera);
      raycaster.current.ray.intersectPlane(dragInfo.current.plane, intersection.current);
      
      // Update model position, adding back the initial offset
      modelRef.current.position.copy(intersection.current.add(dragInfo.current.offset));
      
      // Prevent model from going too far below the floor
      if (modelRef.current.position.y < -1) {
        modelRef.current.position.y = -1;
      }
      
      // Track movement for rotation
      const deltaMove = {
        x: event.clientX - dragInfo.current.previousMousePosition.x,
        y: event.clientY - dragInfo.current.previousMousePosition.y
      };
      
      // If holding shift key, rotate instead of just moving
      if (event.shiftKey) {
        modelRef.current.rotation.y += deltaMove.x * 0.01;
      }
      
      dragInfo.current.previousMousePosition = { x: event.clientX, y: event.clientY };
    };
    
    const onMouseUp = (event) => {
      if (dragInfo.current.isDragging && modelRef.current) {
        // Notify position change
        const newPosition = [
          modelRef.current.position.x,
          modelRef.current.position.y,
          modelRef.current.position.z
        ];
        const newRotation = [
          modelRef.current.rotation.x,
          modelRef.current.rotation.y,
          modelRef.current.rotation.z
        ];
        
        if (onPositionChange) {
          onPositionChange(item.instanceId, newPosition, newRotation);
        }
        
        // End dragging
        setDragging(false);
        dragInfo.current.isDragging = false;
        dom.style.cursor = 'auto';
      }
    };    
    const onKeyDown = (event) => {
      if (selected && (event.key === 'Delete' || event.key === 'Backspace')) {
        // Handle delete key by calling onDelete callback
        console.log(`Delete key pressed for furniture: ${item.instanceId}`);
        if (onDelete) {
          onDelete(item.instanceId);
        }
      }
    };
    
    // Add event listeners
    dom.addEventListener('mousedown', onMouseDown);
    dom.addEventListener('mousemove', onMouseMove);
    dom.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('mouseleave', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    
    return () => {
      // Remove event listeners
      dom.removeEventListener('mousedown', onMouseDown);
      dom.removeEventListener('mousemove', onMouseMove);
      dom.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('mouseleave', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [gl, camera, model, selected, onSelect, onPositionChange, item.instanceId]);
  
  // Apply initial position and rotation from props
  useEffect(() => {
    if (modelRef.current && item.position && item.rotation) {
      modelRef.current.position.set(item.position[0], item.position[1], item.position[2]);
      modelRef.current.rotation.set(item.rotation[0], item.rotation[1], item.rotation[2]);
    }
  }, [model, item.position, item.rotation]);
  
  // Loading indicator
  if (loading) {
    return (
      <Html center>
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px', color: 'white' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', 
                      border: '2px solid #fff', borderTopColor: 'transparent',
                      animation: 'spin 1s linear infinite' }} />
          <div>Loading Furniture</div>
        </div>
      </Html>
    );
  }
    // Error state
  if (error) {
    return (
      <mesh position={item.position || [0, 0, 0]} onClick={() => onSelect && onSelect(item.instanceId)}>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial color="#cc3333" />
        <Html center>
          <div className="furniture-error-container">
            <div className="furniture-error-icon">!</div>
            <div>
              {isLargeFile 
                ? "Large model - using fallback" 
                : (error.toString().includes("NetworkError") || error.toString().includes("Failed to fetch"))
                  ? "Network error loading model"
                  : "Error loading model"}
            </div>
          </div>
        </Html>
      </mesh>
    );
  }
  
  // Successful load
  if (model) {
    return (
      <group 
        ref={modelRef}
        position={item.position || [0, 0, 0]}
        rotation={item.rotation || [0, 0, 0]}
        scale={item.scale || [1, 1, 1]}
      >
        <primitive 
          object={model}
          onClick={(e) => {
            e.stopPropagation();
            if (onSelect) onSelect(item.instanceId);
          }}
        />
        {selected && (
          <>
            {/* Selection outline */}
            <mesh position={[0, 0, 0]} visible={false}>
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial color="#ffff00" wireframe={true} />
            </mesh>
            
            {/* Selection indicator */}
            <Html center position={[0, 1.2, 0]}>
              <div style={{ 
                background: 'rgba(0,120,255,0.7)', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '8px',
                fontSize: '12px',
                pointerEvents: 'none'
              }}>
                {dragging ? 'Moving...' : 'Selected'}
              </div>
            </Html>
          </>
        )}
      </group>
    );
  }
  
  // Fallback
  return null;
};

export default FurnitureModel;