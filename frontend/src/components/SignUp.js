import React, { useState } from 'react';
import './Login.css';
import { FaCheckCircle } from 'react-icons/fa';

function SignUp({ onNext, onShowLogin, onContinueAsGuest }) {
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    schoolName: '',
    startDate: '',
    endDate: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleBasicSubmit = async () => {
    const { firstName, lastName, email, phone, password, confirmPassword } = formData;
    if (!firstName || !lastName || !email || !phone || !password || !confirmPassword) {
      alert('All fields required.');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    setIsSubmitting(true);
    setVerificationError('');
    setNotice('');
    try {
      const res = await fetch('/api/init_register.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, phone, password })
      });

      const text = await res.text();
      console.log("Raw response:", text);
      let data;
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error("Invalid JSON response from init_register.php:", text);
        throw new Error("Server returned invalid JSON.");
      }

      if (res.ok) {
        setUserId(data.user_id);
        setVerificationCode('');
        setNotice(`Verification code sent to ${data.email || email}. Check your inbox.`);
        setStep(2);
      } else {
        alert(data.error || 'An error occurred during registration.');
      }
    } catch (err) {
      console.error("Error submitting basic info:", err);
      alert('Failed to register. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySubmit = async () => {
    if (!verificationCode.trim()) {
      setVerificationError('Enter the 6-digit code we emailed you.');
      return;
    }
    setIsVerifying(true);
    setVerificationError('');
    setNotice('');
    try {
      const res = await fetch('/api/verify_user.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, code: verificationCode.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setNotice('Email verified! Finish your profile below.');
        setStep(3);
      } else {
        setVerificationError(data.error || 'Invalid verification code.');
      }
    } catch (err) {
      console.error('Error verifying code:', err);
      setVerificationError('Could not verify right now. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!userId) return;
    setIsResending(true);
    setVerificationError('');
    setNotice('');
    try {
      const res = await fetch('/api/resend_verification.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, email: formData.email })
      });
      const data = await res.json();
      if (res.ok) {
        setNotice('Verification email re-sent. Check your inbox.');
      } else {
        setVerificationError(data.error || 'Could not resend code.');
      }
    } catch (err) {
      console.error('Error resending code:', err);
      setVerificationError('Could not resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (!userId) {
      alert('Please start signup again so we can verify your account.');
      return;
    }
    const { schoolName, startDate, endDate } = formData;
    if (!schoolName || !startDate || !endDate) {
      alert('Please fill out education details.');
      return;
    }

    try {
      const res = await fetch('/api/complete_registration.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, schoolName, startDate, endDate })
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (err) {
        console.error("Invalid JSON:", text);
        throw new Error("Server returned invalid JSON.");
      }

      if (res.ok) {
        alert('Registration complete!');
        localStorage.setItem('user_id', userId);
        onNext(formData);
      } else {
        alert(data.error || 'Could not complete registration.');
      }
    } catch (err) {
      console.error("Final step error:", err);
      alert('Failed to complete registration.');
    }
  };

  const stepTitles = {
    1: 'Tell us about yourself',
    2: 'Verify your email',
    3: 'Share your education details',
  };

  const renderStepOne = () => (
    <div className="auth-form">
      <div className="auth-input-grid">
        <input name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} />
        <input name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} />
      </div>
      <input name="email" placeholder="Email" value={formData.email} onChange={handleChange} />
      <input name="phone" placeholder="Phone" value={formData.phone} onChange={handleChange} />
      <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} />
      <input type="password" name="confirmPassword" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleChange} />
      <button type="button" className="auth-primary" onClick={handleBasicSubmit} disabled={isSubmitting}>
        {isSubmitting ? 'Creating account…' : 'Continue'}
      </button>
      <button type="button" className="auth-link" onClick={onShowLogin}>
        Already have an account? Log in
      </button>
    </div>
  );

  const renderVerificationStep = () => (
    <div className="auth-form">
      <p>We sent a 6-digit verification code to <strong>{formData.email}</strong>. Enter it below to continue.</p>
      <input
        name="verificationCode"
        placeholder="Verification code"
        value={verificationCode}
        onChange={(e) => setVerificationCode(e.target.value)}
        maxLength={6}
      />
      {verificationError && <p className="auth-error">{verificationError}</p>}
      {notice && <p className="auth-success">{notice}</p>}
      <button
        type="button"
        className="auth-primary"
        onClick={handleVerifySubmit}
        disabled={isVerifying}
      >
        {isVerifying ? 'Verifying…' : 'Verify email'}
      </button>
      <button
        type="button"
        className="auth-link"
        onClick={handleResendCode}
        disabled={isResending}
      >
        {isResending ? 'Resending…' : 'Resend code'}
      </button>
      <button type="button" className="auth-link" onClick={onShowLogin}>
        Already verified? Log in
      </button>
    </div>
  );

  const renderStepTwo = () => (
    <form className="auth-form" onSubmit={handleFinalSubmit}>
      <input name="schoolName" placeholder="School Name" value={formData.schoolName} onChange={handleChange} />
      <div className="auth-input-grid">
        <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} />
        <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} />
      </div>
      <button type="submit" className="auth-primary">
        Finish sign up
      </button>
      <button type="button" className="auth-link" onClick={onShowLogin}>
        Have an account? Log in
      </button>
    </form>
  );

  const renderStep = () => {
    if (step === 1) return renderStepOne();
    if (step === 2) return renderVerificationStep();
    return renderStepTwo();
  };

  const benefits = [
    'Unlock curated scholarships picked for you',
    'Request direct mentorship from verified ambassadors',
    'Track applications and chats in one place',
  ];

  return (
    <div className="auth-welcome">
      <div className="auth-gradient" aria-hidden />
      <div className="auth-content">
        <section className="auth-hero">
          <span className="auth-pill">Create your space</span>
          <h1>Join StudentSphere in minutes.</h1>
          <p>Build your profile, follow communities, and get personal coaching with a free account.</p>
          <ul className="auth-benefits">
            {benefits.map((copy) => (
              <li key={copy}>
                <FaCheckCircle />
                {copy}
              </li>
            ))}
          </ul>
          <button className="auth-secondary" onClick={onShowLogin}>
            Already a member? Log in
          </button>
          <button type="button" className="auth-ghost" onClick={onContinueAsGuest}>
            Browse without an account
          </button>
        </section>

        <section className="auth-panel">
          <p className="auth-step-label">Step {step} of 3</p>
          <h2>{stepTitles[step]}</h2>
          {renderStep()}
        </section>
      </div>
    </div>
  );
}

export default SignUp;
