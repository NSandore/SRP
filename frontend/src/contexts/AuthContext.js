import React, { createContext, useState, useEffect } from 'react';

// Create AuthContext
export const AuthContext = createContext();

// Provide AuthContext
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Adjust initial state if needed
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate user authentication data fetch
    const fetchUser = async () => {
      try {
        // Example fetch; replace with your real authentication logic
        const mockUser = { name: 'John Doe', email: 'john@example.com' };
        setUser(mockUser);
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
