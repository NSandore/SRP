import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000/api', // Update if your API is hosted elsewhere
  withCredentials: true, // Necessary if using cookies for authentication (e.g., Laravel Sanctum)
});

export default api;
