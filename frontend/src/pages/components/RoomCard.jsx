import React, { useRef, useEffect, useState, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Bounds, useGLTF, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Loading from '../../components/Loading'
import Popup from '../../components/Popup'
import ConfirmationPopup from '../../components/ConfirmationPopup'
import { auth } from '../../services/firebase'
import { format } from 'date-fns'

function ModelPreview({ modelBlob, activeTextures }) {
  const [model, setModel] = useState(null)
  const [materials, setMaterials] = useState({})
  const [loadingError, setLoadingError] = useState(null)
  
  useEffect(() => {
    let cleanup = () => {}
    
    if (modelBlob) {
      try {
        console.log('Creating URL for model blob:', modelBlob.type, modelBlob.size)
        // Create a URL for the blob
        const url = URL.createObjectURL(modelBlob)
        cleanup = () => URL.revokeObjectURL(url)
        
        // Load the model
        const RoomModel = ({ materials }) => {
          const { scene, nodes } = useGLTF(url)
          const { camera } = useThree()
          
          // Center and scale the model on first load
          useEffect(() => {
            try {
              // Center the model
              const box = new THREE.Box3().setFromObject(scene)
              const center = box.getCenter(new THREE.Vector3())
              const size = box.getSize(new THREE.Vector3())
              
              console.log('Model dimensions:', size)
              
              // Move to center
              scene.position.x = -center.x
              scene.position.y = -center.y
              scene.position.z = -center.z
              
              // Scale to fit
              const maxDim = Math.max(size.x, size.y, size.z)
              if (maxDim > 0) {
                const scale = 2 / maxDim
                scene.scale.set(scale, scale, scale)
              }
              
              // Reset camera
              camera.position.set(0, 1.5, 3)
              camera.lookAt(0, 0, 0)
            } catch (e) {
              console.error('Error positioning model:', e)
            }
          }, [scene, camera])
          
          // Apply materials to model if needed
          useEffect(() => {
            if (Object.keys(materials).length > 0) {
              console.log('Applying materials to model')
              
              scene.traverse((node) => {
                if (node.isMesh) {
                  // Try multiple methods to identify components
                  const nodeName = node.name.toLowerCase()
                  
                  // Method 1: Check if node name contains 'wall' or 'floor'
                  if (nodeName.includes('wall') && materials.wall) {
                    console.log('Applied wall material to:', node.name)
                    node.material = materials.wall
                  } 
                  else if (nodeName.includes('floor') && materials.floor) {
                    console.log('Applied floor material to:', node.name)
                    node.material = materials.floor
                  }
                  // Method 2: Extract component type from name
                  else {
                    const parts = node.name.split('_')
                    const lastPart = parts[parts.length - 1].toLowerCase()
                    
                    if (materials[lastPart]) {
                      console.log(`Applied ${lastPart} material to:`, node.name)
                      node.material = materials[lastPart]
                    }
                  }
                }
              })
            }
          }, [materials, scene])
          
          return <primitive object={scene} />
        }
        
        setModel(() => (props) => <RoomModel {...props} />)
        setLoadingError(null)
        
      } catch (error) {
        console.error("Error loading model:", error)
        setLoadingError(error.message || 'Failed to load 3D model')
        setModel(null)
      }
    } else {
      setModel(null)
    }
    
    return cleanup
  }, [modelBlob])
  
  // Create materials from active textures
  useEffect(() => {
    const newMaterials = {}
    const textureLoader = new THREE.TextureLoader()
    const texturePromises = []
    
    // Load wall texture
    if (activeTextures.wall) {
      console.log('Loading wall texture:', activeTextures.wall)
      
      const promise = new Promise((resolve) => {
        textureLoader.load(
          activeTextures.wall,
          (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping
            texture.repeat.set(2, 2) // Repeat texture to avoid stretching
            
            // Handle different Three.js versions
            try {
              texture.colorSpace = THREE.SRGBColorSpace
            } catch (e) {
              // Fallback for older Three.js versions
              texture.encoding = THREE.sRGBEncoding
            }
            
            newMaterials.wall = new THREE.MeshStandardMaterial({
              map: texture,
              side: THREE.DoubleSide,
              metalness: 0.1,
              roughness: 0.8
            })
            
            console.log('Wall texture loaded successfully')
            resolve()
          },
          undefined,
          (error) => {
            console.error('Error loading wall texture:', error)
            resolve()
          }
        )
      })
      texturePromises.push(promise)
    }
    
    // Load floor texture
    if (activeTextures.floor) {
      console.log('Loading floor texture:', activeTextures.floor)
      
      const promise = new Promise((resolve) => {
        textureLoader.load(
          activeTextures.floor,
          (texture) => {
            texture.wrapS = texture.wrapT = THREE.RepeatWrapping
            texture.repeat.set(3, 3) // Repeat texture to avoid stretching
            
            // Handle different Three.js versions
            try {
              texture.colorSpace = THREE.SRGBColorSpace
            } catch (e) {
              // Fallback for older Three.js versions
              texture.encoding = THREE.sRGBEncoding
            }
            
            newMaterials.floor = new THREE.MeshStandardMaterial({
              map: texture,
              side: THREE.DoubleSide,
              metalness: 0.1,
              roughness: 0.8
            })
            
            console.log('Floor texture loaded successfully')
            resolve()
          },
          undefined,
          (error) => {
            console.error('Error loading floor texture:', error)
            resolve()
          }
        )
      })
      texturePromises.push(promise)
    }
    
    Promise.all(texturePromises).then(() => {
      setMaterials(newMaterials)
    })
    
    // Cleanup materials when component unmounts
    return () => {
      Object.values(newMaterials).forEach(material => {
        if (material.map) material.map.dispose()
        material.dispose()
      })
    }
  }, [activeTextures])
  
  if (loadingError) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="tomato" />
        <Html position={[0, 1.5, 0]}>
          <div style={{ color: 'red', background: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '5px' }}>
            Error: {loadingError}
          </div>
        </Html>
      </mesh>
    )
  }
  
  return model ? <model materials={materials} /> : null
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

