import React, { useState, useEffect } from 'react';
import { getApiUrl } from '../config/api';
import { API_CONFIG } from '../config/api';

const [apiUrl, setApiUrl] = useState<string>('/api');

export default function LandingOnboarding() {
	const [input, setInput] = useState('');
	const [messages, setMessages] = useState<Array<{ type: 'user' | 'ai'; content: string }>>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		getApiUrl().then(setApiUrl);
	}, []);

	async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!input.trim()) return;

		setLoading(true);
		// Add user message immediately
		setMessages(prev => [...prev, { type: 'user', content: input }]);
		
		try {
			const res = await fetch(`${apiUrl}${API_CONFIG.endpoints.chat}`, {
				method: 'POST',
				headers: API_CONFIG.headers,
				body: JSON.stringify({ message: input })
			});
			const data = await res.json();
			
			// Add AI response
			setMessages(prev => [...prev, { type: 'ai', content: data.reply || 'No response' }]);
			setInput('');
		} catch (err) {
			setMessages(prev => [...prev, { type: 'ai', content: 'Error connecting to backend.' }]);
		}
		setLoading(false);
	}

	return (
		<div className="flex h-screen">
			{/* Sidebar */}
			<aside className="w-64 bg-gray-800 text-white p-4">
				<h2 className="text-xl font-bold mb-4">ZedAI Chat</h2>
				<nav>
					<ul>
						<li className="mb-2">
							<button className="w-full text-left py-2 px-4 rounded hover:bg-gray-700">
								New Chat
							</button>
						</li>
						{/* Add more sidebar items as needed */}
					</ul>
				</nav>
			</aside>

			{/* Main Chat Area */}
			<main className="flex-1 flex flex-col">
				<div className="flex-1 overflow-auto p-4">
					{messages.map((message, index) => (
						<div
							key={index}
							className={`mb-4 p-4 rounded-lg ${
								message.type === 'user' 
									? 'bg-blue-100 ml-auto max-w-[80%]' 
									: 'bg-gray-100 mr-auto max-w-[80%]'
							}`}
						>
							{message.content}
						</div>
					))}
				</div>

				{/* Chat Input */}
				<div className="border-t p-4">
					<form onSubmit={sendMessage} className="flex gap-2">
						<label htmlFor="onboarding-message" className="sr-only">
							Message
						</label>
						<input
							id="onboarding-message"
							name="onboarding-message"
							type="text"
							value={input}
							onChange={e => setInput(e.target.value)}
							placeholder="Type your message..."
							required
							aria-label="Message input"
							className="flex-1 p-2 border rounded"
							disabled={loading}
						/>
						<button
							type="submit"
							disabled={loading}
							className={`px-4 py-2 rounded ${
								loading 
									? 'bg-gray-400' 
									: 'bg-blue-500 hover:bg-blue-600'
							} text-white`}
						>
							{loading ? 'Sending...' : 'Send'}
						</button>
					</form>
				</div>
			</main>
		</div>
	);
}
