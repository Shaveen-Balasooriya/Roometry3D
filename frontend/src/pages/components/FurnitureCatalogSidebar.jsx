import React, { useState, useEffect, Suspense, useRef } from 'react';
import { Canvas, useLoader, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, useGLTF, Html } from '@react-three/drei';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import Loading from '../../components/Loading';
import ErrorBoundary from './ErrorBoundary';
import { getFileTypeFromUrl } from './FurnitureModelUtils';
import './FurnitureCatalogSidebar.css';

// Model Preview Component for the sidebar items
const FurnitureModel = ({ modelUrl, scale = 1 }) => {
  // Skip rendering if no URL is provided
  if (!modelUrl) return null;
  
  // Use our utility to determine file type
  const fileType = getFileTypeFromUrl(modelUrl);
  console.log(`Displaying furniture preview: ${modelUrl} (${fileType})`);
  
  // Add a try/catch at the component level
  try {
    // Wrap each model in its own ErrorBoundary to prevent cascading failures
    return (
      <ErrorBoundary fallback={<FallbackBox color="#cc3333" />}>
        {fileType === 'obj' ? (
          <ObjModel modelUrl={modelUrl} scale={scale} />
        ) : fileType === 'gltf' || fileType === 'glb' ? (
          <GltfModel modelUrl={modelUrl} scale={scale} />
        ) : (
          <FallbackBox color="#999999" />
        )}
      </ErrorBoundary>
    );
  } catch (error) {
    console.error("Error in FurnitureModel component:", error);
    return <FallbackBox color="#cc3333" />;
  }
};

// Helper component to display loading state
const ModelLoadingState = () => (
  <Html center>
    <div style={{ color: 'white', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px' }}>
      <div style={{ width: '20px', height: '20px', borderRadius: '50%', 
                   border: '2px solid #fff', borderTopColor: 'transparent',
                   animation: 'spin 1s linear infinite' }} />
    </div>
  </Html>
);

// Component for OBJ models
const ObjModel = ({ modelUrl, scale = 1 }) => {
  const [modelLoaded, setModelLoaded] = useState(false);
  const [error, setError] = useState(null);
  
  // Use a ref to track if the component is mounted
  const isMounted = useRef(true);
  useEffect(() => {
    // Set isMounted to false when component unmounts
    return () => {
      isMounted.current = false;
    };
  }, []);
  
  // Use a suspense-compatible approach for loading
  const handleObjLoadError = (err) => {
    console.error("Error loading OBJ model:", err);
    if (isMounted.current) {
      // Check if it's a progress event with a large total size
      if (err.type === 'progress' && err.total > 10000000) { // 10MB threshold
        setError(new Error(`Model is too large (${Math.round(err.total / 1024 / 1024)}MB)`));
      } else {
        setError(err);
      }
    }
  };
  
  try {
    const obj = useLoader(
      OBJLoader, 
      modelUrl, 
      (loader) => {
        // Set timeout to 10 seconds for large files
        loader.setRequestHeader({
          timeout: 10000 // 10 seconds
        });
      }, 
      handleObjLoadError
    );
    
    // Apply materials and process the model when loaded
    useEffect(() => {
      if (obj && isMounted.current) {
        try {
          // Apply material to model
          obj.traverse((child) => {
            if (child.isMesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0xcccccc,
                roughness: 0.5,
                metalness: 0.2,
              });
            }
          });
          setModelLoaded(true);
        } catch (err) {
          console.error("Error processing OBJ model:", err);
          setError(err);
        }
      }
    }, [obj]);

    if (error) return <FallbackBox color="orange" />;
    if (!modelLoaded) return <ModelLoadingState />;
    
    // Scale the model appropriately
    return <primitive object={obj} scale={scale} position={[0, -0.5, 0]} rotation={[0, Math.PI / 4, 0]} />;
  } catch (error) {
    console.error("Error in ObjModel useLoader:", error);
    return <FallbackBox color="orange" />;
  }
};

// Component for GLTF/GLB models
const GltfModel = ({ modelUrl, scale = 1 }) => {
  const [modelLoaded, setModelLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [useFallback, setUseFallback] = useState(false);
  
  // Use a ref to track if the component is mounted
  const isMounted = useRef(true);
  
  useEffect(() => {
    // Set isMounted to false when component unmounts
    return () => {
      isMounted.current = false;
    };
  }, []);
    // Use a suspense-compatible approach for loading
  // Add a timeout and size check for the loader
  const handleModelLoadError = (err) => {
    console.error("Error loading GLTF model:", err);
    if (isMounted.current) {
      // Check if it's a network error (failed to fetch)
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        console.warn('Network error loading model, using fallback');
        setUseFallback(true);
        setError(new Error('Network error: Failed to load model'));
        return;
      }
      
      // Check if it's a progress event with a large total size
      if (err.type === 'progress' && err.total > 10000000) { // 10MB threshold
        console.warn(`Model is too large (${Math.round(err.total / 1024 / 1024)}MB), using fallback`);
        setUseFallback(true);
        setError(new Error(`Model is too large (${Math.round(err.total / 1024 / 1024)}MB)`));
      } else {
        setError(err);
      }
    }
  };
  
  // When using fallback, don't try to load the actual model
  if (useFallback) {
    return <FallbackBox color="#999" message="Preview Unavailable" />;
  }
  
  // Use a try-catch for the useLoader call
  try {
    const gltfResult = useLoader(
      GLTFLoader, 
      modelUrl, 
      (loader) => {
        // Set timeout to 15 seconds for large files
        loader.setRequestHeader({
          timeout: 15000 // 15 seconds
        });
        
        // Add a retry mechanism for network errors
        loader.setWithCredentials(true);
      }, 
      handleModelLoadError
    );
    
    useEffect(() => {
      if (gltfResult && gltfResult.scene && isMounted.current) {
        try {
          // Center and prepare the model
          gltfResult.scene.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              // Add a default material if none exists
              if (!child.material) {
                child.material = new THREE.MeshStandardMaterial({
                  color: 0xcccccc,
                  roughness: 0.5,
                  metalness: 0.2,
                });
              }
            }
          });
          setModelLoaded(true);
        } catch (err) {
          console.error("Error processing GLTF model:", err);
          setError(err);
        }
      }
    }, [gltfResult]);

    if (error) return <FallbackBox color="orange" />;
    if (!modelLoaded) return <ModelLoadingState />;
    
    return <primitive object={gltfResult.scene} scale={scale} position={[0, -0.5, 0]} rotation={[0, Math.PI / 4, 0]} />;
  } catch (error) {
    console.error("Error in GltfModel useLoader:", error);
    return <FallbackBox color="orange" />;
  }
};

