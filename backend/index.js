require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
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

app.get('/api/furniture', async (req, res) => {
  try {
    const furnitureCol = db.collection('furniture');
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

// Add this new endpoint for user creation
app.post('/api/users', async (req, res) => {
  console.log('Received user creation request:', req.body);
  try {
    const { name, email, password, userType } = req.body;
    
    if (!name || !email || !password || !userType) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Create the user in Firebase Authentication
    // Passing the plain text password here is correct.
    // Firebase Auth will hash and salt it securely.
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password, // Pass the plain text password directly
      displayName: name,
    });

    console.log('User created in Firebase Auth:', userRecord.uid);

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
    
    // Return success response with user data (excluding password)
    res.status(201).json({
      id: userRecord.uid,
      name,
      email,
      userType,
      createdAt: new Date() // Approximate creation time for response
    });
  } catch (err) {
    // Enhanced error logging: Log the full error object
    console.error('Detailed error creating user:', JSON.stringify(err, null, 2)); 
    
    // Handle Firebase-specific errors
    if (err.code === 'auth/email-already-exists') {
      return res.status(400).json({ message: 'Email already in use' });
    } else if (err.code === 'auth/invalid-email') {
      return res.status(400).json({ message: 'Invalid email format' });
    } else if (err.code === 'auth/weak-password') {
      return res.status(400).json({ message: 'Password is too weak' });
    }
    
    // Generic 500 error for other issues
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
