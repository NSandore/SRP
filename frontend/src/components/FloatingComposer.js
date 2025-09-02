// src/components/FloatingComposer.js
import React, { useMemo, useState } from 'react';
import { FaPlus, FaRegStickyNote, FaPoll, FaQuestionCircle } from 'react-icons/fa';
import TextEditor from './TextEditor';

function FloatingComposer({ communities = [], defaultCommunityId = '' }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('post'); // 'post' | 'poll' | 'question'
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [communityId, setCommunityId] = useState(defaultCommunityId || '');

  const options = useMemo(() => {
    // Unique communities by id
    const map = new Map();
    (communities || []).forEach((c) => {
      if (!map.has(c.community_id)) {
        map.set(c.community_id, c);
      }
    });
    return Array.from(map.values());
  }, [communities]);

  const reset = () => {
    setType('post');
    setTitle('');
    setContent('');
    setTags('');
    setCommunityId(defaultCommunityId || '');
  };

  // When opening, preselect default community if provided
  React.useEffect(() => {
    if (open) {
      setCommunityId((cid) => cid || (defaultCommunityId || ''));
    }
  }, [open, defaultCommunityId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      type,
      title,
      contentHtml: content,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      community_id: communityId || null,
    };
    // Stub: replace with API call
    // eslint-disable-next-line no-console
    console.log('Composer submit payload:', payload);
    alert('Submit captured in console. Replace with API call.');
    setOpen(false);
    reset();
  };

  return (
    <>
      {/* FAB */}
      <div className="fab-container" aria-hidden={open}>
        <button
          type="button"
          className="fab-button"
          onClick={() => setOpen(true)}
          aria-label="Create new"
        >
          <FaPlus />
        </button>
      </div>

      {/* Composer Modal */}
      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="composer-title">
          <div className="modal-content">
            <h3 id="composer-title">Create</h3>

            {/* Type toggle */}
            <div className="compose-type-group" role="tablist" aria-label="Compose type">
              <button
                type="button"
                className={`compose-type-btn ${type === 'post' ? 'active' : ''}`}
                onClick={() => setType('post')}
                role="tab"
                aria-selected={type === 'post'}
              >
                <FaRegStickyNote /> Post
              </button>
              <button
                type="button"
                className={`compose-type-btn ${type === 'poll' ? 'active' : ''}`}
                onClick={() => setType('poll')}
                role="tab"
                aria-selected={type === 'poll'}
              >
                <FaPoll /> Poll
              </button>
              <button
                type="button"
                className={`compose-type-btn ${type === 'question' ? 'active' : ''}`}
                onClick={() => setType('question')}
                role="tab"
                aria-selected={type === 'question'}
              >
                <FaQuestionCircle /> Question
              </button>
            </div>

            <form onSubmit={handleSubmit} className="composer-form">
              <div className="form-group">
                <label htmlFor="compose-title">Title</label>
                <input
                  id="compose-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Add a clear, descriptive title"
                  required
                />
              </div>

              <div className="form-group">
                <label>Content</label>
                <TextEditor value={content} onChange={setContent} />
              </div>

              <div className="form-group">
                <label htmlFor="compose-tags">Tags</label>
                <input
                  id="compose-tags"
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="e.g., admissions, sat prep (comma separated)"
                />
              </div>

              <div className="form-group">
                <label htmlFor="compose-community">Community</label>
                <select
                  id="compose-community"
                  value={communityId}
                  onChange={(e) => setCommunityId(e.target.value)}
                >
                  <option value="">Select a community (optional)</option>
                  {options.map((c) => (
                    <option key={c.community_id} value={c.community_id}>
                      {c.name || c.community_name || `Community #${c.community_id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-actions">
                <button type="submit">Submit</button>
                <button type="button" onClick={() => { setOpen(false); reset(); }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default FloatingComposer;
