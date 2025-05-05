require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Load CORS configuration from file
const corsConfig = require('./cors-config.json');

// Apply CORS configuration
app.use(cors({
  origin: corsConfig[0].origin,
  methods: corsConfig[0].methods,
  allowedHeaders: corsConfig[0].allowedHeaders,
  credentials: corsConfig[0].credentials,
  maxAge: corsConfig[0].maxAge
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
const storage = multer.memoryStorage();
const uploadProject = multer({ storage });

// Create a new project
app.post('/api/projects', uploadProject.single('objFile'), async (req, res) => {
  try {
    const { name, description, clientId, designerId, status = 'draft' } = req.body;
    
    if (!name || !description || !clientId || !designerId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Create project document in Firestore
    const projectRef = db.collection('projects').doc();
    const projectId = projectRef.id;
    
    let objFileUrl = null;
    
    // Handle OBJ file upload if present
    if (req.file) {
      const objFileName = `projects/${projectId}/model.obj`;
      const objFileUpload = bucket.file(objFileName);
      
      await objFileUpload.save(req.file.buffer, {
        metadata: {
          contentType: 'application/octet-stream',
        }
      });
      
      // Get signed URL for the file (valid for 7 days)
      const [url] = await objFileUpload.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      
      objFileUrl = url;
    }
    
    // Store project data
    await projectRef.set({
      name,
      description,
      clientId,
      designerId,
      status,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      objFileUrl
    });
    
    // Add project reference to client's projects
    const clientProjectRef = db.collection('user_projects').doc(clientId);
    await clientProjectRef.set({
      projects: admin.firestore.FieldValue.arrayUnion(projectId)
    }, { merge: true });
    
    // Add project reference to designer's projects
    const designerProjectRef = db.collection('user_projects').doc(designerId);
    await designerProjectRef.set({
      projects: admin.firestore.FieldValue.arrayUnion(projectId)
    }, { merge: true });
    
    res.status(201).json({
      id: projectId,
      name,
      description,
      clientId,
      designerId,
      status,
      objFileUrl,
      createdAt: new Date()
    });
  } catch (err) {
    console.error('Error creating project:', err);
    res.status(500).json({ message: 'Failed to create project', details: err.message });
  }
});

// Get all projects for a user
app.get('/api/users/:userId/projects', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user's project references
    const userProjectsDoc = await db.collection('user_projects').doc(userId).get();
    
    if (!userProjectsDoc.exists || !userProjectsDoc.data().projects) {
      return res.json([]);
    }
    
    const projectIds = userProjectsDoc.data().projects;
    
    // Get full project details
    const projectPromises = projectIds.map(async (projectId) => {
      const projectDoc = await db.collection('projects').doc(projectId).get();
      if (!projectDoc.exists) return null;
      
      const projectData = projectDoc.data();
      return {
        id: projectDoc.id,
        ...projectData,
        createdAt: projectData.createdAt?.toDate(),
        updatedAt: projectData.updatedAt?.toDate()
      };
    });
    
    const projects = (await Promise.all(projectPromises)).filter(Boolean);
    
    res.json(projects);
  } catch (err) {
    console.error('Error fetching user projects:', err);
    res.status(500).json({ message: 'Failed to fetch projects', details: err.message });
  }
});

// Get project by ID
app.get('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const doc = await db.collection('projects').doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    const projectData = doc.data();
    
    res.json({
      id: doc.id,
      ...projectData,
      createdAt: projectData.createdAt?.toDate(),
      updatedAt: projectData.updatedAt?.toDate()
    });
  } catch (err) {
    console.error('Error fetching project:', err);
    res.status(500).json({ message: 'Failed to fetch project', details: err.message });
  }
});

// Update a project
app.put('/api/projects/:id', uploadProject.single('objFile'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status } = req.body;
    
    const projectRef = db.collection('projects').doc(id);
    const doc = await projectRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    const updateData = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (status) updateData.status = status;
    
    // Handle OBJ file update if present
    if (req.file) {
      const objFileName = `projects/${id}/model.obj`;
      const objFileUpload = bucket.file(objFileName);
      
      await objFileUpload.save(req.file.buffer, {
        metadata: {
          contentType: 'application/octet-stream',
        }
      });
      
      // Get signed URL for the file (valid for 7 days)
      const [url] = await objFileUpload.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      
      updateData.objFileUrl = url;
    }
    
    await projectRef.update(updateData);
    
    res.json({ message: 'Project updated successfully' });
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ message: 'Failed to update project', details: err.message });
  }
});

