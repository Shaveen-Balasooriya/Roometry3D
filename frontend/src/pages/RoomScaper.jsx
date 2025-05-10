import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../services/firebase';
import { collection, getDocs, query, where, doc, getDoc, limit } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import './RoomScaper.css';

// Custom 3D Model Preview Component
function RoomModelPreview({ modelUrl, onLoaded }) {
  const loadedRef = useRef(false);
  const modelUrlRef = useRef(modelUrl);
  const wallMaterialsRef = useRef(new Map());
  const cameraRef = useRef();
  const modelRef = useRef();
  
  console.log("Attempting to load model from URL:", modelUrl);
  
  // Use standard GLTFLoader without custom manager to avoid "Proto is not a constructor" error
  const gltf = useLoader(GLTFLoader, modelUrl, undefined, (xhr) => {
    if (xhr.loaded && xhr.total) {
      const progress = Math.floor((xhr.loaded / xhr.total) * 100);
      console.log(`Loading model: ${progress}% complete`);
      if (progress === 100 && !loadedRef.current && onLoaded) {
        loadedRef.current = true;
        console.log("Model load progress complete, calling onLoaded");
        onLoaded();
      }
    }
  });
  
  // Identify what might be walls based on naming or position
  const identifyWalls = (object) => {
    // These patterns help identify walls in common 3D models
    const wallPatterns = [/wall/i, /partition/i, /divider/i];
    
    // Check if the object name contains any wall patterns
    const nameIsWall = wallPatterns.some(pattern => pattern.test(object.name));
    
    // Check if object is flat and vertical (typical wall characteristics)
    let isVerticalSurface = false;
    
    if (object.geometry) {
      // Get bounding box dimensions
      const bbox = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      
      // If one dimension is much smaller than the others and it's vertical, it might be a wall
      const minDim = Math.min(size.x, size.y, size.z);
      const maxDim = Math.max(size.x, size.y, size.z);
      
      // Check if the height (y) is significant compared to other dimensions
      isVerticalSurface = 
        (minDim < maxDim * 0.1) && // One dimension is thin
        (size.y > size.x * 0.6 || size.y > size.z * 0.6); // Significant height
    }
    
    // If either naming or geometry suggests a wall, consider it a wall
    return nameIsWall || isVerticalSurface;
  };
  
  // Create transparent material for see-through walls
  const createTransparentMaterial = (originalMaterial) => {
    // Clone the original material to preserve its properties
    const transparentMaterial = originalMaterial.clone();
    
    // Set transparency properties
    transparentMaterial.transparent = true;
    transparentMaterial.opacity = 0.3;
    transparentMaterial.depthWrite = false; // Prevents z-fighting
    transparentMaterial.side = THREE.DoubleSide;
    
    // Store a reference to both materials
    return transparentMaterial;
  };
  
  // Configure the model when it loads
  useEffect(() => {
    console.log("Model loaded:", gltf ? "success" : "loading");
    
    if (gltf && gltf.scene && !loadedRef.current) {
      try {
        console.log("Processing loaded model...");
        
        // Center and scale the model
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2.5 / (maxDim > 0 ? maxDim : 1); // Increased scale factor for closer view
        
        gltf.scene.position.x = -center.x * scale;
        gltf.scene.position.y = -center.y * scale;
        gltf.scene.position.z = -center.z * scale;
        gltf.scene.scale.set(scale, scale, scale);
        
        console.log("Model centered and scaled, dimensions:", size);
        
        // Store reference to model
        modelRef.current = gltf.scene;
        
        // Process materials for walls
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            if (child.material) {
              child.material.needsUpdate = true;
              
              // Check if this mesh is likely a wall
              if (identifyWalls(child)) {
                console.log("Wall identified:", child.name || "unnamed");
                
                // Handle array of materials
                if (Array.isArray(child.material)) {
                  const transparentMaterials = child.material.map(mat => createTransparentMaterial(mat));
                  wallMaterialsRef.current.set(child.uuid, {
                    original: [...child.material],
                    transparent: transparentMaterials,
                    mesh: child
                  });
                } 
                // Handle single material
                else {
                  const transparentMaterial = createTransparentMaterial(child.material);
                  wallMaterialsRef.current.set(child.uuid, {
                    original: child.material,
                    transparent: transparentMaterial,
                    mesh: child
                  });
                }
              }
            }
          }
        });
        
        if (onLoaded && !loadedRef.current) {
          loadedRef.current = true;
          console.log("Model processing complete, calling onLoaded");
          setTimeout(() => onLoaded(), 100); // Small delay for render completion
        }
      } catch (err) {
        console.error("Error processing model:", err);
        if (onLoaded) onLoaded(); // Mark as loaded even on error
      }
    }
  }, [gltf, onLoaded]);
  
  // Handle URL changes
  useEffect(() => {
    if (modelUrl !== modelUrlRef.current) {
      console.log("Model URL changed from", modelUrlRef.current, "to", modelUrl);
      modelUrlRef.current = modelUrl;
      loadedRef.current = false;
    }
  }, [modelUrl]);
  
  // Add effect for camera-based wall transparency
  useFrame((state) => {
    if (!wallMaterialsRef.current.size || !modelRef.current) return;
    
    const camera = state.camera;
    cameraRef.current = camera;
    
    // Get camera position relative to scene
    const cameraPosition = camera.position.clone();
    
    // Update wall materials based on camera position
    wallMaterialsRef.current.forEach((materialInfo, uuid) => {
      const mesh = materialInfo.mesh;
      
      if (!mesh.visible) return;
      
      // Get mesh world position
      const meshWorldPosition = new THREE.Vector3();
      mesh.getWorldPosition(meshWorldPosition);
      
      // Calculate vector from camera to mesh center
      const cameraToMesh = meshWorldPosition.clone().sub(cameraPosition);
      
      // Get mesh normal (simplified - assumes walls are axis-aligned)
      const normal = new THREE.Vector3();
      if (mesh.geometry.boundingBox) {
        // Try to get face normal
        normal.set(0, 0, 1); // Default
      } else {
        // Compute bounding box if needed
        mesh.geometry.computeBoundingBox();
        normal.set(0, 0, 1); // Default
      }
      
      // If mesh normal is pointing generally toward camera, make it transparent
      const dot = normal.dot(cameraToMesh);
      
      // Adjust this threshold to control when walls become transparent
      const dotThreshold = 0;
      
      // If camera is within a certain distance, make walls transparent
      const distanceThreshold = 3; // Adjust based on model scale
      const distance = cameraPosition.distanceTo(meshWorldPosition);
      
      if (distance < distanceThreshold || dot < dotThreshold) {
        // Wall is between camera and interior - make transparent
        if (Array.isArray(mesh.material)) {
          mesh.material = materialInfo.transparent;
        } else {
          mesh.material = materialInfo.transparent;
        }
      } else {
        // Wall is not obstructing view - use original material
        mesh.material = materialInfo.original;
      }
    });
  });
  
  if (!gltf || !gltf.scene) {
    console.log("No model loaded, showing placeholder");
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="lightgray" />
      </mesh>
    );
  }
  
  console.log("Rendering model scene");
  return <primitive object={gltf.scene} castShadow receiveShadow />;
}

