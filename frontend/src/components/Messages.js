// src/components/Messages.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Messages.css';

function Messages({ userData }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // For now, we'll fetch placeholder messages.
  // Replace this logic with your actual messaging API later.
  useEffect(() => {
    // Simulate a network request with a timeout
    setTimeout(() => {
      // Example placeholder messages:
      setMessages([
        { id: 1, from: 'Alice', text: 'Hey, how are you?' },
        { id: 2, from: 'Bob', text: 'Did you see the latest news?' },
        { id: 3, from: 'Charlie', text: 'Let’s catch up soon!' }
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) return <p>Loading messages...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className="messages-container">
      <h1>Messages</h1>
      <ul className="messages-list">
        {messages.map((msg) => (
          <li key={msg.id} className="message-item">
            <div className="message-sender">{msg.from}</div>
            <div className="message-text">{msg.text}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Messages;
