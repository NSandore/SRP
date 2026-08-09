import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import {
  FaRegArrowAltCircleUp,
  FaRegArrowAltCircleDown
} from 'react-icons/fa';
import { FiMessageCircle } from 'react-icons/fi';
import buildUploadSrc from '../utils/uploads';
import { buildAvatarSrc } from '../utils/avatar';
import { getTagStyle } from '../utils/tagStyle';

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

const BREADCRUMB_MAX_LENGTH = 25;

const truncateBreadcrumb = (part) =>
  part.length > BREADCRUMB_MAX_LENGTH ? `${part.slice(0, BREADCRUMB_MAX_LENGTH)}…` : part;

function SearchBreadcrumb({ parts }) {
  const items = (parts || []).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <div className="breadcrumbs search-card-breadcrumb">
      {items.map((part, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span className="breadcrumb-sep">&gt;</span>}
          <span title={part.length > BREADCRUMB_MAX_LENGTH ? part : undefined}>
            {truncateBreadcrumb(part)}
          </span>
        </React.Fragment>
      ))}
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
      .get(`/api/search.php?q=${encodeURIComponent(query)}&limit=8`, {
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
  }, [query]);

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
  const activeTabLabel = tabs.find((tab) => tab.id === activeTab)?.label || 'Results';

  const renderShell = (body) => (
    <main className="search-results scholarly-page scholarly-search-page">
      <div className="feed-container scholarly-page-panel search-page-panel">
        <header className="scholarly-page-header">
          <div>
            <p className="scholarly-page-kicker">Campus-wide search</p>
            <h1>Search</h1>
            <p>
              {query
                ? <>Results for “{query}” across people, communities, forums, and discussions.</>
                : 'Find people, communities, forums, threads, posts, and tags.'}
            </p>
          </div>
          <div className="scholarly-page-count" aria-live="polite">
            <strong>{getCount(activeTab)}</strong>
            <span>{activeTabLabel.toLowerCase()} in view</span>
          </div>
        </header>
        {body}
      </div>
    </main>
  );

  if (!query) return renderShell(<p className="search-status muted">Please enter a search term.</p>);
  if (loading) return renderShell(<p className="search-status muted">Searching…</p>);
  if (error) return renderShell(<p className="search-status error-text">{error}</p>);
  if (!results) return null;

  return renderShell(
    <>
        <div className="search-tabs section-controls scholarly-controls filter-toolbar filter-toolbar--filter-first">
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
            <label htmlFor="search-sort" className="sr-only">Sort</label>
            <span className="sort-pill" style={{ margin: 0 }}>Sort</span>
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
        <div className="search-content search-page-body">
          {!hasAny && <EmptyState query={query} />}

          {activeTab === 'users' && sorted?.users?.length > 0 && (
            <section className="search-section">
              <div className="search-list">
                {sorted.users.map((u) => (
                  <Link
                    key={u.user_id}
                    to={`/user/${u.user_id}`}
                    className="search-card search-result-item search-result-item--user"
                  >
                    <img
                      src={buildAvatarSrc(u.avatar_path)}
                      alt=""
                      className="search-user-avatar"
                      loading="lazy"
                    />
                    <div>
                      <div className="search-card-title">{u.first_name} {u.last_name}</div>
                      <div className="search-card-meta">Profile</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'communities' && sorted?.communities?.length > 0 && (
            <section className="search-section">
              <div className="search-list">
                {sorted.communities.map((c) => (
                  (() => {
                    const universityFallbackLogo = buildUploadSrc('/uploads/logos/School Image.png');
                    const defaultCommunityLogo = buildUploadSrc('/uploads/logos/default-logo.png');
                    const fallbackLogo =
                      c.community_type === 'university' ? universityFallbackLogo : defaultCommunityLogo;
                    const normalizedLogoPath = typeof c.logo_path === 'string' ? c.logo_path.trim() : '';
                    const logoSrc = normalizedLogoPath
                      ? buildUploadSrc(
                        normalizedLogoPath.startsWith('/')
                          ? normalizedLogoPath
                          : `/uploads/logos/${normalizedLogoPath}`
                      ) || fallbackLogo
                      : fallbackLogo;

                    return (
                      <Link
                        key={c.id}
                        to={c.community_type === 'group' ? `/group/${c.id}` : `/university/${c.id}`}
                        className="community-row-card search-result-item search-result-item--community"
                      >
                        <img
                          src={logoSrc}
                          alt={c.name}
                          className="community-row-logo"
                          loading="lazy"
                        />
                        <div className="community-row-content">
                          <div className="community-row-header">
                            <div className="search-card-title">{c.name}</div>
                            <span className="pill-button secondary" style={{ padding: '4px 10px' }}>
                              {c.community_type === 'group' ? 'Group' : 'University'}
                            </span>
                          </div>
                          <div className="community-row-meta">
                            {c.tagline && <span>{c.tagline}</span>}
                            {c.location && (
                              <span style={{ marginLeft: c.tagline ? 12 : 0 }}>{c.location}</span>
                            )}
                            {c.parent_name && (
                              <span className="muted" style={{ marginLeft: (c.tagline || c.location) ? 12 : 0 }}>
                                Part of {c.parent_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })()
                ))}
              </div>
            </section>
          )}

          {activeTab === 'forums' && sorted?.forums?.length > 0 && (
            <section className="search-section">
              <div className="search-list">
                {sorted.forums.map((f) => (
                  <Link key={f.forum_id} to={`/info/forum/${f.forum_id}`} className="search-card search-result-item search-result-item--forum">
                    <SearchBreadcrumb parts={[f.community_name]} />
                    <div className="search-card-title">{f.name}</div>
                    <div className="search-card-meta">{f.description || 'Forum'}</div>
                    <div className="search-card-meta search-card-metrics">
                      <span><span className="vote-icon"><FaRegArrowAltCircleUp /></span> {(Number(f.upvotes) || 0)}</span>
                      <span><span className="vote-icon"><FaRegArrowAltCircleDown /></span> {(Number(f.downvotes) || 0)}</span>
                      <span><span className="vote-icon"><FiMessageCircle /></span> {f.reply_count || 0}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'threads' && sorted?.threads?.length > 0 && (
            <section className="search-section">
              <div className="search-list">
                {sorted.threads.map((t) => (
                  <Link
                    key={t.thread_id}
                    to={`/info/forum/${t.forum_id}/thread/${t.thread_id}`}
                    className="search-card search-result-item search-result-item--thread"
                  >
                    <SearchBreadcrumb parts={[t.community_name, t.forum_name]} />
                    <div className="card-top-row">
                      <div className="search-card-title">{t.title}</div>
                    </div>
                    <div className="card-meta search-card-metrics">
                      <span><span className="vote-icon"><FaRegArrowAltCircleUp /></span> {t.upvotes || 0}</span>
                      <span><span className="vote-icon"><FaRegArrowAltCircleDown /></span> {t.downvotes || 0}</span>
                      <span><span className="vote-icon"><FiMessageCircle /></span> {t.reply_count || 0}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'posts' && sorted?.posts?.length > 0 && (
            <section className="search-section">
              <div className="search-list">
                {sorted.posts.map((p) => (
                  <Link
                    key={p.post_id}
                    to={`/info/forum/${p.forum_id}/thread/${p.thread_id}`}
                    className="search-card search-result-item search-result-item--post"
                  >
                    <SearchBreadcrumb parts={[p.community_name, p.forum_name, p.thread_title]} />
                    <div className="search-card-title">
                      {stripHtml(p.content || '').slice(0, 160)}
                      {stripHtml(p.content || '').length > 160 ? '…' : ''}
                    </div>
                    <div className="search-card-meta search-card-metrics">
                      <span><span className="vote-icon"><FaRegArrowAltCircleUp /></span> {(Number(p.upvotes) || 0)}</span>
                      <span><span className="vote-icon"><FaRegArrowAltCircleDown /></span> {(Number(p.downvotes) || 0)}</span>
                      <span><span className="vote-icon"><FiMessageCircle /></span> {(Number(p.comment_count) || 0)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'tags' && sorted?.tags?.length > 0 && (
            <section className="search-section">
              <div className="chips-row search-tags-row">
                {sorted.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/search?q=%23${tag}`}
                    className="chip tag-chip"
                    style={{ ...getTagStyle(tag), border: '1px solid', borderRadius: '9999px', padding: '6px 14px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
    </>
  );
}

export default SearchResults;