// Error boundary for 3D rendering
class ModelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      // Return a valid THREE.js object when in a Canvas context
      return (
        <mesh>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="red" />
        </mesh>
      );
    }
    return this.props.children;
  }
}

// Room Card Component
function RoomCard({ room, onSelect, isLoading, onLoaded }) {
  const { id, name, description, category, modelUrl } = room;
  const [inView, setInView] = useState(false);
  const previewRef = useRef(null);
  
  // Setup intersection observer for lazy loading
  useEffect(() => {
    let observer;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setInView(true);
            // Once in view, stop observing
            if (previewRef.current) {
              observer.unobserve(previewRef.current);
            }
          }
        },
        { threshold: 0.1, rootMargin: '100px' }
      );
      
      if (previewRef.current) {
        observer.observe(previewRef.current);
      }
    } catch (err) {
      console.error("Error setting up intersection observer:", err);
      // If observer fails, show content anyway
      setInView(true);
    }
    
    return () => {
      if (observer && previewRef.current) {
        observer.unobserve(previewRef.current);
      }
    };
  }, []);
  
  // Display model path for debugging
  useEffect(() => {
    console.log(`Room ${id} - ${name} model URL:`, modelUrl);
  }, [id, name, modelUrl]);
  
  return (
    <div className="room-card">
      <div className="room-preview-container" ref={previewRef}>
        {modelUrl && inView ? (
          <>
            <Canvas shadows camera={{ position: [0, 0.3, 1.8], fov: 35 }}>
              <color attach="background" args={["#f8f9fa"]} />
              <ambientLight intensity={0.8} />
              <directionalLight 
                position={[5, 5, 5]} 
                intensity={1} 
                castShadow 
                shadow-mapSize-width={1024} 
                shadow-mapSize-height={1024}
              />
              <directionalLight position={[-5, 5, -5]} intensity={0.5} />
              <Environment preset="apartment" />
              
              <ModelErrorBoundary>
                <Suspense fallback={
                  <mesh>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshStandardMaterial color="lightgray" />
                  </mesh>
                }>
                  <RoomModelPreview 
                    modelUrl={modelUrl} 
                    onLoaded={() => onLoaded && onLoaded(id)}
                  />
                </Suspense>
              </ModelErrorBoundary>
              
              <OrbitControls 
                enableZoom={true} 
                autoRotate 
                autoRotateSpeed={0.8}
                maxPolarAngle={Math.PI / 2}
                minDistance={1.2}
                maxDistance={4}
              />
              
              <mesh 
                rotation={[-Math.PI / 2, 0, 0]} 
                position={[0, -1, 0]} 
                receiveShadow
              >
                <planeGeometry args={[10, 10]} />
                <shadowMaterial opacity={0.2} />
              </mesh>
            </Canvas>
            
            {isLoading && (
              <div className="model-loading-overlay">
                <div className="spinner-container">
                  <div className="loading-spinner"></div>
                  <p>Loading room preview...</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="no-preview">
            <p>No 3D Preview Available</p>
            {room.modelPath && typeof room.modelPath === 'string' && (
              <p className="model-path-info">
                (Path: {room.modelPath.substring(0, 20) + '...'})
              </p>
            )}
            {room.modelPath && typeof room.modelPath !== 'string' && (
              <p className="model-path-info">
                (File: {room.modelPath})
              </p>
            )}
          </div>
        )}
        
        {modelUrl && !inView && (
          <div className="model-placeholder">
            <div className="loading-spinner"></div>
            <p>Loading preview...</p>
          </div>
        )}
      </div>        <div className="room-card-body">
          <div className="room-category-tag">{category || 'Uncategorized'}</div>
          <h3 className="room-title">{name}</h3>
          <p className="room-description">
            {description && description.length > 120 
              ? `${description.substring(0, 120)}...` 
              : description || 'No description available.'}
          </p>
          <div className="room-card-footer">
            <button 
              className="room-select-button" 
              onClick={() => onSelect(room)}
              disabled={isLoading}
            >
              Select Room
            </button>
            <button 
              className="room-debug-button" 
              onClick={(e) => {
                e.stopPropagation();
                window.handleDebugRoom(room);
              }}
              title="Debug room model"
            >
              Debug
            </button>
          </div>
        </div>
    </div>
  );
}

// Loading Component
function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="loading-container">
      <div className="loading-spinner-large"></div>
      <h2>Loading Room Templates</h2>
      <p>{message}</p>
    </div>
  );
}

