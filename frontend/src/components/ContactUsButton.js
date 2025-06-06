import React, { useState } from 'react';
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
      const res = await fetch('http://172.16.11.133/api/send_feedback.php', {
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

  return (
    <>
      <button className="contact-us-button" onClick={() => setOpen(true)}>
        Contact Us
      </button>
      {open && (
        <div className="feedback-modal">
          <div className="feedback-content">
            <button className="close-button" onClick={() => setOpen(false)}>×</button>
            <h3>Send Feedback</h3>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                name="name"
                placeholder="Your Name"
                value={formData.name}
                onChange={handleChange}
                required
              />
              <input
                type="email"
                name="email"
                placeholder="Your Email"
                value={formData.email}
                onChange={handleChange}
                required
              />
              <textarea
                name="message"
                placeholder="Your Feedback"
                value={formData.message}
                onChange={handleChange}
                required
              />
              {status && <p className="status-message">{status}</p>}
              <button type="submit">Submit</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default ContactUsButton;
