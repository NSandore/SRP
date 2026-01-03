// src/components/Login.js

import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';
import { FaCheckCircle } from 'react-icons/fa';

function Login({ onLogin, onGoToSignUp, onContinueAsGuest, variant = 'page' }) {
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
      const response = await axios.post('/api/login_user.php', {
        email,
        password,
      });

      if (response.data && response.data.success) {
        setError('');
        onLogin(response.data.user);
      } else {
        setError(response.data.error || 'Login failed. Please try again.');
      }
    } catch (err) {
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
      const response = await axios.post('/api/reset_password.php', {
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

  const isModal = variant === 'modal';

  return (
    <div className={`auth-welcome ${isModal ? 'auth-welcome--modal' : ''}`}>
      {!isModal && <div className="auth-gradient" aria-hidden />}
      <div className="auth-content">
        <section className="auth-hero">
          <span className="auth-pill">StudentSphere community</span>
          <h1>Unlock scholarships, mentors, and momentum.</h1>
          <p>
            Your personalized home for funding alerts, ambassador insights, threads, and direct
            messaging — tailored for students and counselors growing together.
          </p>
          <ul className="auth-benefits">
            {[
              'Save promising scholarships and revisit them anytime',
              'Chat with mentors, classmates, and admissions coaches',
              'Showcase your story with a profile recruiters love',
            ].map((copy) => (
              <li key={copy}>
                <FaCheckCircle />
                {copy}
              </li>
            ))}
          </ul>
          <button className="auth-secondary" onClick={onGoToSignUp}>
            Create a free account
          </button>
        </section>

        <section className="auth-panel" aria-live="polite">
          <h2>{showReset ? 'Reset your password' : 'Welcome back'}</h2>
          <p>{showReset ? 'Choose a new password to regain access.' : 'Log in to continue your journey.'}</p>

          {showReset ? (
            <form className="auth-form" onSubmit={handleResetPassword}>
              <label htmlFor="reset-email">Email</label>
              <input
                type="email"
                id="reset-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label htmlFor="new-password">New password</label>
              <input
                type="password"
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />

              <label htmlFor="confirm-password">Confirm password</label>
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              {resetMessage && <p className="auth-error">{resetMessage}</p>}

              <button type="submit" className="auth-primary">
                Update password
              </button>
              <button type="button" className="auth-link" onClick={() => setShowReset(false)}>
                Never mind, take me back
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleLoginClick}>
              <label htmlFor="login-email">Email</label>
              <input
                type="email"
                id="login-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <label htmlFor="login-password">Password</label>
              <input
                type="password"
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {error && <p className="auth-error">{error}</p>}

              <button type="submit" className="auth-primary">
                Log in
              </button>
              <div className="auth-link-row">
                <button type="button" className="auth-link" onClick={() => setShowReset(true)}>
                  Forgot password?
                </button>
                <button type="button" className="auth-link" onClick={onGoToSignUp}>
                  Need an account?
                </button>
              </div>
              <button type="button" className="auth-link subtle" onClick={onContinueAsGuest}>
                Continue as guest
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

export default Login;
