import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Messages.css';
import { useSearchParams } from 'react-router-dom';

function Messages({ userData }) {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (userData) {
      fetchConversations();
      const startUser = searchParams.get('user');
      if (startUser) {
        startConversation(Number(startUser));
      }
    }
  }, [userData]);

  const fetchConversations = async () => {
    try {
      const resp = await axios.get(`http://172.16.11.133/api/fetch_conversations.php?user_id=${userData.user_id}`, { withCredentials: true });
      if (resp.data.success) {
        setConversations(resp.data.conversations || []);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  };

  const fetchMessages = async (conversation_id, other_user_id) => {
    try {
      const resp = await axios.get(`http://172.16.11.133/api/fetch_messages.php?conversation_id=${conversation_id}&user_id=${userData.user_id}`, { withCredentials: true });
      if (resp.data.success) {
        setMessages(resp.data.messages || []);
        setActiveConv({ conversation_id, other_user_id });
        fetchConversations();
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const startConversation = async (other_user_id) => {
    const existing = conversations.find(c => Number(c.other_user_id) === other_user_id);
    if (existing) {
      fetchMessages(existing.conversation_id, other_user_id);
    } else {
      setActiveConv({ conversation_id: null, other_user_id });
      setMessages([]);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConv) return;
    try {
      const resp = await axios.post('http://172.16.11.133/api/send_message.php', {
        sender_id: userData.user_id,
        recipient_id: activeConv.other_user_id,
        content: newMessage
      }, { withCredentials: true });
      setNewMessage('');
      const cid = activeConv.conversation_id || resp.data.conversation_id;
      fetchMessages(cid, activeConv.other_user_id);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const searchUsers = async (term) => {
    setSearchTerm(term);
    if (!term) { setSearchResults([]); return; }
    try {
      const resp = await axios.get(`http://172.16.11.133/api/search_users.php?term=${encodeURIComponent(term)}`, { withCredentials: true });
      if (resp.data.success) setSearchResults(resp.data.users);
    } catch (err) { console.error('Error searching users:', err); }
  };

  return (
    <div className="messages-wrapper">
      <div className="conversations-column">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => searchUsers(e.target.value)}
          placeholder="Search users"
          className="message-search"
        />
        {searchResults.length > 0 && (
          <ul className="search-results">
            {searchResults.map((u) => (
              <li key={u.user_id} onClick={() => { setSearchResults([]); startConversation(u.user_id); }}>
                {u.first_name} {u.last_name}
              </li>
            ))}
          </ul>
        )}
        <ul className="conversation-list">
          {conversations.map((c) => (
            <li key={c.conversation_id} onClick={() => fetchMessages(c.conversation_id, c.other_user_id)} className={activeConv && activeConv.conversation_id === c.conversation_id ? 'active' : ''}>
              <span>{c.first_name} {c.last_name}</span>
              {Number(c.unread_count) > 0 && <span className="badge">{c.unread_count}</span>}
              <div className="last-message">{c.last_message}</div>
            </li>
          ))}
        </ul>
      </div>
      <div className="messages-column">
        {activeConv ? (
          <>
            <div className="messages-list">
              {messages.map((m) => (
                <div key={m.message_id} className={m.sender_id === userData.user_id ? 'message-out' : 'message-in'}>
                  {m.content}
                </div>
              ))}
            </div>
            <div className="send-box">
              <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message" />
              <button onClick={handleSend}>Send</button>
            </div>
          </>
        ) : (
          <p>Select a conversation</p>
        )}
      </div>
    </div>
  );
}

export default Messages;