// Delete a project
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if project exists
    const projectRef = db.collection('projects').doc(id);
    const doc = await projectRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    // Get project data
    const projectData = doc.data();
    
    // Remove from user_projects collections
    if (projectData.clientId) {
      await db.collection('user_projects').doc(projectData.clientId).update({
        projects: admin.firestore.FieldValue.arrayRemove(id)
      });
    }
    
    if (projectData.designerId) {
      await db.collection('user_projects').doc(projectData.designerId).update({
        projects: admin.firestore.FieldValue.arrayRemove(id)
      });
    }
    
    // Delete 3D model file if exists
    if (projectData.objFileUrl) {
      try {
        const objFileName = `projects/${id}/model.obj`;
        await bucket.file(objFileName).delete();
      } catch (fileErr) {
        console.error('Error deleting project file:', fileErr);
        // Continue with deletion even if file delete fails
      }
    }
    
    // Delete project document
    await projectRef.delete();
    
    res.json({ message: 'Project deleted successfully' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ message: 'Failed to delete project', details: err.message });
  }
});

// Project model endpoint - serve the 3D model file
app.get('/api/projects/:projectId/model', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.uid;
    const projectId = req.params.projectId;
    
    // Get project data to verify access
    const projectDoc = await db.collection('projects').doc(projectId).get();
    
    if (!projectDoc.exists) {
      return res.status(404).json({ message: 'Project not found' });
    }
    
    const projectData = projectDoc.data();
    
    // Check if user has access to this project
    const userRole = req.user.role;
    const isAdmin = userRole === 'admin';
    const isDesigner = userRole === 'designer' && projectData.designerId === userId;
    const isClient = userRole === 'client' && projectData.clientId === userId;
    
    if (!isAdmin && !isDesigner && !isClient) {
      return res.status(403).json({ message: 'Access denied to this project' });
    }
    
    // Get the model file from Firebase Storage
    const file = bucket.file(`projects/${projectId}/model.obj`);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ message: 'Model file not found' });
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Stream the file
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="model-${projectId}.obj"`);
    
    file.createReadStream()
      .on('error', (error) => {
        console.error('Error streaming model file:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error streaming model file' });
        }
      })
      .pipe(res);
    
  } catch (error) {
    console.error('Error serving model file:', error);
    res.status(500).json({ message: 'Failed to retrieve model file', details: error.message });
  }
});

// API to get total number of projects
app.get('/api/count/totalProjcts', async (req, res) => {
  try {
    const projectsCol = db.collection('projects');
    const snapshot = await projectsCol.count().get();
    const totalProjects = snapshot.data().count;
    
    res.json({ count: totalProjects });
  } catch (err) {
    console.error('Error fetching total projects count:', err);
    res.status(500).json({ error: 'Failed to fetch projects count', details: err.message });
  }
});

// API to get count of projects added today
app.get('/api/count/todayProjects', async (req, res) => {
  try {
    // Get today's date at midnight (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const projectsCol = db.collection('projects');
    // Query for documents where createdAt is >= today's start
    const snapshot = await projectsCol
      .where('createdAt', '>=', today)
      .get();
    
    res.json({ count: snapshot.size });
  } catch (err) {
    console.error('Error fetching today\'s projects count:', err);
    res.status(500).json({ error: 'Failed to fetch today\'s projects count', details: err.message });
  }
});

// API to get count of designers
app.get('/api/count/designers', async (req, res) => {
  try {
    const usersCol = db.collection('users');
    const snapshot = await usersCol
      .where('userType', '==', 'designer')
      .get();
    
    res.json({ count: snapshot.size });
  } catch (err) {
    console.error('Error fetching designers count:', err);
    res.status(500).json({ error: 'Failed to fetch designers count', details: err.message });
  }
});

if (process.env.NODE_ENV === 'development') {
  // Running locally
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log("Backend listening on port ${PORT}");
  });
} else {
  // Running on Firebase
  exports.api = functions.https.onRequest(app);
}


