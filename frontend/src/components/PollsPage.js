import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BarChart3, Clock3, Users } from 'lucide-react';
import { isSuperAdmin } from '../constants/roles';

const STORAGE_KEY = 'managedEvents';
const POLL_RESPONSES_KEY = 'managedPollResponses';
const POLL_RESULTS_KEY = 'managedPollTallies';

const pollSampleDate = (daysFromNow) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(17, 0, 0, 0);
  return date.toISOString();
};

const SAMPLE_POLLS = [
  {
    id: 'sample-poll-reading-format',
    type: 'poll',
    title: 'Which reading-group format works best for you?',
    description: 'Help the Academic Commons plan the next sequence of facilitated reading groups.',
    date: pollSampleDate(6),
    scope: 'global',
    communityName: 'Academic Commons',
    pollOptions: ['One longer monthly session', 'Two shorter sessions each month', 'Asynchronous notes with one discussion'],
    showResults: true,
    sample: true,
  },
  {
    id: 'sample-poll-funding-workshop',
    type: 'poll',
    title: 'What should the next funding workshop cover?',
    description: 'Choose the topic that would be most useful for your next application cycle.',
    date: pollSampleDate(10),
    scope: 'global',
    communityName: 'Funding & Fellowships',
    pollOptions: ['Personal statements', 'Project budgets', 'Recommendation strategy', 'Finding smaller grants'],
    showResults: true,
    sample: true,
  },
];

const SAMPLE_POLL_TALLIES = {
  'sample-poll-reading-format': {
    'One longer monthly session': 14,
    'Two shorter sessions each month': 21,
    'Asynchronous notes with one discussion': 9,
  },
  'sample-poll-funding-workshop': {
    'Personal statements': 18,
    'Project budgets': 12,
    'Recommendation strategy': 8,
    'Finding smaller grants': 15,
  },
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
      return typeof parsed === 'object' && parsed !== null
        ? { ...SAMPLE_POLL_TALLIES, ...parsed }
        : SAMPLE_POLL_TALLIES;
    } catch {
      return SAMPLE_POLL_TALLIES;
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

  const isVisible = useCallback((item) => {
    if (item.scope === 'global') return true;
    if (!item.communityId) return false;
    if (isSuperAdminUser) return true;
    if (adminCommunityIds.includes(String(item.communityId))) return true;
    return followed.includes(String(item.communityId));
  }, [adminCommunityIds, followed, isSuperAdminUser]);

  const visibleItems = useMemo(
    () => items.filter((i) => isVisible(i)),
    [items, isVisible]
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
  const displayPolls = polls.length ? polls : SAMPLE_POLLS;

  const scopeLabel = (item) =>
    item.scope === 'global'
      ? 'Global'
      : item.communityName || (item.communityId ? `Community ${item.communityId}` : 'Community item');

  const handleVote = (poll, option) => {
    if (!poll) return;
    if (!userData?.user_id) {
      setPollMessages((prev) => ({ ...prev, [poll.id]: 'Log in or sign up to vote in polls.' }));
      return;
    }

    const prevChoice = pollResponses[poll.id];
    if (prevChoice) {
      setPollMessages((prev) => ({ ...prev, [poll.id]: 'Your response is final for this poll.' }));
      return;
    }

    setPollResponses((prev) => ({ ...prev, [poll.id]: option }));
    setPollTallies((prev) => {
      const next = { ...prev };
      const pollTotals = { ...(next[poll.id] || {}) };
      pollTotals[option] = (pollTotals[option] || 0) + 1;
      next[poll.id] = pollTotals;
      return next;
    });
    setPollMessages((prev) => ({
      ...prev,
      [poll.id]: 'Thanks for voting!',
    }));
  };

  return (
    <div className="feed-container polls-page-shell">
      <div className="polls-page">
        <header className="polls-page__header">
          <div>
            <p className="scholarly-page-kicker">Community questions</p>
            <h1>Polls</h1>
            <p className="muted-text">
              {loadingFollowed ? 'Loading polls…' : 'Contribute a quick perspective and see where the community stands.'}
            </p>
          </div>
          <div className="polls-page__count">
            <strong>{displayPolls.length}</strong>
            <span>open polls</span>
          </div>
        </header>

        {!polls.length && !loadingFollowed && (
          <div className="sample-data-note">
            Showing sample polls until your communities publish a poll.
          </div>
        )}

        <section className="polls-list" aria-label="Community polls">
          {displayPolls.map((poll) => {
                const chosen = pollResponses[poll.id];
                const pollTotal = pollTallies[poll.id] || {};
                const totalVotes = Object.values(pollTotal).reduce((sum, n) => sum + n, 0);
                return (
                  <article
                    key={poll.id}
                    className="poll-card"
                  >
                    <header className="poll-card__header">
                      <div>
                        <div className="poll-card__eyebrow">
                          <span>Poll</span>
                          {poll.sample && <span>Sample</span>}
                        </div>
                        <h2>{poll.title}</h2>
                        <div className="poll-card__meta">
                          <span><Users size={14} /> {scopeLabel(poll)}</span>
                          {poll.date && (
                            <span><Clock3 size={14} /> Closes {new Date(poll.date).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hourCycle: 'h23',
                            })}</span>
                          )}
                          <span><BarChart3 size={14} /> {totalVotes} responses</span>
                        </div>
                      </div>
                    </header>
                    {poll.description && <p className="poll-card__description">{poll.description}</p>}
                    {!chosen && poll.pollOptions && poll.pollOptions.length > 0 ? (
                      <div className="poll-card__options" role="group" aria-label="Poll options">
                        {poll.pollOptions.map((opt, idx) => {
                          return (
                            <button
                              key={idx}
                              type="button"
                              className="poll-card__option"
                              onClick={() => handleVote(poll, opt)}
                              disabled={!userData?.user_id}
                            >
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : !chosen ? (
                      <div className="poll-card__message">This poll has no options configured.</div>
                    ) : null}
                    {pollMessages[poll.id] && <div className="poll-card__message">{pollMessages[poll.id]}</div>}
                    {chosen && (
                      <div className="poll-card__results">
                        {(poll.pollOptions || []).map((opt, idx) => {
                          const votes = pollTotal[opt] || 0;
                          const percent = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
                          return (
                            <div key={idx} className="poll-card__result">
                              <div className="poll-card__result-copy">
                                <span>{opt}</span>
                                <strong>{percent}%</strong>
                              </div>
                              <div className="poll-card__result-track">
                                <div className="poll-card__result-fill" style={{ width: `${percent}%` }} />
                              </div>
                            </div>
                          );
                        })}
                        {!Object.values(pollTotal).length && (
                          <div className="poll-card__message">No votes recorded yet.</div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
        </section>
      </div>
    </div>
  );
}

export default PollsPage;
