require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const os = require('os');

console.log('Starting backend server...');

let functions;
try {
  // Try to import firebase-functions, but make it optional for local development
  console.log('Attempting to load firebase-functions...');
  functions = require('firebase-functions');
  console.log('firebase-functions loaded successfully');
} catch (error) {
  console.log('Running in development mode without firebase-functions:', error.message);
  functions = { https: { onRequest: (app) => app } };
}

console.log('Initializing Express app...');
const app = express();

// Load CORS configuration from file
try {
  console.log('Loading CORS configuration...');
  const corsConfig = require('./cors-config.json');
  console.log('CORS config loaded:', JSON.stringify(corsConfig[0].origin));

  // Apply CORS configuration
  app.use(cors({
    origin: corsConfig[0].origin,
    methods: corsConfig[0].methods,
    allowedHeaders: corsConfig[0].allowedHeaders,
    credentials: corsConfig[0].credentials,
    maxAge: corsConfig[0].maxAge
  }));
  console.log('CORS middleware applied');
} catch (error) {
  console.error('Error setting up CORS:', error);
  // Fallback to a basic CORS configuration
  app.use(cors({ origin: '*' }));
  console.log('Fallback CORS middleware applied');
}

// Middleware for JSON parsing with increased limits
console.log('Setting up middleware...');
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
console.log('Express middleware configured');

// --- Firebase Admin SDK Setup ---
console.log('Setting up Firebase Admin SDK...');
const admin = require('firebase-admin');
let serviceAccount;

try {
  // Try to load serviceAccountKey.json, but provide a fallback for CI/CD environments
  console.log('Loading Firebase service account key...');
  serviceAccount = require('./serviceAccountKey.json');
  console.log('Service account key loaded successfully');
} catch (error) {
  console.warn('serviceAccountKey.json not found or invalid:', error.message);
  console.log('Attempting to use environment variables for Firebase credentials...');
  
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.error('ERROR: No Firebase project ID found in environment variables');
  }
  
  serviceAccount = {
    type: process.env.FIREBASE_TYPE || 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: process.env.FIREBASE_AUTH_URI || 'https://accounts.google.com/o/oauth2/auth',
    token_uri: process.env.FIREBASE_TOKEN_URI || 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_CERT_URL || 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
  };
  console.log('Using environment variables for Firebase credentials');
}

if (!admin.apps.length) {
  try {
    console.log('Initializing Firebase Admin app...');
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET;
    console.log('Using storage bucket:', storageBucket);
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: storageBucket, 
    });
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('ERROR: Failed to initialize Firebase Admin SDK:', error);
    process.exit(1); // Exit with error code if Firebase Admin can't initialize
  }
}

const db = admin.firestore();
const bucket = admin.storage().bucket();
// --- End Admin SDK setup ---

// Authentication Middleware
const authenticateUser = async (req, res, next) => {
  try {
    console.log('Authenticating request...');
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No token provided in request');
      return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = decodedToken;
      
      // Fetch user data from Firestore to ensure we have the correct role
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        // Use either the role from claims or the userType from Firestore
        req.user.role = decodedToken.role || userData.userType;
        console.log(`User authenticated: ${decodedToken.email}, Role: ${req.user.role}`);
      } else {
        console.log(`User authenticated but no Firestore record found: ${decodedToken.uid}`);
      }
      
      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Role-based access control middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized: No user found' });
    }

    const userRole = req.user.role || null;
    console.log(`Checking role access - User role: ${userRole}, Required roles: ${roles.join(', ')}`);
    
    if (!userRole || !roles.some(role => role.toLowerCase() === userRole.toLowerCase())) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    
    console.log(`Access granted to ${req.user.email} with role ${userRole}`);
    next();
  };
};

// Configure multer for file uploads
const multerStorage = multer.memoryStorage();
const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB for GLB files
    files: 10 // Allow up to 10 files
  }
});

// Apply authentication middleware to routes AFTER defining the middleware
app.use('/api/auth/verify', authenticateUser);
app.use('/api/furniture', authenticateUser);
app.use('/api/users', authenticateUser);
app.use('/api/projects', authenticateUser);
app.use('/api/count', authenticateUser);
app.use('/api/cart', authenticateUser);
app.use('/api/rooms', authenticateUser);

