import React, { useEffect, useState } from 'react';
import ModalOverlay from './ModalOverlay';

const REASONS = [
  { value: 'spam', label: 'Spam or promotion', help: 'Unwanted ads, irrelevant links, or repetitive content.' },
  { value: 'off_topic', label: 'Off-topic or irrelevant', help: 'Does not belong in this forum or thread.' },
  { value: 'harassment', label: 'Harassment or bullying', help: 'Targeted abuse or personal attacks.' },
  { value: 'hate', label: 'Hate or discrimination', help: 'Hate speech or discriminatory content.' },
  { value: 'self_harm', label: 'Self-harm or safety risk', help: 'Content encouraging harm or dangerous behavior.' },
  { value: 'threats', label: 'Threats or violence', help: 'Credible threats of harm.' },
  { value: 'nsfw', label: 'NSFW / sexual content', help: 'Explicit or adult content.' },
  { value: 'misinformation', label: 'Misinformation', help: 'False or misleading information presented as fact.' },
  { value: 'other', label: 'Something else', help: 'Doesn’t fit the above categories.' },
];

function ReportModal({ isOpen, target, onClose, onSubmit, submitting = false }) {
  const [reason, setReason] = useState(REASONS[0].value);
  const [details, setDetails] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason(REASONS[0].value);
      setDetails('');
    }
  }, [isOpen, target?.id]);

  if (!isOpen) return null;

  const friendlyLabel = target?.label || 'this item';
  const context = target?.context ? target.context.trim() : '';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason || submitting) return;
    const selected = REASONS.find((r) => r.value === reason);
    onSubmit?.({
      reasonCode: reason,
      reasonText: selected?.label || reason,
      details: details.trim(),
    });
  };

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <form className="report-modal" onSubmit={handleSubmit}>
        <div className="report-modal__header">
          <p className="report-pill">Report</p>
          <h3 className="report-title">Flag {friendlyLabel}</h3>
          <p className="report-subtitle">
            Tell us what’s wrong. Your report is shared privately with the moderation team.
          </p>
          {context && (
            <div className="report-context" aria-label="Reported content snippet">
              {context}
            </div>
          )}
        </div>

        <div className="report-reasons">
          {REASONS.map((opt) => (
            <label key={opt.value} className={`report-reason ${reason === opt.value ? 'selected' : ''}`}>
              <input
                type="radio"
                name="report-reason"
                value={opt.value}
                checked={reason === opt.value}
                onChange={() => setReason(opt.value)}
              />
              <div className="reason-copy">
                <div className="reason-label">{opt.label}</div>
                <div className="reason-help">{opt.help}</div>
              </div>
            </label>
          ))}
        </div>

        <label className="report-details-label" htmlFor="report-details">
          Additional details (optional)
        </label>
        <textarea
          id="report-details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Add context that will help moderators act quickly."
          rows={3}
        />

        <div className="report-actions">
          <button type="button" className="pill-button ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="pill-button" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit report'}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

export default ReportModal;
