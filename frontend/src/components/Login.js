// src/components/Login.js

import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';

function Login({ onLogin, onGoToSignUp }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLoginClick = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      const response = await axios.post('http://34.31.85.242/api/login_user.php', {
        email,
        password,
      });

      if (response.data && response.data.success) {
        setError('');
        // Call onLogin with the user data so the parent can navigate
        onLogin(response.data.user);
      } else {
        // Either a known error message from the server or a generic one
        setError(response.data.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      // This only triggers if there's a network or server issue at the HTTP level
      setError('Server error. Please try again later.');
    }
  };

  return (
    <div className="login-container">
      <h2>Login to StudentSphere</h2>
      <form onSubmit={handleLoginClick}>
        <label htmlFor="email">Email:</label>
        <input
          type="email"
          name="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password">Password:</label>
        <input
          type="password"
          name="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="error-message">{error}</p>}

        <button type="submit">Login</button>
      </form>

      <div className="not-a-member">
        Not a Member? <span className="sign-up-link" onClick={onGoToSignUp}>Sign Up</span>
      </div>
    </div>
  );
}

export default Login;
