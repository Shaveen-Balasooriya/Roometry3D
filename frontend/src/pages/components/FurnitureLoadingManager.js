import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { getFileTypeFromUrl, prepareModelScene, checkModelFileSize } from './FurnitureModelUtils';

// Global loading manager to track and manage all furniture model loading
const loadingManager = new THREE.LoadingManager();

// Keep track of loading statistics and errors
const loadingStats = {
  total: 0,
  completed: 0,
  failed: 0,
  inProgress: 0,
  errors: []
};

// Configure loading manager
loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
  loadingStats.total = itemsTotal;
  loadingStats.inProgress++;
  console.log(`Started loading: ${url} (${itemsLoaded}/${itemsTotal} items)`);
};

loadingManager.onLoad = () => {
  loadingStats.inProgress = 0;
  console.log(`All furniture models loaded. Completed: ${loadingStats.completed}, Failed: ${loadingStats.failed}`);
};

loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
  loadingStats.total = itemsTotal;
  console.log(`Loading progress: ${url} (${itemsLoaded}/${itemsTotal} items)`);
};

loadingManager.onError = (url) => {
  loadingStats.failed++;
  loadingStats.inProgress--;
  loadingStats.errors.push({ url, timestamp: new Date() });
  console.error(`Error loading: ${url}`);
};

// Load a furniture model with comprehensive error handling
export const loadFurnitureModel = (modelUrl, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!modelUrl) {
      reject(new Error('No model URL provided'));
      return;
    }
    
    const {
      timeout = 30000,       // Default 30-second timeout
      sizeLimitMB = 10,      // Default 10MB size limit before using fallback
      fallbackModelUrl = '/models/fallback-cube.gltf',
      instanceId = null,
      onProgress = null
    } = options;
    
    // First check file size to determine loading strategy
    checkModelFileSize(modelUrl)
      .then(({ size, isLarge, formattedSize }) => {
        if (isLarge && size > sizeLimitMB * 1024 * 1024) {
          console.warn(`Model file is very large (${formattedSize}), using fallback model instead`);
          // Skip straight to fallback for extremely large files
          return loadFallbackModel(fallbackModelUrl, { instanceId, originalUrl: modelUrl });
        }
        
        // Determine appropriate loader based on file extension
        const fileType = getFileTypeFromUrl(modelUrl);
        let loader;
        
        switch (fileType) {
          case 'obj':
            loader = new OBJLoader(loadingManager);
            break;
          case 'gltf':
          case 'glb':
            loader = new GLTFLoader(loadingManager);
            break;
          default:
            throw new Error(`Unsupported model format: ${fileType}`);
        }
        
        // Set up loading with timeout
        const timeoutId = setTimeout(() => {
          reject(new Error(`Loading timeout after ${timeout / 1000} seconds`));
        }, timeout);
        
        try {
          // Load the model with appropriate loader
          loader.load(
            modelUrl,
            (model) => {
              clearTimeout(timeoutId);
              loadingStats.completed++;
              loadingStats.inProgress--;
              
              let resultModel;
              if (fileType === 'gltf' || fileType === 'glb') {
                resultModel = model.scene;
              } else {
                resultModel = model;
              }
              
              // Prepare the model (add metadata, shadows, etc.)
              const preparedModel = prepareModelScene(resultModel, instanceId);
              resolve({ model: preparedModel, error: null, usedFallback: false });
            },
            (progressEvent) => {
              if (onProgress && progressEvent.lengthComputable) {
                const progress = (progressEvent.loaded / progressEvent.total) * 100;
                onProgress(progress, progressEvent);
              }
              
              // Also check for very large files during download
              if (progressEvent.total && progressEvent.total > sizeLimitMB * 1024 * 1024 && progressEvent.loaded < progressEvent.total * 0.1) {
                // If we're less than 10% into loading and it's already huge, use fallback
                clearTimeout(timeoutId);
                console.warn(`Model download too large (${(progressEvent.total / (1024 * 1024)).toFixed(2)}MB), switching to fallback`);
                
                loadFallbackModel(fallbackModelUrl, { instanceId, originalUrl: modelUrl })
                  .then(resolve)
                  .catch(reject);
              }
            },
            (error) => {
              clearTimeout(timeoutId);
              loadingStats.failed++;
              loadingStats.inProgress--;
              console.error(`Error loading model (${fileType}): ${modelUrl}`, error);
              
              // Try fallback model
              loadFallbackModel(fallbackModelUrl, { instanceId, originalUrl: modelUrl, originalError: error })
                .then(resolve)
                .catch(reject);
            }
          );
        } catch (error) {
          clearTimeout(timeoutId);
          loadingStats.failed++;
          loadingStats.inProgress--;
          console.error(`Exception loading model: ${modelUrl}`, error);
          
          // Try fallback model
          loadFallbackModel(fallbackModelUrl, { instanceId, originalUrl: modelUrl, originalError: error })
            .then(resolve)
            .catch(reject);
        }
      })
      .catch(sizeCheckError => {
        console.error('Error checking model file size:', sizeCheckError);
        // If we can't check size, try regular loading with timeout
        loadRegularModel(modelUrl, { instanceId, timeout, onProgress, fallbackModelUrl })
          .then(resolve)
          .catch(reject);
      });
  });
};

