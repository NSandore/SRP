import React, { useEffect, useState } from 'react';
import ModalOverlay from './ModalOverlay';

const OPTIONS = [
  ['student_experience', 'Student experience'],
  ['alumni_experience', 'Alumni experience'],
  ['professional_guidance', 'Professional guidance'],
  ['official_institutional', 'Official institutional information'],
  ['community_suggestion', 'Community suggestion'],
];

export default function TrustReviewModal({ isOpen, post, onClose, onSubmit, submitting }) {
  const [perspectiveType, setPerspectiveType] = useState('community_suggestion');
  const [sourceName, setSourceName] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewInterval, setReviewInterval] = useState('180');

  useEffect(() => {
    if (!isOpen) return;
    setPerspectiveType(post?.perspective_type || 'community_suggestion');
    setSourceName(post?.source_name || '');
    setSourceUrl(post?.source_url || '');
    setReviewNote(post?.review_note || '');
    setReviewInterval('180');
  }, [isOpen, post]);

  if (!isOpen) return null;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose} contentClassName="report-dialog-overlay">
      <form className="report-modal" onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.({
          perspective_type: perspectiveType,
          source_name: sourceName.trim(),
          source_url: sourceUrl.trim(),
          review_note: reviewNote.trim(),
          review_interval_days: Number(reviewInterval),
        });
      }}>
        <div className="report-modal__header">
          <p className="report-pill">Trust review</p>
          <h3 className="report-title">Review this answer</h3>
          <p className="report-subtitle">Describe the author’s perspective separately from whether the answer is accurate today.</p>
        </div>
        <div className="report-modal__body report-details">
          <label className="report-details-label" htmlFor="trust-perspective">Perspective shown to readers</label>
          <select id="trust-perspective" value={perspectiveType} onChange={(event) => setPerspectiveType(event.target.value)}>
            {OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <p className="muted-text">Only choose “Official institutional information” when the answer is authorized to speak for the named institution.</p>

          <label className="report-details-label" htmlFor="trust-source-name">Supporting source name (optional)</label>
          <input id="trust-source-name" value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Example: Office of Financial Aid" maxLength={255} />
          <label className="report-details-label" htmlFor="trust-source-url">Supporting source URL (optional)</label>
          <input id="trust-source-url" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://…" />
          <label className="report-details-label" htmlFor="trust-review-note">Reviewer note (optional)</label>
          <textarea id="trust-review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} rows={3} maxLength={500} placeholder="What was checked, or what limitation should readers know?" />
          <label className="report-details-label" htmlFor="trust-review-window">Review again in</label>
          <select id="trust-review-window" value={reviewInterval} onChange={(event) => setReviewInterval(event.target.value)}>
            <option value="90">90 days</option>
            <option value="180">6 months</option>
            <option value="365">1 year</option>
          </select>
        </div>
        <div className="report-actions report-modal__footer">
          <button type="button" className="pill-button ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="submit" className="pill-button" disabled={submitting}>{submitting ? 'Saving…' : 'Confirm review'}</button>
        </div>
      </form>
    </ModalOverlay>
  );
}
