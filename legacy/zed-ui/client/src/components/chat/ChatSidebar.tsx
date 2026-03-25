import { useState } from "react";
import { 
  MessageSquare, 
  Plus, 
  User, 
  X, 
  Settings,
  Save
} from "lucide-react";

interface ChatSidebarProps {
  conversations: any[];
  onClose?: () => void;
  isMobile?: boolean;
}

export default function ChatSidebar({ conversations, onClose, isMobile = false }: ChatSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<'chat' | 'settings'>('chat');
  
  // Authentication settings state
  const [apiKey, setApiKey] = useState(localStorage.getItem('zed-api-key') || '');
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('zed-server-url') || 'http://localhost:3001');
  const [username, setUsername] = useState(localStorage.getItem('zed-username') || '');

  const saveSettings = () => {
    localStorage.setItem('zed-api-key', apiKey);
    localStorage.setItem('zed-server-url', serverUrl);
    localStorage.setItem('zed-username', username);
    console.log('Settings saved successfully');
  };

  if (isCollapsed) {
    return (
      <div className="w-16 flex flex-col items-center py-4 space-y-4 bg-black/80 backdrop-blur-sm border-r border-white/10">
        <button
          onClick={() => setIsCollapsed(false)}
          className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center transition-colors"
        >
          <MessageSquare size={20} className="text-white" />
        </button>
        
        <button 
          onClick={() => console.log("New conversation")}
          className="w-10 h-10 bg-purple-600 hover:bg-purple-700 rounded-xl flex items-center justify-center transition-colors"
        >
          <Plus size={20} className="text-white" />
        </button>

        <div className="w-full flex justify-center">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${isMobile ? 'w-full h-screen' : 'w-80 h-full'} flex flex-col relative bg-black/80 backdrop-blur-sm ${isMobile ? '' : 'border-r'} border-purple-500/30`}>
      {/* Header */}
      <div className="p-6 border-b border-white/10 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div>
              <h2 className="text-xl font-bold flex items-center space-x-2">
                <div className="w-5 h-5 bg-gradient-to-r from-purple-500 via-cyan-500 to-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">Z</span>
                </div>
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">ZED</span>
              </h2>
              <p className="text-xs text-gray-400">Enhanced AI Assistant</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {isMobile ? (
              <button
                onClick={onClose}
                className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center p-0 text-gray-300 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            ) : (
              <button
                onClick={() => setIsCollapsed(true)}
                className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center p-0 text-gray-300 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* New Conversation Button */}
        <button
          onClick={() => console.log("New conversation")}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl p-4 text-white font-medium transition-all duration-300"
        >
          <div className="flex items-center justify-center space-x-2">
            <Plus size={18} />
            <span>New Conversation</span>
          </div>
        </button>

        {/* Navigation Tabs */}
        <div className="mt-4 flex bg-gray-800/50 rounded-xl p-1">
          <button
            onClick={() => setActiveSection('chat')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeSection === 'chat' 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveSection('settings')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center space-x-1 ${
              activeSection === 'settings' 
                ? 'bg-purple-600 text-white' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 px-4 overflow-y-auto">
        {activeSection === 'chat' && (
          <div className="space-y-2 py-4">
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs">Start a new chat to begin</p>
              </div>
            ) : (
              conversations.map((conversation, index) => (
                <div
                  key={index}
                  className="group relative p-3 rounded-xl cursor-pointer transition-all bg-gray-800/50 hover:bg-gray-700/50"
                  onClick={() => console.log("Open conversation:", conversation)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-white truncate mb-1">
                        {conversation.title || 'New Conversation'}
                      </h3>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">Today</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeSection === 'settings' && (
          <div className="py-4 space-y-4">
            <h3 className="text-lg font-medium text-white mb-4">Authentication Settings</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors"
                placeholder="Enter your API key"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Server URL</label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors"
                placeholder="http://localhost:3001"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none transition-colors"
                placeholder="Enter your username"
              />
            </div>

            <button
              onClick={saveSettings}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <Save size={16} />
              <span>Save Settings</span>
            </button>
          </div>
        )}
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center">
            <User size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">ZED Admin</p>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-400">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 relative z-10">
        <div className="flex items-center justify-center space-x-2 text-xs text-gray-400">
          <span>Enhanced AI Assistant</span>
          <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
          <span>Local Setup</span>
        </div>
      </div>
    </div>
  );
}