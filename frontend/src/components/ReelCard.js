import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  Building2,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Star,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { isAdmin } from '../constants/roles';
import { buildAvatarSrc } from '../utils/avatar';
import buildUploadSrc from '../utils/uploads';
import { normalizeReel } from '../utils/reels';
import './Reels.css';

const normalizeCommunityOptions = (userData) => {
  const source = [
    ...(Array.isArray(userData?.ambassador_communities)
      ? userData.ambassador_communities
      : []),
    ...(Array.isArray(userData?.admin_communities) ? userData.admin_communities : []),
    ...(Array.isArray(userData?.admin_community_ids) ? userData.admin_community_ids : []),
  ];
  const map = new Map();
  source.forEach((community) => {
    const communityId = String(
      community && typeof community === 'object'
        ? community.community_id ?? community.id ?? ''
        : community ?? ''
    );
    if (!communityId || map.has(communityId)) return;
    map.set(communityId, {
      community_id: communityId,
      name:
        (community && typeof community === 'object'
          ? community.name || community.community_name
          : '') || `Community ${communityId}`,
    });
  });
  return Array.from(map.values());
};

function ReelActionButton({ label, count, active = false, children, onClick, pressed }) {
  return (
    <button
      type="button"
      className={`reel-action${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={typeof pressed === 'boolean' ? pressed : undefined}
    >
      <span className="reel-action__icon">{children}</span>
      {typeof count !== 'undefined' && count !== null ? (
        <span className="reel-action__count">{count}</span>
      ) : null}
    </button>
  );
}

function ReelCard({
  reel,
  isActive,
  userData,
  onRequireAuth,
  onUpdate,
  onDelete,
  onOpenComments,
  onActivate,
}) {
  const videoRef = useRef(null);
  const menuRef = useRef(null);
  const pinMenuRef = useRef(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinMenuOpen, setPinMenuOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const [pinnedCommunities, setPinnedCommunities] = useState(reel.pinned_communities || []);

  useEffect(() => {
    setPinnedCommunities(reel.pinned_communities || []);
  }, [reel.pinned_communities]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const syncPlayback = () => {
      if (isActive && !document.hidden && !videoError) {
        const playPromise = video.play();
        if (playPromise?.catch) {
          playPromise.catch(() => setIsPlaying(false));
        }
      } else {
        video.pause();
      }
    };

    syncPlayback();
    document.addEventListener('visibilitychange', syncPlayback);
    return () => {
      document.removeEventListener('visibilitychange', syncPlayback);
      video.pause();
    };
  }, [isActive, videoError]);

  useEffect(() => {
    if (!menuOpen && !pinMenuOpen) return undefined;
    const handleOutside = (event) => {
      if (menuRef.current?.contains(event.target) || pinMenuRef.current?.contains(event.target)) {
        return;
      }
      setMenuOpen(false);
      setPinMenuOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [menuOpen, pinMenuOpen]);

  const ambassadorCommunities = useMemo(() => normalizeCommunityOptions(userData), [userData]);
  const creatorIsViewer =
    Boolean(userData?.user_id) && String(userData.user_id) === String(reel.user_id);
  const canFeature = isAdmin(userData?.role_id);
  const canDelete = creatorIsViewer || canFeature;

  const requireUser = (feature) => {
    if (userData?.user_id) return true;
    onRequireAuth?.(feature);
    return false;
  };

  const postAction = async (action, extra = {}) => {
    try {
      const response = await axios.post(
        '/api/reel_action.php',
        { action, reel_id: reel.reel_id, ...extra },
        { withCredentials: true }
      );
      if (response.data?.success === false || response.data?.error) {
        throw new Error(response.data.error || `Unable to ${action} reel.`);
      }
      return response.data || {};
    } catch (requestError) {
      throw new Error(
        requestError?.response?.data?.error ||
          requestError.message ||
          `Unable to ${action} reel.`
      );
    }
  };

  const handleLike = async () => {
    if (!requireUser('Liking reels') || actionBusy) return;
    setActionError('');
    const wasLiked = Boolean(reel.is_liked);
    const optimistic = {
      ...reel,
      is_liked: !wasLiked,
      likes_count: Math.max(0, Number(reel.likes_count || 0) + (wasLiked ? -1 : 1)),
    };
    onUpdate?.(optimistic);
    setActionBusy('like');
    try {
      const data = await postAction(wasLiked ? 'unlike' : 'like');
      onUpdate?.(
        data.reel
          ? normalizeReel({ ...optimistic, ...data.reel })
          : {
              ...optimistic,
              likes_count: Number(data.like_count ?? optimistic.likes_count),
            }
      );
    } catch (error) {
      onUpdate?.(reel);
      setActionError(error.message || 'Unable to update this like.');
    } finally {
      setActionBusy('');
    }
  };

  const handleSave = async () => {
    if (!requireUser('Saving reels') || actionBusy) return;
    setActionError('');
    const wasSaved = Boolean(reel.is_saved);
    const optimistic = {
      ...reel,
      is_saved: !wasSaved,
      saves_count: Math.max(0, Number(reel.saves_count || 0) + (wasSaved ? -1 : 1)),
    };
    onUpdate?.(optimistic);
    setActionBusy('save');
    try {
      const data = await postAction(wasSaved ? 'unsave' : 'save');
      onUpdate?.(
        data.reel
          ? normalizeReel({ ...optimistic, ...data.reel })
          : {
              ...optimistic,
              saves_count: Number(data.save_count ?? optimistic.saves_count),
            }
      );
    } catch (error) {
      onUpdate?.(reel);
      setActionError(error.message || 'Unable to update this save.');
    } finally {
      setActionBusy('');
    }
  };

  const handlePinToggle = async (community) => {
    if (!requireUser('Pinning reels') || actionBusy) return;
    setActionError('');
    const currentPin = pinnedCommunities.find(
      (item) => String(item.community_id) === String(community.community_id)
    );
    const action = currentPin ? 'unpin' : 'pin';
    setActionBusy(`pin-${community.community_id}`);
    try {
      const data = await postAction(action, {
        community_id: community.community_id,
        ...(currentPin?.pin_id ? { pin_id: currentPin.pin_id } : {}),
      });
      const nextPins = currentPin
        ? pinnedCommunities.filter(
            (item) => String(item.community_id) !== String(community.community_id)
          )
        : [
            ...pinnedCommunities,
            {
              community_id: community.community_id,
              name: community.name,
              pin_id: String(data.pin_id || ''),
            },
          ];
      setPinnedCommunities(nextPins);
      onUpdate?.({ ...reel, pinned_communities: nextPins });
    } catch (error) {
      setActionError(error.message || 'Unable to update this community pin.');
    } finally {
      setActionBusy('');
    }
  };

  const handleFeatureToggle = async () => {
    if (!canFeature || actionBusy) return;
    setActionError('');
    const wasFeatured = Boolean(reel.is_featured);
    setActionBusy('feature');
    try {
      await postAction(wasFeatured ? 'unfeature' : 'feature');
      onUpdate?.({ ...reel, is_featured: !wasFeatured });
      setMenuOpen(false);
    } catch (error) {
      setActionError(error.message || 'Unable to update this feature.');
    } finally {
      setActionBusy('');
    }
  };

  const handleDelete = async () => {
    if (!canDelete || actionBusy) return;
    if (!window.confirm('Delete this reel? This cannot be undone.')) return;
    setActionError('');
    setActionBusy('delete');
    try {
      await postAction('delete');
      onDelete?.(reel.reel_id);
    } catch (error) {
      setActionError(error.message || 'Unable to delete this reel.');
    } finally {
      setActionBusy('');
      setMenuOpen(false);
    }
  };

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (!isActive) onActivate?.(reel.reel_id);
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  };

  const videoSrc = buildUploadSrc(reel.video_path);
  const posterSrc = buildUploadSrc(reel.poster_path);
  const communityRoute = reel.community_id
    ? `/${reel.community_type === 'university' ? 'university' : 'group'}/${reel.community_id}`
    : '';
  const hasPinOptions = ambassadorCommunities.length > 0;

  return (
    <article className="reel-card" data-reel-id={reel.reel_id}>
      <div className="reel-card__stage">
        {videoSrc && !videoError ? (
          <video
            ref={videoRef}
            className="reel-card__video"
            src={videoSrc}
            poster={posterSrc || undefined}
            muted={isMuted}
            playsInline
            loop
            preload={isActive ? 'auto' : 'metadata'}
            onClick={togglePlayback}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => setVideoError('This reel is not available right now.')}
            aria-label={`Reel by ${reel.creator_name}`}
          />
        ) : (
          <div className="reel-card__video-error" role="status">
            <FilmFallback />
            <strong>{videoError || 'This reel is still processing.'}</strong>
          </div>
        )}

        <button
          type="button"
          className={`reel-card__play-indicator${isPlaying ? ' is-playing' : ''}`}
          onClick={togglePlayback}
          aria-label={isPlaying ? 'Pause reel' : 'Play reel'}
        >
          {isPlaying ? <Pause size={26} /> : <Play size={30} fill="currentColor" />}
        </button>

        <div className="reel-card__top-actions">
          {reel.is_intro ? <span className="reel-card__badge">Intro Reel</span> : <span />}
          <button
            type="button"
            className="reel-card__mute"
            onClick={() => setIsMuted((current) => !current)}
            aria-label={isMuted ? 'Unmute reel' : 'Mute reel'}
            aria-pressed={!isMuted}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>

        <div className="reel-card__gradient" aria-hidden="true" />
        {actionError ? (
          <p className="reel-card__action-error" role="alert">
            {actionError}
          </p>
        ) : null}

        <div className="reel-card__creator">
          <Link to={`/user/${reel.user_id}`} className="reel-card__identity">
            <img
              src={buildAvatarSrc(reel.avatar_path)}
              alt=""
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = buildAvatarSrc(null);
              }}
            />
            <span>
              <strong>{reel.creator_name}</strong>
              {reel.is_featured ? (
                <em className="reel-featured-badge">
                  <Star size={12} fill="currentColor" aria-hidden="true" />
                  Featured creator
                </em>
              ) : null}
            </span>
          </Link>
          {communityRoute && reel.community_name ? (
            <Link to={communityRoute} className="reel-card__community">
              <Building2 size={14} aria-hidden="true" />
              {reel.community_name}
            </Link>
          ) : null}
          {reel.caption ? <p>{reel.caption}</p> : null}
        </div>

        <div className="reel-card__rail" aria-label="Reel actions">
          <ReelActionButton
            label={reel.is_liked ? 'Unlike reel' : 'Like reel'}
            count={reel.likes_count}
            active={reel.is_liked}
            pressed={Boolean(reel.is_liked)}
            onClick={handleLike}
          >
            <Heart size={23} fill={reel.is_liked ? 'currentColor' : 'none'} />
          </ReelActionButton>
          <ReelActionButton
            label="Open comments"
            count={reel.comments_count}
            onClick={() => onOpenComments?.(reel)}
          >
            <MessageCircle size={23} />
          </ReelActionButton>
          <ReelActionButton
            label={reel.is_saved ? 'Unsave reel' : 'Save reel'}
            count={reel.saves_count}
            active={reel.is_saved}
            pressed={Boolean(reel.is_saved)}
            onClick={handleSave}
          >
            <Bookmark size={23} fill={reel.is_saved ? 'currentColor' : 'none'} />
          </ReelActionButton>
          {hasPinOptions ? (
            <div className="reel-pin-control" ref={pinMenuRef}>
              <ReelActionButton
                label="Pin reel to a community"
                active={pinnedCommunities.length > 0}
                pressed={pinMenuOpen}
                onClick={() => setPinMenuOpen((current) => !current)}
              >
                <Building2 size={23} />
              </ReelActionButton>
              {pinMenuOpen ? (
                <div className="reel-pin-menu" role="menu">
                  <strong>Pin to community</strong>
                  {ambassadorCommunities.map((community) => {
                    const isPinned = pinnedCommunities.some(
                      (item) => String(item.community_id) === community.community_id
                    );
                    return (
                      <button
                        type="button"
                        key={community.community_id}
                        onClick={() => handlePinToggle(community)}
                        disabled={Boolean(actionBusy)}
                        role="menuitemcheckbox"
                        aria-checked={isPinned}
                      >
                        <span>{community.name}</span>
                        <small>{isPinned ? 'Pinned' : 'Pin'}</small>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
          {(canFeature || canDelete) ? (
            <div className="reel-more-control" ref={menuRef}>
              <ReelActionButton
                label="More reel actions"
                pressed={menuOpen}
                onClick={() => setMenuOpen((current) => !current)}
              >
                <MoreHorizontal size={23} />
              </ReelActionButton>
              {menuOpen ? (
                <div className="reel-more-menu" role="menu">
                  {canFeature ? (
                    <button type="button" onClick={handleFeatureToggle} disabled={Boolean(actionBusy)}>
                      <Star size={15} aria-hidden="true" />
                      {reel.is_featured ? 'Remove feature' : 'Feature creator'}
                    </button>
                  ) : null}
                  {canDelete ? (
                    <button
                      type="button"
                      className="is-danger"
                      onClick={handleDelete}
                      disabled={Boolean(actionBusy)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      Delete reel
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function FilmFallback() {
  return (
    <span className="reel-card__fallback-icon" aria-hidden="true">
      <Play size={28} />
    </span>
  );
}

export default ReelCard;
