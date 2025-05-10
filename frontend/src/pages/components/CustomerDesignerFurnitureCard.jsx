import React, { useRef, useEffect, useState, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Bounds, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'
import Loading from '../../components/Loading'
import Popup from '../../components/Popup'
import { auth } from '../../services/firebase'
import { getUserRole } from '../../services/firebase' // Import the getUserRole function

function ModelPreview({ modelFile, textureUrl, dimensions }) {
  const [object, setObject] = useState(null)
  const modelObjectUrl = useRef(null)
  const { width = 1, height = 1, length = 1 } = dimensions || {}
  
  useEffect(() => {
    let currentMaterial = null
    let cancelled = false
    setObject(null)

    async function loadModel() {
      if (!modelFile) return
      
      try {
        // Create URL from the blob
        if (modelObjectUrl.current) {
          URL.revokeObjectURL(modelObjectUrl.current)
        }
        modelObjectUrl.current = URL.createObjectURL(modelFile)
        
        if (cancelled) return
        
        // Load the model using useGLTF
        const { scene } = await new Promise((resolve, reject) => {
          useGLTF.load(
            modelObjectUrl.current,
            (gltf) => resolve(gltf),
            undefined,
            (error) => reject(error)
          )
        })
        
        if (cancelled) return
        
        // Clone the scene to avoid mutation issues
        const modelScene = scene.clone()
        
        // Calculate bounding box and size
        const box = new THREE.Box3().setFromObject(modelScene)
        const originalSize = box.getSize(new THREE.Vector3())
        const centerOffset = box.getCenter(new THREE.Vector3())
        
        // Scale model to match dimensions
        const maxObjDim = Math.max(originalSize.x, originalSize.y, originalSize.z, 0.001)
        const maxTargetDim = Math.max(width, height, length, 0.001)
        const scale = maxTargetDim / maxObjDim
        
        modelScene.scale.set(scale, scale, scale)
        
        const applyMaterial = (material) => {
          if (currentMaterial) {
            if (currentMaterial.map) currentMaterial.map.dispose()
            currentMaterial.dispose()
          }
          currentMaterial = material
          modelScene.traverse(child => {
            if (child.isMesh) {
              child.material = material
              child.material.needsUpdate = true
            }
          })
          setObject({ model: modelScene, centerOffset: centerOffset.clone() })
        }

        if (textureUrl) {
          const textureLoader = new THREE.TextureLoader()
          textureLoader.load(
            textureUrl,
            (mapTexture) => {
              if (cancelled) return
              mapTexture.wrapS = mapTexture.wrapT = THREE.RepeatWrapping
              mapTexture.encoding = THREE.sRGBEncoding
              mapTexture.needsUpdate = true
              applyMaterial(new THREE.MeshStandardMaterial({
                map: mapTexture,
                side: THREE.DoubleSide,
                metalness: 0.1,
                roughness: 0.8
              }))
            },
            undefined,
            () => {
              if (cancelled) return
              applyMaterial(new THREE.MeshStandardMaterial({
                color: '#999999',
                side: THREE.DoubleSide,
                metalness: 0.1,
                roughness: 0.8
              }))
            }
          )
        } else {
          applyMaterial(new THREE.MeshStandardMaterial({
            color: '#999999',
            side: THREE.DoubleSide,
            metalness: 0.1,
            roughness: 0.8
          }))
        }
      } catch (error) {
        console.error("Error processing model:", error)
        setObject(null)
      }
    }

    loadModel()

    return () => {
      cancelled = true
      if (modelObjectUrl.current) {
        URL.revokeObjectURL(modelObjectUrl.current)
        modelObjectUrl.current = null
      }
      if (currentMaterial) {
        if (currentMaterial.map) currentMaterial.map.dispose()
        currentMaterial.dispose()
      }
    }
  }, [modelFile, textureUrl, width, height, length])

  return object ? (
    <group position={[-object.centerOffset.x, -object.centerOffset.y, -object.centerOffset.z]}>
      <primitive object={object.model} />
    </group>
  ) : null
}

function RotatingBoundsContent({ children }) {
  const groupRef = useRef()

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.25
    }
  })

  return (
    <group ref={groupRef}>
      <Bounds fit clip observe margin={1.2}>
        {children}
      </Bounds>
    </group>
  )
}

