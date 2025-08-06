import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

import {
  MessageSquare,
  Trash2,
  User,
  X,
  Camera,
  Shield,
  Database,
  Bot,
  LogOut,
  Settings,
  Bell,
  Satellite,
  Server,
  RefreshCw,
  Download,
  Upload,
  HelpCircle
} from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuthProvider.tsx";
import { apiRequest } from "@/lib/queryClient";
import type { Conversation } from "@shared/schema";

interface ChatSidebarProps {
  conversations: Conversation[];
  onClose?: () => void;
  isMobile?: boolean;
}

export default function ChatSidebar({ conversations = [], onClose, isMobile = false }: ChatSidebarProps) {
  const [location, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [currentMode, setCurrentMode] = useState<"chat" | "agent">("chat");
  const [notifications, setNotifications] = useState(true);
  const [dataSharing, setDataSharing] = useState(false);
  const [analytics, setAnalytics] = useState(true);

  // Panel overlay states
  const [activePanel, setActivePanel] = useState<"alerts" | "privacy" | "data" | "satellite" | "advanced" | "help" | null>(null);

  // Database connection states
  const [databaseStats, setDatabaseStats] = useState({
    connected: false,
    lastSync: null as string | null,
    recordCount: 0,
    storageUsed: "0 MB"
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Zebulon Oracle Database Functions
  const handleDatabaseSync = async () => {
    setIsSyncing(true);
    try {
      const response = await apiRequest('/api/zed-memory/sync-database', 'POST');

      setDatabaseStats({
        connected: true,
        lastSync: new Date().toISOString(),
        recordCount: response.recordCount || 0,
        storageUsed: response.storageUsed || "0 MB"
      });

      toast({
        title: "Database Sync Complete",
        description: `Synchronized ${response.recordCount} records with Zebulon Oracle`,
      });
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: "Failed to sync with Zebulon Oracle Database",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDatabaseBackup = async () => {
    try {
      const response = await apiRequest('/api/zed-memory/backup', 'POST');

      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zebulon-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Backup Complete",
        description: "Zebulon Oracle Database backup downloaded",
      });
    } catch (error) {
      toast({
        title: "Backup Failed",
        description: "Failed to create database backup",
        variant: "destructive",
      });
    }
  };

  const handleDatabaseRestore = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          const data = JSON.parse(text);

          const response = await apiRequest('/api/zed-memory/restore', 'POST', { backupData: data });

          toast({
            title: "Restore Complete",
            description: `Restored ${response.restoredCount} records to Zebulon Oracle`,
          });
        } catch (error) {
          toast({
            title: "Restore Failed",
            description: "Failed to restore database backup",
            variant: "destructive",
          });
        }
      }
    };
    input.click();
  };

  // Settings save/load functionality
  const handleSaveSettings = async () => {
    try {
      const settings = {
        userProfile: {
          name: userName,
          avatar: userAvatar,
          language: interfaceLanguage,
          timezone
        },
        chatBehavior,
        accessibility: accessibilitySettings,
        interface: {
          theme,
          language,
          responseStyle
        },
        preferences: {
          notifications,
          dataSharing,
          analytics,
          contextMemory
        }
      };

      // Try to save to API first
      try {
        await apiRequest('/api/settings/save', 'POST', settings);
        toast({
          title: "Settings Saved",
          description: "Your preferences have been saved to the cloud",
        });
      } catch (apiError) {
        // Fallback to localStorage
        localStorage.setItem('zed-settings', JSON.stringify(settings));
        toast({
          title: "Settings Saved Locally",
          description: "Settings saved to browser storage",
        });
      }
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  // Individual setting states
  const [newMessages, setNewMessages] = useState(true);
  const [systemUpdates, setSystemUpdates] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [encryption, setEncryption] = useState(true);
  const [anonymousAnalytics, setAnonymousAnalytics] = useState(false);
  const [cloudSync, setCloudSync] = useState(true);
  const [contextMemory, setContextMemory] = useState(true);
  const [theme, setTheme] = useState("cyberpunk");
  const [language, setLanguage] = useState("en");
  const [responseStyle, setResponseStyle] = useState("balanced");

  // Comprehensive Personalization Settings
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState("👤");
  const [interfaceLanguage, setInterfaceLanguage] = useState("en");
  const [timezone, setTimezone] = useState("auto");
  const [chatBehavior, setChatBehavior] = useState({
    autoSave: true,
    quickReplies: true,
    typingIndicator: true,
    readReceipts: true
  });
  const [accessibilitySettings, setAccessibilitySettings] = useState({
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    screenReader: false
  });

  // Satellite settings
  const [satelliteConnected, setSatelliteConnected] = useState(true);
  const [satelliteAutoConnect, setSatelliteAutoConnect] = useState(true);
  const [satelliteLowLatency, setSatelliteLowLatency] = useState(false);
  const [satelliteSignalStrength, setSatelliteSignalStrength] = useState(87);
  const [satelliteLatency, setSatelliteLatency] = useState(245);
  const [satelliteBandwidth, setSatelliteBandwidth] = useState(125);

  const { user, logout } = useAuth();
  const { toast } = useToast();

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/conversations/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const formatDate = (dateInput: string | Date | null): string => {
    if (!dateInput) return "";

    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return "Today";
    } else if (diffInHours < 168) {
      return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
    } else {
      return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
    }
  };

  const handleDeleteConversation = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    await deleteConversationMutation.mutateAsync(id);

    if (location.includes(id)) {
      navigate('/chat');
    }
  };

  return (
    <div className={`${isMobile ? 'w-full h-screen-mobile' : 'w-80 h-full'} flex flex-col relative zed-glass ${isMobile ? '' : 'border-r'} border-purple-500/30 backdrop-blur-xl`}>
      {/* Enhanced Multi-layered Cyberpunk Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Layer 1 - Main floating orbs */}
        <div className="absolute top-10 left-4 w-20 h-20 bg-purple-600/10 rounded-full blur-2xl zed-float" />
        <div className="absolute bottom-20 right-4 w-16 h-16 bg-cyan-500/10 rounded-full blur-xl zed-float" />

        {/* Layer 2 - Secondary depth orbs */}
        <div className="absolute top-1/3 right-2 w-12 h-12 bg-pink-500/8 rounded-full blur-xl animate-pulse animation-delay-1000" />
        <div className="absolute bottom-1/3 left-2 w-8 h-8 bg-purple-400/8 rounded-full blur-lg animate-pulse animation-delay-2000" />

        {/* Layer 3 - Floating particles */}
        <div className="absolute top-20 right-6 w-2 h-2 bg-cyan-300 rounded-full opacity-40 animate-bounce animation-delay-500" />
        <div className="absolute top-1/2 left-6 w-1.5 h-1.5 bg-purple-300 rounded-full opacity-30 animate-bounce animation-delay-1500" />
        <div className="absolute bottom-24 right-8 w-1 h-1 bg-pink-300 rounded-full opacity-50 animate-bounce animation-delay-2500" />

        {/* Layer 5 - Gradient overlays for depth */}
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-purple-500/5 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-cyan-500/5 to-transparent" />
      </div>

      {/* Enhanced Header with Glass Effect */}
      <div className="p-2 sm:p-3 border-b border-white/10 relative z-10">
        {/* Glass backdrop for header */}
        <div className="absolute inset-0 bg-white/5 backdrop-blur-md border-b border-white/10 rounded-t-lg"></div>

        <div className="flex items-center justify-between mb-2 relative z-10">
          <div className="flex items-center space-x-2">
            {/* Enhanced User Profile Photo Button with 3D effect */}
            <div className="relative group">
              {/* Glow effect background */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full blur-md opacity-30 group-hover:opacity-50 transition-opacity transform scale-110"></div>

              <div
                className="relative w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-all duration-300 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 border border-white/20 profile-btn-3d"
                onClick={() => document.getElementById('profile-upload')?.click()}
              >
                {user ? (
                  <img
                    src={`/api/auth/profile-picture/${user.id}`}
                    alt={user.name || "User"}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to default user icon if image fails to load
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <User size={16} className={`text-white ${user ? 'hidden' : ''}`} />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-purple-500 rounded-full flex items-center justify-center border border-black group-hover:bg-purple-400 transition-colors">
                {isUploadingPicture ? (
                  <div className="w-1.5 h-1.5 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera size={6} className="text-white" />
                )}
              </div>
              {/* Hover tooltip */}
              <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                Click to upload photo
              </div>
              {/* Hidden file input */}
              <input
                id="profile-upload"
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploadingPicture}
                title="Upload profile picture"
                placeholder="Choose a profile picture"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setIsUploadingPicture(true);
                    try {
                      const formData = new FormData();
                      formData.append('profilePicture', file);

                      const response = await fetch('/api/auth/profile-picture', {
                        method: 'POST',
                        body: formData,
                      });

                      if (response.ok) {
                        await response.json();
                        toast({
                          title: "Profile picture updated",
                          description: "Your profile picture has been successfully updated!",
                        });
                        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                      } else {
                        const error = await response.json();
                        throw new Error(error.error || 'Upload failed');
                      }
                    } catch (error) {
                      console.error('Upload error:', error);
                      toast({
                        title: "Upload failed",
                        description: error instanceof Error ? error.message : "Failed to upload profile picture. Please try again.",
                        variant: "destructive",
                      });
                    } finally {
                      setIsUploadingPicture(false);
                      // Reset the input so the same file can be selected again
                      e.target.value = '';
                    }
                  }
                }}
              />
            </div>

            <div className="text-left">
              <h1 className="text-sm font-bold tracking-wide">
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent drop-shadow-lg transform hover:scale-105 transition-transform duration-300 cursor-default">ZED</span>
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block font-medium tracking-wide">
                {user?.name || user?.email || "User"}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {/* Enhanced close button with glass effect */}
            <div className="relative">
              <div className="absolute inset-0 bg-white/5 backdrop-blur-sm rounded-lg"></div>
              <Button
                onClick={onClose}
                variant="ghost"
                size="sm"
                className="relative w-8 h-8 zed-button rounded-lg p-0 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all duration-300 transform hover:scale-105 border border-white/10"
              >
                <X size={14} />
              </Button>
            </div>
          </div>
        </div>

        {/* Enhanced Chat/Agent Mode Toggle with depth effects */}
        <div className="relative mt-2">
          {/* Background glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-cyan-500/20 to-pink-500/20 rounded-lg blur-sm"></div>

          <div className="relative flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-purple-500/10 via-cyan-500/10 to-pink-500/10 border border-purple-500/30 backdrop-blur-sm shadow-lg shadow-purple-500/20">
            <div className="flex items-center space-x-2">
              {/* Enhanced mode icon with 3D effect */}
              <div className={`w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-r ${currentMode === 'chat' ? 'from-cyan-500 to-blue-500' : 'from-purple-500 to-pink-500'} shadow-lg transform hover:scale-110 transition-transform duration-300 border border-white/20 mode-toggle-3d`}>
                {currentMode === 'chat' ? <MessageSquare size={12} className="text-white drop-shadow-sm" /> : <Bot size={12} className="text-white drop-shadow-sm" />}
              </div>
              <div>
                <div className="text-xs font-semibold tracking-wide bg-gradient-to-r from-purple-300 to-cyan-300 bg-clip-text text-transparent drop-shadow-lg transform hover:scale-105 transition-transform duration-300 cursor-default">
                  {currentMode === 'chat' ? 'Chat' : 'Agent'} Mode
                </div>
              </div>
            </div>

            {/* Enhanced toggle button with 3D effects */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 to-cyan-500/30 rounded-full blur-md"></div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMode(currentMode === 'chat' ? 'agent' : 'chat')}
                className="relative h-6 w-12 p-0 rounded-full bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-400/30 hover:border-purple-300/50 transition-all duration-300 transform hover:scale-105 shadow-lg mode-toggle-3d"
              >
                <div className={`absolute w-4 h-4 bg-gradient-to-r from-white to-purple-100 rounded-full transition-transform shadow-lg border border-white/30 ${currentMode === 'agent' ? 'translate-x-2' : '-translate-x-2'} mode-slider-3d`} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Chat History Section */}
      <div className="flex-1 px-2 overflow-y-auto relative">
        {/* Overlay Panels */}
        {activePanel && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-20 rounded-lg">
            <div className="bg-gradient-to-br from-purple-900/80 to-cyan-900/80 backdrop-blur-xl border border-purple-500/30 rounded-lg h-full p-2">
              {/* Panel Header */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold tracking-wide bg-gradient-to-r from-purple-300 to-cyan-300 bg-clip-text text-transparent drop-shadow-sm">
                  {activePanel === 'alerts' && 'Notifications'}
                  {activePanel === 'privacy' && 'Privacy'}
                  {activePanel === 'data' && 'Data'}
                  {activePanel === 'satellite' && 'Satellite Settings'}
                  {activePanel === 'advanced' && 'Settings & Configuration'}
                  {activePanel === 'help' && 'Help & FAQs'}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActivePanel(null)}
                  className="w-5 h-5 p-0 rounded-full hover:bg-white/10"
                >
                  <X size={10} />
                </Button>
              </div>

              {/* Panel Content - No scrolling, compact layout */}
              <div className="space-y-2 h-full overflow-hidden">
                {activePanel === 'alerts' && (
                  <div className="space-y-2">
                    {/* Main Toggle */}
                    <div className="flex items-center justify-between p-1.5 rounded bg-white/5">
                      <div className="flex items-center space-x-1.5">
                        <Bell size={12} className="text-purple-400" />
                        <span className="text-xs">Notifications</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setNotifications(!notifications)}
                        className={`h-4 w-8 p-0 rounded-full relative ${notifications ? 'bg-purple-500/30' : 'bg-white/10'}`}
                      >
                        <div className={`absolute w-3 h-3 bg-white rounded-full transition-transform ${notifications ? 'translate-x-1.5' : '-translate-x-1.5'}`} />
                      </Button>
                    </div>

                    {/* Compact Options */}
                    <div className="p-1.5 rounded bg-white/5">
                      <div className="space-y-1">
                        <label className="flex items-center justify-between text-xs cursor-pointer">
                          <span>New Messages</span>
                          <input
                            type="checkbox"
                            className="w-3 h-3 rounded"
                            checked={newMessages}
                            onChange={(e) => setNewMessages(e.target.checked)}
                          />
                        </label>
                        <label className="flex items-center justify-between text-xs cursor-pointer">
                          <span>System Updates</span>
                          <input
                            type="checkbox"
                            className="w-3 h-3 rounded"
                            checked={systemUpdates}
                            onChange={(e) => setSystemUpdates(e.target.checked)}
                          />
                        </label>
                        <label className="flex items-center justify-between text-xs cursor-pointer">
                          <span>Marketing</span>
                          <input
                            type="checkbox"
                            className="w-3 h-3 rounded"
                            checked={marketing}
                            onChange={(e) => setMarketing(e.target.checked)}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {activePanel === 'privacy' && (
                  <div className="space-y-2">
                    {/* Main Toggle */}
                    <div className="flex items-center justify-between p-1.5 rounded bg-white/5">
                      <div className="flex items-center space-x-1.5">
                        <Shield size={12} className="text-blue-400" />
                        <span className="text-xs">Data Sharing</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDataSharing(!dataSharing)}
                        className={`h-4 w-8 p-0 rounded-full relative ${dataSharing ? 'bg-blue-500/30' : 'bg-white/10'}`}
                      >
                        <div className={`absolute w-3 h-3 bg-white rounded-full transition-transform ${dataSharing ? 'translate-x-1.5' : '-translate-x-1.5'}`} />
                      </Button>
                    </div>

                    {/* Compact Options */}
                    <div className="p-1.5 rounded bg-white/5">
                      <div className="space-y-1">
                        <label className="flex items-center justify-between text-xs cursor-pointer">
                          <span>End-to-End Encryption</span>
                          <input
                            type="checkbox"
                            className="w-3 h-3 rounded"
                            checked={encryption}
                            onChange={(e) => setEncryption(e.target.checked)}
                          />
                        </label>
                        <label className="flex items-center justify-between text-xs cursor-pointer">
                          <span>Anonymous Analytics</span>
                          <input
                            type="checkbox"
                            className="w-3 h-3 rounded"
                            checked={anonymousAnalytics}
                            onChange={(e) => setAnonymousAnalytics(e.target.checked)}
                          />
                        </label>
                        <label className="flex items-center justify-between text-xs cursor-pointer">
                          <span>Secure Cloud Sync</span>
                          <input
                            type="checkbox"
                            className="w-3 h-3 rounded"
                            checked={cloudSync}
                            onChange={(e) => setCloudSync(e.target.checked)}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {activePanel === 'data' && (
                  <div className="space-y-2">
                    {/* Zebulon Oracle Database Status */}
                    <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Server size={12} className="text-purple-400" />
                          <span className="text-xs font-medium text-purple-300">Zebulon Oracle</span>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${databaseStats.connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                      </div>

                      <div className="text-xs text-gray-400 space-y-1">
                        <div>Records: {databaseStats.recordCount.toLocaleString()}</div>
                        <div>Storage: {databaseStats.storageUsed}</div>
                        {databaseStats.lastSync && (
                          <div>Last Sync: {new Date(databaseStats.lastSync).toLocaleTimeString()}</div>
                        )}
                      </div>

                      <div className="flex space-x-1 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs border-purple-500/30"
                          onClick={handleDatabaseSync}
                          disabled={isSyncing}
                        >
                          <RefreshCw size={10} className={isSyncing ? "animate-spin" : ""} />
                          <span className="ml-1">Sync</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs border-purple-500/30"
                          onClick={handleDatabaseBackup}
                        >
                          <Download size={10} />
                          <span className="ml-1">Backup</span>
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs border-purple-500/30"
                          onClick={handleDatabaseRestore}
                        >
                          <Upload size={10} />
                          <span className="ml-1">Restore</span>
                        </Button>
                      </div>
                    </div>

                    {/* Analytics Toggle */}
                    <div className="flex items-center justify-between p-1.5 rounded bg-white/5">
                      <div className="flex items-center space-x-1.5">
                        <Database size={12} className="text-cyan-400" />
                        <span className="text-xs">Analytics</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setAnalytics(!analytics)}
                        className={`h-4 w-8 p-0 rounded-full relative ${analytics ? 'bg-cyan-500/30' : 'bg-white/10'}`}
                      >
                        <div className={`absolute w-3 h-3 bg-white rounded-full transition-transform ${analytics ? 'translate-x-1.5' : '-translate-x-1.5'}`} />
                      </Button>
                    </div>

                    {/* Data Export Actions */}
                    <div className="p-1.5 rounded bg-white/5">
                      <div className="grid grid-cols-1 gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-5 text-xs border-purple-500/30 py-0"
                          onClick={async () => {
                            try {
                              const response = await apiRequest('/api/conversations/export', 'GET');
                              const blob = new Blob([JSON.stringify(response, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `chat-history-${new Date().toISOString().split('T')[0]}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                              toast({
                                title: "Export successful",
                                description: "Your chat history has been exported.",
                              });
                            } catch (error) {
                              toast({
                                title: "Export failed",
                                description: "Failed to export chat history.",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Export Data
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-5 text-xs border-orange-500/30 text-orange-400 hover:text-orange-300 py-0"
                          onClick={async () => {
                            try {
                              const userData = await apiRequest('/api/auth/user-data', 'GET');
                              const blob = new Blob([JSON.stringify(userData, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `user-data-${new Date().toISOString().split('T')[0]}.json`;
                              a.click();
                              URL.revokeObjectURL(url);
                              toast({
                                title: "Download successful",
                                description: "Your user data has been downloaded.",
                              });
                            } catch (error) {
                              toast({
                                title: "Download failed",
                                description: "Failed to download user data.",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Download Data
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-5 text-xs border-red-500/30 text-red-400 hover:text-red-300 py-0"
                          onClick={async () => {
                            if (confirm('Clear all data? This cannot be undone.')) {
                              try {
                                await apiRequest('/api/conversations', 'DELETE');
                                queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
                                toast({
                                  title: "Data cleared",
                                  description: "All chat data has been cleared.",
                                });
                              } catch (error) {
                                toast({
                                  title: "Clear failed",
                                  description: "Failed to clear data.",
                                  variant: "destructive",
                                });
                              }
                            }
                          }}
                        >
                          Clear All
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activePanel === 'satellite' && (
                  <div className="space-y-2">
                    {/* Satellite Connection Status */}
                    <div className="flex items-center justify-between p-1.5 rounded bg-white/5">
                      <div className="flex items-center space-x-1.5">
                        <Satellite size={12} className={satelliteConnected ? "text-cyan-400" : "text-gray-400"} />
                        <span className="text-xs">Satellite Link</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${satelliteConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                        <span className={`text-xs ${satelliteConnected ? 'text-green-400' : 'text-red-400'}`}>
                          {satelliteConnected ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>

                    {/* Connection Settings */}
                    <div className="p-1.5 rounded bg-white/5">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-300">Auto-Connect</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSatelliteAutoConnect(!satelliteAutoConnect)}
                            className={`h-4 w-8 p-0 rounded-full relative ${satelliteAutoConnect ? 'bg-cyan-500/30' : 'bg-white/10'}`}
                          >
                            <div className={`absolute w-3 h-3 bg-white rounded-full transition-transform ${satelliteAutoConnect ? 'translate-x-1.5' : '-translate-x-1.5'}`} />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-300">Low Latency Mode</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSatelliteLowLatency(!satelliteLowLatency)}
                            className={`h-4 w-8 p-0 rounded-full relative ${satelliteLowLatency ? 'bg-cyan-500/30' : 'bg-white/10'}`}
                          >
                            <div className={`absolute w-3 h-3 bg-white rounded-full transition-transform ${satelliteLowLatency ? 'translate-x-1.5' : '-translate-x-1.5'}`} />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Signal Quality */}
                    <div className="p-1.5 rounded bg-white/5">
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-300">Signal Strength</span>
                          <span className="text-cyan-400">{satelliteSignalStrength}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-1">
                          <div
                            className={`bg-gradient-to-r from-cyan-500 to-green-400 h-1 rounded-full transition-all duration-300 ${satelliteSignalStrength > 80 ? 'w-full' :
                              satelliteSignalStrength > 60 ? 'w-3/4' :
                                satelliteSignalStrength > 40 ? 'w-1/2' :
                                  satelliteSignalStrength > 20 ? 'w-1/4' : 'w-1/12'
                              }`}
                          ></div>
                        </div>
                      </div>
                      <div className="space-y-1 mt-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-300">Latency</span>
                          <span className="text-cyan-400">{satelliteLatency}ms</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-300">Bandwidth</span>
                          <span className="text-cyan-400">{satelliteBandwidth} Mbps</span>
                        </div>
                      </div>
                    </div>

                    {/* Satellite Network Selection */}
                    <div className="p-1.5 rounded bg-white/5">
                      <div className="space-y-1">
                        <span className="text-xs text-gray-300 font-medium">Network</span>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white">Starlink (Primary)</span>
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">OneWeb (Backup)</span>
                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="p-1.5 rounded bg-white/5">
                      <div className="grid grid-cols-1 gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            setSatelliteConnected(false);
                            toast({ title: "Reconnecting...", description: "Establishing satellite link..." });
                            setTimeout(() => {
                              setSatelliteConnected(true);
                              setSatelliteSignalStrength(Math.floor(Math.random() * 20) + 80);
                              setSatelliteLatency(Math.floor(Math.random() * 100) + 200);
                              setSatelliteBandwidth(Math.floor(Math.random() * 50) + 100);
                              toast({ title: "Connected", description: "Satellite link established successfully." });
                            }, 2000);
                          }}
                          className="h-5 text-xs border-cyan-500/30 text-cyan-400 hover:text-cyan-300 py-0"
                        >
                          Reconnect
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            toast({
                              title: "Diagnostics Complete",
                              description: `Signal: ${satelliteSignalStrength}% | Latency: ${satelliteLatency}ms | Status: ${satelliteConnected ? 'Healthy' : 'Disconnected'}`
                            });
                          }}
                          className="h-5 text-xs border-purple-500/30 py-0"
                        >
                          Run Diagnostics
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            toast({ title: "Coverage Map", description: "Opening global satellite coverage..." });
                          }}
                          className="h-5 text-xs border-orange-500/30 text-orange-400 hover:text-orange-300 py-0"
                        >
                          Coverage Map
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activePanel === 'advanced' && (
                  <div className="space-y-2">
                    {/* Interface Settings */}
                    <div className="p-1.5 rounded bg-white/5">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Theme</span>
                          <select
                            className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-xs w-20"
                            aria-label="Select theme"
                            title="Select theme"
                            value={theme}
                            onChange={(e) => {
                              setTheme(e.target.value);
                              toast({
                                title: "Theme updated",
                                description: `Theme changed to ${e.target.value}`,
                              });
                            }}
                          >
                            <option value="cyberpunk">Cyber</option>
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs">Language</span>
                          <select
                            className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-xs w-20"
                            aria-label="Select language"
                            title="Select language"
                            value={language}
                            onChange={(e) => {
                              setLanguage(e.target.value);
                              toast({
                                title: "Language updated",
                                description: `Language changed to ${e.target.options[e.target.selectedIndex].text}`,
                              });
                            }}
                          >
                            <option value="en">EN</option>
                            <option value="es">ES</option>
                            <option value="fr">FR</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs">AI Style</span>
                          <select
                            className="bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-xs w-20"
                            aria-label="Select AI response style"
                            title="Select AI response style"
                            value={responseStyle}
                            onChange={(e) => {
                              setResponseStyle(e.target.value);
                              toast({
                                title: "Response style updated",
                                description: `AI response style set to ${e.target.value}`,
                              });
                            }}
                          >
                            <option value="balanced">Balanced</option>
                            <option value="creative">Creative</option>
                            <option value="precise">Precise</option>
                          </select>
                        </div>
                        <label className="flex items-center justify-between text-xs cursor-pointer">
                          <span>Context Memory</span>
                          <input
                            type="checkbox"
                            className="w-3 h-3 rounded"
                            checked={contextMemory}
                            onChange={(e) => {
                              setContextMemory(e.target.checked);
                              toast({
                                title: "Context memory updated",
                                description: `Context memory ${e.target.checked ? 'enabled' : 'disabled'}`,
                              });
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* User Profile Section */}
                    <div className="p-1.5 rounded bg-blue-500/10 border border-blue-500/20">
                      <h4 className="text-xs font-semibold text-blue-300 mb-2">User Profile</h4>
                      <div className="space-y-1.5">
                        <div>
                          <label className="text-xs text-gray-300">Name</label>
                          <input
                            type="text"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            placeholder="Enter your name"
                            className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-xs mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-300">Avatar</label>
                          <div className="grid grid-cols-6 gap-1 mt-1">
                            {['👤', '😊', '🤖', '👨‍💼', '👩‍💼', '🧑‍🎓', '🦸', '🐱'].map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => setUserAvatar(emoji)}
                                title={`Select ${emoji} avatar`}
                                className={`text-sm p-1 rounded hover:bg-white/10 ${userAvatar === emoji ? 'bg-blue-500/30 ring-1 ring-blue-400' : ''}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <label className="text-xs text-gray-300">Language</label>
                            <select
                              value={interfaceLanguage}
                              onChange={(e) => setInterfaceLanguage(e.target.value)}
                              title="Select interface language"
                              className="w-full px-1.5 py-1 bg-white/10 border border-white/20 rounded text-xs mt-1"
                            >
                              <option value="en">English</option>
                              <option value="es">Español</option>
                              <option value="fr">Français</option>
                              <option value="de">Deutsch</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-300">Timezone</label>
                            <select
                              value={timezone}
                              onChange={(e) => setTimezone(e.target.value)}
                              title="Select timezone"
                              className="w-full px-1.5 py-1 bg-white/10 border border-white/20 rounded text-xs mt-1"
                            >
                              <option value="auto">Auto</option>
                              <option value="utc">UTC</option>
                              <option value="est">EST</option>
                              <option value="pst">PST</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chat Behavior Section */}
                    <div className="p-1.5 rounded bg-green-500/10 border border-green-500/20">
                      <h4 className="text-xs font-semibold text-green-300 mb-2">Chat Behavior</h4>
                      <div className="space-y-1">
                        {[
                          { key: 'autoSave', label: 'Auto-save conversations' },
                          { key: 'quickReplies', label: 'Show quick replies' },
                          { key: 'typingIndicator', label: 'Show typing indicator' },
                          { key: 'readReceipts', label: 'Send read receipts' }
                        ].map((option) => (
                          <label key={option.key} className="flex items-center justify-between text-xs cursor-pointer">
                            <span>{option.label}</span>
                            <input
                              type="checkbox"
                              className="w-3 h-3 rounded"
                              checked={chatBehavior[option.key as keyof typeof chatBehavior]}
                              onChange={(e) => {
                                setChatBehavior(prev => ({
                                  ...prev,
                                  [option.key]: e.target.checked
                                }));
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Accessibility Section */}
                    <div className="p-1.5 rounded bg-orange-500/10 border border-orange-500/20">
                      <h4 className="text-xs font-semibold text-orange-300 mb-2">Accessibility</h4>
                      <div className="space-y-1">
                        {[
                          { key: 'highContrast', label: 'High contrast mode' },
                          { key: 'largeText', label: 'Large text size' },
                          { key: 'reducedMotion', label: 'Reduced motion' },
                          { key: 'screenReader', label: 'Screen reader support' }
                        ].map((option) => (
                          <label key={option.key} className="flex items-center justify-between text-xs cursor-pointer">
                            <span>{option.label}</span>
                            <input
                              type="checkbox"
                              className="w-3 h-3 rounded"
                              checked={accessibilitySettings[option.key as keyof typeof accessibilitySettings]}
                              onChange={(e) => {
                                setAccessibilitySettings(prev => ({
                                  ...prev,
                                  [option.key]: e.target.checked
                                }));
                              }}
                            />
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Save Settings Button */}
                    <Button
                      onClick={handleSaveSettings}
                      className="w-full h-7 text-xs bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0"
                    >
                      Save Settings
                    </Button>

                  </div>
                )}

                {activePanel === 'help' && (
                  <div className="space-y-2">
                    {/* Getting Started */}
                    <div className="p-1.5 rounded bg-green-500/10 border border-green-500/20">
                      <h4 className="text-xs font-semibold text-green-300 mb-2">🚀 Getting Started</h4>
                      <div className="space-y-1 text-xs text-gray-300">
                        <div className="p-1 rounded bg-black/20">
                          <strong>💬 Chat:</strong> Just type your message below
                        </div>
                        <div className="p-1 rounded bg-black/20">
                          <strong>🎭 Agent Mode:</strong> Toggle for autonomous help
                        </div>
                        <div className="p-1 rounded bg-black/20">
                          <strong>⚙️ Settings:</strong> Click buttons above for config
                        </div>
                      </div>
                    </div>

                    {/* Frequently Asked Questions */}
                    <div className="p-1.5 rounded bg-blue-500/10 border border-blue-500/20">
                      <h4 className="text-xs font-semibold text-blue-300 mb-2">❓ FAQs</h4>
                      <div className="space-y-1 text-xs text-gray-300">
                        <details className="cursor-pointer">
                          <summary className="font-medium text-blue-200 hover:text-blue-100">How do I upload files?</summary>
                          <p className="mt-1 text-gray-400 text-[10px] leading-tight">Click the + button in the chat input area, then select "Upload File" to share documents with ZED.</p>
                        </details>
                        <details className="cursor-pointer">
                          <summary className="font-medium text-blue-200 hover:text-blue-100">What's the difference between Chat and Agent mode?</summary>
                          <p className="mt-1 text-gray-400 text-[10px] leading-tight">Chat mode is conversational, while Agent mode provides autonomous, comprehensive analysis.</p>
                        </details>
                        <details className="cursor-pointer">
                          <summary className="font-medium text-blue-200 hover:text-blue-100">How do I change my settings?</summary>
                          <p className="mt-1 text-gray-400 text-[10px] leading-tight">Use the Settings button above to access themes, AI behavior, accessibility, and more.</p>
                        </details>
                        <details className="cursor-pointer">
                          <summary className="font-medium text-blue-200 hover:text-blue-100">Can ZED remember our conversations?</summary>
                          <p className="mt-1 text-gray-400 text-[10px] leading-tight">Yes! Enable context memory in Settings to help ZED learn your preferences.</p>
                        </details>
                      </div>
                    </div>

                    {/* Features & Tips */}
                    <div className="p-1.5 rounded bg-purple-500/10 border border-purple-500/20">
                      <h4 className="text-xs font-semibold text-purple-300 mb-2">💡 Features & Tips</h4>
                      <div className="space-y-1 text-xs text-gray-300">
                        <div className="flex items-start space-x-1">
                          <span>📸</span>
                          <span className="text-[10px]">Take photos or scan QR codes using the camera button</span>
                        </div>
                        <div className="flex items-start space-x-1">
                          <span>🎨</span>
                          <span className="text-[10px]">Customize themes and appearance in Settings</span>
                        </div>
                        <div className="flex items-start space-x-1">
                          <span>🌐</span>
                          <span className="text-[10px]">Multi-language support for global users</span>
                        </div>
                        <div className="flex items-start space-x-1">
                          <span>♿</span>
                          <span className="text-[10px]">Accessibility options for better usability</span>
                        </div>
                        <div className="flex items-start space-x-1">
                          <span>🔒</span>
                          <span className="text-[10px]">Privacy controls for your data security</span>
                        </div>
                      </div>
                    </div>

                    {/* Keyboard Shortcuts */}
                    <div className="p-1.5 rounded bg-cyan-500/10 border border-cyan-500/20">
                      <h4 className="text-xs font-semibold text-cyan-300 mb-2">⌨️ Shortcuts</h4>
                      <div className="space-y-0.5 text-xs text-gray-300">
                        <div className="flex justify-between">
                          <span>Send message</span>
                          <code className="text-cyan-200 bg-black/30 px-1 rounded text-[9px]">Enter</code>
                        </div>
                        <div className="flex justify-between">
                          <span>New line</span>
                          <code className="text-cyan-200 bg-black/30 px-1 rounded text-[9px]">Shift+Enter</code>
                        </div>
                        <div className="flex justify-between">
                          <span>Clear chat</span>
                          <code className="text-cyan-200 bg-black/30 px-1 rounded text-[9px]">Ctrl+K</code>
                        </div>
                      </div>
                    </div>

                    {/* Contact & Support */}
                    <div className="p-1.5 rounded bg-yellow-500/10 border border-yellow-500/20">
                      <h4 className="text-xs font-semibold text-yellow-300 mb-2">📞 Need More Help?</h4>
                      <div className="space-y-1 text-xs text-gray-300">
                        <div className="text-[10px]">
                          <strong>Documentation:</strong> Available in the main menu
                        </div>
                        <div className="text-[10px]">
                          <strong>Status:</strong> Check system health in Satellite panel
                        </div>
                        <div className="text-[10px]">
                          <strong>Updates:</strong> New features announced in notifications
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section Header */}
        <div className="flex items-center justify-between py-2 px-1">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
            <h3 className="text-xs font-bold tracking-wide bg-gradient-to-r from-foreground to-purple-300 bg-clip-text text-transparent">Recent Chats</h3>
          </div>
          <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 border-purple-500/30 font-medium">
            {Array.isArray(conversations)
              ? conversations.filter(conversation => !conversation.title?.toLowerCase().includes('test')).length
              : 0}
          </Badge>
        </div>

        <div className="space-y-1 pb-2">
          {(() => {
            const filteredConversations = Array.isArray(conversations)
              ? conversations.filter(conversation => !conversation.title?.toLowerCase().includes('test'))
              : [];

            if (filteredConversations.length === 0) {
              return (
                <div className="text-center py-4 text-muted-foreground">
                  <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-medium tracking-wide">Your conversations will appear here</p>
                </div>
              );
            }

            return filteredConversations.map((conversation) => {
              const isActive = location === `/chat/${conversation.id}` || location === `/chat/${conversation.id}/`;
              const date = conversation.updatedAt || conversation.createdAt;

              return (
                <div
                  key={conversation.id}
                  className={`
                    group relative p-2 rounded-lg cursor-pointer transition-all zed-button
                    ${isActive
                      ? 'zed-glass border-purple-500/50 shadow-md shadow-purple-500/20'
                      : 'hover:bg-white/5'
                    }
                  `}
                  onClick={() => navigate(`/chat/${conversation.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-semibold text-foreground truncate mb-1 tracking-wide">
                        {conversation.title || 'New Conversation'}
                      </h3>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">
                          {formatDate(date)}
                        </span>
                        {conversation.mode && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${conversation.mode === 'agent'
                            ? 'bg-purple-500/20 text-purple-400'
                            : 'bg-cyan-500/20 text-cyan-400'
                            }`}>
                            {conversation.mode}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteConversation(e, conversation.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/20 h-auto p-1 ml-1 rounded"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Quick Settings Row - Moved below Recent Chats */}
      <div className="px-2 pb-2">
        <div className="mt-2 space-y-1">
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActivePanel(activePanel === 'alerts' ? null : 'alerts')}
              className={`flex-1 h-8 text-xs rounded-lg transition-colors font-medium ${activePanel === 'alerts' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : notifications ? 'bg-pink-500/10 text-pink-500' : 'bg-white/5 text-muted-foreground hover:text-pink-400'}`}
            >
              <Bell size={12} className="mr-1" />
              Alerts
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActivePanel(activePanel === 'privacy' ? null : 'privacy')}
              className={`flex-1 h-8 text-xs rounded-lg transition-colors font-medium ${activePanel === 'privacy' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : dataSharing ? 'bg-blue-500/10 text-blue-500' : 'bg-white/5 text-muted-foreground hover:text-blue-400'}`}
            >
              <Shield size={12} className="mr-1" />
              Privacy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActivePanel(activePanel === 'data' ? null : 'data')}
              className={`flex-1 h-8 text-xs rounded-lg transition-colors font-medium ${activePanel === 'data' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : analytics ? 'bg-cyan-500/10 text-cyan-500' : 'bg-white/5 text-muted-foreground hover:text-cyan-400'}`}
            >
              <Database size={12} className="mr-1" />
              Data
            </Button>
          </div>

          {/* Side-by-side buttons without "settings" text */}
          <div className="flex justify-center space-x-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActivePanel(activePanel === 'satellite' ? null : 'satellite')}
              className={`h-8 text-xs rounded-lg transition-colors font-medium flex items-center space-x-1 ${activePanel === 'satellite' ? 'bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border-cyan-400/50' : 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-cyan-500/30 hover:border-cyan-400/50'} border text-cyan-300 hover:text-cyan-200`}
              title="Satellite"
            >
              <Satellite size={12} />
              <span>Satellite</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActivePanel(activePanel === 'advanced' ? null : 'advanced')}
              className={`h-8 text-xs rounded-lg transition-colors font-medium flex items-center space-x-1 ${activePanel === 'advanced' ? 'bg-gradient-to-r from-purple-600/30 to-cyan-600/30 border-purple-400/50' : 'bg-gradient-to-r from-purple-600/20 to-cyan-600/20 border-purple-500/30 hover:border-purple-400/50'} border text-purple-300 hover:text-purple-200`}
              title="Advanced Settings & Configuration"
            >
              <Settings size={12} />
              <span>Settings</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActivePanel(activePanel === 'help' ? null : 'help')}
              className={`h-8 text-xs rounded-lg transition-colors font-medium flex items-center space-x-1 ${activePanel === 'help' ? 'bg-gradient-to-r from-green-500/30 to-emerald-500/30 border-green-400/50' : 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-green-500/30 hover:border-green-400/50'} border text-green-300 hover:text-green-200`}
              title="Help & FAQs"
            >
              <HelpCircle size={12} />
              <span>Help</span>
            </Button>
          </div>

          {/* Footer */}
          <div className="p-1 border-t border-white/10 relative z-10">
            <div className="flex items-center justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await logout();
                    toast({
                      title: "Logged out",
                      description: "Successfully logged out.",
                    });
                  } catch (error) {
                    console.error("Logout error:", error);
                    toast({
                      title: "Error",
                      description: "Failed to logout. Please try again.",
                    });
                  }
                }}
                className="h-6 text-xs px-2 text-muted-foreground hover:text-red-400 transition-colors"
              >
                <LogOut size={10} className="mr-1" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Overlays for different panels */}
      {activePanel === 'alerts' && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Bell size={20} className="mr-2 text-yellow-400" />
                Alert Settings
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActivePanel(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={16} />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">New Messages</span>
                <button
                  onClick={() => setNewMessages(!newMessages)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${newMessages ? 'bg-purple-600' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${newMessages ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">System Updates</span>
                <button
                  onClick={() => setSystemUpdates(!systemUpdates)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${systemUpdates ? 'bg-purple-600' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${systemUpdates ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Marketing</span>
                <button
                  onClick={() => setMarketing(!marketing)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${marketing ? 'bg-purple-600' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${marketing ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activePanel === 'privacy' && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Shield size={20} className="mr-2 text-green-400" />
                Privacy Settings
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActivePanel(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={16} />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Data Encryption</span>
                <button
                  onClick={() => setEncryption(!encryption)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${encryption ? 'bg-green-600' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${encryption ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Anonymous Analytics</span>
                <button
                  onClick={() => setAnonymousAnalytics(!anonymousAnalytics)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${anonymousAnalytics ? 'bg-green-600' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${anonymousAnalytics ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activePanel === 'data' && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Database size={20} className="mr-2 text-blue-400" />
                Data Settings
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActivePanel(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={16} />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Cloud Sync</span>
                <button
                  onClick={() => setCloudSync(!cloudSync)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${cloudSync ? 'bg-blue-600' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${cloudSync ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Context Memory</span>
                <button
                  onClick={() => setContextMemory(!contextMemory)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${contextMemory ? 'bg-blue-600' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${contextMemory ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activePanel === 'satellite' && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Satellite size={20} className="mr-2 text-cyan-400" />
                Satellite Settings
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActivePanel(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={16} />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Auto-Connect</span>
                <button
                  onClick={() => setSatelliteAutoConnect(!satelliteAutoConnect)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${satelliteAutoConnect ? 'bg-cyan-600' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${satelliteAutoConnect ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Low Latency Mode</span>
                <button
                  onClick={() => setSatelliteLowLatency(!satelliteLowLatency)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${satelliteLowLatency ? 'bg-cyan-600' : 'bg-gray-600'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${satelliteLowLatency ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                </button>
              </div>

              <div className="space-y-2">
                <span className="text-sm text-gray-300">Signal Strength: {satelliteSignalStrength}%</span>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-cyan-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${satelliteSignalStrength}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm text-gray-300">Latency: {satelliteLatency}ms</span>
                <span className="text-sm text-gray-300">Bandwidth: {satelliteBandwidth} Mbps</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activePanel === 'advanced' && (
        <div className="absolute inset-0 bg-black/95 backdrop-blur-sm z-50 flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Settings size={20} className="mr-2 text-purple-400" />
                Advanced Settings
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActivePanel(null)}
                className="text-gray-400 hover:text-white"
              >
                <X size={16} />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-3">
              <div className="space-y-2">
                <span className="text-sm text-gray-300">Theme</span>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  <option value="cyberpunk">Cyberpunk</option>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>

              <div className="space-y-2">
                <span className="text-sm text-gray-300">Language</span>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>

              <div className="space-y-2">
                <span className="text-sm text-gray-300">Response Style</span>
                <select
                  value={responseStyle}
                  onChange={(e) => setResponseStyle(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                >
                  <option value="balanced">Balanced</option>
                  <option value="creative">Creative</option>
                  <option value="precise">Precise</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
