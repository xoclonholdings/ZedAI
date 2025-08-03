import { useState } from "react";

export default function ChatSimple() {
    const [message, setMessage] = useState("");

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-4">Chat Interface</h1>
                <div className="bg-gray-800 rounded-lg p-4 h-96 overflow-y-auto mb-4">
                    <div className="text-gray-400">Chat messages will appear here...</div>
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    />
                    <button
                        onClick={() => setMessage("")}
                        className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition-colors"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}
