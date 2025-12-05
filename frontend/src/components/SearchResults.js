import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import {
  FaArrowAltCircleUp,
  FaRegArrowAltCircleUp,
  FaArrowAltCircleDown,
  FaRegArrowAltCircleDown
} from 'react-icons/fa';
import { FiMessageCircle } from 'react-icons/fi';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function EmptyState({ query }) {
  return (
    <div className="search-empty">
      <p>No results for “{query}”. Try different keywords or a tag like <code>#events</code> or a user handle like <code>@alex</code>.</p>
    </div>
  );
}

const stripHtml = (html) => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

const getSortOptions = (tab) => {
  const map = {
    users: [
      { id: 'default', label: 'Relevance' },
      { id: 'name', label: 'Name A–Z' },
    ],
    communities: [
      { id: 'default', label: 'Relevance' },
      { id: 'recent', label: 'Newest' },
      { id: 'name', label: 'Name A–Z' },
    ],
    forums: [
      { id: 'default', label: 'Relevance' },
      { id: 'activity', label: 'Recent activity' },
      { id: 'upvotes', label: 'Most upvoted' },
    ],
    threads: [
      { id: 'default', label: 'Relevance' },
      { id: 'activity', label: 'Recent activity' },
      { id: 'replies', label: 'Most replies' },
      { id: 'upvotes', label: 'Most upvoted' },
    ],
    posts: [
      { id: 'default', label: 'Relevance' },
      { id: 'newest', label: 'Newest' },
    ],
    tags: [
      { id: 'default', label: 'Relevance' },
      { id: 'az', label: 'A–Z' },
    ],
  };
  return map[tab] || map.users;
};

