import React, { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL;

export default function LandingOnboarding() {
	const [input, setInput] = useState('');
	const [reply, setReply] = useState('');
	const [loading, setLoading] = useState(false);

	async function sendMessage(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setLoading(true);
		try {
			const res = await fetch(`${API_URL}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: input })
			});
			const data = await res.json();
			setReply(data.reply);
			setInput('');
		} catch (err) {
			setReply('Error connecting to backend.');
		}
		setLoading(false);
	}

	return (
		<div>
			<h1>Landing & Onboarding Page</h1>
			<form onSubmit={sendMessage}>
				<input
					type="text"
					value={input}
					onChange={e => setInput(e.target.value)}
					placeholder="Type your message..."
					required
				/>
				<button type="submit" disabled={loading}>
					{loading ? 'Sending...' : 'Send'}
				</button>
			</form>
			{reply && <div><strong>ZED:</strong> {reply}</div>}
		</div>
	);
}
