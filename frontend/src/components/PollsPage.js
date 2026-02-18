import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { isSuperAdmin } from '../constants/roles';

const STORAGE_KEY = 'managedEvents';
const POLL_RESPONSES_KEY = 'managedPollResponses';
const POLL_RESULTS_KEY = 'managedPollTallies';

const datePrefix = (type) => {
  if (type === 'poll') return 'Closes';
  if (type === 'announcement') return 'Publishes';
  return 'Occurs';
};

function PollsPage({ userData }) {
  const isSuperAdminUser = isSuperAdmin(userData?.role_id);
  const adminCommunityIds = useMemo(() => {
    if (!Array.isArray(userData?.admin_community_ids)) return [];
    return userData.admin_community_ids.map((id) => String(id));
  }, [userData]);

  const [items, setItems] = useState([]);
  const [followed, setFollowed] = useState([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [pollResponses, setPollResponses] = useState(() => {
    try {
      const raw = localStorage.getItem(POLL_RESPONSES_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  });
  const [pollTallies, setPollTallies] = useState(() => {
    try {
      const raw = localStorage.getItem(POLL_RESULTS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  });
  const [pollMessages, setPollMessages] = useState({});

  const readLocalItems = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        setItems([]);
        return;
      }
      const normalized = parsed
        .filter((i) => i && i.id && i.title)
        .map((i) => ({
          ...i,
          id: String(i.id),
          scope: i.scope || 'community',
          communityId: i.communityId ? String(i.communityId) : '',
          pollOptions: Array.isArray(i.pollOptions) ? i.pollOptions : [],
          showResults: Boolean(i.showResults),
        }));
      setItems(normalized);
    } catch (err) {
      console.error('Unable to read managed events', err);
      setItems([]);
    }
  };

  useEffect(() => {
    readLocalItems();
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) readLocalItems();
    };
    const handleCustomUpdate = (e) => {
      if (e.detail?.key === STORAGE_KEY || !e.detail) {
        readLocalItems();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('managedEventsUpdated', handleCustomUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('managedEventsUpdated', handleCustomUpdate);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const loadFollowed = async () => {
      if (!userData?.user_id) {
        setFollowed([]);
        return;
      }
      setLoadingFollowed(true);
      try {
        const res = await axios.get(`/api/followed_communities.php?user_id=${userData.user_id}`);
        if (!isCancelled) {
          const list = Array.isArray(res.data) ? res.data : [];
          const ids = list.map((c) => String(c.community_id ?? c.id ?? '')).filter(Boolean);
          setFollowed(ids);
        }
      } catch (err) {
        console.error('Unable to fetch followed communities', err);
        if (!isCancelled) setFollowed([]);
      } finally {
        if (!isCancelled) setLoadingFollowed(false);
      }
    };
    loadFollowed();
    return () => {
      isCancelled = true;
    };
  }, [userData?.user_id]);

  useEffect(() => {
    try {
      localStorage.setItem(POLL_RESPONSES_KEY, JSON.stringify(pollResponses));
    } catch {
      // ignore storage errors
    }
  }, [pollResponses]);

  useEffect(() => {
    try {
      localStorage.setItem(POLL_RESULTS_KEY, JSON.stringify(pollTallies));
    } catch {
      // ignore storage errors
    }
  }, [pollTallies]);

  const followsCommunity = (communityId) => {
    if (!communityId) return false;
    if (adminCommunityIds.includes(String(communityId))) return true;
    return followed.includes(String(communityId));
  };

  const isVisible = (item) => {
    if (item.scope === 'global') return true;
    if (!item.communityId) return false;
    if (isSuperAdminUser) return true;
    if (adminCommunityIds.includes(String(item.communityId))) return true;
    return followsCommunity(item.communityId);
  };

  const visibleItems = useMemo(
    () => items.filter((i) => isVisible(i)),
    [items, adminCommunityIds, followed, isSuperAdminUser]
  );

  const polls = useMemo(() => {
    const rank = (item) => {
      const date = item.date || item.createdAt;
      if (date) {
        const t = Date.parse(date);
        if (!Number.isNaN(t)) return t;
      }
      return Number.MAX_SAFE_INTEGER;
    };
    return visibleItems
      .filter((i) => i.type === 'poll')
      .sort((a, b) => rank(a) - rank(b));
  }, [visibleItems]);

  const scopeLabel = (item) =>
    item.scope === 'global'
      ? 'Global'
      : item.communityName || (item.communityId ? `Community ${item.communityId}` : 'Community item');

  const renderPollMeta = (item) => {
    const dateText = item.date ? `${datePrefix(item.type)} ${new Date(item.date).toLocaleString()}` : '';
    return `Poll · ${scopeLabel(item)}${dateText ? ` · ${dateText}` : ''}`;
  };

  const handleVote = (poll, option) => {
    if (!poll) return;
    if (!userData?.user_id) {
      setPollMessages((prev) => ({ ...prev, [poll.id]: 'Log in or sign up to vote in polls.' }));
      return;
    }

    const prevChoice = pollResponses[poll.id];
    if (prevChoice === option) {
      setPollMessages((prev) => ({ ...prev, [poll.id]: 'You already selected this option.' }));
      return;
    }

    setPollResponses((prev) => ({ ...prev, [poll.id]: option }));
    setPollTallies((prev) => {
      const next = { ...prev };
      const pollTotals = { ...(next[poll.id] || {}) };
      if (prevChoice && pollTotals[prevChoice]) {
        pollTotals[prevChoice] = Math.max(0, pollTotals[prevChoice] - 1);
      }
      pollTotals[option] = (pollTotals[option] || 0) + 1;
      next[poll.id] = pollTotals;
      return next;
    });
    setPollMessages((prev) => ({
      ...prev,
      [poll.id]: prevChoice ? 'Vote updated.' : 'Thanks for voting!',
    }));
  };

  return (
    <div className="feed-container">
      <div className="polls-page">
        <div className="polls-page__header">
          <h2>Polls</h2>
          <p className="muted-text">
            {loadingFollowed ? 'Loading polls...' : 'Vote on polls from your communities.'}
          </p>
        </div>
        <section className="widget-card polls-feed-card" aria-labelledby="polls-feed-header">
          <div
            id="polls-feed-header"
            className="widget-header"
            style={{ backgroundColor: '#F59E0B' }}
          >
            <h3 className="widget-title">Polls</h3>
          </div>
          <div className="widget-body">
            {!polls.length && (
              <div className="widget-item-meta">
                {loadingFollowed ? 'Loading polls...' : 'No polls from your communities yet.'}
              </div>
            )}
            <ul className="widget-list" aria-label="Community polls">
              {polls.map((poll) => {
                const chosen = pollResponses[poll.id];
                return (
                  <li
                    key={poll.id}
                    className="widget-list-item"
                    style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '10px' }}
                  >
                    <div className="widget-item-title">{poll.title}</div>
                    <div className="widget-item-meta">{renderPollMeta(poll)}</div>
                    {poll.pollOptions && poll.pollOptions.length > 0 ? (
                      <div className="widget-poll-options" role="group" aria-label="Poll options">
                        {poll.pollOptions.map((opt, idx) => {
                          const isSelected = chosen === opt;
                          return (
                            <button
                              key={idx}
                              type="button"
                              className={`poll-option-button${isSelected ? ' selected' : ''}`}
                              onClick={() => handleVote(poll, opt)}
                              disabled={!userData?.user_id}
                              style={{ width: '100%', textAlign: 'left', justifyContent: 'space-between' }}
                            >
                              <span>{opt}</span>
                              {isSelected && <span>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="widget-item-meta">This poll has no options configured.</div>
                    )}
                    {pollMessages[poll.id] && <div className="widget-item-meta">{pollMessages[poll.id]}</div>}
                    {chosen && poll.showResults && (
                      <div className="poll-results">
                        {(poll.pollOptions || []).map((opt, idx) => {
                          const pollTotal = pollTallies[poll.id] || {};
                          const votes = pollTotal[opt] || 0;
                          const totalVotes = Object.values(pollTotal).reduce((sum, n) => sum + n, 0);
                          const percent = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
                          return (
                            <div key={idx} className="poll-result-row">
                              <div className="poll-result-label">{opt}</div>
                              <div className="poll-result-bar">
                                <div className="poll-result-fill" style={{ width: `${percent}%` }} />
                              </div>
                              <div className="poll-result-meta">{votes} vote{votes === 1 ? '' : 's'} • {percent}%</div>
                            </div>
                          );
                        })}
                        {!Object.values(pollTallies[poll.id] || {}).length && (
                          <div className="widget-item-meta">No votes recorded yet.</div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

export default PollsPage;
