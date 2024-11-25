// src/services/api.js

import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api', // Update if your backend is hosted elsewhere
  withCredentials: true, // Important for sending cookies and auth headers
});

// Optionally, you can set up interceptors for handling responses or errors globally
api.interceptors.response.use(
  response => response,
  error => {
    // Handle errors globally
    return Promise.reject(error);
  }
);

export default api;
