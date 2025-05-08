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


// --- Replace Firebase client SDK with Admin SDK ---
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET, // e.g. 'your-bucket.appspot.com'
  });
}
const db = admin.firestore();
const bucket = admin.storage().bucket();
// --- End Admin SDK setup ---

// Authentication Middleware
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

// Verify a user's authentication status and get profile
app.get('/api/auth/verify', authenticateUser, async (req, res) => {
  try {
    const uid = req.user.uid;
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ message: 'User profile not found' });
    }
    
    const userData = userDoc.data();
    
    res.json({
      authenticated: true,
      uid: uid,
      email: req.user.email,
      role: req.user.role || null,
      name: userData.name,
      userType: userData.userType,
      lastLogin: userData.lastLogin ? userData.lastLogin.toDate() : null
    });
    
    // Update last login time
    await userDoc.ref.update({
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error verifying authentication:', error);
    res.status(500).json({ message: 'Failed to verify authentication' });
  }
});

// Self-register endpoint (no auth required)
app.post('/api/auth/register', async (req, res) => {
  console.log('Received self-registration request:', req.body);
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check if user already exists
    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      if (userRecord) {
        return res.status(400).json({ message: 'Email is already in use' });
      }
    } catch (error) {
      // Error code auth/user-not-found means we can proceed with creation
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Create the user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name,
      emailVerified: false
    });

    console.log('User created in Firebase Auth:', userRecord.uid);

    // Set custom claims for role-based access (default to client)
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: 'client'
    });

    // Store additional user data in Firestore
    const userDocRef = db.collection('users').doc(userRecord.uid);
    await userDocRef.set({
      name: name,
      email: email,
      userType: 'client',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null
    });

    console.log('User document created in Firestore');
    
    // Send verification email
    const verificationLink = await admin.auth().generateEmailVerificationLink(email);
    
    // Return success response with user data (excluding sensitive info)
    res.status(201).json({
      message: 'User registered successfully. Please verify your email.',
      user: {
        id: userRecord.uid,
        name,
        email,
        userType: 'client',
        createdAt: new Date()
      }
    });
  } catch (err) {
    console.error('Detailed error registering user:', JSON.stringify(err, null, 2));
    
    if (err.code === 'auth/email-already-exists') {
      return res.status(400).json({ message: 'Email already in use' });
    } else if (err.code === 'auth/invalid-email') {
      return res.status(400).json({ message: 'Invalid email format' });
    } else if (err.code === 'auth/weak-password') {
      return res.status(400).json({ message: 'Password is too weak' });
    }
    
    res.status(500).json({ message: 'Failed to register user', details: err.message });
  }
});

// Change a user's role (admin only)
app.put('/api/users/:id/role', authenticateUser, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!role || !['admin', 'designer', 'client'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }
    
    // Update role in custom claims
    await admin.auth().setCustomUserClaims(id, { role });
    
    // Update role in Firestore
    await db.collection('users').doc(id).update({
      userType: role
    });
    
    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
});

// Reset a user's password (admin only)
app.post('/api/users/:id/reset-password', authenticateUser, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { temporaryPassword } = req.body;
    
    if (!temporaryPassword || temporaryPassword.length < 6) {
      return res.status(400).json({ message: 'Invalid temporary password' });
    }
    
    // Update user's password
    await admin.auth().updateUser(id, {
      password: temporaryPassword
    });
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

// Apply authentication middleware to sensitive routes
app.use('/api/furniture', authenticateUser);
app.use('/api/users', authenticateUser);
app.use('/api/projects', authenticateUser);
app.use('/api/count',authenticateUser);
app.use('/api/cart',authenticateUser);

// User self-service profile endpoints
app.post('/api/user/change-password', authenticateUser, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }
    
    // Verify current password by attempting to get a new ID token
    try {
      // We can't directly verify the password on the backend, so we'll rely on Firebase Auth rules
      // to prevent changing password unless the user is properly authenticated
      await admin.auth().updateUser(uid, { password: newPassword });
      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/requires-recent-login') {
        return res.status(403).json({ 
          message: 'This operation requires recent authentication. Please log in again before retrying.',
          requiresReauth: true
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ message: 'Failed to change password', details: error.message });
  }
});

