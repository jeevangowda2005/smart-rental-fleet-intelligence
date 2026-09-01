import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from './StateViews';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner label="Authenticating user session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect operators attempting to access manager-only views to their assigned machine page
    if (user.role === 'OPERATOR') {
      return <Navigate to="/operator" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
