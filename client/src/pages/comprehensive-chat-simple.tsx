import React, { useState } from 'react';

export default function ComprehensiveChatSimple() {
	const [message, setMessage] = useState("");
	const [reply, setReply] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setReply("");
		try {
			const res = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ message }),
			});
			const data = await res.json();
			if (data.reply) setReply(data.reply);
			else setReply(data.error || "No reply received.");
		} catch (err) {
			setReply("Error connecting to backend.");
		}
		setLoading(false);
	};

	return (
		<div>
			<h2>Comprehensive Chat Simple Page</h2>
			<form onSubmit={handleSubmit}>
				<label htmlFor="chat-message">Message:</label>
				<textarea
					id="chat-message"
					name="chat-message"
					rows={4}
					cols={50}
					placeholder="Type your message here..."
					value={message}
					onChange={e => setMessage(e.target.value)}
				></textarea>
				<br />
				<button type="submit" disabled={loading || !message.trim()}>
					{loading ? "Sending..." : "Send"}
				</button>
			</form>
			{reply && (
				<div style={{ marginTop: "1em", padding: "1em", border: "1px solid #ccc" }}>
					<strong>ZedAI Reply:</strong>
					<div>{reply}</div>
				</div>
			)}
		</div>
	);
}
