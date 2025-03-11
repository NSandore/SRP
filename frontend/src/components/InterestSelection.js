import React, { useState, useEffect } from 'react';
import './InterestSelection.css';

function InterestSelection({ onComplete }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [schoolsFromDatabase, setSchoolsFromDatabase] = useState([]);

  // Fetch communities from the backend when the component mounts
  useEffect(() => {
    async function fetchCommunities() {
      try {
        const response = await fetch('/api/fetch_communities.php');
        const data = await response.json();

        if (response.ok) {
          setSchoolsFromDatabase(data);
        } else {
          alert('Failed to fetch communities: ' + data.error);
        }
      } catch (error) {
        console.error('Error fetching communities:', error);
        alert('An error occurred while fetching communities.');
      }
    }

    fetchCommunities();
  }, []);

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
              <img
                src={school.logo_path || '/uploads/logos/default-logo.png'}
                alt={`${school.name} Logo`}
                className="school-logo"
              />
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
