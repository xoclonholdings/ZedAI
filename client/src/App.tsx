// Minimal ZedAI frontend UI shell
// Accessible form, connects to backend endpoints
import React, { useState } from 'react';

const API_URL = '/api'; // Caddyfile will proxy /api to backend

export default function App() {
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);

  // Send message to backend /ai endpoint
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch(`${API_URL}/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: input })
    });
    const data = await res.json();
    setConversation([...conversation, { user: input, ai: data.response }]);
    setInput('');
    setLoading(false);
  }

  return (
    <div className="zedai-app">
      <h1>ZedAI Chat</h1>
      <form onSubmit={sendMessage} aria-label="chat-form">
        <input
          id="chat-input"
          name="chat-input"
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your message..."
          required
          aria-label="Message input"
        />
        <button id="send-btn" name="send-btn" type="submit" disabled={loading} aria-label="Send message">
          {loading ? 'Sending...' : 'Send'}
        </button>
      </form>
      <ul id="conversation-list" aria-label="Conversation history">
        {conversation.map((turn, i) => (
          <li key={i}>
            <strong>You:</strong> {turn.user}<br />
            <strong>ZED:</strong> {turn.ai}
          </li>
        ))}
      </ul>
    </div>
  );
}