export default function CustomerDesignerFurnitureCard({ furniture }) {
  const {
    id, name, category, price, quantity, height, width, length, wallMountable,
    modelEndpoint, textureUrls = []
  } = furniture

  const [selectedTextureIndex, setSelectedTextureIndex] = useState(0)
  const [modelBlob, setModelBlob] = useState(null)
  const [isLoadingBlob, setIsLoadingBlob] = useState(false)
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' })
  const [userRole, setUserRole] = useState(null)
  const navigate = useNavigate()
  const API_URL = import.meta.env.VITE_BACKEND_URL;
  
  useEffect(() => { setSelectedTextureIndex(0) }, [textureUrls])

  const currentTextureUrl = useMemo(() => {
    if (!textureUrls || textureUrls.length === 0) return null
    return textureUrls[selectedTextureIndex] || textureUrls[0]
  }, [textureUrls, selectedTextureIndex])

  // Get user role when component mounts
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const role = await getUserRole();
        setUserRole(role);
      } catch (error) {
        console.error("Error getting user role:", error);
      }
    };
    
    fetchUserRole();
  }, []);

  useEffect(() => {
    let isActive = true
    setModelBlob(null)
    if (modelEndpoint) {
      setIsLoadingBlob(true)
      const fetchModel = async () => {
        try {
          // Get the current user's auth token
          const user = auth.currentUser;
          if (!user) {
            throw new Error('You must be logged in to access this model');
          }
          
          const idToken = await user.getIdToken();
          
          const response = await fetch(`${API_URL}${modelEndpoint}`, {
            headers: {
              'Authorization': `Bearer ${idToken}`
            }
          });
          
          if (!response.ok) throw new Error('Failed to fetch GLB file')
          const blob = await response.blob();
          if (isActive) {
            setModelBlob(blob)
          }
        } catch (err) {
          console.error("Error fetching blob:", err)
          if (isActive) {
            setModelBlob(null)
          }
        } finally {
          if (isActive) {
            setIsLoadingBlob(false)
          }
        }
      };
      
      fetchModel();
    } else {
      setIsLoadingBlob(false)
    }
    return () => {
      isActive = false
    }
  }, [modelEndpoint])

  const handleEdit = () => {
    console.log(`Edit button clicked for item ID: ${id}`)
    navigate(`/update-furniture/${id}`)
  }

  const handleAddToCart = async () => {
    setIsAddingToCart(true);
    try {
      // Get the current user's auth token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to add items to cart');
      }
      
      const idToken = await user.getIdToken();
      
      // Call the new API endpoint to add the item to cart in Firestore
      const response = await fetch(`${API_URL}/api/cart/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          furnitureId: id,
          quantity: 1, // Default quantity is 1
          textureUrl: currentTextureUrl
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add item to cart');
      }
      
      setPopup({ 
        open: true, 
        type: 'success', 
        message: `${name} added to cart successfully!` 
      });
      
    } catch (err) {
      console.error("Error adding to cart:", err);
      setPopup({ 
        open: true, 
        type: 'error', 
        message: err.message || 'Error adding item to cart.' 
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const previewAvailable = !!modelBlob
  const showLoading = isLoadingBlob || (!previewAvailable && modelEndpoint)

  return (
    <div
      style={{
        background: '#FFFFFF',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
        border: '1px solid var(--border)',
        padding: '1.5rem 1.2rem 1.2rem 1.2rem',
        margin: '0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '1rem',
        height: '100%', // Make sure it takes full height
        width: '100%', // Take full width of grid cell
        maxWidth: '340px', // Set maximum width
        transition: 'transform 0.2s ease, box-shadow 0.2s ease'
      }}
    >
      <Popup open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ ...popup, open: false })} />

      <div style={{ 
        marginBottom: '0.5rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <span style={{
          fontWeight: 600, 
          fontSize: '18px', 
          color: '#00474C' // Darker teal from HomePage
        }}>{name}</span>
        <span style={{ 
          color: '#006A71', // Teal from HomePage
          fontWeight: 600, 
          fontSize: '16px' 
        }}>${price}</span>
      </div>
      
      <div style={{  
        color: '#66B2B8', // Lighter teal from HomePage
        fontSize: '14px', 
        marginBottom: '0.2rem', 
        fontWeight: 500 
      }}>{category}</div>
      
      {/* Preview container with gold accent at the bottom */}
      <div
        style={{
          width: '100%',
          height: 140,
          background: '#F7FAFC', // Light background from HomePage
          borderRadius: 8,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          border: '1px solid #E2E8F0',
          borderBottom: '2px solid #ECC94B', // Added gold accent to preview area
        }}
      >
        {showLoading ? (
          <div style={{ color: '#4A5568', fontSize: 13, textAlign: 'center'}}>
            <Loading size={30} />
            <div style={{ marginTop: '5px', opacity: 0.8 }}>Loading Preview...</div>
          </div>
        ) : previewAvailable ? (
          <Canvas
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 8,
            }}
            gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
            dpr={[1, 1.5]}
            frameloop="always"
            shadows
            camera={{ fov: 45, near: 0.1, far: 50 }}
          >
            <color attach="background" args={['#F7FAFC']} />
            <ambientLight intensity={0.6} />
            <directionalLight
              position={[3, 5, 4]}
              intensity={1.0}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            <directionalLight position={[-3, 2, -4]} intensity={0.4} />
            <Suspense fallback={null}>
              <Environment preset="city" />
              <RotatingBoundsContent>
                <ModelPreview
                  modelFile={modelBlob}
                  textureUrl={currentTextureUrl}
                  dimensions={{ width, height, length }}
                />
              </RotatingBoundsContent>
            </Suspense>
          </Canvas>
        ) : (
          <div style={{ color: '#4A5568', fontSize: 13, width: '100%', textAlign: 'center' }}>
            <span style={{ opacity: 0.7 }}>No 3D Preview</span>
          </div>
        )}
      </div>
      
      {/* Texture selection buttons with gold accent */}
      {textureUrls.length > 1 && (
        <div style={{ 
          display: 'flex', 
          gap: 8, 
          marginBottom: 4, 
          justifyContent: 'flex-start',
          padding: '6px 10px',
          borderRadius: '4px',
          border: '1px solid #E2E8F0',
          borderLeft: '2px solid #ECC94B' // Added gold accent to texture selection
        }}>
          {textureUrls.map((url, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedTextureIndex(idx)}
              style={{
                border: idx === selectedTextureIndex ? `2px solid #006A71` : '1px solid #E2E8F0',
                borderRadius: '4px',
                padding: 0,
                background: '#FFFFFF',
                width: 24,
                height: 24,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: idx === selectedTextureIndex ? '0 0 0 2px #66B2B8' : undefined,
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }}
              title={`Texture ${idx + 1}`}
              type="button"
            >
              <img src={url} alt={`Texture ${idx + 1}`} style={{ 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover', 
                borderRadius: 4 
              }} />
            </button>
          ))}
        </div>
      )}
      
      {/* Product details */}
      <div style={{ fontSize: '12px', marginBottom: '8px', display: 'grid', gridTemplateColumns: '40% 60%' }}>
        <span style={{ fontWeight: 600, color: '#00474C', textAlign: 'left' }}>Dimensions:</span>
        <span style={{ color: '#4A5568', textAlign: 'left' }}>{height}m (H) × {width}m (W) × {length}m (L)</span>
      </div>
      <div style={{ fontSize: '12px', marginBottom: '8px', display: 'grid', gridTemplateColumns: '40% 60%' }}>
        <span style={{ fontWeight: 600, color: '#00474C', textAlign: 'left' }}>Quantity:</span>
        <span style={{ color: '#4A5568', textAlign: 'left' }}>{quantity}</span>
      </div>
      <div style={{ fontSize: '12px', marginBottom: '8px', display: 'grid', gridTemplateColumns: '40% 60%' }}>
        <span style={{ fontWeight: 600, color: '#00474C', textAlign: 'left' }}>Wall Mountable:</span>
        <span style={{ color: '#4A5568', textAlign: 'left' }}>{wallMountable ? 'Yes' : 'No'}</span>
      </div>
      
      {/* Action buttons with icon styling */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        marginTop: 'auto', // This pushes the buttons to the bottom
        paddingTop: '1rem',
        gap: '8px'
      }}>
        {/* Edit Button - Only for designers */}
        {userRole === 'designer' && (
          <button
            className="icon-button"
            onClick={handleEdit}
            style={{ 
              background: '#66B2B8', // Lighter teal from HomePage
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              padding: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              transition: 'background-color 0.2s'
            }}
            title="Edit Furniture"
            aria-label={`Edit ${name}`}
            onMouseOver={(e) => e.currentTarget.style.background = '#006A71'} // Darker teal on hover
            onMouseOut={(e) => e.currentTarget.style.background = '#66B2B8'} // Back to lighter teal
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="white"
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
        )}
        
        {/* Add to Cart Button */}
        <button
          onClick={handleAddToCart}
          disabled={isAddingToCart}
          style={{ 
            background: '#006A71', // Teal from HomePage
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            padding: '6px 12px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 500,
            fontSize: '14px',
            transition: 'background-color 0.2s',
            minWidth: userRole === 'designer' ? 'auto' : '100%',
            flex: userRole === 'designer' ? '0 1 auto' : '1'
          }}
          title="Add to Cart"
          aria-label={`Add ${name} to cart`}
          onMouseOver={(e) => !isAddingToCart && (e.currentTarget.style.background = '#00474C')} // Darker teal on hover
          onMouseOut={(e) => !isAddingToCart && (e.currentTarget.style.background = '#006A71')} // Back to original teal
        >
          {isAddingToCart ? (
            <Loading size={16} color="white" />
          ) : (
            <>
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="white" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{ marginRight: '6px' }}
              >
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
              </svg>
              Add to Cart
            </>
          )}
        </button>
      </div>
    </div>
  )
}