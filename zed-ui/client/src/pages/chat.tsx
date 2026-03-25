import { useState, useEffect } from "react";
import ChatSidebar from "@/components/chat/ChatSidebar";
import { Menu, X } from "lucide-react";

interface AuthSettings {
  apiKey?: string;
  serverUrl?: string;
  username?: string;
}

function SettingsModal({ 
  isOpen, 
  onClose, 
  settings, 
  onSave 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  settings: AuthSettings;
  onSave: (settings: AuthSettings) => void;
}) {
  const [formData, setFormData] = useState<AuthSettings>(settings);

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 rounded-lg border border-purple-500 w-96">
        <h2 className="text-xl font-bold text-purple-400 mb-4">Settings</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={formData.apiKey || ''}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
              placeholder="Enter your API key"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Server URL
            </label>
            <input
              type="text"
              value={formData.serverUrl || ''}
              onChange={(e) => setFormData({ ...formData, serverUrl: e.target.value })}
              className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
              placeholder="https://api.example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <input
              type="text"
              value={formData.username || ''}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full p-2 bg-gray-800 border border-gray-600 rounded text-white"
              placeholder="Your username"
            />
          </div>
        </div>
        
        <div className="flex gap-2 mt-6">
          <button
            onClick={handleSave}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition-colors"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Chat() {
  const [showSettings, setShowSettings] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [settings, setSettings] = useState<AuthSettings>(() => {
    // Load settings from localStorage on mount
    const saved = localStorage.getItem('zed-settings');
    return saved ? JSON.parse(saved) : {};
  });

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(true); // Always show sidebar on desktop
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSaveSettings = (newSettings: AuthSettings) => {
    setSettings(newSettings);
    localStorage.setItem('zed-settings', JSON.stringify(newSettings));
  };

  // Mock conversations data
  const conversations: any[] = [];

  return (
    <div className="flex h-screen bg-black relative overflow-hidden">
      {/* Cyberpunk Grid Background */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{
             backgroundImage: `
               linear-gradient(rgba(139, 0, 255, 0.3) 1px, transparent 1px),
               linear-gradient(90deg, rgba(139, 0, 255, 0.3) 1px, transparent 1px)
             `,
             backgroundSize: '40px 40px'
           }} />
      
      {/* Cyberpunk Glow Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl zed-float" />
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl zed-float" style={{ animationDelay: '4s' }} />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-pink-500/5 rounded-full blur-3xl zed-float" style={{ animationDelay: '2s' }} />
      </div>
      
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="fixed top-4 left-4 z-50 w-12 h-12 rounded-xl bg-black/80 backdrop-blur-sm border border-purple-500/30 hover:bg-purple-500/20 transition-all duration-200 flex items-center justify-center"
        >
          {isSidebarOpen ? (
            <X size={20} className="text-white" />
          ) : (
            <Menu size={20} className="text-white" />
          )}
        </button>
      )}

      {/* Mobile Backdrop */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Responsive */}
      <div className={`
        ${isMobile ? 'fixed left-0 top-0 h-full w-80 z-50 transform transition-transform duration-300' : 'relative w-80 flex-shrink-0'} 
        ${isMobile && !isSidebarOpen ? '-translate-x-full' : 'translate-x-0'}
      `}>
        <ChatSidebar 
          conversations={conversations} 
          onClose={() => setIsSidebarOpen(false)}
          isMobile={isMobile}
        />
      </div>
      
      {/* Chat Area - Responsive */}
      <div className="flex-1 flex flex-col">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="text-center text-gray-500 py-8">
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-500 via-cyan-500 to-pink-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-xl">Z</span>
                  </div>
                </div>
                <p className="text-xl">Welcome to ZED Chat!</p>
                <p className="text-sm mt-2 text-gray-400">
                  Enhanced AI assistant ready to help
                </p>
                {settings.username && (
                  <p className="text-sm mt-1 text-purple-400">
                    Connected as: {settings.username}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-800 p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="flex-1 p-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                />
                <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors">
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />
    </div>
  );
}