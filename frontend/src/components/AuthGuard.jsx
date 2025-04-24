import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { onAuthChange, getUserRole } from '../services/firebase';
import Loading from './Loading';

export default function AuthGuard({ allowedRoles = [] }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (authUser) => {
      if (authUser) {
        setUser(authUser);
        try {
          // Get user role from custom claims
          const role = await getUserRole();
          console.log("User role from claims:", role);
          setUserRole(role);
          
          // If role is not found in claims, fetch from Firestore
          if (!role) {
            // Fetch the user's role from the backend
            const idToken = await authUser.getIdToken();
            const response = await fetch('http://localhost:3001/api/auth/verify', {
              headers: {
                'Authorization': `Bearer ${idToken}`
              }
            });
            
            if (response.ok) {
              const userData = await response.json();
              console.log("User data from API:", userData);
              // Use either role or userType, depending on what's available
              setUserRole(userData.role || userData.userType);
            }
          }
        } catch (error) {
          console.error("Error getting user role:", error);
        }
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="loading-container"><Loading size={40} /></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If no specific roles are required, allow access
  if (allowedRoles.length === 0) {
    return <Outlet />;
  }
  
  // For debugging
  console.log("Required roles:", allowedRoles, "User role:", userRole);
  
  // Check if user's role is in allowed roles
  if (userRole && allowedRoles.includes(userRole.toLowerCase())) {
    return <Outlet />;
  }

  // User doesn't have the required role
  return <Navigate to="/unauthorized" replace />;
}