export default function RoomCard({ room, baseUrl, onDeleteSuccess }) {
  // Destructure with default values to prevent undefined errors
  const {
    id = '',
    category = 'Unknown Category',
    description = 'No description available.',
    createdAt = null,
    modelEndpoint = '',
    wallTextureEndpoint = '',
    floorTextureEndpoint = ''
  } = room || {}; // Add fallback for when room is undefined

  // Get name from room.name or create a default
  const roomName = room?.name || `${category} Room`;
  
  const [modelBlob, setModelBlob] = useState(null)
  const [isLoadingModel, setIsLoadingModel] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' })
  const [showConfirmPopup, setShowConfirmPopup] = useState(false)
  const [wallTextures, setWallTextures] = useState([])
  const [floorTextures, setFloorTextures] = useState([])
  
  // Keep track of active textures for preview
  const [activeTextures, setActiveTextures] = useState({ 
    wall: null, 
    floor: null 
  })
  
  // For debugging - Print room info
  useEffect(() => {
    console.log(`Room info (${id}):`);
    console.log(`  - model: ${modelEndpoint || 'none'}`);
    console.log(`  - wallTextureEndpoint: ${wallTextureEndpoint || 'none'}`);
    console.log(`  - floorTextureEndpoint: ${floorTextureEndpoint || 'none'}`);
  }, [id, modelEndpoint, wallTextureEndpoint, floorTextureEndpoint]);

  // Format date for display
  const formattedDate = useMemo(() => {
    if (!createdAt) return 'Unknown date';
    return format(new Date(createdAt), 'MMM d, yyyy');
  }, [createdAt]);

  // Fetch model from endpoint
  useEffect(() => {
    let isActive = true
    setModelBlob(null)
    
    if (modelEndpoint && baseUrl) {
      setIsLoadingModel(true)
      
      const fetchModel = async () => {
        try {
          // Get the current user's auth token
          const user = auth.currentUser;
          if (!user) {
            throw new Error('You must be logged in to access this model');
          }
          
          const idToken = await user.getIdToken();
          
          console.log(`Fetching model from: ${baseUrl}${modelEndpoint}`);
          const response = await fetch(`${baseUrl}${modelEndpoint}`, {
            headers: {
              'Authorization': `Bearer ${idToken}`
            }
          });
          
          if (!response.ok) {
            // Get the error message from the response if possible
            let errorMessage;
            try {
              const errorData = await response.json();
              errorMessage = errorData.error || errorData.message || 'Unknown error';
            } catch (e) {
              errorMessage = response.statusText || 'Unknown error';
            }
            
            throw new Error(`Failed to fetch model file: ${response.status} ${errorMessage}`);
          }
          
          const blob = await response.blob();
          console.log('Model blob fetched:', blob.type, 'size:', (blob.size / 1024).toFixed(2) + 'KB');
          
          if (isActive) {
            setModelBlob(blob)
          }
        } catch (err) {
          console.error("Error fetching model blob:", err)
          if (isActive) {
            setModelBlob(null)
            
            // Provide feedback to user about the error
            setPopup({ 
              open: true, 
              type: 'error', 
              message: `Could not load 3D model: ${err.message}`
            });
            
            // Auto-close the error after 5 seconds
            setTimeout(() => {
              if (isActive) {
                setPopup(prev => ({ ...prev, open: false }));
              }
            }, 5000);
          }
        } finally {
          if (isActive) {
            setIsLoadingModel(false)
          }
        }
      };
      
      fetchModel();
    } else {
      setIsLoadingModel(false)
    }
    
    return () => {
      isActive = false
    }
  }, [modelEndpoint, baseUrl])

  // Fetch wall textures
  useEffect(() => {
    if (!wallTextureEndpoint || !baseUrl) return;
    
    let isActive = true;
    
    const fetchWallTextures = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        
        const idToken = await user.getIdToken();
        
        console.log(`Fetching wall textures from: ${baseUrl}${wallTextureEndpoint}`);
        const response = await fetch(`${baseUrl}${wallTextureEndpoint}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        
        if (!response.ok) {
          // Try to get detailed error message
          let errorMessage;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || 'Unknown error';
          } catch (e) {
            errorMessage = response.statusText || 'Unknown error';
          }
          throw new Error(`Failed to fetch wall textures: ${errorMessage}`);
        }
        
        const textures = await response.json();
        console.log('Wall textures received:', textures);
        
        if (isActive && Array.isArray(textures) && textures.length > 0) {
          setWallTextures(textures);
          
          // Set the active wall texture
          const activeTexture = textures.find(t => t.isActive);
          if (activeTexture) {
            console.log('Setting active wall texture:', activeTexture.name);
            setActiveTextures(prev => ({
              ...prev,
              wall: activeTexture.url
            }));
          } else if (textures[0]) {
            // Fallback to first texture if none is marked active
            console.log('No active wall texture found, using first one:', textures[0].name);
            setActiveTextures(prev => ({
              ...prev,
              wall: textures[0].url
            }));
          }
        }
      } catch (err) {
        console.error("Error fetching wall textures:", err);
        // Set mock wall textures if backend fails
        if (isActive) {
          // Try to create mock texture URLs based on the room ID if we have no textures
          console.log("Using mock wall textures due to error");
          // We'll skip setting mock textures in this implementation
        }
      }
    };
    
    fetchWallTextures();
    
    return () => {
      isActive = false;
    };
  }, [wallTextureEndpoint, baseUrl]);

  // Fetch floor textures
  useEffect(() => {
    if (!floorTextureEndpoint || !baseUrl) return;
    
    let isActive = true;
    
    const fetchFloorTextures = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        
        const idToken = await user.getIdToken();
        
        console.log(`Fetching floor textures from: ${baseUrl}${floorTextureEndpoint}`);
        const response = await fetch(`${baseUrl}${floorTextureEndpoint}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        
        if (!response.ok) {
          // Try to get detailed error message
          let errorMessage;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || 'Unknown error';
          } catch (e) {
            errorMessage = response.statusText || 'Unknown error';
          }
          throw new Error(`Failed to fetch floor textures: ${errorMessage}`);
        }
        
        const textures = await response.json();
        console.log('Floor textures received:', textures);
        
        if (isActive && Array.isArray(textures) && textures.length > 0) {
          setFloorTextures(textures);
          
          // Set the active floor texture
          const activeTexture = textures.find(t => t.isActive);
          if (activeTexture) {
            console.log('Setting active floor texture:', activeTexture.name);
            setActiveTextures(prev => ({
              ...prev,
              floor: activeTexture.url
            }));
          } else if (textures[0]) {
            // Fallback to first texture if none is marked active
            console.log('No active floor texture found, using first one:', textures[0].name);
            setActiveTextures(prev => ({
              ...prev,
              floor: textures[0].url
            }));
          }
        }
      } catch (err) {
        console.error("Error fetching floor textures:", err);
        // Set mock floor textures if backend fails
        if (isActive) {
          // Try to create mock texture URLs based on the room ID if we have no textures
          console.log("Using mock floor textures due to error");
          // We'll skip setting mock textures in this implementation
        }
      }
    };
    
    fetchFloorTextures();
    
    return () => {
      isActive = false;
    };
  }, [floorTextureEndpoint, baseUrl]);

  const executeDelete = async () => {
    // Ensure we have a valid id before attempting to delete
    if (!id) {
      setPopup({ open: true, type: 'error', message: 'Cannot delete: Invalid room ID' });
      setShowConfirmPopup(false);
      return;
    }
    
    setShowConfirmPopup(false)
    setIsDeleting(true)
    setPopup({ open: false, type: '', message: '' })
    
    try {
      // Get the current user's auth token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to delete this room');
      }
      
      const idToken = await user.getIdToken();
      
      const response = await fetch(`${baseUrl}/api/rooms/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete room. Server returned an error.' }))
        throw new Error(errorData.message || 'Failed to delete room.')
      }

      if (onDeleteSuccess) {
        onDeleteSuccess(id)
      }

    } catch (err) {
      console.error("Error deleting room:", err)
      setPopup({ open: true, type: 'error', message: err.message || 'Error deleting room.' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDelete = () => {
    if (!id) {
      setPopup({ open: true, type: 'error', message: 'Cannot delete: Invalid room ID' });
      return;
    }
    setShowConfirmPopup(true)
  }

  const handleCancelDelete = () => {
    setShowConfirmPopup(false)
  }
  
  const handleWallTextureChange = (url) => {
    console.log('Changing wall texture to:', url);
    setActiveTextures(prev => ({
      ...prev,
      wall: url
    }));
  };
  
  const handleFloorTextureChange = (url) => {
    console.log('Changing floor texture to:', url);
    setActiveTextures(prev => ({
      ...prev,
      floor: url
    }));
  };

  const previewAvailable = !!modelBlob
  const showLoading = isLoadingModel || (!previewAvailable && modelEndpoint)

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

      <ConfirmationPopup
        open={showConfirmPopup}
        message={`Are you sure you want to delete this ${category || 'room'}? This action cannot be undone.`}
        onConfirm={executeDelete}
        onCancel={handleCancelDelete}
        confirmText="Delete"
        confirmButtonClass="button-primary"
      />

      <div style={{ 
        marginBottom: '0.5rem', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}>
        <span style={{
          fontWeight: 600, 
          fontSize: '18px', 
          color: '#00474C' // Darker teal
        }}>{roomName}</span>
        <span style={{ 
          color: '#006A71', // Teal
          fontWeight: 500, 
          fontSize: '14px' 
        }}>{formattedDate}</span>
      </div>
      
      <div style={{  
        color: '#4A5568', // Slate gray for description
        fontSize: '14px', 
        marginBottom: '0.2rem'
      }}>{description}</div>
      
      {/* Preview container with gold accent at the bottom */}
      <div
        style={{
          width: '100%',
          height: 180, // Taller for room preview
          background: '#F7FAFC', // Light background
          borderRadius: 8,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          border: '1px solid #E2E8F0',
          borderBottom: '2px solid #ECC94B', // Gold accent to preview area
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
            gl={{ antialias: true, preserveDrawingBuffer: false }}
            dpr={[1, 1.5]}
            frameloop="always"
            shadows
            camera={{ fov: 45, near: 0.1, far: 100, position: [0, 2, 5] }}
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
              <Environment preset="apartment" />
              <RotatingBoundsContent>
                <ModelPreview 
                  modelBlob={modelBlob}
                  activeTextures={activeTextures}
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
      
      {/* Wall texture selection */}
      {wallTextures.length > 0 && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: 4, 
          marginBottom: 4,
          padding: '6px 10px',
          borderRadius: '4px',
          border: '1px solid #E2E8F0',
          borderLeft: '2px solid #ECC94B' // Gold accent
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#00474C', marginBottom: '4px' }}>
            Wall Texture
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {wallTextures.map((texture, idx) => (
              <button
                key={idx}
                onClick={() => handleWallTextureChange(texture.url)}
                style={{
                  border: texture.url === activeTextures.wall ? `2px solid #006A71` : '1px solid #E2E8F0',
                  borderRadius: '4px',
                  padding: 0,
                  background: '#FFFFFF',
                  width: 24,
                  height: 24,
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: texture.url === activeTextures.wall ? '0 0 0 2px #66B2B8' : undefined,
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                title={texture.name}
                type="button"
              >
                <img src={texture.url} alt={texture.name} style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  borderRadius: 4 
                }} />
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Floor texture selection */}
      {floorTextures.length > 0 && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: 4, 
          marginBottom: 4,
          padding: '6px 10px',
          borderRadius: '4px',
          border: '1px solid #E2E8F0',
          borderLeft: '2px solid #ECC94B' // Gold accent
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#00474C', marginBottom: '4px' }}>
            Floor Texture
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {floorTextures.map((texture, idx) => (
              <button
                key={idx}
                onClick={() => handleFloorTextureChange(texture.url)}
                style={{
                  border: texture.url === activeTextures.floor ? `2px solid #006A71` : '1px solid #E2E8F0',
                  borderRadius: '4px',
                  padding: 0,
                  background: '#FFFFFF',
                  width: 24,
                  height: 24,
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: texture.url === activeTextures.floor ? '0 0 0 2px #66B2B8' : undefined,
                  transition: 'border-color 0.2s, box-shadow 0.2s'
                }}
                title={texture.name}
                type="button"
              >
                <img src={texture.url} alt={texture.name} style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover', 
                  borderRadius: 4 
                }} />
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Category label */}
      <div style={{ fontSize: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontWeight: 600, color: '#00474C' }}>Category:</span>
        <span style={{ 
          color: '#4A5568', 
          backgroundColor: '#EDF2F7', 
          padding: '2px 8px', 
          borderRadius: '4px',
          fontSize: '11px'
        }}>
          {category}
        </span>
      </div>
      
      {/* Action buttons */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        marginTop: 'auto', // This pushes the buttons to the bottom
        paddingTop: '1rem',
        gap: '8px'
      }}>
        {/* Delete Icon Button - Red styling */}
        <button
          className="icon-button"
          onClick={handleDelete}
          style={{ 
            background: '#9B2C2C', // Darker red from HomePage error colors
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
          title="Delete Room"
          aria-label={`Delete ${category} room`}
          disabled={isDeleting || !id}
          onMouseOver={(e) => !isDeleting && (e.currentTarget.style.background = '#FC8181')} // Lighter red on hover
          onMouseOut={(e) => !isDeleting && (e.currentTarget.style.background = '#9B2C2C')} // Back to darker red
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
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      </div>
    </div>
  )
}