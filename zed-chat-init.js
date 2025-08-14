// zed-chat-init.js
(() => {
  // Configuration
  const CHAT_API_URL = window.ZED_CHAT_API_URL || 'http://localhost:5001/chat';

  // DOM Elements
  const chatContainer = document.getElementById('zed-chat-container');
  const input = document.getElementById('zed-chat-input');
  const sendBtn = document.getElementById('zed-chat-send');

  // Utility: Safe DOM append
  function appendMessage(text, sender = 'user') {
    const msgDiv = document.createElement('div');
    msgDiv.className = `zed-chat-msg zed-chat-msg-${sender}`;
    msgDiv.textContent = text;
    chatContainer.appendChild(msgDiv);
  }

  // Send message to backend
  async function sendMessage(message) {
    appendMessage(message, 'user');
    try {
      const res = await fetch(CHAT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      if (!res.ok) throw new Error(`Network error: ${res.status}`);
      const data = await res.json();
      if (data.reply) {
        appendMessage(data.reply, 'bot');
      } else {
        appendMessage('No reply received.', 'bot');
      }
    } catch (err) {
      appendMessage(`Error: ${err.message}`, 'error');
      // Optionally log error to a remote endpoint here
    }
  }

  // Event listeners
  sendBtn.addEventListener('click', () => {
    const msg = input.value.trim();
    if (msg) {
      sendMessage(msg);
      input.value = '';
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendBtn.click();
    }
  });

  // Initialize chat on page load
  document.addEventListener('DOMContentLoaded', () => {
    appendMessage('Welcome to ZED AI Chat!', 'bot');
  });

  // Expose sendMessage for external use
  window.ZEDSendMessage = sendMessage;
})();
