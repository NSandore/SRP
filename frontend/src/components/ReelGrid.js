import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Heart, Play, Plus, Sparkles, Star, Trash2 } from 'lucide-react';
import buildUploadSrc from '../utils/uploads';
import { normalizeReel, normalizeReelsResponse } from '../utils/reels';
import './Reels.css';

const getIntroReel = (profile = {}) => {
  if (!profile || typeof profile !== 'object') return null;

  if (profile.intro_reel && typeof profile.intro_reel === 'object') {
    return normalizeReel(profile.intro_reel);
  }
  const reelId = String(profile.intro_reel_id || profile.intro_video_reel_id || '');
  if (!reelId) return null;
  return normalizeReel({
    reel_id: reelId,
    video_path: profile.intro_reel_video_path || profile.intro_video_path || '',
    poster_path: profile.intro_reel_poster_path || profile.intro_poster_path || '',
    is_intro: true,
    user_id: profile.user_id,
  });
};

export function IntroReelCard({
  profile,
  isOwner = false,
  onIntroRemoved,
}) {
  const profileUserId = String(profile?.user_id || '');
  const initialIntro = useMemo(() => getIntroReel(profile), [profile]);
  const [introReel, setIntroReel] = useState(initialIntro);
  const [isResolvingIntro, setIsResolvingIntro] = useState(!initialIntro && Boolean(profileUserId));
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setIntroReel(initialIntro);
  }, [initialIntro]);

  useEffect(() => {
    if (initialIntro || !profileUserId) {
      setIsResolvingIntro(false);
      return undefined;
    }
    let cancelled = false;
    setIsResolvingIntro(true);
    axios
      .get('/api/fetch_reels.php', {
        params: { scope: 'feed', user_id: profileUserId, limit: 24 },
        withCredentials: true,
      })
      .then((response) => {
        if (cancelled) return;
        const resolved = normalizeReelsResponse(response.data).reels.find((reel) => reel.is_intro);
        setIntroReel(resolved || null);
      })
      .catch(() => {
        if (!cancelled) setIntroReel(null);
      })
      .finally(() => {
        if (!cancelled) setIsResolvingIntro(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialIntro, profileUserId]);

  if (isResolvingIntro) {
    return (
      <section className="intro-reel-card intro-reel-card--loading" aria-label="Loading Intro Reel">
        <span className="intro-reel-card__loading-poster" />
        <span className="intro-reel-card__loading-copy" />
      </section>
    );
  }

  if (!introReel && !isOwner) return null;

  const handleRemove = async () => {
    if (!introReel?.reel_id || isRemoving) return;
    setIsRemoving(true);
    setError('');
    try {
      const response = await axios.post(
        '/api/reel_action.php',
        { action: 'unset_intro', reel_id: introReel.reel_id },
        { withCredentials: true }
      );
      if (response.data?.success === false || response.data?.error) {
        throw new Error(response.data.error || 'Unable to remove Intro Reel.');
      }
      setIntroReel(null);
      onIntroRemoved?.();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || 'Unable to remove Intro Reel.');
    } finally {
      setIsRemoving(false);
    }
  };

  if (!introReel) {
    return (
      <section className="intro-reel-card intro-reel-card--empty" aria-label="Intro Reel">
        <span className="intro-reel-card__icon">
          <Sparkles size={22} aria-hidden="true" />
        </span>
        <div>
          <p className="intro-reel-card__eyebrow">Your Intro Reel</p>
          <h3>Introduce yourself in under a minute</h3>
          <p>Share what you care about, what you’re working on, and why people should connect.</p>
        </div>
        <Link to="/reels?compose=intro" className="intro-reel-card__button">
          <Plus size={17} aria-hidden="true" />
          Add Intro Reel
        </Link>
      </section>
    );
  }

  const posterSrc = buildUploadSrc(introReel.poster_path);
  const target = `/reels?user_id=${encodeURIComponent(profileUserId)}&reel=${encodeURIComponent(
    introReel.reel_id
  )}`;

  return (
    <section className="intro-reel-card" aria-label="Intro Reel">
      <Link to={target} className="intro-reel-card__media" aria-label="Play Intro Reel">
        {posterSrc ? <img src={posterSrc} alt="" /> : <span className="intro-reel-card__poster-fallback" />}
        <span className="intro-reel-card__play">
          <Play size={21} fill="currentColor" aria-hidden="true" />
        </span>
      </Link>
      <div className="intro-reel-card__copy">
        <p className="intro-reel-card__eyebrow">Intro Reel</p>
        <h3>{isOwner ? 'Your story, at a glance' : 'Meet me in under a minute'}</h3>
        <p>
          {introReel.caption ||
            (isOwner
              ? 'Visitors can play this video directly from your profile.'
              : 'Play this short introduction to learn more.')}
        </p>
        <div className="intro-reel-card__actions">
          <Link to={target} className="intro-reel-card__button">
            <Play size={16} fill="currentColor" aria-hidden="true" />
            Play intro
          </Link>
          {isOwner ? (
            <>
              <Link to="/reels?compose=intro" className="intro-reel-card__text-button">
                Replace
              </Link>
              <button
                type="button"
                className="intro-reel-card__text-button intro-reel-card__text-button--danger"
                onClick={handleRemove}
                disabled={isRemoving}
              >
                <Trash2 size={14} aria-hidden="true" />
                {isRemoving ? 'Removing…' : 'Remove'}
              </button>
            </>
          ) : null}
        </div>
        {error ? <p className="intro-reel-card__error">{error}</p> : null}
      </div>
    </section>
  );
}

function ReelGrid({
  userId = '',
  communityId = '',
  isOwner = false,
  showCreate = false,
  title = 'Reels',
  description = '',
  emptyLabel = 'No reels have been shared yet.',
  limit = 24,
}) {
  const [reels, setReels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const loadReels = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await axios.get('/api/fetch_reels.php', {
          params: {
            scope: 'feed',
            ...(userId ? { user_id: userId } : {}),
            ...(communityId ? { community_id: communityId } : {}),
            limit,
          },
          withCredentials: true,
        });
        if (response.data?.success === false) {
          throw new Error(response.data.error || 'Unable to load reels.');
        }
        const normalized = normalizeReelsResponse(response.data);
        if (!cancelled) setReels(normalized.reels);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError?.response?.data?.error || requestError.message || 'Unable to load reels.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    loadReels();
    return () => {
      cancelled = true;
    };
  }, [userId, communityId, limit]);

  const buildTarget = (reel) => {
    const params = new URLSearchParams();
    if (userId) params.set('user_id', userId);
    if (communityId) params.set('community_id', communityId);
    params.set('reel', reel.reel_id);
    return `/reels?${params.toString()}`;
  };
  const canCreate = showCreate && (isOwner || Boolean(communityId));
  const createTarget = communityId
    ? `/reels?community_id=${encodeURIComponent(communityId)}&compose=1`
    : '/reels?compose=1';

  return (
    <section className="reel-grid-panel" aria-labelledby={`reel-grid-${userId || communityId || 'all'}`}>
      <header className="reel-grid-panel__header">
        <div>
          <p className="reel-grid-panel__eyebrow">Short-form video</p>
          <h3 id={`reel-grid-${userId || communityId || 'all'}`}>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {canCreate ? (
          <Link to={createTarget} className="reel-grid-panel__create">
            <Plus size={17} aria-hidden="true" />
            New reel
          </Link>
        ) : null}
      </header>

      {isLoading ? (
        <div className="reel-grid reel-grid--loading" aria-label="Loading reels">
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={index} className="reel-grid__skeleton" />
          ))}
        </div>
      ) : null}
      {!isLoading && error ? <p className="reel-grid-panel__status reel-grid-panel__status--error">{error}</p> : null}
      {!isLoading && !error && reels.length === 0 ? (
        <div className="reel-grid-panel__empty">
          <Play size={23} aria-hidden="true" />
          <p>{emptyLabel}</p>
          {canCreate ? (
            <Link to={createTarget}>Share the first reel</Link>
          ) : null}
        </div>
      ) : null}
      {!isLoading && reels.length > 0 ? (
        <div className="reel-grid">
          {reels.map((reel) => {
            const posterSrc = buildUploadSrc(reel.poster_path);
            return (
              <Link
                key={reel.reel_id}
                to={buildTarget(reel)}
                className="reel-grid__item"
                aria-label={`Play reel by ${reel.creator_name}`}
              >
                {posterSrc ? (
                  <img src={posterSrc} alt="" loading="lazy" />
                ) : (
                  <span className="reel-grid__poster-fallback" />
                )}
                <span className="reel-grid__shade" aria-hidden="true" />
                {reel.is_intro ? (
                  <span className="reel-grid__featured reel-grid__featured--intro">
                    <Sparkles size={11} aria-hidden="true" />
                    Intro{reel.is_featured ? ' · Featured' : ''}
                  </span>
                ) : reel.is_featured ? (
                  <span className="reel-grid__featured">
                    <Star size={11} fill="currentColor" aria-hidden="true" />
                    Featured
                  </span>
                ) : null}
                <span className="reel-grid__play">
                  <Play size={18} fill="currentColor" aria-hidden="true" />
                </span>
                <span className="reel-grid__stats">
                  <Heart size={13} fill="currentColor" aria-hidden="true" />
                  {reel.likes_count}
                </span>
                {reel.caption ? <span className="reel-grid__caption">{reel.caption}</span> : null}
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export default ReelGrid;