// Main RoomScaper Component
function RoomScaper() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loadingStates, setLoadingStates] = useState({});
  const [categories, setCategories] = useState(['All']);
  const [projectData, setProjectData] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = location.state?.projectId;
  
  // Fetch project data if project ID is available
  useEffect(() => {
    if (projectId) {
      const fetchProjectData = async () => {
        try {
          const projectRef = doc(db, 'projects', projectId);
          const projectDoc = await getDoc(projectRef);
          
          if (projectDoc.exists()) {
            const data = projectDoc.data();
            setProjectData({ id: projectDoc.id, ...data });
            console.log('Project data loaded:', data);
          } else {
            console.warn('Project not found:', projectId);
          }
        } catch (error) {
          console.error('Error fetching project data:', error);
          setError(`Failed to load project: ${error.message}`);
        }
      };
      
      fetchProjectData();
    }
  }, [projectId]);
  
  // Fetch rooms from Firestore
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        console.log("Fetching rooms from Firestore...");
        
        // Query rooms collection
        const roomsRef = collection(db, 'rooms');
        const roomsSnapshot = await getDocs(roomsRef);
        
        if (roomsSnapshot.empty) {
          console.log('No rooms found in database');
          setRooms([]);
          setLoading(false);
          return;
        }
        
        console.log(`Found ${roomsSnapshot.size} rooms in database`);
        
        // Process room data
        const loadingStateObj = {};
        const categoriesSet = new Set(['All']);
        
        const roomPromises = roomsSnapshot.docs.map(async (doc) => {
          const data = doc.data();
          const roomId = doc.id;
          
          console.log(`Processing room ${roomId}:`, data);
          
          // Track loading state for this room
          loadingStateObj[roomId] = true;
          
          // Add category to set of categories
          if (data.category) {
            categoriesSet.add(data.category);
          }
          
          // Get model URL from Firebase Storage if path exists
          let modelUrl = null;
          let modelPath = null;
          
          // Check the different possible fields where the model path might be stored
          const modelData = data.modelPath || data.modelUrl || data.model || 
            (data.files && data.files.model) || null;
            
          console.log(`Room ${roomId} model path:`, modelData);
          
          // Handle different data structures for model path/url
          if (modelData) {
            try {
              // Handle object with url property (which is what we're seeing in the logs)
              if (typeof modelData === 'object' && modelData.url) {
                modelUrl = modelData.url;
                modelPath = modelData.name || 'model file';
                console.log(`Using URL from object for room ${roomId}:`, modelUrl);
              }
              // Handle direct string URL
              else if (typeof modelData === 'string') {
                if (modelData.startsWith('http')) {
                  modelUrl = modelData;
                  modelPath = modelData;
                  console.log(`Using direct string URL for room ${roomId}:`, modelUrl);
                } else {
                  // For paths, use Firebase Storage
                  const modelRef = ref(storage, modelData);
                  modelUrl = await getDownloadURL(modelRef);
                  modelPath = modelData;
                  console.log(`Generated download URL for room ${roomId}:`, modelUrl);
                }
              }
            } catch (err) {
              console.error(`Error getting download URL for room ${roomId}:`, err);
              
              // Only try alternative approach if modelData is a string
              if (typeof modelData === 'string') {
                try {
                  // Sometimes the path might be stored with or without a leading slash
                  const altPath = modelData.startsWith('/') ? modelData.substring(1) : `/${modelData}`;
                  const modelRef = ref(storage, altPath);
                  modelUrl = await getDownloadURL(modelRef);
                  modelPath = altPath;
                  console.log(`Generated download URL using alternate path for room ${roomId}:`, modelUrl);
                } catch (altErr) {
                  console.error(`Alternative approach also failed for room ${roomId}:`, altErr);
                }
              }
            }
          }
          
          return {
            id: roomId,
            name: data.name || 'Unnamed Room',
            description: data.description || 'No description available',
            category: data.category || 'Other',
            modelUrl: modelUrl,
            modelPath: modelPath,
            modelData: modelData, // Store the original model data
            createdAt: data.createdAt?.toDate() || new Date()
          };
        });
        
        const processedRooms = await Promise.all(roomPromises);
        console.log("Processed rooms:", processedRooms);
        
        setRooms(processedRooms);
        setLoadingStates(loadingStateObj);
        setCategories(Array.from(categoriesSet));
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching rooms:', err);
        setError('Failed to load room templates. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchRooms();
  }, []);
  
  // Handle model loaded event
  const handleModelLoaded = (roomId) => {
    console.log(`Model for room ${roomId} loaded successfully`);
    setTimeout(() => {
      setLoadingStates(prev => ({
        ...prev,
        [roomId]: false
      }));
    }, 300);
  };
  
  // Handle room selection
  const handleRoomSelect = (room) => {
    console.log('Selected room:', room);
    
    // Ensure we have the model URL before navigating
    if (!room.modelUrl) {
      console.error('Room is missing modelUrl:', room);
    }
    
    // Navigate to the room environment with the selected room and all necessary data
    navigate(`/room-environment/${room.id}`, {
      state: {
        roomId: room.id,
        roomData: {
          ...room,
          modelUrl: room.modelUrl  // Explicitly include the model URL
        },
        projectId: projectId,
        projectData: projectData
      }
    });
  };
  
  // Debug route for troubleshooting room issues
  const handleDebugRoom = (room) => {
    console.log('Debugging room:', room);
    
    // Navigate to the debug page with all room data
    navigate(`/room-debug/${room.id}`, {
      state: {
        roomId: room.id,
        roomData: room,
        projectId: projectId,
        projectData: projectData
      }
    });
  };
  
  // Filter rooms by selected category
  const filteredRooms = selectedCategory === 'All'
    ? rooms
    : rooms.filter(room => room.category === selectedCategory);
  
  // Show loading spinner while fetching data
  if (loading) {
    return (
      <div className="room-scaper-container">
        <div className="room-scaper-header">
          <h1>Room Scaper</h1>
          <p className="subtitle">Loading your room templates...</p>
        </div>
        <LoadingSpinner message="Loading room templates..." />
      </div>
    );
  }
  
  // Show error message if something went wrong
  if (error) {
    return (
      <div className="room-scaper-container">
        <div className="room-scaper-header">
          <h1>Room Scaper</h1>
          <p className="subtitle">There was a problem loading room templates</p>
        </div>
        <div className="error-container">
          <h3>Error</h3>
          <p>{error}</p>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="room-scaper-container">
      <div className="room-scaper-header">
        <h1>Room Scaper</h1>
        <p className="subtitle">
          Choose a room template to get started with your {projectData ? projectData.name : ''} project.
          You can customize the room with furniture and décor in the next step.
        </p>
        
        {/* Category filter buttons */}
        <div className="category-filter">
          {categories.map(category => (
            <button
              key={category}
              className={`category-button ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category === 'All' ? 'All Rooms' : category}
            </button>
          ))}
        </div>
      </div>
      
      {/* Room grid or empty state */}
      {filteredRooms.length === 0 ? (
        <div className="empty-rooms">
          <h3>No Room Templates Available</h3>
          <p>
            {selectedCategory === 'All' 
              ? 'Check back later for new room templates.'
              : `No rooms found in the '${selectedCategory}' category.`}
          </p>
        </div>
      ) : (
        <>
          <div className="rooms-count">
            Showing {filteredRooms.length} {selectedCategory === 'All' ? 'rooms' : `${selectedCategory} rooms`}
          </div>
          <div className="rooms-grid">
            {filteredRooms.map(room => (
              <RoomCard
                key={room.id}
                room={room}
                onSelect={handleRoomSelect}
                isLoading={loadingStates[room.id]}
                onLoaded={handleModelLoaded}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default RoomScaper;