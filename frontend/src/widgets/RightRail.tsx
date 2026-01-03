import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

type ManagedItem = {
  id: string;
  type?: 'event' | 'announcement' | 'poll' | string;
  title: string;
  description?: string;
  date?: string;
  location?: string;
  scope?: 'global' | 'community';
  communityId?: string;
  communityName?: string;
  pollOptions?: string[];
  createdAt?: string;
  showResults?: boolean;
};

type RightRailProps = {
  userData?: any;
};

const STORAGE_KEY = 'managedEvents';
const POLL_RESPONSES_KEY = 'managedPollResponses';
const POLL_RESULTS_KEY = 'managedPollTallies';

const datePrefix = (type?: string) => {
  if (type === 'poll') return 'Closes';
  if (type === 'announcement') return 'Publishes';
  return 'Occurs';
};

export default function RightRail({ userData }: RightRailProps) {
  const isSuperAdmin = Number(userData?.role_id) === 1;
  const adminCommunityIds = useMemo(() => {
    if (!Array.isArray(userData?.admin_community_ids)) return [];
    return userData.admin_community_ids.map((id: any) => String(id));
  }, [userData]);

  const [items, setItems] = useState<ManagedItem[]>([]);
  const [followed, setFollowed] = useState<string[]>([]);
  const [loadingFollowed, setLoadingFollowed] = useState(false);
  const [pollIndex, setPollIndex] = useState(0);
  const [pollResponses, setPollResponses] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(POLL_RESPONSES_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  });
  const [pollTallies, setPollTallies] = useState<Record<string, Record<string, number>>>(() => {
    try {
      const raw = localStorage.getItem(POLL_RESULTS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  });
  const [pollMessage, setPollMessage] = useState('');

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
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) readLocalItems();
    };
    const handleCustomUpdate = (e: Event) => {
      if ((e as CustomEvent).detail?.key === STORAGE_KEY || !(e as CustomEvent).detail) {
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
      if (!userData?.user_id) return;
      setLoadingFollowed(true);
      try {
        const res = await axios.get(`/api/followed_communities.php?user_id=${userData.user_id}`);
        if (!isCancelled) {
          const list = Array.isArray(res.data) ? res.data : [];
          const ids = list.map((c: any) => String(c.community_id ?? c.id ?? '')).filter(Boolean);
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

  const followsCommunity = (communityId?: string) => {
    if (!communityId) return false;
    if (adminCommunityIds.includes(String(communityId))) return true;
    return followed.includes(String(communityId));
  };

  const isVisible = (item: ManagedItem) => {
    if (item.scope === 'global') return true;
    if (!item.communityId) return false;
    if (isSuperAdmin) return true;
    if (adminCommunityIds.includes(String(item.communityId))) return true;
    return followsCommunity(item.communityId);
  };

  const visibleItems = useMemo(
    () => items.filter((i) => isVisible(i)),
    [items, adminCommunityIds, followed, isSuperAdmin]
  );

  const sortedEvents = useMemo(() => {
    const rank = (item: ManagedItem) => {
      const date = item.date || item.createdAt;
      if (date) {
        const t = Date.parse(date);
        if (!Number.isNaN(t)) return t;
      }
      return Number.MAX_SAFE_INTEGER;
    };
    return visibleItems
      .filter((i) => i.type !== 'poll')
      .sort((a, b) => rank(a) - rank(b))
      .slice(0, 8);
  }, [visibleItems]);

  const polls = useMemo(
    () => visibleItems.filter((i) => i.type === 'poll').slice(0, 5),
    [visibleItems]
  );

  useEffect(() => {
    setPollIndex((idx) => {
      if (polls.length === 0) return 0;
      return Math.min(idx, polls.length - 1);
    });
  }, [polls.length]);

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

  const scopeLabel = (item: ManagedItem) =>
    item.scope === 'global'
      ? 'Global'
      : item.communityName || (item.communityId ? `Community ${item.communityId}` : 'Community item');

  const renderItemMeta = (item: ManagedItem) => {
    const dateText = item.date ? `${datePrefix(item.type)} ${new Date(item.date).toLocaleString()}` : '';
    const baseType = item.type === 'announcement' ? 'Announcement' : 'Event';
    return `${baseType} · ${scopeLabel(item)}${dateText ? ` · ${dateText}` : ''}`;
  };

  const renderPollMeta = (item: ManagedItem) => {
    const dateText = item.date ? `${datePrefix(item.type)} ${new Date(item.date).toLocaleString()}` : '';
    return `Poll · ${scopeLabel(item)}${dateText ? ` · ${dateText}` : ''}`;
  };

  const currentPoll = polls[pollIndex];

  const handleVote = (option: string) => {
    if (!currentPoll) return;
    if (!userData?.user_id) {
      setPollMessage('Log in or sign up to vote in polls.');
      return;
    }

    const prevChoice = pollResponses[currentPoll.id];
    if (prevChoice === option) {
      setPollMessage('You already selected this option.');
      return;
    }

    setPollResponses((prev) => ({ ...prev, [currentPoll.id]: option }));
    setPollTallies((prev) => {
      const next = { ...prev };
      const pollTotals = { ...(next[currentPoll.id] || {}) };
      if (prevChoice && pollTotals[prevChoice]) {
        pollTotals[prevChoice] = Math.max(0, pollTotals[prevChoice] - 1);
      }
      pollTotals[option] = (pollTotals[option] || 0) + 1;
      next[currentPoll.id] = pollTotals;
      return next;
    });
    setPollMessage(prevChoice ? 'Vote updated.' : 'Thanks for voting!');
    if (!prevChoice && polls.length > 1) {
      setTimeout(() => {
        setPollIndex((prev) => (prev + 1) % polls.length);
      }, 3000);
    }
  };

  const goNextPoll = () => {
    if (!polls.length) return;
    setPollIndex((prev) => (prev + 1) % polls.length);
    setPollMessage('');
  };

  const goPrevPoll = () => {
    if (!polls.length) return;
    setPollIndex((prev) => (prev - 1 + polls.length) % polls.length);
    setPollMessage('');
  };

  useEffect(() => {
    setPollMessage('');
  }, [pollIndex]);

  return (
    <div className="right-rail-stack">
      <section className="widget-card" aria-labelledby="events-header">
        <div
          id="events-header"
          className="widget-header"
          style={{ backgroundColor: '#2563EB' }}
        >
          <h3 className="widget-title">Upcoming Events</h3>
        </div>
        <div className="widget-body">
          {!sortedEvents.length && (
            <div className="widget-item-meta">
              {loadingFollowed
                ? 'Loading your upcoming events...'
                : 'No upcoming events for your communities yet.'}
            </div>
          )}
          <ul className="widget-list" aria-label="Upcoming events">
            {sortedEvents.map((item) => (
              <li
                key={item.id}
                className="widget-list-item"
                style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '6px' }}
              >
                <div className="widget-item-title">{item.title}</div>
                <div className="widget-item-meta">{renderItemMeta(item)}</div>
                {item.description && (
                  <div className="widget-item-meta" style={{ color: 'var(--text-color)' }}>
                    {item.description.length > 140 ? `${item.description.slice(0, 140)}…` : item.description}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="widget-card" aria-labelledby="polls-header">
        <div
          id="polls-header"
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
          {polls.length > 0 && currentPoll && (
            <div
              className="widget-list poll-slide"
              aria-label="Community polls"
              style={{ gap: '10px' }}
              key={currentPoll.id}
            >
              <div
                className="widget-list-item"
                style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '8px' }}
              >
                <div className="widget-item-title">{currentPoll.title}</div>
                <div className="widget-item-meta">{renderPollMeta(currentPoll)}</div>
                {!userData?.user_id && (
                  <div className="widget-item-meta" style={{ color: '#b91c1c' }}>
                    Log in or sign up to vote in polls.
                  </div>
                )}
                {currentPoll.pollOptions && currentPoll.pollOptions.length > 0 ? (
                  <div className="widget-poll-options" role="group" aria-label="Poll options">
                    {currentPoll.pollOptions.map((opt, idx) => {
                      const chosen = pollResponses[currentPoll.id];
                      const isSelected = chosen === opt;
                      return (
                        <button
                          key={idx}
                          type="button"
                          className={`poll-option-button${isSelected ? ' selected' : ''}`}
                          onClick={() => handleVote(opt)}
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
                {pollMessage && <div className="widget-item-meta">{pollMessage}</div>}
                {pollResponses[currentPoll.id] && currentPoll.showResults && (
                  <div className="poll-results">
                    {(currentPoll.pollOptions || []).map((opt, idx) => {
                      const pollTotal = pollTallies[currentPoll.id] || {};
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
                    {!Object.values(pollTallies[currentPoll.id] || {}).length && (
                      <div className="widget-item-meta">No votes recorded yet.</div>
                    )}
                  </div>
                )}
                <div className="poll-nav" style={{ alignSelf: 'center' }}>
                  <button type="button" onClick={goPrevPoll} disabled={polls.length <= 1} aria-label="Previous poll">
                    ‹
                  </button>
                  <div className="poll-dots" aria-label="Poll pagination">
                    {polls.map((_, idx) => (
                      <span
                        key={idx}
                        className={`poll-dot${idx === pollIndex ? ' active' : ''}`}
                        aria-hidden="true"
                      />
                    ))}
                  </div>
                  <button type="button" onClick={goNextPoll} disabled={polls.length <= 1} aria-label="Next poll">
                    ›
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
