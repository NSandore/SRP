// src/contexts/AuthContext.js

import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api'; // Updated import

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      api.get('/user')
        .then(response => {
          setUser(response.data);
          setLoading(false);
        })
        .catch(error => {
          console.error('Error fetching user:', error);
          setUser(null);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const response = await api.post('/login', { email, password });
    setUser(response.data.user);
    localStorage.setItem('token', response.data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
  };

  const register = async (name, email, password, password_confirmation) => {
    const response = await api.post('/register', { name, email, password, password_confirmation });
    setUser(response.data.user);
    localStorage.setItem('token', response.data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
  };

  const logout = async () => {
    await api.post('/logout');
    setUser(null);
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
