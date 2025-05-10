import React, { useRef, useEffect } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import * as THREE from 'three';
import './ModelViewer.css';

function ModelViewer({ modelUrl, onLoaded, activeTexture }) {
  const loadedRef = useRef(false);
  const modelRef = useRef();
  const wallMaterialsRef = useRef(new Map());
  const { scene } = useThree();

  // Load the model using GLTFLoader
  const gltf = useLoader(GLTFLoader, modelUrl, undefined, (xhr) => {
    if (xhr.loaded && xhr.total) {
      const progress = Math.floor((xhr.loaded / xhr.total) * 100);
      console.log(`Loading model: ${progress}% complete`);
      
      if (progress === 100 && !loadedRef.current && onLoaded) {
        loadedRef.current = true;
        onLoaded();
      }
    }
  });

  // Identify walls based on name or geometry
  const identifyWalls = (object) => {
    const wallPatterns = [/wall/i, /partition/i, /divider/i];
    const nameIsWall = wallPatterns.some(pattern => pattern.test(object.name));
    
    let isVerticalSurface = false;
    
    if (object.geometry) {
      const bbox = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      
      const minDim = Math.min(size.x, size.y, size.z);
      const maxDim = Math.max(size.x, size.y, size.z);
      
      isVerticalSurface = 
        (minDim < maxDim * 0.1) && 
        (size.y > size.x * 0.6 || size.y > size.z * 0.6);
    }
    
    return nameIsWall || isVerticalSurface;
  };

  // Create materials for walls and floors
  const createMaterial = (originalMaterial, isTransparent = false) => {
    const newMaterial = originalMaterial.clone();
    
    if (isTransparent) {
      newMaterial.transparent = true;
      newMaterial.opacity = 0.4;
      newMaterial.depthWrite = false;
    }
    
    newMaterial.side = THREE.DoubleSide;
    return newMaterial;
  };

  // Apply texture to material
  const applyTextureToMaterial = (material, texture) => {
    if (!texture) return material;
    
    const newMaterial = material.clone();
    
    // Create a texture loader
    const loader = new THREE.TextureLoader();
    const textureMap = loader.load(texture.url);
    
    // Apply texture settings
    textureMap.wrapS = THREE.RepeatWrapping;
    textureMap.wrapT = THREE.RepeatWrapping;
    textureMap.repeat.set(texture.repeat || 1, texture.repeat || 1);
    
    // Apply texture to material
    newMaterial.map = textureMap;
    newMaterial.needsUpdate = true;
    
    return newMaterial;
  };

  // Process model and set up materials
  useEffect(() => {
    if (!gltf || !gltf.scene) return;
    
    console.log("Model loaded, processing...");
    
    // Center and scale the model
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const scale = 2.5 / (maxDim > 0 ? maxDim : 1);
    
    gltf.scene.position.x = -center.x * scale;
    gltf.scene.position.y = -center.y * scale;
    gltf.scene.position.z = -center.z * scale;
    gltf.scene.scale.set(scale, scale, scale);
    
    console.log("Model centered and scaled, dimensions:", size);
    
    // Store reference to model
    modelRef.current = gltf.scene;
    scene.add(gltf.scene);
    
    // Process materials for walls and floors
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        if (child.material) {
          child.material.needsUpdate = true;
          
          // Check if this mesh is likely a wall or floor
          if (identifyWalls(child)) {
            console.log("Wall identified:", child.name || "unnamed");
            
            // Store original and create transparent materials
            if (Array.isArray(child.material)) {
              const originalMaterials = [...child.material];
              const transparentMaterials = originalMaterials.map(mat => createMaterial(mat, true));
              
              wallMaterialsRef.current.set(child.uuid, {
                original: originalMaterials,
                transparent: transparentMaterials,
                mesh: child,
                type: 'wall'
              });
            } else {
              const originalMaterial = child.material;
              const transparentMaterial = createMaterial(originalMaterial, true);
              
              wallMaterialsRef.current.set(child.uuid, {
                original: originalMaterial,
                transparent: transparentMaterial,
                mesh: child,
                type: 'wall'
              });
            }
          } 
          // Check for floor (typically horizontal surfaces)
          else if (child.name.toLowerCase().includes('floor') || 
                  (child.rotation.x < -Math.PI/3 || child.rotation.x > Math.PI/3)) {
            console.log("Floor identified:", child.name || "unnamed");
            
            if (Array.isArray(child.material)) {
              wallMaterialsRef.current.set(child.uuid, {
                original: [...child.material],
                mesh: child,
                type: 'floor'
              });
            } else {
              wallMaterialsRef.current.set(child.uuid, {
                original: child.material,
                mesh: child,
                type: 'floor'
              });
            }
          }
        }
      }
    });
    
    // Call onLoaded if it hasn't been called by the progress handler
    if (!loadedRef.current && onLoaded) {
      loadedRef.current = true;
      setTimeout(() => onLoaded(), 100);
    }
    
    return () => {
      // Cleanup on unmount
      scene.remove(gltf.scene);
      wallMaterialsRef.current.clear();
    };
  }, [gltf, onLoaded, scene]);

  // Apply texture when it changes
  useEffect(() => {
    if (!activeTexture || !modelRef.current) return;
    
    console.log("Applying texture:", activeTexture);
    
    wallMaterialsRef.current.forEach((materialInfo, uuid) => {
      const mesh = materialInfo.mesh;
      
      // Only apply textures to surfaces of the correct type
      if (materialInfo.type === activeTexture.type) {
        if (Array.isArray(materialInfo.original)) {
          // For multiple materials
          const newMaterials = materialInfo.original.map(mat => 
            applyTextureToMaterial(mat, activeTexture)
          );
          mesh.material = newMaterials;
        } else {
          // For single material
          mesh.material = applyTextureToMaterial(materialInfo.original, activeTexture);
        }
      }
    });
  }, [activeTexture]);

  if (!gltf) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="lightgray" />
      </mesh>
    );
  }

  // The model is already added to the scene in the useEffect
  return null;
}

export default ModelViewer;