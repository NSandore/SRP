import React, { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import axios from 'axios';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function SearchResults() {
  const query = useQuery().get('q') || '';
  const [results, setResults] = useState(null);

  useEffect(() => {
    if (!query) return;
    axios
      .get(`/api/search.php?q=${encodeURIComponent(query)}`)
      .then((res) => setResults(res.data))
      .catch((err) => console.error('Search error', err));
  }, [query]);

  if (!query) return <div className="search-results"><p>Please enter a search term.</p></div>;
  if (!results) return <div className="search-results"><p>Loading...</p></div>;

  return (
    <div className="search-results">
      <h2>Results for "{query}"</h2>
      {results.users && results.users.length > 0 && (
        <div>
          <h3>Users</h3>
          <ul>
            {results.users.map((u) => (
              <li key={u.user_id}>
                <Link to={`/user/${u.user_id}`}>{u.first_name} {u.last_name}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {results.forums && results.forums.length > 0 && (
        <div>
          <h3>Forums</h3>
          <ul>
            {results.forums.map((f) => (
              <li key={f.forum_id}>
                <Link to={`/info/forum/${f.forum_id}`}>{f.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {results.threads && results.threads.length > 0 && (
        <div>
          <h3>Threads</h3>
          <ul>
            {results.threads.map((t) => (
              <li key={t.thread_id}>
                <Link to={`/info/forum/${t.forum_id}/thread/${t.thread_id}`}>{t.title}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {results.tags && results.tags.length > 0 && (
        <div>
          <h3>Tags</h3>
          <ul>
            {results.tags.map((tag) => (
              <li key={tag}>
                <Link to={`/search?q=%23${tag}`}>#{tag}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SearchResults;
