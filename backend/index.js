require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const functions = require('firebase-functions');
const path = require('path');
const admin = require('firebase-admin');

const app = express();

// Load environment variables
dotenv.config();

// Initialize Firebase Admin SDK
let serviceAccount;
try {
  // First try to load from environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // Fallback to service account file if it exists
    serviceAccount = require('./serviceAccountKey.json');
  }
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'roometry-3d.appspot.com'
  });
} catch (error) {
  console.error('Firebase initialization error:', error.message);
  console.error('Please ensure your Firebase service account credentials are properly set up.');
}

// Check if Firebase is initialized
const isFirebaseInitialized = () => {
  try {
    admin.app();
    return true;
  } catch (error) {
    return false;
  }
};

// Configure CORS to allow requests from frontend
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://roometry-3d.web.app', 'https://roometry-3d.firebaseapp.com']
    : 'http://localhost:5173', // Vite default port
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

app.use(express.json());

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Accept images and 3D model files
    const allowedTypes = [
      // Images
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      // 3D Models
      'model/gltf-binary', 'model/gltf+json', 
      'application/octet-stream' // For .bin files and some 3D formats
    ];
    
    // Also accept by extension for 3D files that might not have the correct mime type
    const allowedExtensions = ['.glb', '.gltf', '.bin', '.jpg', '.jpeg', '.png', '.webp'];
    
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      return cb(null, true);
    }
    
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV || 'development',
    firebase: isFirebaseInitialized() ? 'initialized' : 'not initialized'
  });
});

// Upload texture endpoint
app.post('/api/upload/texture', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Check if Firebase is initialized
    if (!isFirebaseInitialized()) {
      return res.status(500).json({ 
        error: 'Firebase not initialized',
        message: 'Server is not properly configured with Firebase'
      });
    }
    
    const bucket = admin.storage().bucket();
    const textureType = req.body.type || 'wall'; // wall or floor
    
    // Generate a unique filename to prevent conflicts
    const fileExtension = path.extname(req.file.originalname);
    const fileName = `${textureType}/${uuidv4()}${fileExtension}`;
    
    // Create a reference to the file in Firebase Storage
    const fileRef = bucket.file(`textures/${fileName}`);
    
    // Create a write stream to upload the file
    const blobStream = fileRef.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
        metadata: {
          originalName: req.file.originalname,
          uploadedAt: new Date().toISOString()
        }
      }
    });
    
    // Handle stream errors
    blobStream.on('error', (error) => {
      console.error('Upload error:', error);
      res.status(500).json({ 
        error: 'Upload failed', 
        message: error.message 
      });
    });
    
    // Handle successful uploads
    blobStream.on('finish', async () => {
      try {
        // Make the file publicly accessible
        await fileRef.makePublic();
        
        // Get the public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileRef.name}`;
        
        res.status(200).json({
          message: 'Upload successful',
          file: {
            name: req.file.originalname,
            type: textureType,
            url: publicUrl,
            path: fileRef.name,
            size: req.file.size
          }
        });
      } catch (error) {
        console.error('Error making file public:', error);
        res.status(500).json({ 
          error: 'Error after upload', 
          message: error.message 
        });
      }
    });
    
    // Write the file data to the stream
    blobStream.end(req.file.buffer);
    
  } catch (error) {
    console.error('Server error during upload:', error);
    res.status(500).json({ 
      error: 'Server error', 
      message: error.message 
    });
  }
});

// Get all textures endpoint
app.get('/api/textures/:type', async (req, res) => {
  try {
    if (!isFirebaseInitialized()) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }
    
    const textureType = req.params.type;
    if (!['wall', 'floor'].includes(textureType)) {
      return res.status(400).json({ error: 'Invalid texture type. Must be wall or floor' });
    }
    
    const bucket = admin.storage().bucket();
    const [files] = await bucket.getFiles({ prefix: `textures/${textureType}/` });
    
    const textureList = await Promise.all(files.map(async (file) => {
      try {
        const [metadata] = await file.getMetadata();
        const url = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
        
        return {
          name: metadata.metadata?.originalName || path.basename(file.name),
          url: url,
          path: file.name,
          timeCreated: metadata.timeCreated,
          size: metadata.size
        };
      } catch (err) {
        console.error(`Error getting metadata for ${file.name}:`, err);
        return null;
      }
    }));
    
    // Filter out any entries that failed to get metadata
    const validTextures = textureList.filter(texture => texture !== null);
    
    res.status(200).json(validTextures);
    
  } catch (error) {
    console.error('Error fetching textures:', error);
    res.status(500).json({ 
      error: 'Failed to fetch textures', 
      message: error.message 
    });
  }
});

// Delete a texture endpoint
app.delete('/api/textures/:path(*)', async (req, res) => {
  try {
    if (!isFirebaseInitialized()) {
      return res.status(500).json({ error: 'Firebase not initialized' });
    }
    
    const filePath = req.params.path;
    if (!filePath.startsWith('textures/')) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    const bucket = admin.storage().bucket();
    const file = bucket.file(filePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Delete the file
    await file.delete();
    
    res.status(200).json({ message: 'File deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ 
      error: 'Failed to delete file', 
      message: error.message 
    });
  }
});

if (process.env.NODE_ENV === 'development') {
  // Running locally
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Firebase status: ${isFirebaseInitialized() ? 'initialized' : 'not initialized'}`);
  });
} else {
  // Running on Firebase
  exports.api = functions.https.onRequest(app);
}


