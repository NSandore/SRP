// src/App.js

import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import ProfileView from './pages/ProfileView';
import ProfileEdit from './pages/ProfileEdit';
import { AuthContext } from './contexts/AuthContext';

const App = () => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div>Loading...</div>; // You can replace this with a spinner or loader component
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />

        {/* Protected Routes */}
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" replace />} />
        <Route path="/profile" element={user ? <ProfileView /> : <Navigate to="/login" replace />} />
        <Route path="/profile/edit" element={user ? <ProfileEdit /> : <Navigate to="/login" replace />} />

        {/* Catch-All Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
