import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export class ModelViewer {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.model = null;
    this.textures = {};
    this.currentTexture = null;
    this.animationId = null;
    this.gridHelper = null;
    
    this.init();
  }
  
  init() {
    // Create scene with a nice background gradient
    this.scene = new THREE.Scene();
    
    // Create a gradient background
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#dce8ff');
    gradient.addColorStop(1, '#ffffff');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 2, 512);
    const texture = new THREE.CanvasTexture(canvas);
    this.scene.background = texture;
    
    // Set up lights for better appearance
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambientLight);
    
    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    
    // Improve shadow quality
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.bias = -0.001;
    
    this.scene.add(directionalLight);
    
    // Additional lights for better coverage
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
    backLight.position.set(0, -5, -5);
    this.scene.add(backLight);
    
    // Set up camera
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(2, 2, 5);
    
    // Set up renderer with antialiasing for better quality
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true
    });
    
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);
    
    // Set up controls with better defaults for a smoother experience
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.rotateSpeed = 0.7;
    this.controls.panSpeed = 0.7;
    this.controls.zoomSpeed = 1.2;
    
    // Add grid helper for better size perception
    this.addGrid();
    
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    // Start animation loop
    this.animate();
  }
  
  addGrid() {
    // Remove previous grid if exists
    if (this.gridHelper) {
      this.scene.remove(this.gridHelper);
    }
    
    // Create a helper grid with 10x10 size and 10 divisions
    this.gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0xcccccc);
    this.gridHelper.position.y = -0.01; // Slightly below objects
    this.scene.add(this.gridHelper);
    
    // Add subtle ground plane to catch shadows
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.ShadowMaterial({ 
      opacity: 0.2,
      color: 0x000000
    });
    
    const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = 0;
    groundPlane.receiveShadow = true;
    this.scene.add(groundPlane);
  }
  
  onWindowResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  
  animate() {
    this.animationId = requestAnimationFrame(this.animate.bind(this));
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  
  loadModel(modelFile, dimensions = { width: 1, height: 1, length: 1 }) {
    // If there's already a model, remove it
    if (this.model) {
      this.scene.remove(this.model);
    }
    
    // Create a URL for the model file
    const modelUrl = URL.createObjectURL(modelFile);
    
    // Show loading indicator (maybe add a spinner later)
    console.log('Loading model...');
    
    // Load the model
    const loader = new OBJLoader();
    loader.load(
      modelUrl,
      (object) => {
        // Calculate the scaling factors
        const boundingBox = new THREE.Box3().setFromObject(object);
        const modelSize = new THREE.Vector3();
        boundingBox.getSize(modelSize);
        
        // Calculate scale to convert model to real-world dimensions
        const scaleX = dimensions.width / modelSize.x || 1;
        const scaleY = dimensions.height / modelSize.y || 1;
        const scaleZ = dimensions.length / modelSize.z || 1;
        
        // Apply scaling
        object.scale.set(scaleX, scaleY, scaleZ);
        
        // Center the model on the grid
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        
        // Adjust position to place bottom at y=0
        object.position.x = -center.x * scaleX;
        object.position.y = -boundingBox.min.y * scaleY;
        object.position.z = -center.z * scaleZ;
        
        // Make it receive and cast shadows
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        
        // Add to scene
        this.model = object;
        this.scene.add(this.model);
        
        // Apply current texture if available
        if (this.currentTexture) {
          this.applyTexture(this.currentTexture);
        }
        
        // Reset camera position and controls target
        // Position camera to look at the model from a good angle
        const maxDim = Math.max(dimensions.width, dimensions.height, dimensions.length);
        this.camera.position.set(maxDim * 2, maxDim * 1.5, maxDim * 2);
        this.controls.target.set(0, dimensions.height / 2, 0);
        this.controls.update();
      },
      (xhr) => {
        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
      },
      (error) => {
        console.error('Error loading model', error);
      }
    );
    
    // Clean up object URL
    return () => URL.revokeObjectURL(modelUrl);
  }
  
  loadTexture(name, textureFile) {
    const textureUrl = URL.createObjectURL(textureFile);
    const texture = new THREE.TextureLoader().load(textureUrl);
    
    // Improve texture quality
    texture.encoding = THREE.sRGBEncoding;
    texture.flipY = false; // Often better for imported models
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    
    this.textures[name] = {
      texture,
      url: textureUrl
    };
    
    // If this is the first texture, apply it
    if (!this.currentTexture) {
      this.currentTexture = name;
      this.applyTexture(name);
    }
    
    return () => URL.revokeObjectURL(textureUrl);
  }
  
  applyTexture(name) {
    if (!this.textures[name] || !this.model) return;
    
    this.currentTexture = name;
    const textureInfo = this.textures[name];
    
    // Create a better looking material with the texture
    const material = new THREE.MeshStandardMaterial({
      map: textureInfo.texture,
      metalness: 0.1,
      roughness: 0.7,
      envMapIntensity: 1.0,
      side: THREE.DoubleSide // Better for some models
    });
    
    // Apply the texture to each mesh in the model
    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = material;
      }
    });
  }
  
  dispose() {
    // Stop animation
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    // Dispose of textures
    Object.values(this.textures).forEach(({ texture, url }) => {
      texture.dispose();
      URL.revokeObjectURL(url);
    });
    
    // Remove event listeners
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    
    // Dispose of controls
    if (this.controls) {
      this.controls.dispose();
    }
    
    // Dispose of renderer
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }
    
    // Clear scene
    if (this.scene) {
      this.scene.clear();
    }
  }
}
