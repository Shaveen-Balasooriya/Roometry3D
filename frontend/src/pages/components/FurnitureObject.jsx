import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { auth } from '../../services/firebase'; // Import auth
import { Html } from '@react-three/drei';

// Component to handle loading and displaying furniture objects
export default function FurnitureObject({ 
  furniture, 
  position = [0, 0, 0], 
  rotation = [0, 0, 0],
  scale = 1, // Use the passed scale prop
  onLoad, // Expecting instanceId as argument
  onError,
  selected = false
}) {
  const [objData, setObjData] = useState(null);
  const [modelError, setModelError] = useState(null);
  const objRef = useRef();
  const hasLoaded = useRef(false); // Ref to track if onLoad has been called

  // Reset hasLoaded if the furniture instance itself changes.
  useEffect(() => {
    hasLoaded.current = false;
  }, [furniture.instanceId]);

  // Fetch OBJ data from the backend
  useEffect(() => {
    if (!furniture || !furniture.id) return;
    let isActive = true;
    
    const fetchObjData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('User not authenticated to load furniture model.');
        }
        const idToken = await user.getIdToken();

        const response = await fetch(`/api/furniture/${furniture.id}/model`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });
        if (!response.ok) {
          throw new Error(`Failed to load model: ${response.status} ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const objUrl = URL.createObjectURL(blob);
        if (isActive) {
          setObjData(objUrl);
        }
      } catch (err) {
        console.error('Error loading furniture model:', err);
        if (isActive) {
          setModelError(true);
          if (onError) {
            onError(err.message, furniture.instanceId);
          }
        }
      }
    };
    
    fetchObjData();
    
    return () => {
      isActive = false;
      if (objData) {
        URL.revokeObjectURL(objData);
      }
    };
  }, [furniture, onError]); // Removed onLoad from here as it was causing re-fetches
  
  const positionModelInView = useCallback((obj) => {
    if (!obj || !objRef.current) return;

    const group = objRef.current; // The group containing the model
    group.updateMatrixWorld(true); // Ensure world matrix is up-to-date

    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Calculate scale factor to fit within a unit cube (or desired size)
    const maxDim = Math.max(size.x, size.y, size.z);
    const desiredScale = (maxDim > 0 ? 1 / maxDim : 1) * scale; // Apply overall scale prop

    obj.scale.set(desiredScale, desiredScale, desiredScale);
    obj.updateMatrixWorld(true);

    // Recalculate bounding box after scaling
    const scaledBox = new THREE.Box3().setFromObject(obj);
    const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

    // Adjust position to place the bottom of the model at y=0 of the group's position
    obj.position.copy(scaledCenter.negate()); // Center the model at the group's origin first
    obj.position.y += (scaledBox.max.y - scaledBox.min.y) / 2; // Then lift it so its bottom is at y=0 within the group
  }, [scale]); // Dependency on `scale` prop
  
  const handleInternalModelLoad = useCallback((loadedObj) => {
    if (!loadedObj) return;
    
    loadedObj.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (!child.material) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xCCCCCC, 
            roughness: 0.7,
            metalness: 0.1
          });
        } else if (Array.isArray(child.material)) {
          // Handle multi-material objects if necessary
          child.material.forEach(mat => {
            mat.color = new THREE.Color(0xCCCCCC);
            mat.roughness = 0.7;
            mat.metalness = 0.1;
          });
        }
      }
    });
    
    positionModelInView(loadedObj);

    // Only call the parent onLoad once for this instance
    if (onLoad && !hasLoaded.current) {
      onLoad(furniture.instanceId);
      hasLoaded.current = true;
    }
  }, [positionModelInView, onLoad, furniture.instanceId]); // Added furniture.instanceId

  // Memoize the Model component to prevent re-renders if props are stable
  const MemoizedModel = useMemo(() => {
    if (!objData) return null;
    return <Model url={objData} onLoad={handleInternalModelLoad} selected={selected} />;
  }, [objData, handleInternalModelLoad, selected]);
  
  if (modelError) {
    return (
        <Html center position={position}>
            <div style={{ color: 'red', background: 'rgba(255,255,255,0.7)', padding: '5px', borderRadius: '3px' }}>
                Error loading: {furniture.name}
            </div>
        </Html>
    );
  }
  
  if (!objData) {
    return (
        <Html center position={position}>
             <div style={{ color: 'gray', background: 'rgba(255,255,255,0.7)', padding: '5px', borderRadius: '3px' }}>
                Loading: {furniture.name}...
            </div>
        </Html>
    );
  }
  
  return (
    <group ref={objRef} position={position} rotation={rotation}>
      <React.Suspense fallback={null}>
        {MemoizedModel}
      </React.Suspense>
    </group>
  );
}

// Model component to handle the actual OBJ loading
function Model({ url, onLoad, selected }) {
  const obj = useLoader(OBJLoader, url);
  const modelRef = useRef();
  
  useEffect(() => {
    if (obj && onLoad) {
      onLoad(obj); // This `obj` is the raw Three.js Object3D from OBJLoader
    }
  }, [obj, onLoad]);
  
  useEffect(() => {
    if (obj && modelRef.current) {
      obj.traverse((child) => {
        if (child.isMesh) {
          if (selected) {
            if (!child.userData.originalMaterial) {
              child.userData.originalMaterial = child.material.clone();
            }
            child.material = new THREE.MeshStandardMaterial({
              color: 0x88CCFF, // Highlight color
              emissive: 0x113366,
              roughness: 0.4,
              metalness: 0.2,
            });
          } else if (child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial;
          }
        }
      });
    }
  }, [obj, selected]);
  
  return <primitive ref={modelRef} object={obj} dispose={null} />;
}