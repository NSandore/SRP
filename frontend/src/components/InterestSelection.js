import React, { useState } from 'react';
import './InterestSelection.css';

function InterestSelection({ onComplete }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchools, setSelectedSchools] = useState([]);

  // Simulate fetching from the database
  const schoolsFromDatabase = [
    { name: 'Columbia University', tagline: 'A New York State of Mind' },
    { name: 'Princeton University', tagline: 'Forward Thinking and Tradition' },
    { name: 'UC Berkeley', tagline: 'Public Research and Innovation' },
    { name: 'University of Michigan', tagline: 'Leaders and Best' },
    { name: 'Duke University', tagline: 'Where Innovation Meets Tradition' },
    { name: 'University of Washington', tagline: 'Boundless Opportunities' },
    { name: 'Carnegie Mellon University', tagline: 'Driving Innovation in Tech and Arts' },
    { name: 'UCLA', tagline: 'Diversity and Achievement in Los Angeles' },
  ];

  const filteredSchools = schoolsFromDatabase.filter((school) =>
    school.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSchoolClick = (schoolName) => {
    setSelectedSchools((prev) =>
      prev.includes(schoolName)
        ? prev.filter((s) => s !== schoolName)
        : [...prev, schoolName]
    );
  };

  const handleSubmit = async () => {
    if (selectedSchools.length === 0) {
      alert('Please select at least one school.');
      return;
    }

    const user_id = localStorage.getItem('user_id');
    if (!user_id) {
      alert('User not found. Please sign up first.');
      return;
    }

    try {
      const response = await fetch('/api/update_interests.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id,
          selected_schools: selectedSchools,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Interests updated successfully!');
        onComplete(selectedSchools);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      console.error('Error updating interests:', error);
      alert('An error occurred while updating interests. Please try again.');
    }
  };

  return (
    <div className="interest-selection-wrapper">
      <h2>Choose Your Interests</h2>
      <p className="interest-subtext">
        Select one or more schools that interest you. Your feed will be curated based on these communities.
      </p>

      <div className="search-bar-container">
        <input
          type="text"
          className="interest-search-bar"
          placeholder="Search for schools..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="interest-grid">
        {filteredSchools.map((school, index) => {
          const isSelected = selectedSchools.includes(school.name);
          return (
            <div
              key={index}
              className={`interest-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleSchoolClick(school.name)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSchoolClick(school.name);
              }}
            >
              <div className="interest-logo-placeholder"></div>
              <h3 className="interest-name">{school.name}</h3>
              <p className="interest-tagline">{school.tagline}</p>
            </div>
          );
        })}
      </div>

      {!filteredSchools.length && (
        <p className="no-results">No matching schools found. Try another search.</p>
      )}

      <button className="submit-button" onClick={handleSubmit}>Submit</button>
    </div>
  );
}

export default InterestSelection;
