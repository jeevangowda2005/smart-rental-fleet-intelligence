import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';

import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { EquipmentPage } from './pages/EquipmentPage';
import { RentalsPage } from './pages/RentalsPage';
import { SitesPage } from './pages/SitesPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { AlertsPage } from './pages/AlertsPage';
import { OperatorView } from './pages/OperatorView';
import { ExecutivePage } from './pages/ExecutivePage';
import { PredictiveMaintenancePage } from './pages/PredictiveMaintenancePage';
import { IncidentCommandPage } from './pages/IncidentCommandPage';
import { BillingPage } from './pages/BillingPage';

const HomeRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'OPERATOR') return <Navigate to="/operator" replace />;
  return <Navigate to="/dashboard" replace />;
};

export const App = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['MANAGER']}>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/incidents"
              element={
                <ProtectedRoute allowedRoles={['MANAGER']}>
                  <IncidentCommandPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/executive"
              element={
                <ProtectedRoute allowedRoles={['MANAGER']}>
                  <ExecutivePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/predictive-maintenance"
              element={
                <ProtectedRoute allowedRoles={['MANAGER']}>
                  <PredictiveMaintenancePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/equipment"
              element={
                <ProtectedRoute allowedRoles={['MANAGER', 'OPERATOR']}>
                  <EquipmentPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/rentals"
              element={
                <ProtectedRoute allowedRoles={['MANAGER', 'OPERATOR']}>
                  <RentalsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/sites"
              element={
                <ProtectedRoute allowedRoles={['MANAGER']}>
                  <SitesPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/maintenance"
              element={
                <ProtectedRoute allowedRoles={['MANAGER']}>
                  <MaintenancePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/alerts"
              element={
                <ProtectedRoute allowedRoles={['MANAGER', 'OPERATOR']}>
                  <AlertsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/billing"
              element={
                <ProtectedRoute allowedRoles={['MANAGER', 'OPERATOR']}>
                  <BillingPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/operator"
              element={
                <ProtectedRoute allowedRoles={['OPERATOR']}>
                  <OperatorView />
                </ProtectedRoute>
              }
            />

            <Route path="/" element={<HomeRedirect />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