// Helper function to extract storage path from signed URL
const getStoragePathFromUrl = (url) => {
  if (!url) return null;
  try {
    const urlObject = new URL(url);
    const bucketName = bucket.name;
    const pathRegex = /\/o\/([^?]+)/;
    const match = urlObject.pathname.match(pathRegex);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
    let path = decodeURIComponent(urlObject.pathname);
    if (path.startsWith(`/${bucketName}/`)) {
      path = path.substring(`/${bucketName}/`.length);
    } else if (path.startsWith('/')) {
      path = path.substring(1);
    }
    return path;
  } catch (e) {
    console.error(`Error parsing storage path from URL: ${url}`, e);
    return null;
  }
};

// ===== FURNITURE API ROUTES =====
app.post('/api/furniture', upload.fields([
  { name: 'modelFile', maxCount: 1 },
  { name: 'textures', maxCount: 10 }
]), async (req, res) => {
  console.log('Received /api/furniture POST request'); 
  console.log('Request Body:', req.body); 
  console.log('Request Files:', req.files);

  try {
    const { name, category, description, price, quantity, height, width, length, wallMountable } = req.body;
    if (!name || !category || !description || !price || !quantity || !height || !width || !length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!req.files || !req.files.modelFile || req.files.modelFile.length === 0) {
      return res.status(400).json({ error: 'Model file is required' });
    }

    console.log('Validation passed. Starting file uploads...');

    // --- Upload model file to Firebase Storage using Admin SDK ---
    const modelFile = req.files.modelFile[0]; // Changed from objFile to modelFile
    const objFileName = `furniture/models/${uuidv4()}_${modelFile.originalname}`; // Keeping the storage path naming convention
    const objFileUpload = bucket.file(objFileName);
    await objFileUpload.save(modelFile.buffer, { contentType: modelFile.mimetype });
    const [objFileUrl] = await objFileUpload.getSignedUrl({
      action: 'read',
      expires: '03-01-2030', // Set a far future expiration or use your own logic
    });
    console.log(`Model uploaded successfully: ${objFileUrl}`); // Updated log message
    // --- End model file upload ---

    // --- Upload texture files (if any) using Admin SDK ---
    let textureUrls = [];
    if (req.files.textures && req.files.textures.length > 0) {
      console.log(`Uploading ${req.files.textures.length} textures...`);
      for (const texture of req.files.textures) {
        const textureName = `furniture/textures/${uuidv4()}_${texture.originalname}`;
        const textureUpload = bucket.file(textureName);
        await textureUpload.save(texture.buffer, { contentType: texture.mimetype });
        const [textureUrl] = await textureUpload.getSignedUrl({
          action: 'read',
          expires: '03-01-2030',
        });
        textureUrls.push(textureUrl);
        console.log(`Texture uploaded successfully: ${textureUrl}`);
      }
    } else {
      console.log('No textures to upload.');
    }
    // --- End texture upload ---

    // Save metadata to Firestore
    const furnitureData = {
      name,
      category,
      description,
      price: Number(price),
      quantity: Number(quantity),
      height: Number(height),
      width: Number(width),
      length: Number(length),
      wallMountable: wallMountable === 'true' || wallMountable === true,
      objFileUrl,
      textureUrls,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    console.log('Saving data to Firestore:', furnitureData);
    const docRef = await db.collection('furniture').add(furnitureData);
    console.log(`Data saved to Firestore with ID: ${docRef.id}`);

    res.status(201).json({ id: docRef.id, ...furnitureData, createdAt: new Date() }); // Return approximate creation time
  } catch (err) {
    console.error('Error processing /api/furniture:', err); // Log the full error on the backend
    res.status(500).json({ error: 'Failed to add furniture', details: err.message });
  }
});

app.put('/api/furniture/:id', upload.fields([
  { name: 'modelFile', maxCount: 1 }, // Changed from objFile to modelFile to match frontend
  { name: 'textures', maxCount: 10 }
]), async (req, res) => {
  const { id } = req.params;
  console.log(`Received PUT request for furniture ID: ${id}`);
  console.log('Request Body:', req.body);
  console.log('Request Files:', req.files);

  try {
    const { name, category, description, price, quantity, height, width, length, wallMountable } = req.body;
    if (!name || !category || !description || !price || !quantity || !height || !width || !length) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const docRef = db.collection('furniture').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Furniture item not found' });
    }

    const existingData = doc.data();
    const updateData = {
      name, category, description,
      price: Number(price), quantity: Number(quantity),
      height: Number(height), width: Number(width), length: Number(length),
      wallMountable: wallMountable === 'true' || wallMountable === true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    let newObjFileUrl = existingData.objFileUrl;
    let newTextureUrls = existingData.textureUrls || [];
    const deletePromises = [];

    if (req.files && req.files.modelFile && req.files.modelFile.length > 0) { // Changed from objFile to modelFile
      console.log('New model file provided. Uploading...');
      const modelFile = req.files.modelFile[0]; // Changed from objFile to modelFile
      const objFileName = `furniture/models/${uuidv4()}_${modelFile.originalname}`;
      const objFileUpload = bucket.file(objFileName);
      await objFileUpload.save(modelFile.buffer, { contentType: modelFile.mimetype });
      const [signedUrl] = await objFileUpload.getSignedUrl({ action: 'read', expires: '03-01-2030' });
      newObjFileUrl = signedUrl;
      console.log(`New model file uploaded: ${newObjFileUrl}`); // Updated log message

      const oldObjPath = getStoragePathFromUrl(existingData.objFileUrl);
      if (oldObjPath) {
        console.log(`Scheduling deletion of old OBJ: ${oldObjPath}`);
        deletePromises.push(bucket.file(oldObjPath).delete().catch(err => console.error(`Non-fatal: Failed to delete old OBJ ${oldObjPath}:`, err.message)));
      }
    }

    if (req.files && req.files.textures && req.files.textures.length > 0) {
      console.log(`New textures provided (${req.files.textures.length}). Uploading and replacing...`);
      const uploadedTextureUrls = [];
      for (const texture of req.files.textures) {
        const textureName = `furniture/textures/${uuidv4()}_${texture.originalname}`;
        const textureUpload = bucket.file(textureName);
        await textureUpload.save(texture.buffer, { contentType: texture.mimetype });
        const [signedUrl] = await textureUpload.getSignedUrl({ action: 'read', expires: '03-01-2030' });
        uploadedTextureUrls.push(signedUrl);
        console.log(`New texture uploaded: ${signedUrl}`);
      }
      newTextureUrls = uploadedTextureUrls;

      (existingData.textureUrls || []).forEach(oldUrl => {
        const oldTexturePath = getStoragePathFromUrl(oldUrl);
        if (oldTexturePath) {
          console.log(`Scheduling deletion of old texture: ${oldTexturePath}`);
          deletePromises.push(bucket.file(oldTexturePath).delete().catch(err => console.error(`Non-fatal: Failed to delete old texture ${oldTexturePath}:`, err.message)));
        }
      });
    }

    if (deletePromises.length > 0) {
      console.log(`Waiting for ${deletePromises.length} old file deletion(s)...`);
      await Promise.all(deletePromises);
      console.log('Attempted old file deletions.');
    }

    updateData.objFileUrl = newObjFileUrl;
    updateData.textureUrls = newTextureUrls;

    console.log('Updating Firestore document:', updateData);
    await docRef.update(updateData);
    console.log(`Firestore document ${id} updated successfully.`);

    const finalData = { ...existingData, ...updateData, id: doc.id, updatedAt: new Date() };
    res.status(200).json(finalData);

  } catch (err) {
    console.error(`Error updating furniture item ${id}:`, err);
    res.status(500).json({ message: 'Failed to update furniture item', details: err.message });
  }
});

app.get('/api/furniture/:id/model', async (req, res) => {
  try {
    const doc = await db.collection('furniture').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Furniture not found' });
    }
    const data = doc.data();
    if (!data.objFileUrl) {
      return res.status(404).json({ error: 'OBJ file not found' });
    }
    const storagePath = getStoragePathFromUrl(data.objFileUrl);
    if (!storagePath) {
      return res.status(500).json({ message: 'Could not determine storage path from URL' });
    }
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ message: 'OBJ file not found in storage' });
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Access-Control-Allow-Origin', '*');

    file.createReadStream()
      .on('error', (err) => {
        console.error(`Error streaming file ${storagePath}:`, err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Failed to stream OBJ file', details: err.message });
        } else {
          res.end();
        }
      })
      .pipe(res);
  } catch (err) {
    console.error(`Error fetching model for ${req.params.id}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Failed to fetch OBJ file', details: err.message });
    }
  }
});

app.get('/api/furniture/:id/details', async (req, res) => {
  try {
    const doc = await db.collection('furniture').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'Furniture not found' });
    }
    const data = doc.data();
    res.json({ id: doc.id, ...data });
  } catch (err) {
    console.error(`Error fetching details for ${req.params.id}:`, err);
    res.status(500).json({ message: 'Failed to fetch furniture details', details: err.message });
  }
});

app.delete('/api/furniture/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`Received DELETE request for furniture ID: ${id}`);

  try {
    const docRef = db.collection('furniture').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log(`Furniture item with ID: ${id} not found.`);
      return res.status(404).json({ message: 'Furniture item not found' });
    }

    const data = doc.data();
    const objStoragePath = getStoragePathFromUrl(data.objFileUrl);
    const textureStoragePaths = (data.textureUrls || []).map(getStoragePathFromUrl).filter(p => p !== null);

    const deletePromises = [];

    if (objStoragePath) {
      console.log(`Attempting to delete OBJ file from Storage: ${objStoragePath}`);
      deletePromises.push(bucket.file(objStoragePath).delete().catch(err => {
        console.error(`Failed to delete OBJ file ${objStoragePath}:`, err.message);
      }));
    }

    textureStoragePaths.forEach(path => {
      console.log(`Attempting to delete texture file from Storage: ${path}`);
      deletePromises.push(bucket.file(path).delete().catch(err => {
        console.error(`Failed to delete texture file ${path}:`, err.message);
      }));
    });

    await Promise.all(deletePromises);
    console.log('Attempted deletion of associated storage files.');

    console.log(`Attempting to delete Firestore document: ${id}`);
    await docRef.delete();
    console.log(`Successfully deleted Firestore document: ${id}`);

    res.status(200).json({ message: 'Furniture item deleted successfully' });

  } catch (err) {
    console.error(`Error deleting furniture item ${id}:`, err);
    res.status(500).json({ message: 'Failed to delete furniture item', details: err.message });
  }
});

app.get('/api/furniture', async (req, res) => {
  try {
    const { category } = req.query;
    let furnitureCol = db.collection('furniture');
    
    // Apply category filter if provided
    if (category && category !== 'All') {
      furnitureCol = furnitureCol.where('category', '==', category);
    }
    
    const snapshot = await furnitureCol.get();
    
    const items = snapshot.docs.map(doc => {
      const data = doc.data();
      const { objFileUrl, ...rest } = data;
      return {
        id: doc.id,
        ...rest,
        modelEndpoint: `/api/furniture/${doc.id}/model`
      };
    });
    
    res.json(items);
  } catch (err) {
    console.error('Error fetching furniture:', err);
    res.status(500).json({ error: 'Failed to fetch furniture', details: err.message });
  }
});

// ===== METRICS API ROUTES =====
// API to get total number of projects
app.get('/api/count/totalProjects', async (req, res) => {
  try {
    console.log('Fetching total projects count...');
    const projectsCol = db.collection('projects');
    const snapshot = await projectsCol.count().get();
    const totalProjects = snapshot.data().count;
    
    console.log(`Found ${totalProjects} total projects`);
    res.json({ count: totalProjects });
  } catch (err) {
    console.error('Error fetching total projects count:', err);
    res.status(500).json({ error: 'Failed to fetch projects count', details: err.message });
  }
});

// API to get count of projects added today
app.get('/api/count/todayProjects', async (req, res) => {
  try {
    console.log('Fetching today\'s projects count...');
    // Get today's date at midnight (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const projectsCol = db.collection('projects');
    // Query for documents where createdAt is >= today's start
    const snapshot = await projectsCol
      .where('createdAt', '>=', today)
      .get();
    
    console.log(`Found ${snapshot.size} projects created today`);
    res.json({ count: snapshot.size });
  } catch (err) {
    console.error('Error fetching today\'s projects count:', err);
    res.status(500).json({ error: 'Failed to fetch today\'s projects count', details: err.message });
  }
});

// API to get count of designers
app.get('/api/count/designers', async (req, res) => {
  try {
    console.log('Fetching designers count...');
    const usersCol = db.collection('users');
    const snapshot = await usersCol
      .where('userType', '==', 'designer')
      .get();
    
    console.log(`Found ${snapshot.size} designers`);
    res.json({ count: snapshot.size });
  } catch (err) {
    console.error('Error fetching designers count:', err);
    res.status(500).json({ error: 'Failed to fetch designers count', details: err.message });
  }
});

// API endpoint for adding items to cart
app.post('/api/cart/add', authenticateUser, async (req, res) => {
  try {
    // Get user ID from the authenticated request
    const userId = req.user?.uid || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated or user ID not found' });
    }

    // Extract furniture details from request body
    const { furnitureId, quantity = 1, textureUrl } = req.body;
    
    if (!furnitureId) {
      return res.status(400).json({ error: 'Furniture ID is required' });
    }

    // Fetch the furniture details to ensure it exists and to store complete info
    const furnitureDoc = await db.collection('furniture').doc(furnitureId).get();
    if (!furnitureDoc.exists) {
      return res.status(404).json({ error: 'Furniture not found' });
    }
    
    const furnitureData = furnitureDoc.data();
    
    // Reference to the user's cart document
    const userCartRef = db.collection('carts').doc(userId);
    
    // Use a transaction to safely update the cart
    await db.runTransaction(async (transaction) => {
      const cartDoc = await transaction.get(userCartRef);
      
      let cartItems = [];
      if (cartDoc.exists) {
        cartItems = cartDoc.data().items || [];
      }
      
      // Check if the item with the same furnitureId and textureUrl already exists
      const existingItemIndex = cartItems.findIndex(item => 
        item.furnitureId === furnitureId && 
        (item.textureUrl === textureUrl || (!item.textureUrl && !textureUrl))
      );
      
      if (existingItemIndex >= 0) {
        // Update quantity if item exists
        cartItems[existingItemIndex].quantity += quantity;
      } else {
        // Add new item with full furniture details, ensuring no undefined values
        const cartItem = {
          furnitureId,
          quantity,
          textureUrl: textureUrl || null, // Use null instead of undefined
          dateAdded: new Date().toISOString(),
          // Store full furniture details with null fallbacks for any undefined values
          name: furnitureData.name || "",
          price: furnitureData.price || 0,
          category: furnitureData.category || "",
          dimensions: {
            height: furnitureData.height || 0,
            width: furnitureData.width || 0,
            length: furnitureData.length || 0
          },
          wallMountable: furnitureData.wallMountable || false,
          // Only store the URL, not the actual file
          modelEndpoint: furnitureData.modelEndpoint || null,
          // Preserve the original texture URL list
          availableTextures: furnitureData.textureUrls || []
        };
        
        cartItems.push(cartItem);
      }
      
      // Set or update the cart document
      transaction.set(userCartRef, { 
        items: cartItems,
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    });
    
    // Return success
    res.status(200).json({ 
      message: 'Item added to cart successfully',
      furnitureId,
      textureUrl: textureUrl || null
    });
    
  } catch (err) {
    console.error('Error adding item to cart:', err);
    res.status(500).json({ 
      error: 'Failed to add item to cart', 
      details: err.message 
    });
  }
});

// API endpoint to retrieve the cart
app.get('/api/cart', authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.uid || req.user?.sub;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated or user ID not found' });
    }
    
    const cartDoc = await db.collection('carts').doc(userId).get();
    if (!cartDoc.exists) {
      return res.status(200).json({ items: [] });
    }
    
    res.status(200).json(cartDoc.data());
    
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).json({ 
      error: 'Failed to fetch cart', 
      details: err.message 
    });
  }
});

// Start the server in development mode
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
  console.log(`Server is running at http://localhost:${PORT}`);
});

