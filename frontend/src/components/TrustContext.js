import React from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaExternalLinkAlt, FaInfoCircle } from 'react-icons/fa';
import './TrustContext.css';

const LABELS = {
  student_experience: 'Student experience',
  alumni_experience: 'Alumni experience',
  professional_guidance: 'Professional guidance',
  official_institutional: 'Official institutional information',
  community_suggestion: 'Community suggestion',
};

const DESCRIPTIONS = {
  student_experience: 'A student is sharing what they experienced. Policies and outcomes may differ for someone else.',
  alumni_experience: 'A former student is sharing past experience. Current procedures may have changed.',
  professional_guidance: 'Guidance from someone presenting professional or staff experience. Confirm requirements with the responsible organization.',
  official_institutional: 'Information published or explicitly reviewed as applying to the named institution or program.',
  community_suggestion: 'A community member is offering a suggestion, not an official or universally applicable answer.',
};

const formatDate = (value) => {
  if (!value) return '';
  const parsed = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function TrustContext({ post, institutional = false }) {
  if (!post && !institutional) return null;
  const type = institutional ? 'official_institutional' : (post?.perspective_type || 'community_suggestion');
  const label = post?.perspective_label || LABELS[type] || LABELS.community_suggestion;
  const description = post?.perspective_description || DESCRIPTIONS[type] || DESCRIPTIONS.community_suggestion;
  const isReviewed = Number(post?.verified) === 1 || Boolean(post?.reviewed_at);
  const isStale = post?.review_status === 'stale';
  const reviewedDate = formatDate(post?.reviewed_at || post?.verified_at);
  const reviewer = [post?.reviewer_first_name, post?.reviewer_last_name].filter(Boolean).join(' ');

  return (
    <details className={`trust-context trust-context--${type}${isStale ? ' is-stale' : ''}`}>
      <summary>
        <span className="trust-context__perspective"><FaInfoCircle aria-hidden="true" /> {label}</span>
        {isReviewed && !isStale && (
          <span className="trust-context__reviewed"><FaCheckCircle aria-hidden="true" /> Reviewed answer</span>
        )}
        {isStale && (
          <span className="trust-context__stale"><FaExclamationTriangle aria-hidden="true" /> Review may be outdated</span>
        )}
        <span className="trust-context__more">What this means</span>
      </summary>
      <div className="trust-context__details">
        <p>{description}</p>
        {isReviewed && (
          <p>
            Reviewed{reviewedDate ? ` on ${reviewedDate}` : ''}{reviewer ? ` by ${reviewer}` : ''}.
            {' '}Review confirms the answer was checked at that time; it does not guarantee that policies will never change.
          </p>
        )}
        {post?.applicable_community_name && <p><strong>Applies to:</strong> {post.applicable_community_name}</p>}
        {post?.review_note && <p><strong>Reviewer note:</strong> {post.review_note}</p>}
        {post?.source_url && (
          <a href={post.source_url} target="_blank" rel="noopener noreferrer">
            <FaExternalLinkAlt aria-hidden="true" /> {post.source_name || 'Open supporting source'}
          </a>
        )}
      </div>
    </details>
  );
}
