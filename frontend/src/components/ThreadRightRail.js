// src/components/ThreadRightRail.js
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';

export default function ThreadRightRail() {
  const { thread_id } = useParams();
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [related, setRelated] = useState([]);
  const [session, setSession] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const tRes = await axios.get(`/api/fetch_thread.php?thread_id=${thread_id}`);
        setThread(tRes.data);
        const pRes = await axios.get(`/api/fetch_posts.php?thread_id=${thread_id}`);
        const p = Array.isArray(pRes.data) ? pRes.data : [];
        setPosts(p);
        // Fetch related threads from same forum
        if (tRes.data?.forum_id) {
          const rRes = await axios.get(`/api/fetch_threads.php?forum_id=${tRes.data.forum_id}&user_id=0`);
          const arr = Array.isArray(rRes.data) ? rRes.data : [];
          const list = arr.filter((x) => Number(x.thread_id) !== Number(thread_id)).slice(0, 5);
          setRelated(list);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('ThreadRightRail load error', e);
      }
      try {
        const sRes = await axios.get('/api/check_session.php', { withCredentials: true });
        if (sRes.data && sRes.data.user_id) setSession(sRes.data);
      } catch (_) {}
    };
    load();
  }, [thread_id]);

  const replyCount = useMemo(() => {
    if (!Array.isArray(posts)) return 0;
    // exclude the original post if present (reply_to null)
    const replies = posts.filter((p) => p.reply_to !== null && p.reply_to !== undefined);
    return replies.length;
  }, [posts]);

  const participants = useMemo(() => {
    const map = new Map();
    (posts || []).forEach((p) => {
      if (!map.has(p.user_id)) {
        const initial = (p.first_name?.[0] || 'U').toUpperCase();
        map.set(p.user_id, { user_id: p.user_id, initial });
      }
    });
    return Array.from(map.values());
  }, [posts]);

  const statusText = useMemo(() => {
    const anyVerified = (posts || []).some((p) => Number(p.verified) === 1);
    return anyVerified ? 'Resolved' : 'Still looking for advice';
  }, [posts]);

  const canModerate = Number(session?.role_id) >= 5; // tweak as needed

  const handleDelete = () => {
    if (!canModerate) return;
    if (window.confirm('Delete this thread?')) {
      alert('Stub: wire to /api/delete_thread.php');
    }
  };
  const handleLock = () => {
    if (!canModerate) return;
    alert('Stub: wire to lock endpoint');
  };
  const handleResolve = () => {
    if (!canModerate) return;
    alert('Stub: mark as Resolved');
  };

  return (
    <div className="right-rail-stack">
      {/* Thread Info */}
      <section className="widget-card" aria-labelledby="thread-info-title">
        <div className="widget-header" style={{ background: 'transparent', color: 'var(--text-color)' }}>
          <h3 id="thread-info-title" className="widget-title" style={{ margin: 0 }}>Thread Info</h3>
        </div>
        <div className="widget-body">
          <div className="ti-row"><span className="ti-label">Replies</span><span className="ti-value">{replyCount}</span></div>
          <div className="ti-row"><span className="ti-label">{statusText}</span></div>
        </div>
      </section>

      {/* Participants */}
      <section className="widget-card" aria-labelledby="participants-title">
        <div className="widget-header" style={{ background: 'transparent', color: 'var(--text-color)' }}>
          <h3 id="participants-title" className="widget-title" style={{ margin: 0 }}>Participants</h3>
        </div>
        <div className="widget-body">
          <div className="participant-avatars">
            {participants.slice(0, 5).map((p) => (
              <div key={p.user_id} className="participant-avatar" title={`User ${p.user_id}`}>{p.initial}</div>
            ))}
            {participants.length > 5 && (
              <div className="participant-avatar more">+{participants.length - 5}</div>
            )}
          </div>
        </div>
      </section>

      {/* Related Threads */}
      <section className="widget-card" aria-labelledby="related-title">
        <div className="widget-header" style={{ background: 'transparent', color: 'var(--text-color)' }}>
          <h3 id="related-title" className="widget-title" style={{ margin: 0 }}>Related Threads</h3>
        </div>
        <div className="widget-body">
          <ul className="widget-list">
            {(related || []).map((t) => (
              <li key={t.thread_id} className="widget-list-item">
                <Link className="widget-link" to={`/info/forum/${t.forum_id || thread?.forum_id}/thread/${t.thread_id}`}>
                  <span className="rt-icon rt-blue" aria-hidden>💬</span>
                  <span>{t.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Moderation Tools */}
      {canModerate && (
        <section className="widget-card" aria-labelledby="modtools-title">
          <div className="widget-header" style={{ background: 'transparent', color: 'var(--text-color)' }}>
            <h3 id="modtools-title" className="widget-title" style={{ margin: 0 }}>Moderation Tools</h3>
          </div>
          <div className="widget-body modtools">
            <button type="button" className="mod-btn danger" onClick={handleDelete}>Delete</button>
            <button type="button" className="mod-btn warning" onClick={handleLock}>Lock</button>
            <button type="button" className="mod-btn success" onClick={handleResolve}>Mark as Resolved</button>
          </div>
        </section>
      )}
    </div>
  );
}

