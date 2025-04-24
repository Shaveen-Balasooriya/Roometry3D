import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  sendEmailVerification
} from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBEsaFwwnOvOf1JGmnHdinQTq6xL_oreKk",
  authDomain: "roometry-3d.firebaseapp.com",
  projectId: "roometry-3d",
  storageBucket: "roometry-3d.firebasestorage.app",
  messagingSenderId: "884691030201",
  appId: "1:884691030201:web:2af08ff0d592557f890b68",
  measurementId: "G-XERC9K8ELR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Authentication functions
export const loginUser = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const registerUser = async (email, password, displayName) => {
  try {
    // Create the user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update the user's profile with displayName
    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }
    
    // Send email verification
    await sendEmailVerification(userCredential.user);
    
    // Store additional user data in Firestore with default 'client' role
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      name: displayName || '',
      email: email,
      userType: 'client', // Default role for self-registered users
      createdAt: serverTimestamp(),
      lastLogin: null
    });
    
    // Note: Admin role assignment will need to be done through the backend
    // by an existing admin user, as it requires custom claims
    
    return userCredential;
  } catch (error) {
    console.error("Error registering user:", error);
    throw error;
  }
};

export const resetPassword = (email) => {
  return sendPasswordResetEmail(auth, email);
};

export const logoutUser = () => {
  return signOut(auth);
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

export const getUserRole = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  
  // Get ID token result which includes custom claims
  const tokenResult = await user.getIdTokenResult();
  return tokenResult.claims.role || null;
};

// Auth state observer
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export { app, auth, db, storage };