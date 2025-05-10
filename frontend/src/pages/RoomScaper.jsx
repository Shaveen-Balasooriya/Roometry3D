import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { auth, db } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import './RoomScaper.css';

// Simple model loader component
function RoomModel({ modelUrl, onLoaded }) {
  const actualModelUrl = typeof modelUrl === 'object' && modelUrl?.url ? 
    modelUrl.url : 
    modelUrl;
  
  // Use a ref to track if we've called onLoaded already
  const loadedRef = useRef(false);
  
  // Call onLoaded when component mounts to ensure loading state is visible immediately
  useEffect(() => {
    // Don't mark as complete yet - this is just to ensure loading indicator shows up
    return () => {
      // Cleanup if unmounted before loaded
      if (!loadedRef.current && onLoaded) {
        onLoaded();
      }
    };
  }, [onLoaded]);
  
  const gltf = useLoader(GLTFLoader, actualModelUrl, undefined, 
    (xhr) => {
      if (xhr.loaded && xhr.total) {
        const progress = Math.floor((xhr.loaded / xhr.total) * 100);
        if (progress === 100 && !loadedRef.current) {
          loadedRef.current = true;
          if (onLoaded) onLoaded();
        }
      }
    });
  
  useEffect(() => {
    if (gltf && gltf.scene && !loadedRef.current) {
      try {
        // Set up model (center, scale)
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / (maxDim > 0 ? maxDim : 1);
        
        gltf.scene.position.x = -center.x * scale;
        gltf.scene.position.y = -center.y * scale;
        gltf.scene.position.z = -center.z * scale;
        gltf.scene.scale.set(scale, scale, scale);
        
        // Add lighting to model
        gltf.scene.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.needsUpdate = true;
            }
          }
        });
        
        // Mark as loaded
        loadedRef.current = true;
        if (onLoaded) setTimeout(() => onLoaded(), 100); // Small delay to ensure render completes
      } catch (err) {
        console.error("Error processing model:", err);
        if (onLoaded) onLoaded(); // Still mark as loaded to remove loading screen
      }
    }
  }, [gltf, onLoaded]);
  
  if (!gltf || !gltf.scene) {
    return <ModelFallback />; // Show fallback if model isn't loaded yet
  }
  
  return <primitive object={gltf.scene} castShadow receiveShadow />;
}

// Fallback displayed during loading
function ModelFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="lightgray" />
    </mesh>
  );
}

