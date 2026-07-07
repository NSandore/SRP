import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './ContactUsButton.css';

function ContactUsButton() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    try {
      const res = await fetch('/api/send_feedback.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus('Thank you for your feedback!');
        setFormData({ name: '', email: '', message: '' });
      } else {
        setStatus(data.error || 'Failed to send feedback.');
      }
    } catch (err) {
      setStatus('Failed to send feedback.');
    }
  };

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    if (open) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const modalContent = (
    <div className="feedback-modal" role="dialog" aria-modal="true" aria-label="Send feedback">
      <div className="feedback-content">
        <button className="close-button" onClick={() => setOpen(false)} aria-label="Close feedback form">×</button>
        <header className="feedback-header">
          <p className="feedback-kicker">Contact the commons</p>
          <h3>Send feedback</h3>
          <p className="feedback-description">
            Share a question, report an issue, or tell us what would make StudentSphere more useful.
          </p>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="feedback-field-row">
            <label className="feedback-field">
              <span>Name</span>
              <input
                type="text"
                name="name"
                placeholder="Your name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </label>
            <label className="feedback-field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                placeholder="you@example.edu"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </label>
          </div>
          <label className="feedback-field">
            <span>Message</span>
            <textarea
              name="message"
              placeholder="How can we help?"
              value={formData.message}
              onChange={handleChange}
              required
            />
          </label>
          {status && <p className="status-message" role="status">{status}</p>}
          <button type="submit">Submit</button>
        </form>
      </div>
    </div>
  );

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <>
      <button className="contact-us-button" onClick={() => setOpen(true)}>
        Contact
      </button>
      {open && portalTarget && createPortal(modalContent, portalTarget)}
    </>
  );
}

export default ContactUsButton;