// Helper function to load the regular model with timeout
const loadRegularModel = (modelUrl, options) => {
  return new Promise((resolve, reject) => {
    const { 
      instanceId, 
      timeout = 30000, 
      onProgress = null,
      fallbackModelUrl = '/models/fallback-cube.gltf'
    } = options;
    
    const fileType = getFileTypeFromUrl(modelUrl);
    let loader;
    
    switch (fileType) {
      case 'obj':
        loader = new OBJLoader(loadingManager);
        break;
      case 'gltf':
      case 'glb':
        loader = new GLTFLoader(loadingManager);
        break;
      default:
        reject(new Error(`Unsupported model format: ${fileType}`));
        return;
    }
    
    // Set up loading with timeout
    const timeoutId = setTimeout(() => {
      loadFallbackModel(fallbackModelUrl, { instanceId, originalUrl: modelUrl, originalError: new Error('Loading timeout') })
        .then(resolve)
        .catch(reject);
    }, timeout);
    
    try {
      // Load the model with appropriate loader
      loader.load(
        modelUrl,
        (model) => {
          clearTimeout(timeoutId);
          loadingStats.completed++;
          
          let resultModel;
          if (fileType === 'gltf' || fileType === 'glb') {
            resultModel = model.scene;
          } else {
            resultModel = model;
          }
          
          // Prepare the model (add metadata, shadows, etc.)
          const preparedModel = prepareModelScene(resultModel, instanceId);
          resolve({ model: preparedModel, error: null, usedFallback: false });
        },
        onProgress,
        (error) => {
          clearTimeout(timeoutId);
          loadingStats.failed++;
          console.error(`Error loading model (${fileType}): ${modelUrl}`, error);
          
          // Try fallback model
          loadFallbackModel(fallbackModelUrl, { instanceId, originalUrl: modelUrl, originalError: error })
            .then(resolve)
            .catch(reject);
        }
      );
    } catch (error) {
      clearTimeout(timeoutId);
      loadingStats.failed++;
      console.error(`Exception loading model: ${modelUrl}`, error);
      
      // Try fallback model
      loadFallbackModel(fallbackModelUrl, { instanceId, originalUrl: modelUrl, originalError: error })
        .then(resolve)
        .catch(reject);
    }
  });
};

// Helper function to load fallback model
const loadFallbackModel = (fallbackModelUrl, metadata = {}) => {
  return new Promise((resolve, reject) => {
    const { instanceId, originalUrl, originalError } = metadata;
    
    console.log(`Loading fallback model for ${originalUrl}`);
    const loader = new GLTFLoader(loadingManager);
    
    loader.load(
      fallbackModelUrl,
      (gltf) => {
        loadingStats.completed++;
        
        // Add a label with furniture name if available
        if (metadata.name) {
          const textSprite = createTextLabel(metadata.name || 'Furniture');
          gltf.scene.add(textSprite);
        }
        
        // Prepare the scene and add metadata
        const preparedModel = prepareModelScene(gltf.scene, instanceId);
        
        // Set color to indicate this is a fallback
        preparedModel.traverse(child => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({ 
              color: 0xcccccc, 
              roughness: 0.7,
              metalness: 0.2
            });
          }
        });
        
        resolve({ 
          model: preparedModel, 
          error: originalError, 
          usedFallback: true, 
          originalUrl, 
          fallbackUrl: fallbackModelUrl
        });
      },
      null,
      (error) => {
        loadingStats.failed++;
        console.error('Error loading fallback model:', error);
        
        // Create an extremely simple cube as ultimate fallback
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ 
          color: 0xff0000, 
          roughness: 0.7,
          metalness: 0.2
        });
        const cube = new THREE.Mesh(geometry, material);
        
        const group = new THREE.Group();
        group.add(cube);
        
        const preparedModel = prepareModelScene(group, instanceId);
        
        resolve({ 
          model: preparedModel, 
          error: originalError, 
          usedFallback: true, 
          usedEmergencyFallback: true,
          originalUrl, 
          fallbackUrl: fallbackModelUrl
        });
      }
    );
  });
};

// Helper to create a text label for fallback models
const createTextLabel = (text) => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 128;
  
  context.fillStyle = 'rgba(0,0,0,0.5)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  context.font = 'Bold 24px Arial';
  context.fillStyle = 'white';
  context.textAlign = 'center';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.position.y = 1.5;
  sprite.scale.set(2, 1, 1);
  
  return sprite;
};

// Get current loading statistics
export const getLoadingStats = () => {
  return { ...loadingStats };
};

export default {
  loadFurnitureModel,
  getLoadingStats,
  loadingManager
};
