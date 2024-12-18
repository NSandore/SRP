import React, { useState, useEffect } from 'react';
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

  const [schoolsFromDatabase, setSchoolsFromDatabase] = useState([]);

  // Fetch universities from the backend on component mount
  useEffect(() => {
    async function fetchUniversities() {
      try {
        const response = await fetch('/api/fetch_universities.php');
        const data = await response.json();
  
        if (response.ok) {
          setSchoolsFromDatabase(data);
        } else {
          alert('Failed to fetch universities: ' + data.error);
        }
      } catch (error) {
        console.error('Error fetching universities:', error);
        alert('An error occurred while fetching universities.');
      }
    }
    fetchUniversities();
  }, []);
  

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleNextStep = () => {
    if (step === 1) {
      const { firstName, lastName, email, phone } = formData;
      if (!firstName || !lastName || !email || !phone) {
        alert('Please fill in all required fields.');
        return;
      }
    }
    if (step === 2 && formData.password !== formData.confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    if (step === 3 && (!formData.educationStatus || !formData.isOver18)) {
      alert('Please complete all required fields.');
      return;
    }
    setStep(step + 1);
  };

  const handleSchoolClick = (schoolName) => {
    setFormData((prev) => ({ ...prev, schoolName }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.schoolName || !formData.startDate || !formData.endDate) {
      alert('Please fill in all required fields.');
      return;
    }

    try {
      const response = await fetch('/api/register_user.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('user_id', data.user_id);
        alert('User registered successfully');
        onNext(formData);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error registering user:', error);
      alert('An error occurred while registering. Please try again.');
    }
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
                const logoSrc = school.logo_path ? school.logo_path : 'uploads/logos/default-logo.png';

                return (
                  <div
                    key={index}
                    className={`school-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSchoolClick(school.name)}
                  >
                    <img
                      src={logoSrc}
                      alt={`${school.name} Logo`}
                      className="school-logo"
                    />
                    <h3 className="school-name">{school.name}</h3>
                    <p className="school-tagline">{school.tagline}</p>
                  </div>
                );
              })}
            </div>
            {!filteredSchools.length && <p className="no-results">No matching schools found.</p>}

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
