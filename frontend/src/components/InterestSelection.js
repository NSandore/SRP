import React, { useMemo, useState } from 'react';
import './InterestSelection.css';
import useTagOptions from '../hooks/useTagOptions';

function InterestSelection({ onComplete }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const { tags, loading } = useTagOptions();
  const MAX_TAGS = 8;

  const filteredTags = useMemo(() => {
    if (!searchTerm.trim()) return tags;
    const term = searchTerm.trim().toLowerCase();
    return tags.filter((tag) => tag.name.toLowerCase().includes(term));
  }, [tags, searchTerm]);

  const handleTagClick = (slug) => {
    setSelectedTags((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= MAX_TAGS
          ? prev
          : [...prev, slug]
    );
  };

  const handleSubmit = async () => {
    if (selectedTags.length === 0) {
      alert('Please select at least one interest.');
      return;
    }

    const user_id = localStorage.getItem('user_id');
    if (!user_id) {
      alert('User not found. Please sign up first.');
      return;
    }

    try {
      const response = await fetch('/api/update_tag_interests.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id,
          tags: selectedTags,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Interests updated successfully!');
        onComplete(selectedTags);
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
        Select the topics you care about most (up to 8). Your feed will be curated based on these tags.
      </p>

      <div className="search-bar-container">
        <input
          type="text"
          className="interest-search-bar"
          placeholder="Search for tags..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="interest-grid">
        {loading ? (
          <p className="no-results">Loading tags...</p>
        ) : filteredTags.map((tag, index) => {
          const isSelected = selectedTags.includes(tag.slug);
          return (
            <div
              key={index}
              className={`interest-card ${isSelected ? 'selected' : ''}`}
              onClick={() => handleTagClick(tag.slug)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTagClick(tag.slug);
              }}
            >
              <div className="interest-logo-placeholder" aria-hidden="true" />
              <h3 className="interest-name">{tag.name}</h3>
              <p className="interest-tagline">Tag</p>
            </div>
          );
        })}
      </div>

      {!loading && !filteredTags.length && (
        <p className="no-results">No matching tags found. Try another search.</p>
      )}

      <button className="submit-button" onClick={handleSubmit}>Submit</button>
    </div>
  );
}

export default InterestSelection;