app.put('/api/user/profile', authenticateUser, async (req, res) => {
  try {
    const uid = req.user.uid;
    const { name, photoURL } = req.body;
    
    const updates = {};
    const authUpdates = {};
    
    if (name) {
      updates.name = name;
      authUpdates.displayName = name;
    }
    
    if (photoURL) {
      updates.photoURL = photoURL;
      authUpdates.photoURL = photoURL;
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update' });
    }
    
    // Update in Firebase Auth
    if (Object.keys(authUpdates).length > 0) {
      await admin.auth().updateUser(uid, authUpdates);
    }
    
    // Update in Firestore
    const userDocRef = db.collection('users').doc(uid);
    await userDocRef.update({
      ...updates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ 
      message: 'Profile updated successfully',
      user: {
        uid,
        ...updates
      }
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Failed to update profile', details: error.message });
  }
});

// Apply role-based access control to admin routes
app.post('/api/furniture', requireRole(['admin']));
app.put('/api/furniture/:id', requireRole(['admin', 'designer']));
app.delete('/api/furniture/:id', requireRole(['admin']));
app.post('/api/users', requireRole(['admin']));
app.delete('/api/users/:id', requireRole(['admin']));
app.get('/api/count/designers', requireRole(['admin']));
app.get('/api/count/todayProjects',requireRole(['admin']));
app.get('/api/count/totalProjcts',requireRole(['admin']));
app.post('/api/cart/add',requireRole(['client','designer']))
app.get('api/cart',requireRole(['client','designer']))
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

// Multer setup for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/furniture', upload.fields([
  { name: 'objFile', maxCount: 1 },
  { name: 'textures', maxCount: 10 }
]), async (req, res) => {
  console.log('Received /api/furniture POST request'); // Log request received
  console.log('Request Body:', req.body); // Log text fields
  console.log('Request Files:', req.files); // Log file info

  try {
    const { name, category, description, price, quantity, height, width, length, wallMountable } = req.body;
    if (!name || !category || !description || !price || !quantity || !height || !width || !length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!req.files || !req.files.objFile || req.files.objFile.length === 0) {
      return res.status(400).json({ error: 'OBJ file is required' });
    }

    console.log('Validation passed. Starting file uploads...');

    // --- Upload OBJ file to Firebase Storage using Admin SDK ---
    const objFile = req.files.objFile[0];
    const objFileName = `furniture/models/${uuidv4()}_${objFile.originalname}`;
    const objFileUpload = bucket.file(objFileName);
    await objFileUpload.save(objFile.buffer, { contentType: objFile.mimetype });
    const [objFileUrl] = await objFileUpload.getSignedUrl({
      action: 'read',
      expires: '03-01-2030', // Set a far future expiration or use your own logic
    });
    console.log(`OBJ uploaded successfully: ${objFileUrl}`);
    // --- End OBJ upload ---

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
  { name: 'objFile', maxCount: 1 },
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

    if (req.files && req.files.objFile && req.files.objFile.length > 0) {
      console.log('New OBJ file provided. Uploading...');
      const objFile = req.files.objFile[0];
      const objFileName = `furniture/models/${uuidv4()}_${objFile.originalname}`;
      const objFileUpload = bucket.file(objFileName);
      await objFileUpload.save(objFile.buffer, { contentType: objFile.mimetype });
      const [signedUrl] = await objFileUpload.getSignedUrl({ action: 'read', expires: '03-01-2030' });
      newObjFileUrl = signedUrl;
      console.log(`New OBJ uploaded: ${newObjFileUrl}`);

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

app.put('/api/furniture/:id/textures', upload.array('textures', 10), async (req, res) => {
  const { id } = req.params;
  console.log(`Received PUT request to add textures for furniture ID: ${id}`);

  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No texture files provided' });
    }

    const docRef = db.collection('furniture').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Furniture item not found' });
    }

    const existingData = doc.data();
    const existingTextures = existingData.textureUrls || [];

    // Upload new textures
    const newTextureUrls = [];
    for (const texture of req.files) {
      const textureName = `furniture/textures/${uuidv4()}_${texture.originalname}`;
      const textureUpload = bucket.file(textureName);
      await textureUpload.save(texture.buffer, { contentType: texture.mimetype });
      const [signedUrl] = await textureUpload.getSignedUrl({ 
        action: 'read', 
        expires: '03-01-2030' 
      });
      newTextureUrls.push(signedUrl);
      console.log(`New texture uploaded: ${signedUrl}`);
    }

    // Combine existing and new textures
    const updatedTextures = [...existingTextures, ...newTextureUrls];
    
    // Update Firestore
    await docRef.update({
      textureUrls: updatedTextures,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ 
      success: true,
      newTextureUrls,
      textureUrls: updatedTextures
    });

  } catch (err) {
    console.error(`Error adding textures to furniture item ${id}:`, err);
    res.status(500).json({ 
      message: 'Failed to add textures', 
      details: err.message 
    });
  }
});