function SearchResults() {
  const query = useQuery().get('q')?.trim() || '';
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const API_BASE = process.env.REACT_APP_API_BASE || 'http://172.16.11.133';
  const tabs = React.useMemo(
    () => [
      { id: 'users', label: 'Users' },
      { id: 'communities', label: 'Communities' },
      { id: 'forums', label: 'Forums' },
      { id: 'threads', label: 'Threads' },
      { id: 'posts', label: 'Posts' },
      { id: 'tags', label: 'Tags' },
    ],
    []
  );
  const storedTab = typeof window !== 'undefined' ? localStorage.getItem('searchLastTab') : null;
  const [activeTab, setActiveTab] = useState(storedTab || tabs[0].id);
  const [lastTab, setLastTab] = useState(storedTab || tabs[0].id);
  const [sortKey, setSortKey] = useState('default');
  useEffect(() => {
    const opts = getSortOptions(activeTab);
    setSortKey(opts[0]?.id || 'default');
  }, [activeTab]);

  useEffect(() => {
    setLastTab(activeTab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('searchLastTab', activeTab);
    }
  }, [activeTab]);
  const sorted = React.useMemo(() => {
    if (!results) return results;
    const clone = { ...results };
    const sorter = (arr, compare) => {
      if (!arr) return [];
      return [...arr].sort(compare);
    };
    switch (activeTab) {
      case 'users':
        clone.users = sorter(results.users, (a, b) => {
          if (sortKey === 'name') {
            return `${a.first_name} ${a.last_name}`.toLowerCase()
              .localeCompare(`${b.first_name} ${b.last_name}`.toLowerCase());
          }
          return 0;
        });
        break;
      case 'communities':
        clone.communities = sorter(results.communities, (a, b) => {
          if (sortKey === 'recent') {
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
          }
          if (sortKey === 'name') {
            return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
          }
          return 0;
        });
        break;
      case 'forums':
        clone.forums = sorter(results.forums, (a, b) => {
          if (sortKey === 'activity') {
            return new Date(b.last_activity_at || b.updated_at || 0).getTime() -
              new Date(a.last_activity_at || a.updated_at || 0).getTime();
          }
          if (sortKey === 'upvotes') {
            return (Number(b.upvotes) || 0) - (Number(a.upvotes) || 0);
          }
          return 0;
        });
        break;
      case 'threads':
        clone.threads = sorter(results.threads, (a, b) => {
          if (sortKey === 'activity') {
            return new Date(b.last_activity_at || b.updated_at || 0).getTime() -
              new Date(a.last_activity_at || a.updated_at || 0).getTime();
          }
          if (sortKey === 'replies') {
            return (Number(b.reply_count) || 0) - (Number(a.reply_count) || 0);
          }
          if (sortKey === 'upvotes') {
            return (Number(b.upvotes) || 0) - (Number(a.upvotes) || 0);
          }
          return 0;
        });
        break;
      case 'posts':
        clone.posts = sorter(results.posts, (a, b) => {
          if (sortKey === 'newest') {
            return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
          }
          return 0;
        });
        break;
      case 'tags':
        clone.tags = sorter(results.tags, (a, b) => {
          if (sortKey === 'az') return (a || '').localeCompare(b || '');
          return 0;
        });
        break;
      default:
        break;
    }
    return clone;
  }, [results, activeTab, sortKey]);

  useEffect(() => {
    if (!query) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError('');
    const controller = new AbortController();
    axios
      .get(`${API_BASE}/api/search.php?q=${encodeURIComponent(query)}&limit=8`, {
        withCredentials: true,
        signal: controller.signal,
      })
      .then((res) => setResults(res.data))
      .catch((err) => {
        if (axios.isCancel(err)) return;
        console.error('Search error', err);
        setError('There was a problem searching. Please try again.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query, API_BASE]);

  const getCount = React.useCallback((tabId) => {
    switch (tabId) {
      case 'users': return sorted?.users?.length || 0;
      case 'communities': return sorted?.communities?.length || 0;
      case 'forums': return sorted?.forums?.length || 0;
      case 'threads': return sorted?.threads?.length || 0;
      case 'posts': return sorted?.posts?.length || 0;
      case 'tags': return sorted?.tags?.length || 0;
      default: return 0;
    }
  }, [sorted]);

  useEffect(() => {
    if (!results) return;
    if (getCount(activeTab) > 0) return;
    const firstNonEmpty = tabs.find((t) => getCount(t.id) > 0)?.id;
    const preferred = getCount(lastTab) > 0 ? lastTab : (firstNonEmpty || tabs[0].id);
    if (preferred && preferred !== activeTab) {
      setActiveTab(preferred);
    }
  }, [results, lastTab, activeTab, tabs, getCount]);

  const activeItems = sorted?.[activeTab] || [];
  const hasAny = activeItems.length > 0;

  if (!query) return <div className="search-results"><p>Please enter a search term.</p></div>;
  if (loading) return <div className="search-results"><p>Searching…</p></div>;
  if (error) return <div className="search-results"><p className="error-text">{error}</p></div>;
  if (!results) return null;

  return (
    <div className="search-results">
        <div className="feed-container">
        <div className="feed-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
          <h2 className="section-title" style={{ marginBottom: '0.25rem' }}>Results for “{query}”</h2>
        </div>
        <div className="section-controls" style={{ marginBottom: 0 }}>
          <div className="search-tabs">
            <div className="search-tab-buttons">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`search-tab ${activeTab === tab.id ? 'active' : ''} ${getCount(tab.id) === 0 ? 'disabled' : ''}`}
                  onClick={() => getCount(tab.id) > 0 && setActiveTab(tab.id)}
                  disabled={getCount(tab.id) === 0}
                >
                  {tab.label}
                  {getCount(tab.id) > 0 && (
                    <span className="search-tab-badge">{getCount(tab.id)}</span>
                  )}
                </button>
              ))}
            </div>
            <div className="search-sort">
              <label htmlFor="search-sort">Sort</label>
              <select
                id="search-sort"
                className="sort-select"
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
              >
                {getSortOptions(activeTab).map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="search-divider" />

        <div className="search-content">
          {!hasAny && <EmptyState query={query} />}

          {activeTab === 'users' && sorted?.users?.length > 0 && (
            <section className="search-section">
              <div className="search-section-header">
                <h3>Users</h3>
                <span className="search-count">{sorted.users.length}</span>
              </div>
              <div className="search-grid">
                {sorted.users.map((u) => (
                  <Link key={u.user_id} to={`/user/${u.user_id}`} className="search-card">
                    <div className="search-card-title">{u.first_name} {u.last_name}</div>
                    <div className="search-card-meta">Profile</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'communities' && sorted?.communities?.length > 0 && (
            <section className="search-section">
              <div className="search-section-header">
                <h3>Communities</h3>
                <span className="search-count">{sorted.communities.length}</span>
              </div>
              <div className="search-list">
                {sorted.communities.map((c) => (
                  <Link
                    key={c.id}
                    to={c.community_type === 'group' ? `/group/${c.id}` : `/university/${c.id}`}
                    className="community-row-card"
                  >
                    <img
                      src={c.logo_path ? `${API_BASE}${c.logo_path}` : '/favicon.ico'}
                      alt={c.name}
                      className="community-row-logo"
                      loading="lazy"
                    />
                    <div className="community-row-content">
                      <div className="community-row-header">
                        <div className="thread-title">{c.name}</div>
                        <span className="pill-button secondary" style={{ padding: '4px 10px' }}>
                          {c.community_type === 'group' ? 'Group' : 'University'}
                        </span>
                      </div>
                      <div className="community-row-meta">
                        {c.tagline && <span>{c.tagline}</span>}
                        {c.location && (
                          <>
                            <span className="dot-sep">•</span>
                            <span>{c.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'forums' && sorted?.forums?.length > 0 && (
            <section className="search-section">
              <div className="search-section-header">
                <h3>Forums</h3>
                <span className="search-count">{sorted.forums.length}</span>
              </div>
              <div className="search-grid">
                {sorted.forums.map((f) => (
                <Link key={f.forum_id} to={`/info/forum/${f.forum_id}`} className="search-card">
                  <div className="search-card-title">{f.name}</div>
                  <div className="search-card-meta">{f.description || 'Forum'}</div>
                  <div className="search-card-meta">
                    <span className="vote-icon"><FaRegArrowAltCircleUp /></span> {(Number(f.upvotes) || 0)}
                    <span className="vote-icon" style={{ marginLeft: 8 }}><FaRegArrowAltCircleDown /></span> {(Number(f.downvotes) || 0)}
                    <span className="vote-icon" style={{ marginLeft: 8 }}><FiMessageCircle /></span> {f.reply_count || 0}
                  </div>
                </Link>
              ))}
            </div>
          </section>
          )}

          {activeTab === 'threads' && sorted?.threads?.length > 0 && (
            <section className="search-section">
              <div className="search-section-header">
                <h3>Threads</h3>
                <span className="search-count">{sorted.threads.length}</span>
              </div>
              <div className="search-list">
                {sorted.threads.map((t) => (
                  <Link
                    key={t.thread_id}
                    to={`/info/forum/${t.forum_id}/thread/${t.thread_id}`}
                    className="thread-card card-lift"
                    style={{ borderBottom: '1px solid var(--card-border)' }}
                  >
                    <div className="card-top-row">
                      <div className="thread-title">{t.title}</div>
                    </div>
                    <div className="card-meta">
                      <span className="vote-icon"><FaRegArrowAltCircleUp /></span> {t.upvotes || 0}
                      <span className="vote-icon" style={{ marginLeft: 8 }}><FaRegArrowAltCircleDown /></span> {t.downvotes || 0}
                      <span className="vote-icon" style={{ marginLeft: 8 }}><FiMessageCircle /></span> {t.reply_count || 0}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'posts' && sorted?.posts?.length > 0 && (
            <section className="search-section">
              <div className="search-section-header">
                <h3>Posts</h3>
                <span className="search-count">{sorted.posts.length}</span>
              </div>
              <div className="search-grid posts-grid">
                {sorted.posts.map((p) => (
                  <Link
                    key={p.post_id}
                    to={`/info/forum/${p.forum_id}/thread/${p.thread_id}`}
                    className="search-card"
                  >
                    <div className="search-card-title">
                      {stripHtml(p.content || '').slice(0, 160)}
                      {stripHtml(p.content || '').length > 160 ? '…' : ''}
                    </div>
                    <div className="search-card-meta">
                      <span className="vote-icon"><FaRegArrowAltCircleUp /></span> {(Number(p.upvotes) || 0)}
                      <span className="vote-icon" style={{ marginLeft: 8 }}><FaRegArrowAltCircleDown /></span> {(Number(p.downvotes) || 0)}
                      <span className="vote-icon" style={{ marginLeft: 8 }}><FiMessageCircle /></span> {(Number(p.comment_count) || 0)}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'tags' && sorted?.tags?.length > 0 && (
            <section className="search-section">
              <div className="search-section-header">
                <h3>Tags</h3>
                <span className="search-count">{sorted.tags.length}</span>
              </div>
              <div className="search-grid">
                {sorted.tags.map((tag) => (
                  <Link key={tag} to={`/search?q=%23${tag}`} className="search-card">
                    <div className="search-card-title">#{tag}</div>
                    <div className="search-card-meta">Tag</div>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchResults;
