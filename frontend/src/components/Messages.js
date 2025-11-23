import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Messages.css';
import { Link, useSearchParams } from 'react-router-dom';
import { FiSearch, FiSend } from 'react-icons/fi';

function Messages({ userData }) {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [searchParams] = useSearchParams();
  const API_BASE = 'http://172.16.11.133';
  const DEFAULT_AVATAR = '/uploads/avatars/default-avatar.png';

  const buildAvatarSrc = (path) => {
    if (!path) return DEFAULT_AVATAR;
    return path.startsWith('http') ? path : `${API_BASE}${path}`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    return date.toLocaleString(undefined, {
      month: isToday ? undefined : 'short',
      day: isToday ? undefined : 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', '');
  };

  useEffect(() => {
    if (userData) {
      fetchConversations();
    }
  }, [userData]);

  useEffect(() => {
    if (!userData) return;
    const startUser = searchParams.get('user');
    if (startUser) {
      startConversation(Number(startUser));
    }
  }, [searchParams, userData]);

  useEffect(() => {
    if (!activeConv || activeConv.conversation_id) return;
    const existing = conversations.find(
      (c) => Number(c.other_user_id) === Number(activeConv.other_user_id)
    );
    if (existing) {
      fetchMessages(existing.conversation_id, existing.other_user_id, {
        first_name: existing.first_name,
        last_name: existing.last_name,
        avatar_path: existing.avatar_path
      });
    }
  }, [conversations, activeConv]);

  const fetchConversations = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/api/fetch_conversations.php?user_id=${userData.user_id}`, { withCredentials: true });
      if (resp.data.success) {
        setConversations(resp.data.conversations || []);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  };

  const fetchMessages = async (conversation_id, other_user_id, meta = {}) => {
    setLoadingMessages(true);
    try {
      const resp = await axios.get(`${API_BASE}/api/fetch_messages.php?conversation_id=${conversation_id}&user_id=${userData.user_id}`, { withCredentials: true });
      if (resp.data.success) {
        setMessages(resp.data.messages || []);
        setActiveConv({ conversation_id, other_user_id, ...meta });
        fetchConversations();
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const fetchUserProfile = async (userId) => {
    try {
      const resp = await axios.get(`${API_BASE}/api/fetch_user.php?user_id=${userId}`, { withCredentials: true });
      if (resp.data.success) {
        return resp.data.user;
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
    return null;
  };

  const startConversation = async (user) => {
    const other_user_id = typeof user === 'number' ? user : user?.user_id;
    if (!other_user_id) return;
    const existing = conversations.find(c => Number(c.other_user_id) === Number(other_user_id));
    const existingMeta = existing
      ? {
          first_name: existing.first_name,
          last_name: existing.last_name,
          avatar_path: existing.avatar_path,
          headline: existing.headline
        }
      : {};
    const passedMeta = typeof user === 'object' && user
      ? {
          first_name: user.first_name,
          last_name: user.last_name,
          avatar_path: user.avatar_path,
          headline: user.headline
        }
      : {};
    const meta = { ...passedMeta, ...existingMeta };
    if (existing) {
      fetchMessages(existing.conversation_id, other_user_id, meta);
    } else {
      if (!meta.first_name) {
        const profile = await fetchUserProfile(other_user_id);
        if (profile) {
          meta.first_name = profile.first_name;
          meta.last_name = profile.last_name;
          meta.avatar_path = profile.avatar_path;
          meta.headline = profile.headline;
        }
      }
      setActiveConv({ conversation_id: null, other_user_id, ...meta });
      setMessages([]);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConv) return;
    setIsSending(true);
    try {
      const resp = await axios.post(`${API_BASE}/api/send_message.php`, {
        sender_id: userData.user_id,
        recipient_id: activeConv.other_user_id,
        content: newMessage
      }, { withCredentials: true });
      setNewMessage('');
      const cid = activeConv.conversation_id || resp.data.conversation_id;
      fetchMessages(cid, activeConv.other_user_id, {
        first_name: activeConv.first_name,
        last_name: activeConv.last_name,
        avatar_path: activeConv.avatar_path,
        headline: activeConv.headline
      });
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const searchUsers = async (term) => {
    setSearchTerm(term);
    if (!term) { setSearchResults([]); return; }
    try {
      const resp = await axios.get(`${API_BASE}/api/search_users.php?term=${encodeURIComponent(term)}`, { withCredentials: true });
      if (resp.data.success) setSearchResults(resp.data.users);
    } catch (err) { console.error('Error searching users:', err); }
  };

  const handleSearchPick = (user) => {
    setSearchResults([]);
    setSearchTerm('');
    startConversation(user);
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="messages-page">
      <div className="messages-card">
        <div className="conversations-panel">
          <div className="panel-header">
            <h2>Messages</h2>
            <p>Stay connected with your communities and contacts.</p>
          </div>
          <label className="conversation-search">
            <FiSearch />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => searchUsers(e.target.value)}
              placeholder="Search people"
            />
          </label>
          {searchResults.length > 0 && (
            <ul className="search-results">
              {searchResults.map((u) => (
                <li key={u.user_id} onClick={() => handleSearchPick(u)}>
                  <img src={buildAvatarSrc(u.avatar_path)} alt={`${u.first_name} ${u.last_name}`} />
                  <span>{u.first_name} {u.last_name}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="conversation-scroll">
            {conversations.length === 0 ? (
              <div className="empty-copy">
                <h4>No conversations yet</h4>
                <p>Start connecting from a profile or use the search bar above.</p>
              </div>
            ) : (
              <ul className="conversation-list">
                {conversations.map((c) => {
                  const isActive = activeConv && activeConv.conversation_id === c.conversation_id;
                  const unread = Number(c.unread_count) > 0;
                  return (
                    <li
                      key={c.conversation_id}
                      className={`conversation-item ${isActive ? 'active' : ''}`}
                      onClick={() =>
                        fetchMessages(c.conversation_id, c.other_user_id, {
                          first_name: c.first_name,
                          last_name: c.last_name,
                          avatar_path: c.avatar_path
                        })
                      }
                    >
                      <img src={buildAvatarSrc(c.avatar_path)} alt={`${c.first_name} ${c.last_name}`} />
                      <div className="conversation-body">
                        <div className="conversation-meta">
                          <span className="conversation-name">{c.first_name} {c.last_name}</span>
                          <time>{formatTimestamp(c.last_date)}</time>
                        </div>
                        <p className="conversation-preview">{c.last_message}</p>
                      </div>
                      {unread && <span className="badge">{c.unread_count}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <div className="thread-panel">
          {activeConv ? (
            <>
              <div className="thread-header">
                <div className="thread-user">
                  <img src={buildAvatarSrc(activeConv.avatar_path)} alt={`${activeConv.first_name || ''} ${activeConv.last_name || ''}`} />
                  <div>
                    <h3>{activeConv.first_name} {activeConv.last_name}</h3>
                    {activeConv.headline && <p>{activeConv.headline}</p>}
                  </div>
                </div>
                <Link to={`/user/${activeConv.other_user_id}`} className="profile-link">View profile</Link>
              </div>
              <div className="messages-scroll">
                {loadingMessages ? (
                  <div className="empty-copy">
                    <p>Loading conversation...</p>
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((m) => (
                    <div
                      key={m.message_id}
                      className={`message-bubble ${m.sender_id === userData.user_id ? 'message-out' : 'message-in'}`}
                    >
                      <p>{m.content}</p>
                      <span>{formatTimestamp(m.created_at)}</span>
                    </div>
                  ))
                ) : (
                  <div className="empty-copy">
                    <h4>No messages yet</h4>
                    <p>
                      {activeConv.conversation_id
                        ? 'This conversation is all caught up.'
                        : `Say hello to ${activeConv.first_name || 'this member'} to get things started.`}
                    </p>
                  </div>
                )}
              </div>
              <div className="composer">
                <textarea
                  value={newMessage}
                  placeholder="Write a message"
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleComposerKeyDown}
                />
                <button onClick={handleSend} disabled={!newMessage.trim() || isSending}>
                  <FiSend />
                  {isSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </>
          ) : (
            <div className="empty-copy centered">
              <h3>Select a conversation</h3>
              <p>Choose a thread on the left or search for a member to begin chatting.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Messages;