app.delete('/api/furniture/:id/textures/delete', async (req, res) => {
  const { id } = req.params;
  const { textureUrl } = req.body;
  
  console.log(`Received DELETE request for texture on furniture ID: ${id}`);
  
  if (!textureUrl) {
    return res.status(400).json({ message: 'No texture URL provided' });
  }
  
  try {
    // Get the furniture document
    const docRef = db.collection('furniture').doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ message: 'Furniture item not found' });
    }
    
    const furnitureData = doc.data();
    const existingTextures = furnitureData.textureUrls || [];
    
    // Check if the URL exists in the textures array
    if (!existingTextures.includes(textureUrl)) {
      return res.status(404).json({ message: 'Texture not found on this furniture item' });
    }
    
    // Check that we won't delete the last texture
    if (existingTextures.length <= 1) {
      return res.status(400).json({ message: 'Cannot delete the last texture. At least one texture is required.' });
    }
    
    // Extract the filename from the URL to delete from storage
    // The URL format from your example looks like:
    // https://storage.googleapis.com/roometry-3d.firebasestorage.app/furniture/textures/{uuid}_{filename}
    const textureFilePath = textureUrl.split('?')[0].split('/furniture/textures/')[1];
    
    if (textureFilePath) {
      try {
        // Delete the file from storage
        const fileRef = bucket.file(`furniture/textures/${textureFilePath}`);
        await fileRef.delete();
        console.log(`Deleted texture file: ${textureFilePath}`);
      } catch (err) {
        console.warn(`Unable to delete texture file from storage: ${err.message}`);
        // Continue even if file delete fails, as we still want to update the database
      }
    }
    
    // Update the document by removing the texture URL
    const updatedTextures = existingTextures.filter(url => url !== textureUrl);
    
    await docRef.update({
      textureUrls: updatedTextures,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.status(200).json({
      success: true,
      message: 'Texture deleted successfully',
      textureUrls: updatedTextures
    });
    
  } catch (err) {
    console.error(`Error deleting texture from furniture item ${id}:`, err);
    res.status(500).json({
      message: 'Failed to delete texture',
      details: err.message
    });
  }
});

// app.get('/api/furniture', async (req, res) => {
//   try {
//     const furnitureCol = db.collection('furniture');
//     const snapshot = await furnitureCol.get();
//     const items = snapshot.docs.map(doc => {
//       const data = doc.data();
//       const { objFileUrl, ...rest } = data;
//       return {
//         id: doc.id,
//         ...rest,
//         modelEndpoint: `/api/furniture/${doc.id}/model`
//       };
//     });
//     res.json(items);
//   } catch (err) {
//     console.error('Error fetching furniture:', err);
//     res.status(500).json({ error: 'Failed to fetch furniture', details: err.message });
//   }
// });

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

// Update existing user creation endpoint
app.post('/api/users', async (req, res) => {
  console.log('Received user creation request:', req.body);
  try {
    const { name, email, password, userType } = req.body;
    
    if (!name || !email || !password || !userType) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate userType
    if (!['admin', 'client', 'designer'].includes(userType)) {
      return res.status(400).json({ message: 'Invalid user type' });
    }

    // Create the user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: name,
    });

    console.log('User created in Firebase Auth:', userRecord.uid);

    // Set custom claims for role-based access
    await admin.auth().setCustomUserClaims(userRecord.uid, {
      role: userType
    });

    // Store additional user data in Firestore
    const userDocRef = db.collection('users').doc(userRecord.uid);
    await userDocRef.set({
      name: name,
      email: email,
      userType: userType,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null
    });

    console.log('User document created in Firestore');
    
    // Return success response with user data
    res.status(201).json({
      id: userRecord.uid,
      name,
      email,
      userType,
      createdAt: new Date()
    });
  } catch (err) {
    // Error handling code remains the same
    console.error('Detailed error creating user:', JSON.stringify(err, null, 2));
    
    if (err.code === 'auth/email-already-exists') {
      return res.status(400).json({ message: 'Email already in use' });
    } else if (err.code === 'auth/invalid-email') {
      return res.status(400).json({ message: 'Invalid email format' });
    } else if (err.code === 'auth/weak-password') {
      return res.status(400).json({ message: 'Password is too weak' });
    }
    
    res.status(500).json({ message: 'Failed to create user', details: err.message });
  }
});

// Get all users (for dashboard)
app.get('/api/users', async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        email: data.email,
        userType: data.userType,
        createdAt: data.createdAt || null,
      };
    });
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// Get a single user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }
    const data = doc.data();
    res.json({
      id: doc.id,
      name: data.name,
      email: data.email,
      userType: data.userType,
      createdAt: data.createdAt || null,
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ message: 'Failed to fetch user', details: err.message });
  }
});

// Update user by ID (name and/or password)
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { name, password } = req.body;
  try {
    const docRef = db.collection('users').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'User not found' });
    }
    // Update displayName in Firebase Auth if name is changed
    if (name) {
      await admin.auth().updateUser(id, { displayName: name });
      await docRef.update({ name });
    }
    // Only update password if provided
    if (password && password.length >= 6) {
      await admin.auth().updateUser(id, { password });
    }
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ message: 'Failed to update user', details: err.message });
  }
});

// Delete a user by ID
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Delete from Firebase Auth
    await admin.auth().deleteUser(id).catch(() => { /* If not found in Auth, ignore */ });
    // Delete from Firestore
    await db.collection('users').doc(id).delete();
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ message: 'Failed to delete user', details: err.message });
  }
});

// Set up multer for file uploads
b04c8b1fd3742cf66345746dc51d72adc2cc907e
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