// Fallback component when model can't be loaded
const FallbackBox = ({ color = "#bbbbbb", message = "Preview unavailable" }) => {
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html position={[0, 1, 0]} center>
        <div className="model-error">
          <div className="model-error-icon">!</div>
          <div>{message}</div>
        </div>
      </Html>
    </group>
  );
};

function FurnitureCatalogSidebar({ onSelectFurniture, onClose }) {
  const [furniture, setFurniture] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [categories, setCategories] = useState(['All']);

  useEffect(() => {
    const fetchFurniture = async () => {
      setLoading(true);
      try {
        const furnitureCollection = collection(db, 'furniture');
        const furnitureSnapshot = await getDocs(furnitureCollection);
        const furnitureList = furnitureSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setFurniture(furnitureList);
        
        // Extract unique categories
        const uniqueCategories = ['All', ...new Set(furnitureList.map(item => item.category).filter(Boolean))];
        setCategories(uniqueCategories);
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching furniture:", error);
        setLoading(false);
      }
    };

    fetchFurniture();
  }, []);

  const filteredFurniture = furniture.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });  const handleFurnitureSelect = (item) => {
    if (onSelectFurniture) {
      console.log("Furniture selected from catalog:", item);
      
      // Get the first texture if available, otherwise null
      const textureUrl = item.textureUrls && item.textureUrls.length > 0 ? item.textureUrls[0] : null;
      
      // Get the model URL from the appropriate property
      const modelUrl = item.objFileUrl || item.modelEndpoint || null;
      
      if (!modelUrl) {
        console.error("No model URL available for this furniture item:", item);
        return;
      }
      
      const fileType = getFileTypeFromUrl(modelUrl);
      console.log(`Sending furniture to room with model URL: ${modelUrl} (${fileType})`);
      
      onSelectFurniture({
        ...item,
        modelUrl: modelUrl,
        selectedTextureUrl: textureUrl,
      });
    }
  };

  return (
    <div className="furniture-catalog-sidebar">
      <div className="furniture-sidebar-header">
        <h2>Furniture Catalog</h2>
        <button className="close-sidebar-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="furniture-sidebar-search">
        <input
          type="text"
          placeholder="Search furniture..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      <div className="furniture-sidebar-categories">
        {categories.map(category => (
          <button
            key={category}
            className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>
      
      <div className="furniture-sidebar-items">
        {loading ? (
          <div className="furniture-loading">
            <Loading size={30} />
            <p>Loading furniture...</p>
          </div>
        ) : filteredFurniture.length === 0 ? (
          <div className="no-furniture">No furniture found</div>
        ) : (
          filteredFurniture.map(item => (
            <div 
              key={item.id} 
              className="furniture-item"
              onClick={() => handleFurnitureSelect(item)}
            >              <div className="furniture-preview-container">
                {(item.objFileUrl || item.modelEndpoint) ? (
                  <ErrorBoundary fallback={
                    <div className="model-error">
                      <div className="model-error-icon">!</div>
                      <div className="model-error-text">Preview unavailable</div>
                    </div>
                  }>
                    <Canvas 
                      shadows 
                      dpr={[1, 2]} 
                      camera={{ position: [0, 0, 4], fov: 50 }}
                      onError={(e) => console.error('Canvas error:', e)}
                    >
                      <ambientLight intensity={0.7} />
                      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
                      <directionalLight position={[-5, 5, -5]} intensity={0.5} />
                      
                      <Suspense fallback={
                        <Html center>
                          <div className="loading-preview">
                            <div className="loading-spinner"></div>
                          </div>
                        </Html>
                      }>
                        <FurnitureModel 
                          modelUrl={item.objFileUrl || item.modelEndpoint} 
                          scale={1} 
                        />
                      </Suspense>
                      <OrbitControls
                        enableZoom={false}
                        enablePan={false}
                        autoRotate
                        autoRotateSpeed={4}
                      />
                    </Canvas>
                  </ErrorBoundary>
                ) : (
                  <div className="no-preview">
                    <span className="no-preview-icon">📷</span>
                    <span>No preview available</span>
                  </div>
                )}
              </div>
              <div className="furniture-item-details">
                <h3>{item.name}</h3>
                <p>{item.description || 'No description'}</p>
                <p className="furniture-price">₹{item.price || 'Price not available'}</p>
                <button className="add-to-room-btn" onClick={(e) => {
                  e.stopPropagation();
                  handleFurnitureSelect(item);
                }}>
                  Add to Room
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FurnitureCatalogSidebar;