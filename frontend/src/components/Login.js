// src/components/Login.js

import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';
import { FaCheckCircle } from 'react-icons/fa';
import { getPasswordLengthError } from '../utils/passwordValidation';

function Login({ onLogin, onGoToSignUp, onContinueAsGuest, variant = 'page' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [resetPasswordFeedback, setResetPasswordFeedback] = useState({ field: '', message: '', nonce: 0 });
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorMessage, setTwoFactorMessage] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const [isHandlingDeletion, setIsHandlingDeletion] = useState(false);
  const [deletionMessage, setDeletionMessage] = useState('');
  const [forceDeleteConfirmation, setForceDeleteConfirmation] = useState('');

  const handleLoginClick = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      const response = await axios.post(
        '/api/login_user.php',
        {
          email,
          password,
        },
        { withCredentials: true }
      );

      if (response.data?.requires_two_factor) {
        setRequiresTwoFactor(true);
        setTwoFactorMessage(response.data.message || 'Enter the verification code sent to your email.');
        setTwoFactorError('');
        setError('');
        return;
      }

      if (response.data && response.data.success) {
        setError('');
        onLogin(response.data.user);
      } else {
        setError(response.data.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      const payload = err?.response?.data;
      if (payload?.code === 'account_pending_deletion') {
        setPendingDeletion(payload.deletion || {});
        setForceDeleteConfirmation('');
        setDeletionMessage('');
        setError('');
        return;
      }
      if (payload?.requires_two_factor) {
        setRequiresTwoFactor(true);
        setTwoFactorMessage(payload.message || 'Enter the verification code sent to your email.');
        setTwoFactorError('');
        setError('');
        return;
      }
      setError(payload?.error || 'Server error. Please try again later.');
    }
  };

  const handlePendingAccount = async (action) => {
    if (isHandlingDeletion) return;
    setIsHandlingDeletion(true);
    setDeletionMessage('');
    try {
      const response = await axios.post('/api/account_lifecycle.php', {
        action,
        email: email.trim(),
        password,
        confirmation: action === 'force_delete' ? forceDeleteConfirmation : '',
      }, { withCredentials: true });
      setPendingDeletion(null);
      setPassword('');
      setForceDeleteConfirmation('');
      setDeletionMessage(response.data?.message || (action === 'recover' ? 'Account restored. Sign in to continue.' : 'Account permanently deleted.'));
    } catch (requestError) {
      setDeletionMessage(requestError?.response?.data?.error || 'Unable to complete the account request.');
    } finally {
      setIsHandlingDeletion(false);
    }
  };

  const handleVerifyTwoFactor = async (e) => {
    e.preventDefault();
    if (!twoFactorCode.trim()) {
      setTwoFactorError('Enter the 6-digit code.');
      return;
    }
    try {
      const response = await axios.post(
        '/api/verify_two_factor.php',
        {
          code: twoFactorCode.trim(),
          remember_device: rememberDevice,
        },
        { withCredentials: true }
      );
      if (response.data?.success) {
        setTwoFactorError('');
        setTwoFactorMessage('');
        onLogin(response.data.user);
      } else {
        setTwoFactorError(response.data?.error || 'Invalid code. Please try again.');
      }
    } catch (err) {
      setTwoFactorError('Server error. Please try again.');
    }
  };

  // Step 1: request an emailed reset code.
  const handleRequestResetCode = async (e) => {
    e.preventDefault();
    if (!email) {
      setResetMessage('Please enter your email.');
      return;
    }
    try {
      const response = await axios.post('/api/reset_password.php', { email });
      if (response.data && response.data.success) {
        setResetCodeSent(true);
        setResetMessage(response.data.message || 'If that email is registered, a reset code has been sent.');
      } else {
        setResetMessage(response.data?.error || 'Unable to send a reset code.');
      }
    } catch (err) {
      setResetMessage(err.response?.data?.error || 'Server error. Please try again later.');
    }
  };

  // Step 2: submit the code plus the new password.
  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!email || !resetCode || !newPassword || !confirmPassword) {
      if (!newPassword) {
        setResetPasswordFeedback((current) => ({ field: 'password', message: 'Enter a password with at least 10 characters.', nonce: current.nonce + 1 }));
      } else if (!confirmPassword) {
        setResetPasswordFeedback((current) => ({ field: 'confirm', message: 'Enter the password again.', nonce: current.nonce + 1 }));
      }
      setResetMessage('Please fill out all fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetPasswordFeedback((current) => ({ field: 'confirm', message: 'The passwords do not match.', nonce: current.nonce + 1 }));
      setResetMessage('Passwords do not match.');
      return;
    }

    const passwordLengthError = getPasswordLengthError(newPassword);
    if (passwordLengthError) {
      setResetPasswordFeedback((current) => ({ field: 'password', message: passwordLengthError, nonce: current.nonce + 1 }));
      setResetMessage(passwordLengthError);
      return;
    }
    setResetPasswordFeedback({ field: '', message: '', nonce: 0 });

    try {
      const response = await axios.post('/api/reset_password.php', {
        email,
        code: resetCode.trim(),
        new_password: newPassword,
      });

      if (response.data && response.data.success) {
        setResetMessage('Password updated. You can now log in.');
        setShowReset(false);
        setResetCodeSent(false);
        setResetCode('');
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setResetMessage(response.data.error || 'Failed to reset password.');
      }
    } catch (err) {
      setResetMessage(err.response?.data?.error || 'Server error. Please try again later.');
    }
  };

  const isModal = variant === 'modal';

  return (
    <div className={`auth-welcome ${isModal ? 'auth-welcome--modal' : ''}`}>
      {!isModal && <div className="auth-gradient" aria-hidden />}
      <div className="auth-content">
        <section className="auth-hero">
          <span className="auth-pill">StudentSphere community</span>
          <h1>Learn with people who share your questions.</h1>
          <p>
            Explore community discussions, university spaces, events, and verified perspectives
            from students and representatives.
          </p>
          <ul className="auth-benefits">
            {[
              'Save useful discussions and return to them later',
              'Follow university and interest-based communities',
              'Build a profile and connect through shared interests',
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
            <form className="auth-form" onSubmit={resetCodeSent ? handleResetPassword : handleRequestResetCode} noValidate>
              <label htmlFor="reset-email">Email</label>
              <input
                type="email"
                id="reset-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={resetCodeSent}
                required
              />

              {resetCodeSent && (
                <>
                  <label htmlFor="reset-code">Reset code</label>
                  <p className="auth-helper">Enter the 6-digit code we emailed you.</p>
                  <input
                    type="text"
                    id="reset-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    required
                  />

                  <label htmlFor="new-password">New password</label>
                  <input
                    type="password"
                    id="new-password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (resetPasswordFeedback.field === 'password') setResetPasswordFeedback({ field: '', message: '', nonce: 0 });
                    }}
                    minLength={10}
                    maxLength={72}
                    aria-describedby="reset-password-help"
                    aria-invalid={resetPasswordFeedback.field === 'password'}
                    required
                  />
                  <p key={resetPasswordFeedback.field === 'password' ? resetPasswordFeedback.nonce : 'reset-password-help'} id="reset-password-help" className={`auth-helper auth-requirement${resetPasswordFeedback.field === 'password' ? ' is-invalid' : ''}`} role={resetPasswordFeedback.field === 'password' ? 'alert' : undefined}>{resetPasswordFeedback.field === 'password' ? resetPasswordFeedback.message : 'Use 10–72 characters. A long passphrase works well.'}</p>

                  <label htmlFor="confirm-password">Confirm password</label>
                  <input
                    type="password"
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (resetPasswordFeedback.field === 'confirm') setResetPasswordFeedback({ field: '', message: '', nonce: 0 });
                    }}
                    minLength={10}
                    maxLength={72}
                    aria-describedby={resetPasswordFeedback.field === 'confirm' ? 'reset-confirm-password-help' : undefined}
                    aria-invalid={resetPasswordFeedback.field === 'confirm'}
                    required
                  />
                  {resetPasswordFeedback.field === 'confirm' && <p key={resetPasswordFeedback.nonce} id="reset-confirm-password-help" className="auth-helper auth-requirement is-invalid" role="alert">{resetPasswordFeedback.message}</p>}
                </>
              )}

              {resetMessage && <p className="auth-error">{resetMessage}</p>}

              <button type="submit" className="auth-primary">
                {resetCodeSent ? 'Update password' : 'Send reset code'}
              </button>
              {resetCodeSent && (
                <button
                  type="button"
                  className="auth-link"
                  onClick={handleRequestResetCode}
                >
                  Resend code
                </button>
              )}
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setShowReset(false);
                  setResetCodeSent(false);
                  setResetCode('');
                  setResetMessage('');
                  setResetPasswordFeedback({ field: '', message: '', nonce: 0 });
                }}
              >
                Never mind, take me back
              </button>
            </form>
          ) : pendingDeletion ? (
            <div className="auth-form account-recovery-panel">
              <div className="account-recovery-copy">
                <h3>Account scheduled for deletion</h3>
                <p>Your profile is hidden and your posts appear under “Deleted User.”</p>
                <p><strong>{pendingDeletion.days_remaining || 0} day{Number(pendingDeletion.days_remaining) === 1 ? '' : 's'} remain</strong> before personal account data is permanently removed and this email becomes available again.</p>
              </div>
              {deletionMessage && <p className="auth-error" role="alert">{deletionMessage}</p>}
              <button type="button" className="auth-primary" onClick={() => handlePendingAccount('recover')} disabled={isHandlingDeletion}>{isHandlingDeletion ? 'Working…' : 'Recover my account'}</button>
              <label htmlFor="login-force-delete-confirmation">To permanently delete it now, type <strong>DELETE NOW</strong></label>
              <input id="login-force-delete-confirmation" type="text" autoComplete="off" value={forceDeleteConfirmation} onChange={(event) => setForceDeleteConfirmation(event.target.value)} disabled={isHandlingDeletion} />
              <button type="button" className="auth-secondary auth-danger-outline" onClick={() => handlePendingAccount('force_delete')} disabled={isHandlingDeletion || forceDeleteConfirmation !== 'DELETE NOW'}>Permanently delete now</button>
              <button type="button" className="auth-link" onClick={() => { setPendingDeletion(null); setPassword(''); setDeletionMessage(''); setForceDeleteConfirmation(''); }}>Back to login</button>
            </div>
          ) : requiresTwoFactor ? (
            <form className="auth-form" onSubmit={handleVerifyTwoFactor}>
              <label htmlFor="two-factor-code">Verification code</label>
              <p className="auth-helper">We sent a 6-digit code to your email.</p>
              <input
                type="text"
                id="two-factor-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={twoFactorCode}
                onChange={(e) => {
                  const next = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setTwoFactorCode(next);
                }}
                placeholder="6-digit code"
                required
              />
              <label className="auth-remember">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                />
                Remember this device
              </label>

              {twoFactorMessage && <p className="auth-success">{twoFactorMessage}</p>}
              {twoFactorError && <p className="auth-error">{twoFactorError}</p>}

              <button type="submit" className="auth-primary">
                Verify
              </button>
              <button
                type="button"
                className="auth-link"
                onClick={() => {
                  setRequiresTwoFactor(false);
                  setTwoFactorCode('');
                  setTwoFactorMessage('');
                  setTwoFactorError('');
                  setRememberDevice(true);
                }}
              >
                Back to login
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
              {deletionMessage && <p className="auth-success" role="status">{deletionMessage}</p>}

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