// Error boundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <ModelFallback />;
    }
    return this.props.children;
  }
}  // Main Room Scaper component
function RoomScaper() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loadingStates, setLoadingStates] = useState({});
  const [projectData, setProjectData] = useState(null);
  
  // Get project ID from location state if available
  const location = useLocation();
  const navigate = useNavigate();
  const projectId = location.state?.projectId;
  
  // Sample room for testing if needed
  const sampleRoom = {
    id: 'sample-room-1',
    name: 'Sample Test Room',
    description: 'This is a sample room for testing purposes.',
    category: 'Test Room',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/BoxTextured/glTF/BoxTextured.gltf'
  };
  
  // Fetch project data if projectId is available
  useEffect(() => {
    if (projectId) {
      const fetchProjectData = async () => {
        try {
          const idToken = await auth.currentUser.getIdToken();
          const response = await fetch(`/api/projects/${projectId}`, {
            headers: {
              'Authorization': `Bearer ${idToken}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Found project data:', data);
            setProjectData(data);
          } else {
            console.error('Failed to fetch project:', response.status);
          }
        } catch (error) {
          console.error('Error fetching project data:', error);
        }
      };
      
      fetchProjectData();
    }
  }, [projectId]);
  
  // Mark a model as loaded
  const handleModelLoaded = (roomId) => {
    console.log(`Model loaded for room ${roomId}`);
    // Use a small delay to ensure the model has time to render before hiding loading screen
    setTimeout(() => {
      setLoadingStates(prev => ({
        ...prev,
        [roomId]: false
      }));
    }, 300);
  };
  
  // Fetch rooms data
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/rooms', { withCredentials: true });
        
        let processedRooms = [];
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          // Create an initial loading states object
          const initialLoadingStates = {};
          
          processedRooms = response.data.map(room => {
            // Extract modelUrl from room data
            let modelUrl = null;
            if (room.modelUrl) {
              modelUrl = room.modelUrl;
            } else if (room.files && room.files.model) {
              modelUrl = room.files.model;
            }
            
            const roomId = room.id || `room-${Math.random().toString(36).substring(2, 9)}`;
            
            // Add to initial loading states
            initialLoadingStates[roomId] = true;
            
            return {
              id: roomId,
              name: room.name || 'Unnamed Room',
              description: room.description || 'No description available',
              category: room.category || 'Other',
              modelUrl: modelUrl
            };
          });
          
          // Set all loading states at once instead of individual updates
          setLoadingStates(initialLoadingStates);
        } else {
          processedRooms = [sampleRoom];
          setLoadingStates({ [sampleRoom.id]: true });
        }
        
        setRooms(processedRooms);
        setError(null);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching rooms:', err);
        setRooms([sampleRoom]);
        setLoadingStates({ [sampleRoom.id]: true });
        setError('Failed to load rooms. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchRooms();
  }, []);
  
  // Safety timeout to prevent infinite loading states
  useEffect(() => {
    const timeoutIds = [];
    
    // Clear any stuck loading states after 15 seconds
    Object.keys(loadingStates).forEach(roomId => {
      if (loadingStates[roomId]) {
        const timeoutId = setTimeout(() => {
          setLoadingStates(prev => ({
            ...prev,
            [roomId]: false
          }));
        }, 15000);
        
        timeoutIds.push(timeoutId);
      }
    });
    
    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
    };
  }, [loadingStates]);
  
  const handleWorkWithRoom = (room) => {
    console.log(`Navigate to workspace for room: ${room.id}`);
    
    // Make a clean copy of room data, ensuring modelUrl is a string
    const cleanRoomData = {
      ...room,
      modelUrl: typeof room.modelUrl === 'string' ? 
        room.modelUrl : 
        (room.modelUrl && typeof room.modelUrl === 'object' && room.modelUrl.url) ? 
          room.modelUrl.url : 
          null
    };
    
    // Include the projectId if available
    navigate(`/work-environment/${room.id}`, {
      state: {
        roomId: room.id,
        roomData: cleanRoomData,
        projectId: projectId,
        name: room.name || 'Room Preview',
        modelUrl: cleanRoomData.modelUrl
      }
    });
  };
  
  // Get unique categories
  const categories = ['All', ...new Set(rooms.map(room => room.category).filter(Boolean))];
  
  // Filter rooms by category
  const filteredRooms = selectedCategory === 'All' 
    ? rooms 
    : rooms.filter(room => room.category === selectedCategory);
  
  // Show loading indicator
  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading rooms...</p>
        </div>
      </div>
    );
  }
  
  // Show error
  if (error) {
    return (
      <div className="page-content">
        <div className="error-container">
          {error}
        </div>
      </div>
    );
  }
  
  return (
    <div className="page-content">
      <div className="room-scaper-header">
        <h1>Room Scaper</h1>
        <p className="subtitle">
          Explore our collection of 3D room templates to create your perfect space.
          Select a room and customize it to your liking.
        </p>
        
        <div className="filter-container">
          {categories.map(category => (
            <button 
              key={category} 
              className={`btn ${selectedCategory === category ? "btn-primary" : "btn-outline"}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      
      {filteredRooms.length === 0 ? (
        <div className="empty-rooms">
          <h3>No rooms available</h3>
          <p>{selectedCategory === 'All' ? 'Check back later for new room templates.' : `No rooms found in the '${selectedCategory}' category.`}</p>
        </div>
      ) : (
        <div className="room-grid">
          {filteredRooms.map((room) => (
            <div key={room.id} className="room-card">
              <div className="room-preview-container">
                {room.modelUrl ? (
                  <>
                    {/* Always show Canvas, but it might be covered by loading overlay */}
                    <Canvas shadows camera={{ position: [0, 0.1, 0.9], fov: 35 }}>
                      <color attach="background" args={["#f5f5f5"]} />
                      <ambientLight intensity={1.3} />
                      <directionalLight 
                        position={[5, 5, 5]} 
                        intensity={1.2} 
                        castShadow 
                      />
                      <directionalLight position={[-5, 5, -5]} intensity={0.8} />
                      <Environment preset="apartment" />
                      
                      <ErrorBoundary>
                        <Suspense fallback={null}> {/* Hide fallback, use overlay instead */}
                          <RoomModel 
                            modelUrl={room.modelUrl} 
                            onLoaded={() => handleModelLoaded(room.id)}
                          />
                        </Suspense>
                      </ErrorBoundary>
                      
                      <OrbitControls 
                        enableZoom={true} 
                        autoRotate 
                        autoRotateSpeed={1.5}
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
                    
                    {/* Loading overlay outside the Canvas */}
                    {(loadingStates[room.id] === true) && (
                      <div className="model-loading-overlay">
                        <div className="spinner-container">
                          <div className="loading-spinner"></div>
                          <p>Loading model...</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', backgroundColor: '#e9ecef' }}>
                    <p>No 3D Preview</p>
                  </div>
                )}
              </div>
              
              <div className="room-card-body">
                <h4 className="room-title">{room.name}</h4>
                <p className="room-description">
                  {room.description && room.description.length > 120 
                    ? `${room.description.substring(0, 120)}...` 
                    : room.description}
                </p>
                <div className="room-card-footer">
                  <div className="room-category">Category: <strong>{room.category || 'N/A'}</strong></div>
                  <button 
                    className="btn btn-primary room-action-button" 
                    onClick={() => handleWorkWithRoom(room)}
                  >
                    Work in 3D Space
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RoomScaper;