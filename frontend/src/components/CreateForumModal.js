// src/components/CreateForumModal.js

import React from 'react';
import PropTypes from 'prop-types';
import './CreateForumModal.css'; // Ensure you create corresponding CSS for styling

function CreateForumModal({ isVisible, onClose, onSubmit, formData, setFormData, isCreating }) {
  if (!isVisible) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-content">
        <h3 id="modal-title">Create a New Forum</h3>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="forum-name">Forum Name:</label>
            <input
              type="text"
              id="forum-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="forum-description">Description:</label>
            <textarea
              id="forum-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
            ></textarea>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

CreateForumModal.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  formData: PropTypes.shape({
    name: PropTypes.string,
    description: PropTypes.string,
  }).isRequired,
  setFormData: PropTypes.func.isRequired,
  isCreating: PropTypes.bool.isRequired,
};

export default CreateForumModal;
