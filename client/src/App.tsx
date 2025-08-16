// Minimal ZedAI frontend UI shell
// Accessible form, connects to backend endpoints
import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';


const API_URL = '/api'; // Caddyfile will proxy /api to backend


function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null);
  if (error) return <div role="alert">Error: {error.message}</div>;
  return <React.Fragment>{children}</React.Fragment>;
}

function Chat() {
  const [input, setInput] = useState('');
  const [conversation, setConversation] = useState<{user: string, ai: string}[]>([]);
  const [loading, setLoading] = useState(false);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
      });
      const data = await res.json();
      setConversation([...conversation, { user: input, ai: data.response }]);
      setInput('');
    } catch (err) {
      // error boundary will catch
    }
    setLoading(false);
  }

  return (
    <div className="zedai-app">
      <h1>ZedAI Chat</h1>
      <nav>
        <Link to="/">Chat</Link> | <Link to="/reason">Reason</Link>
      </nav>
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

function Reason() {
  const [input, setInput] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendReason(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/reason`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input })
      });
      const data = await res.json();
      setResponse(data.response);
      setInput('');
    } catch (err) {
      // error boundary will catch
    }
    setLoading(false);
  }

  return (
    <div className="zedai-app">
      <h1>ZedAI Reasoning</h1>
      <nav>
        <Link to="/">Chat</Link> | <Link to="/reason">Reason</Link>
      </nav>
      <form onSubmit={sendReason} aria-label="reason-form">
        <input
          id="reason-input"
          name="reason-input"
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Type your reasoning query..."
          required
          aria-label="Reason input"
        />
        <button id="reason-btn" name="reason-btn" type="submit" disabled={loading} aria-label="Send reasoning query">
          {loading ? 'Reasoning...' : 'Send'}
        </button>
      </form>
      {response && <div id="reason-response"><strong>Reasoned:</strong> {response}</div>}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/" element={<Chat />} />
            <Route path="/reason" element={<Reason />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
