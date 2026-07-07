import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BarChart3, Clock3, Users } from 'lucide-react';

function PollsPage({ userData }) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pollMessages, setPollMessages] = useState({});

  const loadPolls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/fetch_polls.php', { withCredentials: true });
      const list = Array.isArray(res.data?.polls) ? res.data.polls : [];
      setPolls(list);
    } catch (err) {
      console.error('Unable to fetch polls', err);
      setPolls([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPolls();
  }, [loadPolls]);

  const scopeLabel = (poll) =>
    poll.scope === 'global' ? 'Global' : (poll.community_name || 'Community');

  const handleVote = async (poll, option) => {
    if (!poll || !option) return;
    if (!userData?.user_id) {
      setPollMessages((prev) => ({ ...prev, [poll.poll_id]: 'Log in or sign up to vote in polls.' }));
      return;
    }
    if (poll.closed) {
      setPollMessages((prev) => ({ ...prev, [poll.poll_id]: 'This poll is closed.' }));
      return;
    }
    if (!poll.allow_multiple_choices && poll.has_voted) {
      setPollMessages((prev) => ({ ...prev, [poll.poll_id]: 'Your response is final for this poll.' }));
      return;
    }

    try {
      const res = await axios.post(
        '/api/vote_poll.php',
        { poll_id: poll.poll_id, option_id: option.option_id },
        { withCredentials: true }
      );
      if (res.data?.success) {
        const options = Array.isArray(res.data.options) ? res.data.options : poll.options;
        const total = typeof res.data.total_votes === 'number' ? res.data.total_votes : poll.total_votes;
        setPolls((prev) =>
          prev.map((p) =>
            p.poll_id === poll.poll_id
              ? {
                  ...p,
                  options,
                  total_votes: total,
                  has_voted: true,
                  user_choices: [...(p.user_choices || []), option.option_id],
                }
              : p
          )
        );
        setPollMessages((prev) => ({ ...prev, [poll.poll_id]: 'Thanks for voting!' }));
      } else {
        setPollMessages((prev) => ({
          ...prev,
          [poll.poll_id]: res.data?.error || 'Unable to record your vote.',
        }));
      }
    } catch (err) {
      setPollMessages((prev) => ({
        ...prev,
        [poll.poll_id]: err.response?.data?.error || 'Unable to record your vote.',
      }));
    }
  };

  const openPollCount = useMemo(
    () => polls.filter((p) => !p.closed).length,
    [polls]
  );

  return (
    <div className="feed-container polls-page-shell">
      <div className="polls-page">
        <header className="polls-page__header">
          <div>
            <p className="scholarly-page-kicker">Community questions</p>
            <h1>Polls</h1>
            <p className="muted-text">
              {loading ? 'Loading polls…' : 'Contribute a quick perspective and see where the community stands.'}
            </p>
          </div>
          <div className="polls-page__count">
            <strong>{openPollCount}</strong>
            <span>open polls</span>
          </div>
        </header>

        {!loading && !polls.length && (
          <div className="sample-data-note">
            No polls yet. When your communities publish a poll, it will appear here.
          </div>
        )}

        <section className="polls-list" aria-label="Community polls">
          {polls.map((poll) => {
            const options = Array.isArray(poll.options) ? poll.options : [];
            const totalVotes = poll.total_votes || 0;
            const userChoices = poll.user_choices || [];
            const showOptions = !poll.closed && (!poll.has_voted || poll.allow_multiple_choices);
            const showResults = poll.has_voted || poll.closed;
            return (
              <article key={poll.poll_id} className="poll-card">
                <header className="poll-card__header">
                  <div>
                    <div className="poll-card__eyebrow">
                      <span>Poll</span>
                      {poll.closed && <span>Closed</span>}
                    </div>
                    <h2>{poll.question}</h2>
                    <div className="poll-card__meta">
                      <span><Users size={14} /> {scopeLabel(poll)}</span>
                      {poll.closes_at && (
                        <span><Clock3 size={14} /> {poll.closed ? 'Closed' : 'Closes'} {new Date(poll.closes_at).toLocaleString(undefined, {
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

                {showOptions && options.length > 0 && (
                  <div className="poll-card__options" role="group" aria-label="Poll options">
                    {options.map((opt) => {
                      const alreadyChosen = userChoices.includes(opt.option_id);
                      return (
                        <button
                          key={opt.option_id}
                          type="button"
                          className="poll-card__option"
                          onClick={() => handleVote(poll, opt)}
                          disabled={!userData?.user_id || alreadyChosen}
                        >
                          <span>{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {pollMessages[poll.poll_id] && (
                  <div className="poll-card__message">{pollMessages[poll.poll_id]}</div>
                )}

                {showResults && (
                  <div className="poll-card__results">
                    {options.map((opt) => {
                      const votes = opt.votes || 0;
                      const percent = totalVotes ? Math.round((votes / totalVotes) * 100) : 0;
                      const chosen = userChoices.includes(opt.option_id);
                      return (
                        <div key={opt.option_id} className={`poll-card__result${chosen ? ' poll-card__result--chosen' : ''}`}>
                          <div className="poll-card__result-copy">
                            <span>{opt.text}</span>
                            <strong>{percent}%</strong>
                          </div>
                          <div className="poll-card__result-track">
                            <div className="poll-card__result-fill" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {!totalVotes && (
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
