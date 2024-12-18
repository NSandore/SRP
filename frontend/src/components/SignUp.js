import React, { useState } from 'react';
import './SignUp.css';

function SignUp({ onNext }) {
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    educationStatus: 'Undergrad',
    schoolName: '',
    startDate: '',
    endDate: '',
    isOver18: false,
  });

  const schoolsFromDatabase = [
    { name: 'Harvard University', tagline: 'Excellence in Research and Liberal Arts' },
    { name: 'Stanford University', tagline: 'Innovation and Forward Thinking' },
    { name: 'MIT', tagline: 'Leading in Science and Technology' },
    { name: 'Yale University', tagline: 'Tradition, Leadership, and Scholarship' },
    { name: 'University of Oxford', tagline: 'Global Leader in Academia' },
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleNextStep = () => {
    // Basic validation per step
    if (step === 1) {
      const { firstName, lastName, email, phone } = formData;
      if (!firstName || !lastName || !email || !phone) {
        alert('Please fill in all required fields.');
        return;
      }
    }
    if (step === 2) {
      if (formData.password !== formData.confirmPassword) {
        alert('Passwords do not match!');
        return;
      }
    }
    if (step === 3) {
      if (!formData.educationStatus) {
        alert('Please select your education status.');
        return;
      }
      if (!formData.isOver18) {
        alert('You must be over 18.');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleSchoolClick = (schoolName) => {
    setFormData((prev) => ({ ...prev, schoolName }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Final validations:
    if (!formData.schoolName) {
      alert('Please select a school.');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      alert('Please provide start and end dates.');
      return;
    }
    // Once all validations pass, proceed
    onNext(formData);
  };

  const filteredSchools = schoolsFromDatabase.filter((school) =>
    school.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="signup-container">
      <h2>Create Your Account</h2>
      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <div className="form-step">
            <label>First Name:</label>
            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required />

            <label>Last Name:</label>
            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required />

            <label>Email:</label>
            <input type="email" name="email" value={formData.email} onChange={handleChange} required />

            <label>Phone:</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required />

            <button type="button" onClick={handleNextStep}>Next</button>
          </div>
        )}

        {step === 2 && (
          <div className="form-step">
            <label>Password:</label>
            <input type="password" name="password" value={formData.password} onChange={handleChange} required />

            <label>Confirm Password:</label>
            <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required />

            <button type="button" onClick={handleNextStep}>Next</button>
          </div>
        )}

        {step === 3 && (
          <div className="form-step">
            <label>Current Education Status:</label>
            <select name="educationStatus" value={formData.educationStatus} onChange={handleChange}>
              <option value="Prospective Student">Prospective Student</option>
              <option value="Undergrad">Undergrad</option>
              <option value="Graduate">Graduate</option>
              <option value="Alum">Alum</option>
              <option value="Faculty/Staff">Faculty/Staff</option>
              <option value="Just looking">Just looking!</option>
            </select>

            <label>
              <input type="checkbox" name="isOver18" checked={formData.isOver18} onChange={handleChange} />
              I am over 18 years old
            </label>

            <button type="button" onClick={handleNextStep}>Next</button>
          </div>
        )}

        {step === 4 && (
          <div className="form-step">
            <label>Search for Your School:</label>
            <input
              type="text"
              className="school-search"
              placeholder="Type to search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="school-grid">
              {filteredSchools.map((school, index) => {
                const isSelected = formData.schoolName === school.name;
                return (
                  <div
                    key={index}
                    className={`school-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSchoolClick(school.name)}
                  >
                    <div className="school-logo-placeholder"></div>
                    <h3 className="school-name">{school.name}</h3>
                    <p className="school-tagline">{school.tagline}</p>
                  </div>
                );
              })}
            </div>

            {!filteredSchools.length && (
              <p className="no-results">No matching schools found. Try another search.</p>
            )}

            <div className="form-step-inline">
              <div>
                <label>Start Date:</label>
                <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} required />
              </div>

              <div>
                <label>End Date:</label>
                <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} required />
              </div>
            </div>

            <button type="submit">Submit</button>
          </div>
        )}
      </form>
    </div>
  );
}

export default SignUp;
