import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Bookmark, Film, Lock, Plus, RefreshCw, Sparkles, UserRound } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ReelCard from './ReelCard';
import ReelComments from './ReelComments';
import ReelComposer from './ReelComposer';
import { normalizeReel, normalizeReelsResponse } from '../utils/reels';
import './Reels.css';

const PAGE_SIZE = 12;

function ReelsPage({ userData, onRequireAuth }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const feedRef = useRef(null);
  const composeHandledRef = useRef('');
  const [reels, setReels] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [activeReelId, setActiveReelId] = useState('');
  const [commentReel, setCommentReel] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerIsIntro, setComposerIsIntro] = useState(false);
  const [followedCommunities, setFollowedCommunities] = useState([]);

  const requestedView = searchParams.get('view') || 'feed';
  const view = ['saved', 'posted'].includes(requestedView) ? requestedView : 'feed';
  const targetUserId = searchParams.get('user_id') || '';
  const targetCommunityId = searchParams.get('community_id') || '';
  const requestedReelId = searchParams.get('reel') || '';
  const composeParam = searchParams.get('compose') || '';

  useEffect(() => {
    if (!userData?.user_id) {
      setFollowedCommunities([]);
      return;
    }
    let cancelled = false;
    axios
      .get('/api/followed_communities.php', {
        params: { user_id: userData.user_id },
        withCredentials: true,
      })
      .then((response) => {
        if (cancelled) return;
        const list = Array.isArray(response.data)
          ? response.data
          : response.data?.communities || [];
        setFollowedCommunities(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setFollowedCommunities([]);
      });
    return () => {
      cancelled = true;
    };
  }, [userData?.user_id]);

  const communityOptions = useMemo(() => {
    const map = new Map();
    [
      ...followedCommunities,
      ...(Array.isArray(userData?.ambassador_communities)
        ? userData.ambassador_communities
        : []),
      ...(Array.isArray(userData?.admin_communities)
        ? userData.admin_communities
        : []),
      ...(Array.isArray(userData?.admin_community_ids)
        ? userData.admin_community_ids
        : []),
    ].forEach((community) => {
      const id = String(
        community && typeof community === 'object'
          ? community.community_id ?? community.id ?? ''
          : community ?? ''
      );
      if (!id || map.has(id)) return;
      map.set(id, {
        ...(community && typeof community === 'object' ? community : {}),
        community_id: id,
        name:
          (community && typeof community === 'object'
            ? community.name || community.community_name
            : '') || `Community ${id}`,
      });
    });
    return Array.from(map.values());
  }, [
    followedCommunities,
    userData?.ambassador_communities,
    userData?.admin_communities,
    userData?.admin_community_ids,
  ]);

  const fetchPage = useCallback(
    async ({ cursor = '', append = false } = {}) => {
      if ((view === 'saved' || view === 'posted') && !userData?.user_id) {
        setReels([]);
        setNextCursor(null);
        setIsLoading(false);
        return;
      }
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError('');

      try {
        const creatorFilter =
          view === 'posted' ? String(userData?.user_id || '') : targetUserId;
        const response = await axios.get('/api/fetch_reels.php', {
          params: {
            scope: view === 'saved' ? 'saved' : 'feed',
            ...(creatorFilter ? { user_id: creatorFilter } : {}),
            ...(targetCommunityId ? { community_id: targetCommunityId } : {}),
            ...(requestedReelId && !cursor ? { reel_id: requestedReelId } : {}),
            limit: PAGE_SIZE,
            ...(cursor ? { cursor } : {}),
          },
          withCredentials: true,
        });
        if (response.data?.success === false) {
          throw new Error(response.data.error || 'Unable to load reels.');
        }
        const normalized = normalizeReelsResponse(response.data);
        const ordered =
          requestedReelId && !append
            ? [...normalized.reels].sort((left, right) => {
                if (left.reel_id === requestedReelId) return -1;
                if (right.reel_id === requestedReelId) return 1;
                return 0;
              })
            : normalized.reels;

        setReels((current) => {
          if (!append) return ordered;
          const byId = new Map(current.map((reel) => [reel.reel_id, reel]));
          ordered.forEach((reel) => byId.set(reel.reel_id, reel));
          return Array.from(byId.values());
        });
        setNextCursor(normalized.nextCursor);
        if (!append && ordered.length > 0) {
          setActiveReelId(requestedReelId || ordered[0].reel_id);
        }
      } catch (requestError) {
        setError(requestError?.response?.data?.error || requestError.message || 'Unable to load reels.');
        if (!append) setReels([]);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [view, userData?.user_id, targetUserId, targetCommunityId, requestedReelId]
  );

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  useEffect(() => {
    if (!composeParam) {
      composeHandledRef.current = '';
      return;
    }
    if (composeHandledRef.current === composeParam) return;
    if (!userData?.user_id) {
      onRequireAuth?.();
      return;
    }
    composeHandledRef.current = composeParam;
    setComposerIsIntro(composeParam === 'intro');
    setComposerOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('compose');
    setSearchParams(next, { replace: true });
  }, [composeParam, userData?.user_id, onRequireAuth, searchParams, setSearchParams]);

  useEffect(() => {
    const root = feedRef.current;
    if (!root || reels.length === 0 || typeof IntersectionObserver === 'undefined') return undefined;
    const ratios = new Map();
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const reelId = entry.target.getAttribute('data-reel-id');
          if (reelId) ratios.set(reelId, entry.isIntersecting ? entry.intersectionRatio : 0);
        });
        let nextActive = '';
        let highestRatio = 0;
        ratios.forEach((ratio, reelId) => {
          if (ratio > highestRatio) {
            highestRatio = ratio;
            nextActive = reelId;
          }
        });
        setActiveReelId(nextActive && highestRatio >= 0.45 ? nextActive : '');
      },
      {
        root,
        threshold: [0, 0.25, 0.45, 0.65, 0.85, 1],
      }
    );
    root.querySelectorAll('[data-reel-id]').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [reels]);

  useEffect(() => {
    if (!requestedReelId || !reels.some((reel) => reel.reel_id === requestedReelId)) return;
    const root = feedRef.current;
    const target = Array.from(root?.querySelectorAll('[data-reel-id]') || []).find(
      (node) => node.getAttribute('data-reel-id') === requestedReelId
    );
    if (!root || !target) return;
    const frame = window.requestAnimationFrame(() => {
      root.scrollTo({ top: target.offsetTop, behavior: 'auto' });
      setActiveReelId(requestedReelId);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [requestedReelId, reels]);

  const openComposer = (intro = false) => {
    if (!userData?.user_id) {
      onRequireAuth?.();
      return;
    }
    setComposerIsIntro(intro);
    setComposerOpen(true);
  };

  const setView = (nextView) => {
    if ((nextView === 'saved' || nextView === 'posted') && !userData?.user_id) {
      onRequireAuth?.();
      return;
    }
    const next = new URLSearchParams();
    if (nextView !== 'feed') next.set('view', nextView);
    setSearchParams(next);
  };

  const updateReel = (updated) => {
    const normalized = normalizeReel(updated);
    setReels((current) => {
      if (view === 'saved' && !normalized.is_saved) {
        return current.filter((reel) => reel.reel_id !== normalized.reel_id);
      }
      return current.map((reel) =>
        reel.reel_id === normalized.reel_id ? normalized : reel
      );
    });
    setCommentReel((current) =>
      current?.reel_id === normalized.reel_id ? normalized : current
    );
  };

  const handleCommentCountChange = (count) => {
    if (!commentReel) return;
    updateReel({ ...commentReel, comments_count: Number(count) || 0 });
  };

  const handleCreated = (createdReel) => {
    if (!createdReel?.reel_id) {
      fetchPage();
      return;
    }
    const normalized = normalizeReel(createdReel);
    setReels((current) => [normalized, ...current.filter((item) => item.reel_id !== normalized.reel_id)]);
    setActiveReelId(normalized.reel_id);
    window.requestAnimationFrame(() => feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  const contextualTitle = targetCommunityId
    ? 'Community Reels'
    : targetUserId && view !== 'posted'
      ? 'Creator Reels'
      : view === 'saved'
        ? 'Saved Reels'
        : view === 'posted'
          ? 'Your Reels'
          : 'Reels';

  return (
    <main className="reels-page">
      <header className="reels-page__header">
        <div className="reels-page__heading">
          <p className="reels-page__eyebrow">
            <Sparkles size={15} aria-hidden="true" />
            Short-form stories from the commons
          </p>
          <h1>{contextualTitle}</h1>
          <p>Meet creators, discover communities, and share what you’re about in sixty seconds or less.</p>
        </div>
        <button type="button" className="reel-primary-button" onClick={() => openComposer(false)}>
          {userData ? <Plus size={18} aria-hidden="true" /> : <Lock size={17} aria-hidden="true" />}
          Create reel
        </button>
      </header>

      <div className="reels-page__toolbar">
        <div className="reels-page__segments" role="tablist" aria-label="Reel view">
          <button
            type="button"
            className={view === 'feed' && !targetUserId && !targetCommunityId ? 'active' : ''}
            onClick={() => setView('feed')}
            role="tab"
            aria-selected={view === 'feed' && !targetUserId && !targetCommunityId}
          >
            <Film size={16} aria-hidden="true" />
            Discover
          </button>
          <button
            type="button"
            className={view === 'saved' ? 'active' : ''}
            onClick={() => setView('saved')}
            role="tab"
            aria-selected={view === 'saved'}
          >
            <Bookmark size={16} aria-hidden="true" />
            Saved
            {!userData ? <Lock size={11} aria-hidden="true" /> : null}
          </button>
          <button
            type="button"
            className={view === 'posted' ? 'active' : ''}
            onClick={() => setView('posted')}
            role="tab"
            aria-selected={view === 'posted'}
          >
            <UserRound size={16} aria-hidden="true" />
            Posted
            {!userData ? <Lock size={11} aria-hidden="true" /> : null}
          </button>
        </div>
        {(targetUserId || targetCommunityId) ? (
          <button type="button" className="reels-page__clear-filter" onClick={() => setView('feed')}>
            View all reels
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="reels-page__loading" aria-label="Loading reels">
          <span className="reels-page__loading-card" />
          <p>Gathering reels from across StudentSphere…</p>
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="reels-page__error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => fetchPage()}>
            <RefreshCw size={16} aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : null}

      {!isLoading && !error && reels.length === 0 ? (
        <div className="reels-page__empty">
          <span>
            <Film size={30} aria-hidden="true" />
          </span>
          <h2>{view === 'saved' ? 'No saved reels yet' : 'No reels here yet'}</h2>
          <p>
            {view === 'saved'
              ? 'Save a reel and it will be waiting for you here.'
              : 'Be the first to share a short story with the community.'}
          </p>
          {view !== 'saved' ? (
            <button type="button" className="reel-primary-button" onClick={() => openComposer(false)}>
              <Plus size={18} aria-hidden="true" />
              Create a reel
            </button>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !error && reels.length > 0 ? (
        <section className="reels-feed" ref={feedRef} aria-label="Reels feed">
          {reels.map((reel) => (
            <ReelCard
              key={reel.reel_id}
              reel={reel}
              isActive={activeReelId === reel.reel_id}
              userData={userData}
              onRequireAuth={onRequireAuth}
              onUpdate={updateReel}
              onDelete={(reelId) =>
                setReels((current) => current.filter((item) => item.reel_id !== reelId))
              }
              onOpenComments={setCommentReel}
              onActivate={setActiveReelId}
            />
          ))}
          {nextCursor ? (
            <div className="reels-feed__more">
              <button
                type="button"
                onClick={() => fetchPage({ cursor: nextCursor, append: true })}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? 'Loading…' : 'Load more reels'}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <ReelComments
        isOpen={Boolean(commentReel)}
        reel={commentReel}
        userData={userData}
        onClose={() => setCommentReel(null)}
        onRequireAuth={onRequireAuth}
        onCountChange={handleCommentCountChange}
      />
      <ReelComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        userData={userData}
        communityOptions={communityOptions}
        initialIntro={composerIsIntro}
        defaultCommunityId={targetCommunityId}
        onCreated={handleCreated}
      />
    </main>
  );
}

export default ReelsPage;
