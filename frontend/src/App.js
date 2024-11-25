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
  const context = useContext(AuthContext);

  // Ensure the context is defined
  if (!context) {
    return <div>Error: AuthContext is not available.</div>;
  }

  const { user, loading } = context;

  if (loading) {
    return <div>Loading...</div>; // Replace with a spinner or loading component
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
        <Route path="/" element={user ? <Home /> : <Navigate to="/login" replace />} />
        <Route path="/profile" element={user ? <ProfileView /> : <Navigate to="/login" replace />} />
        <Route path="/profile/edit" element={user ? <ProfileEdit /> : <Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

export default App;
