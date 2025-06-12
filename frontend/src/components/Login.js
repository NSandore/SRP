// src/components/Login.js

import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';

function Login({ onLogin, onGoToSignUp }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  const handleLoginClick = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      const response = await axios.post('http://172.16.11.133/api/login_user.php', {
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

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!email || !newPassword || !confirmPassword) {
      setResetMessage('Please fill out all fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetMessage('Passwords do not match.');
      return;
    }

    try {
      const response = await axios.post('http://172.16.11.133/api/reset_password.php', {
        email,
        new_password: newPassword,
      });

      if (response.data && response.data.success) {
        setResetMessage('Password updated. You can now log in.');
        setShowReset(false);
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setResetMessage(response.data.error || 'Failed to reset password.');
      }
    } catch (err) {
      setResetMessage('Server error. Please try again later.');
    }
  };

  return (
    <div className="login-container">
      <h2>Login to StudentSphere</h2>
      {showReset ? (
        <form onSubmit={handleResetPassword}>
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            name="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="new-password">New Password:</label>
          <input
            type="password"
            name="new-password"
            id="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />

          <label htmlFor="confirm-password">Confirm Password:</label>
          <input
            type="password"
            name="confirm-password"
            id="confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          {resetMessage && <p className="error-message">{resetMessage}</p>}

          <button type="submit">Reset Password</button>
          <div className="not-a-member">
            Remembered?{' '}
            <span className="sign-up-link" onClick={() => setShowReset(false)}>
              Back to Login
            </span>
          </div>
        </form>
      ) : (
        <>
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
            Not a Member?{' '}
            <span className="sign-up-link" onClick={onGoToSignUp}>
              Sign Up
            </span>
          </div>

          <div className="not-a-member">
            Forgot your password?{' '}
            <span className="sign-up-link" onClick={() => setShowReset(true)}>
              Reset Password
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export default Login;
