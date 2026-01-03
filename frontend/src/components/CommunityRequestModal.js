import React from 'react';
import PropTypes from 'prop-types';
import './CommunityRequestModal.css';

function CommunityRequestModal({
  isVisible,
  onClose,
  onSubmit,
  formData,
  setFormData,
  isSubmitting,
  title,
  submitLabel,
  lockType,
  allowSubCommunity = false,
  parentCommunities = [],
  isLoadingParents = false
}) {
  const [parentSearch, setParentSearch] = React.useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Reset parent if type changes away from sub-community
    if (name === 'type' && value !== 'sub_community') {
      setFormData(prev => ({ ...prev, [name]: value, parent_community_id: '' }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const filteredParents = React.useMemo(() => {
    if (!parentSearch) return parentCommunities;
    return parentCommunities.filter((c) =>
      (c.name || '').toLowerCase().includes(parentSearch.toLowerCase())
    );
  }, [parentSearch, parentCommunities]);

  if (!isVisible) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="request-modal-title">
      <div className="modal-content">
        <h3 id="request-modal-title">{title || 'Request New Community'}</h3>
        <form onSubmit={onSubmit}>
          <div className="form-group">
            <label htmlFor="community-name">Name:</label>
            <input
              type="text"
              id="community-name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="community-tagline">Tagline:</label>
            <input
              type="text"
              id="community-tagline"
              name="tagline"
              value={formData.tagline}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="community-location">Location:</label>
            <input
              type="text"
              id="community-location"
              name="location"
              value={formData.location}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="community-website">Website:</label>
            <input
              type="text"
              id="community-website"
              name="website"
              value={formData.website}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label htmlFor="primary-color">Primary Color:</label>
            <input
              type="text"
              id="primary-color"
              name="primary_color"
              value={formData.primary_color}
              onChange={handleChange}
              placeholder="#0077B5"
            />
          </div>
          <div className="form-group">
            <label htmlFor="secondary-color">Secondary Color:</label>
            <input
              type="text"
              id="secondary-color"
              name="secondary_color"
              value={formData.secondary_color}
              onChange={handleChange}
              placeholder="#005f8d"
            />
          </div>
          <div className="form-group">
            <label htmlFor="community-type">Type:</label>
            {lockType ? (
              <>
                <input type="hidden" name="type" value={formData.type} />
                <div style={{ padding: '8px 0' }}>{formData.type || 'group'}</div>
              </>
            ) : (
              <select
                id="community-type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
              >
                <option value="">Select...</option>
                <option value="university">University</option>
                <option value="group">Group</option>
                {allowSubCommunity && <option value="sub_community">Sub-Community</option>}
              </select>
            )}
          </div>
          {formData.type === 'sub_community' && (
            <div className="form-group">
              <label htmlFor="parent-community">Parent Community:</label>
              <input
                type="text"
                placeholder="Search communities..."
                value={parentSearch}
                onChange={(e) => setParentSearch(e.target.value)}
                style={{ marginBottom: '8px' }}
              />
              <select
                id="parent-community"
                name="parent_community_id"
                value={formData.parent_community_id || ''}
                onChange={handleChange}
                required
                disabled={isLoadingParents}
              >
                <option value="">{isLoadingParents ? 'Loading communities...' : 'Select parent'}</option>
                {filteredParents.map((c) => (
                  <option key={c.community_id || c.id} value={c.community_id || c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="muted" style={{ marginTop: 6 }}>
                {isLoadingParents
                  ? 'Loading communities...'
                  : 'Choose the community to nest under.'}
              </p>
            </div>
          )}
          <div className="form-group">
            <label htmlFor="community-description">Description:</label>
            <textarea
              id="community-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
            ></textarea>
          </div>
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : (submitLabel || 'Submit')}</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

CommunityRequestModal.propTypes = {
  isVisible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  formData: PropTypes.object.isRequired,
  setFormData: PropTypes.func.isRequired,
  isSubmitting: PropTypes.bool.isRequired,
  title: PropTypes.string,
  submitLabel: PropTypes.string,
  lockType: PropTypes.bool,
  allowSubCommunity: PropTypes.bool,
  parentCommunities: PropTypes.arrayOf(PropTypes.shape({
    community_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string
  })),
  isLoadingParents: PropTypes.bool,
};

export default CommunityRequestModal;
