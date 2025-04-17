require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const { v4: uuidv4 } = require('uuid'); // Import uuid

const app = express();
app.use(cors());
app.use(express.json());

// Firebase config from .env
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET, // Use VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
let firebaseApp;
if (!getApps().length) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0]; // Use the existing app
}
const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

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

    // Upload OBJ file to Firebase Storage
    const objFile = req.files.objFile[0];
    const objFileName = `furniture/models/${uuidv4()}_${objFile.originalname}`; // <-- changed to models subfolder
    const objFileRef = ref(storage, objFileName);
    console.log(`Uploading OBJ to: ${objFileName}`);
    await uploadBytes(objFileRef, objFile.buffer, { contentType: objFile.mimetype });
    const objFileUrl = await getDownloadURL(objFileRef);
    console.log(`OBJ uploaded successfully: ${objFileUrl}`);

    // Upload texture files (if any)
    let textureUrls = [];
    if (req.files.textures && req.files.textures.length > 0) {
      console.log(`Uploading ${req.files.textures.length} textures...`);
      for (const texture of req.files.textures) {
        const textureName = `furniture/textures/${uuidv4()}_${texture.originalname}`; // Use uuid
        const textureRef = ref(storage, textureName);
        console.log(`Uploading texture to: ${textureName}`);
        await uploadBytes(textureRef, texture.buffer, { contentType: texture.mimetype });
        const textureUrl = await getDownloadURL(textureRef);
        textureUrls.push(textureUrl);
        console.log(`Texture uploaded successfully: ${textureUrl}`);
      }
    } else {
      console.log('No textures to upload.');
    }

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
      createdAt: serverTimestamp() // Use server timestamp
    };
    console.log('Saving data to Firestore:', furnitureData);
    const docRef = await addDoc(collection(db, 'furniture'), furnitureData);
    console.log(`Data saved to Firestore with ID: ${docRef.id}`);

    res.status(201).json({ id: docRef.id, ...furnitureData, createdAt: new Date() }); // Return approximate creation time
  } catch (err) {
    console.error('Error processing /api/furniture:', err); // Log the full error on the backend
    res.status(500).json({ error: 'Failed to add furniture', details: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
