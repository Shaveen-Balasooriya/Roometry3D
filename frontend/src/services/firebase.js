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
import { getFirestore, doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
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
const API_URL = import.meta.env.VITE_BACKEND_URL;
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
  
  try {
    // First, try to get role from custom claims
    const tokenResult = await user.getIdTokenResult();
    const claimsRole = tokenResult.claims.role;
    
    if (claimsRole) {
      return claimsRole;
    }
    
    // If no role in claims, try to get from Firestore
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.userType || userData.role;
    }
    
    // If we still don't have a role, try to get from token/backend
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('${API_URL}/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        return userData.role || userData.userType;
      }
    } catch (e) {
      console.error("Error fetching user role from backend:", e);
    }
    
    return null;
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
};

// Auth state observer
export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

export { app, auth, db, storage };