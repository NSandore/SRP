import React, { useState } from 'react';

function SignUp({ onNext }) {
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState(null);
  const [verificationMethod, setVerificationMethod] = useState('email');
  const [verificationCode, setVerificationCode] = useState('');

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

    try {
      const res = await fetch('/api/init_register.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, phone, password, method: verificationMethod })
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
        alert(`Verification code sent via ${verificationMethod}`);
        setStep(2);
      } else {
        alert(data.error || 'An error occurred during registration.');
      }
    } catch (err) {
      console.error("Error submitting basic info:", err);
      alert('Failed to register. Please try again.');
    }
  };

  const handleVerify = async () => {
    try {
      const res = await fetch('/api/verify_user.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, code: verificationCode })
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
        alert('Account verified!');
        setStep(3);
      } else {
        alert(data.error || 'Invalid verification code.');
      }
    } catch (err) {
      console.error("Verification error:", err);
      alert('Verification failed. Please try again.');
    }
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
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

  return (
    <div className="signup-container">
      <h2>Create Your Account</h2>

      {step === 1 && (
        <div>
          <input name="firstName" placeholder="First Name" value={formData.firstName} onChange={handleChange} />
          <input name="lastName" placeholder="Last Name" value={formData.lastName} onChange={handleChange} />
          <input name="email" placeholder="Email" value={formData.email} onChange={handleChange} />
          <input name="phone" placeholder="Phone" value={formData.phone} onChange={handleChange} />
          <input type="password" name="password" placeholder="Password" value={formData.password} onChange={handleChange} />
          <input type="password" name="confirmPassword" placeholder="Confirm Password" value={formData.confirmPassword} onChange={handleChange} />

          <label>
            Verify via:
            <select value={verificationMethod} onChange={(e) => setVerificationMethod(e.target.value)}>
              <option value="email">Email</option>
              <option value="sms">Text Message</option>
            </select>
          </label>
          <button onClick={handleBasicSubmit}>Next</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <p>Enter the verification code sent to your {verificationMethod}:</p>
          <input value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)} />
          <button onClick={handleVerify}>Verify</button>
        </div>
      )}

      {step === 3 && (
        <form onSubmit={handleFinalSubmit}>
          <input name="schoolName" placeholder="School Name" value={formData.schoolName} onChange={handleChange} />
          <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} />
          <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} />
          <button type="submit">Finish Sign Up</button>
        </form>
      )}
    </div>
  );
}

export default SignUp;
