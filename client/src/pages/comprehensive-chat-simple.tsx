import { useState } from "react";

export default function ComprehensiveChat() {
    const [activeTab, setActiveTab] = useState('chat');

    return (
        <div className="min-h-screen bg-black cyberpunk-bg">
            {/* Header */}
            <header className="border-b border-gray-800 bg-black/50 backdrop-blur-lg">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-sm">Z</span>
                        </div>
                        <h1 className="text-xl font-bold text-white">ZED AI</h1>
                    </div>

                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-green-400 text-sm">Connected</span>
                        </div>
                        <button
                            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
                            title="Settings"
                            aria-label="Settings"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </header>

            <div className="flex h-[calc(100vh-80px)]">
                {/* Sidebar */}
                <div className="w-64 bg-gray-900/50 border-r border-gray-800 backdrop-blur-lg">
                    <div className="p-4">
                        <h2 className="text-white font-semibold mb-4">Chat Controls</h2>

                        <div className="space-y-2">
                            <button
                                onClick={() => setActiveTab('chat')}
                                className={`w-full text-left p-3 rounded-lg transition-colors ${activeTab === 'chat'
                                        ? 'bg-purple-500 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                    }`}
                            >
                                💬 Chat
                            </button>

                            <button
                                onClick={() => setActiveTab('satellite')}
                                className={`w-full text-left p-3 rounded-lg transition-colors ${activeTab === 'satellite'
                                        ? 'bg-purple-500 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                    }`}
                            >
                                🛰️ Satellite
                            </button>

                            <button
                                onClick={() => setActiveTab('memory')}
                                className={`w-full text-left p-3 rounded-lg transition-colors ${activeTab === 'memory'
                                        ? 'bg-purple-500 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                    }`}
                            >
                                🧠 Memory
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col">
                    {/* Chat Messages */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        <div className="max-w-4xl mx-auto space-y-6">
                            {/* Welcome Message */}
                            <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-lg p-6">
                                <div className="flex items-center space-x-3 mb-3">
                                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full flex items-center justify-center">
                                        <span className="text-white font-bold text-sm">Z</span>
                                    </div>
                                    <span className="text-white font-semibold">ZED AI</span>
                                </div>
                                <p className="text-gray-300 leading-relaxed">
                                    Welcome to ZED AI! I'm your advanced artificial intelligence assistant with satellite connectivity,
                                    intelligent memory systems, and comprehensive chat capabilities. How can I help you today?
                                </p>
                            </div>

                            {/* Sample Conversation */}
                            <div className="space-y-4">
                                <div className="flex justify-end">
                                    <div className="bg-blue-600 text-white rounded-lg p-4 max-w-md">
                                        Hello ZED! Can you help me understand your satellite connectivity features?
                                    </div>
                                </div>

                                <div className="flex justify-start">
                                    <div className="bg-gray-800 text-gray-300 rounded-lg p-4 max-w-md">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full flex items-center justify-center">
                                                <span className="text-white font-bold text-xs">Z</span>
                                            </div>
                                            <span className="text-sm text-gray-400">ZED AI</span>
                                        </div>
                                        Absolutely! My satellite connectivity allows for global communication even in remote areas.
                                        I can maintain connections through multiple satellite networks, ensuring reliable AI assistance anywhere on Earth.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chat Input */}
                    <div className="border-t border-gray-800 p-4 bg-gray-900/50 backdrop-blur-lg">
                        <div className="max-w-4xl mx-auto">
                            <div className="flex space-x-4">
                                <input
                                    type="text"
                                    placeholder="Type your message..."
                                    className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700"
                                />
                                <button className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-cyan-700 transition-all duration-200 font-medium">
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Panel */}
                <div className="w-80 bg-gray-900/50 border-l border-gray-800 backdrop-blur-lg">
                    <div className="p-4">
                        <h3 className="text-white font-semibold mb-4">System Status</h3>

                        <div className="space-y-4">
                            {/* Connection Status */}
                            <div className="bg-gray-800/50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-gray-400 text-sm">Satellite Link</span>
                                    <div className="flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <span className="text-green-400 text-xs">Active</span>
                                    </div>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div className="bg-green-500 h-2 rounded-full w-5/6"></div>
                                </div>
                                <span className="text-xs text-gray-500 mt-1">Signal: 85%</span>
                            </div>

                            {/* Memory Usage */}
                            <div className="bg-gray-800/50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-gray-400 text-sm">Memory Usage</span>
                                    <span className="text-blue-400 text-xs">67%</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div className="bg-blue-500 h-2 rounded-full w-2/3"></div>
                                </div>
                            </div>

                            {/* AI Processing */}
                            <div className="bg-gray-800/50 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-gray-400 text-sm">AI Processing</span>
                                    <span className="text-purple-400 text-xs">Running</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2">
                                    <div className="bg-purple-500 h-2 rounded-full animate-pulse w-2/5"></div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="mt-6">
                            <h4 className="text-white text-sm font-medium mb-3">Quick Actions</h4>
                            <div className="space-y-2">
                                <button className="w-full text-left p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded text-sm transition-colors">
                                    📊 View Analytics
                                </button>
                                <button className="w-full text-left p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded text-sm transition-colors">
                                    🔧 System Settings
                                </button>
                                <button className="w-full text-left p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded text-sm transition-colors">
                                    📱 Mobile Sync
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
