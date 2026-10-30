import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { MessageCircle, Send } from 'lucide-react';
import ModalOverlay from './ModalOverlay';
import { buildAvatarSrc } from '../utils/avatar';
import './Reels.css';

const normalizeComment = (comment = {}) => ({
  ...comment,
  comment_id: String(comment.comment_id ?? comment.id ?? ''),
  user_id: String(comment.user_id ?? comment.created_by ?? ''),
  content: comment.content || comment.body || comment.comment || '',
  first_name: comment.first_name || '',
  last_name: comment.last_name || '',
  avatar_path: comment.avatar_path || '',
  created_at: comment.created_at || '',
});

const formatCommentTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

function ReelComments({
  isOpen,
  reel,
  userData,
  onClose,
  onRequireAuth,
  onCountChange,
}) {
  const reelId = reel?.reel_id;
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const loadComments = useCallback(async () => {
    if (!reelId) return;
    setIsLoading(true);
    setError('');
    try {
      const response = await axios.get('/api/fetch_reel_comments.php', {
        params: { reel_id: reelId },
        withCredentials: true,
      });
      if (response.data?.success === false) {
        throw new Error(response.data.error || 'Unable to load comments.');
      }
      const list = response.data?.comments || response.data?.items || [];
      const normalized = Array.isArray(list) ? list.map(normalizeComment) : [];
      setComments(normalized);
      return normalized;
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || 'Unable to load comments.');
    } finally {
      setIsLoading(false);
    }
  }, [reelId]);

  useEffect(() => {
    if (!isOpen) return;
    setDraft('');
    loadComments();
  }, [isOpen, loadComments]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !reelId) return;
    if (!userData?.user_id) {
      onRequireAuth?.();
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const response = await axios.post(
        '/api/create_reel_comment.php',
        {
          reel_id: reelId,
          body: content,
        },
        { withCredentials: true }
      );
      if (response.data?.success === false) {
        throw new Error(response.data.error || 'Unable to post comment.');
      }

      const returnedComment = response.data?.comment;
      const responseCount = response.data?.comments_count ?? response.data?.comment_count;
      const nextKnownCount = Number.isFinite(Number(responseCount))
        ? Number(responseCount)
        : Math.max(Number(reel?.comments_count || 0), comments.length) + 1;
      if (returnedComment) {
        setComments((current) => [...current, normalizeComment(returnedComment)]);
        onCountChange?.(nextKnownCount);
      } else {
        const refreshed = await loadComments();
        onCountChange?.(
          Number.isFinite(Number(responseCount))
            ? Number(responseCount)
            : Math.max(nextKnownCount, refreshed?.length || 0)
        );
      }
      setDraft('');
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || 'Unable to post comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      contentClassName="reel-comments-overlay"
    >
      <section className="reel-comments" aria-labelledby="reel-comments-title">
        <header className="reel-comments__header">
          <div className="reel-comments__title-row">
            <MessageCircle size={20} aria-hidden="true" />
            <h2 id="reel-comments-title">Comments</h2>
          </div>
          <p>
            {reel?.creator_name ? `Join the conversation on ${reel.creator_name}’s reel.` : 'Join the conversation.'}
          </p>
        </header>

        <div className="reel-comments__list" aria-live="polite">
          {isLoading ? <p className="reel-comments__status">Loading comments…</p> : null}
          {!isLoading && error ? <p className="reel-comments__status reel-comments__status--error">{error}</p> : null}
          {!isLoading && !error && comments.length === 0 ? (
            <div className="reel-comments__empty">
              <MessageCircle size={26} aria-hidden="true" />
              <strong>Start the conversation</strong>
              <span>Be the first to leave a thoughtful comment.</span>
            </div>
          ) : null}
          {comments.map((comment) => {
            const name =
              [comment.first_name, comment.last_name].filter(Boolean).join(' ') || 'StudentSphere member';
            return (
              <article className="reel-comment" key={comment.comment_id || `${comment.user_id}-${comment.created_at}`}>
                <img
                  src={buildAvatarSrc(comment.avatar_path)}
                  alt=""
                  className="reel-comment__avatar"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = buildAvatarSrc(null);
                  }}
                />
                <div className="reel-comment__body">
                  <div className="reel-comment__meta">
                    {comment.user_id ? (
                      <Link to={`/user/${comment.user_id}`} onClick={onClose}>
                        {name}
                      </Link>
                    ) : (
                      <strong>{name}</strong>
                    )}
                    <span>{formatCommentTime(comment.created_at)}</span>
                  </div>
                  <p>{comment.content}</p>
                </div>
              </article>
            );
          })}
        </div>

        <form className="reel-comments__composer" onSubmit={handleSubmit}>
          <label htmlFor="reel-comment-draft" className="sr-only">
            Add a comment
          </label>
          <textarea
            id="reel-comment-draft"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={userData ? 'Add a comment…' : 'Log in to comment'}
            maxLength={1000}
            rows={2}
            onFocus={() => {
              if (!userData?.user_id) onRequireAuth?.();
            }}
          />
          <button
            type="submit"
            className="reel-comments__submit"
            disabled={isSubmitting || !draft.trim()}
            aria-label="Post comment"
          >
            <Send size={18} aria-hidden="true" />
            <span>{isSubmitting ? 'Posting…' : 'Post'}</span>
          </button>
        </form>
      </section>
    </ModalOverlay>
  );
}

export default ReelComments;
