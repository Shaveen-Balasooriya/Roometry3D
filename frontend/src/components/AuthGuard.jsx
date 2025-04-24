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
        const role = await getUserRole();
        setUserRole(role);
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

  // If no specific roles are required or user's role is in allowed roles
  if (allowedRoles.length === 0 || allowedRoles.includes(userRole)) {
    return <Outlet />;
  }

  // User doesn't have the required role
  return <Navigate to="/unauthorized" replace />;
}