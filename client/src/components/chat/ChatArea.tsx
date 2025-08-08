import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { streamChat } from "@/lib/chatClient";
import {
  Send,
  MessageSquare,
  Brain,
  Satellite,
  ChevronDown,
  Plus,
  Smile,
  Mic,
  Languages,
  Menu,
  Zap,
  Activity,
  AlertTriangle,
  X,
  Settings,
  Palette,
  Bell,
  Shield,
  Monitor,
  Moon,
  Sun,
  Image,
  Camera,
  QrCode,
  ScanLine,
  FolderOpen,
  Upload,
  RefreshCw
} from "lucide-react";
import MemoryPanel from "./MemoryPanel";
import { nanoid } from 'nanoid';

interface ChatAreaProps {
  onSidebarToggle?: () => void;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: number;
  type?: 'text' | 'image' | 'file';
  status?: 'sending' | 'streaming' | 'done' | 'error'; // for streaming/error handling
}

// ChatArea component - Original interface design
export default function ChatArea({ onSidebarToggle }: ChatAreaProps) {
  const [inputValue, setInputValue] = useState("");
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isGifPickerOpen, setIsGifPickerOpen] = useState(false);
  const [gifSearchQuery, setGifSearchQuery] = useState("");
  const [isTranslateMenuOpen, setIsTranslateMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showSocialFeed, setShowSocialFeed] = useState(false);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [satelliteDropdownOpen, setSatelliteDropdownOpen] = useState(false);
  const [isScannerMenuOpen, setIsScannerMenuOpen] = useState(false);

  // Chat Messages State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      content: "Hello! I'm ZED, your enhanced AI assistant. I'm connected to your memory systems and ready to help you with anything you need. How can I assist you today?",
      sender: 'ai',
      timestamp: Date.now(),
      type: 'text',
      status: 'done'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Advanced Settings & Personalization
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [userTheme, setUserTheme] = useState("dark"); // dark, light, auto
  const [aiPersonality, setAiPersonality] = useState("professional"); // professional, casual, technical
  const [responseLength, setResponseLength] = useState("balanced"); // concise, balanced, detailed

  // Enhanced Personalization Options
  const [userName, setUserName] = useState("User");
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

  // Memory & Data states
  // ...existing code...

  const [notificationSettings, setNotificationSettings] = useState({
    sounds: true,
    desktop: true,
    email: false
  });
  const [dataPrivacy, setDataPrivacy] = useState({
    analytics: true,
    dataRetention: "30days", // 7days, 30days, 90days, forever
    shareWithTeam: false
  });

  const memoryDropdownRef = useRef<HTMLDivElement>(null);
  const signalDropdownRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const gifPickerRef = useRef<HTMLDivElement>(null);
  const translateMenuRef = useRef<HTMLDivElement>(null);
  const scannerMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  // Click outside handlers
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (memoryDropdownRef.current && !memoryDropdownRef.current.contains(event.target as Node)) {
        setShowMemoryPanel(false);
      }
      if (signalDropdownRef.current && !signalDropdownRef.current.contains(event.target as Node)) {
        setSatelliteDropdownOpen(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setIsEmojiPickerOpen(false);
      }
      if (gifPickerRef.current && !gifPickerRef.current.contains(event.target as Node)) {
        setIsGifPickerOpen(false);
      }
      if (translateMenuRef.current && !translateMenuRef.current.contains(event.target as Node)) {
        setIsTranslateMenuOpen(false);
      }
      if (scannerMenuRef.current && !scannerMenuRef.current.contains(event.target as Node)) {
        setIsScannerMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Button handlers - Enhanced with API connections

  // Scanner/Detection functionality handlers

  const handlePhotoFromGallery = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await processMediaFiles(files, 'gallery');
      }
    };
    input.click();
    setIsScannerMenuOpen(false);
  };

  const handleFileUploadFromScanner = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.zip,.doc,.docx,.md,.txt,.json,.csv,.xlsx,.ppt,.pptx';
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await processDocumentFiles(files);
      }
    };
    input.click();
    setIsScannerMenuOpen(false);
  };

  const handleTakePhoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Create camera capture interface
      await initializeCameraCapture(stream);
      setIsScannerMenuOpen(false);
    } catch (error) {
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access to take photos",
        variant: "destructive",
      });
    }
  };

  const handleScanSearch = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      await initializeLensScanner(stream);
      setIsScannerMenuOpen(false);
    } catch (error) {
      toast({
        title: "Camera Access Denied",
        description: "Please allow camera access for scanning",
        variant: "destructive",
      });
    }
  };


  // Media file upload handler (fixed)
  const processMediaFiles = async (files: FileList, source: string) => {
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('media', file));
      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) throw new Error('Media upload failed');
      const result = await response.json();
      await apiRequest('/api/memory/media', 'POST', {
        files: result.files,
        timestamp: Date.now(),
        source
      });
      toast({
        title: "Media Uploaded",
        description: `Successfully uploaded ${files.length} media file(s)`
      });
      const mediaRefs = Array.from(files).map(f => `[Photo: ${f.name}]`).join(' ');
      setInputValue(prev => prev + ` ${mediaRefs} `);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload media files",
        variant: "destructive",
      });
    }
  };

  const processDocumentFiles = async (files: FileList) => {
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('documents', file));

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Document upload failed');

      const result = await response.json();

      // Save to Zebulon database
      await apiRequest('/api/memory/documents', 'POST', {
        files: result.files,
        timestamp: Date.now()
      });

      toast({
        title: "Documents Uploaded",
        description: `Successfully uploaded ${files.length} document(s)`,
      });

      const docRefs = Array.from(files).map(f => `[Document: ${f.name}]`).join(' ');
      setInputValue(prev => prev + ` ${docRefs} `);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload documents",
        variant: "destructive",
      });
    }
  };

  const initializeCameraCapture = async (_stream: MediaStream) => {
    // Implementation for camera capture would go here
    // This would create a modal with video preview and capture button
    toast({
      title: "Camera Ready",
      description: "Camera capture feature initialized",
    });
  };

  const initializeLensScanner = async (_stream: MediaStream) => {
    // Implementation for Google Lens-like functionality
    // This would use ML/AI to identify objects in camera view
    toast({
      title: "Lens Scanner Ready",
      description: "Point camera at objects to identify them",
    });
  };


  // Removed unused initializeQRScanner to fix TS error

  const handleEmojiSelect = (emoji: string) => {
    setInputValue(prev => prev + emoji);
    setIsEmojiPickerOpen(false);
  };

  const handleGifSelect = async (gifUrl: string) => {
    try {
      // Save GIF to chat
      await apiRequest('/api/chat/gif', 'POST', { gifUrl, messageId: Date.now() });

      setInputValue(prev => prev + ` [GIF: ${gifUrl}] `);
      setIsGifPickerOpen(false);

      toast({
        title: "GIF Added",
        description: "GIF added to message",
      });
    } catch (error) {
      // Fallback to local handling
      setInputValue(prev => prev + ` [GIF: ${gifUrl}] `);
      setIsGifPickerOpen(false);
    }
  };

  // Settings Management Functions
  const handleSaveSettings = async () => {
    try {
      const settings = {
        userProfile: {
          name: userName,
          avatar: userAvatar,
          language: interfaceLanguage,
          timezone: timezone
        },
        appearance: {
          theme: userTheme
        },
        aiPersonality: {
          style: aiPersonality,
          responseLength: responseLength
        },
        chatBehavior: chatBehavior,
        accessibility: accessibilitySettings,
        notifications: notificationSettings,
        privacy: dataPrivacy
      };

      // Save to API
      await apiRequest('/api/user/settings', 'POST', settings);

      // Apply settings immediately
      applySettings(settings);

      setShowAdvancedSettings(false);

      toast({
        title: "Settings Saved",
        description: "Your personalization settings have been saved successfully",
      });
    } catch (error) {
      // Fallback to local storage
      localStorage.setItem('zed-settings', JSON.stringify({
        userProfile: { name: userName, avatar: userAvatar, language: interfaceLanguage, timezone },
        appearance: { theme: userTheme },
        aiPersonality: { style: aiPersonality, responseLength },
        chatBehavior,
        accessibility: accessibilitySettings,
        notifications: notificationSettings,
        privacy: dataPrivacy
      }));

      setShowAdvancedSettings(false);

      toast({
        title: "Settings Saved Locally",
        description: "Settings saved to browser storage",
      });
    }
  };

  const applySettings = (settings: any) => {
    // Apply theme
    if (settings.appearance?.theme) {
      document.documentElement.setAttribute('data-theme', settings.appearance.theme);
    }

    // Apply accessibility settings
    if (settings.accessibility?.highContrast) {
      document.documentElement.classList.toggle('high-contrast', settings.accessibility.highContrast);
    }
    if (settings.accessibility?.largeText) {
      document.documentElement.classList.toggle('large-text', settings.accessibility.largeText);
    }
    if (settings.accessibility?.reducedMotion) {
      document.documentElement.classList.toggle('reduced-motion', settings.accessibility.reducedMotion);
    }
  };

  const loadSettings = async () => {
    try {
      // Try to load from API first
      const response = await apiRequest('/api/user/settings', 'GET');
      if (response.settings) {
        const settings = response.settings;
        setUserName(settings.userProfile?.name || "User");
        setUserAvatar(settings.userProfile?.avatar || "👤");
        setInterfaceLanguage(settings.userProfile?.language || "en");
        setTimezone(settings.userProfile?.timezone || "auto");
        setUserTheme(settings.appearance?.theme || "dark");
        setAiPersonality(settings.aiPersonality?.style || "professional");
        setResponseLength(settings.aiPersonality?.responseLength || "balanced");
        setChatBehavior(settings.chatBehavior || { autoSave: true, quickReplies: true, typingIndicator: true, readReceipts: true });
        setAccessibilitySettings(settings.accessibility || { highContrast: false, largeText: false, reducedMotion: false, screenReader: false });
        setNotificationSettings(settings.notifications || { sounds: true, desktop: true, email: false });
        setDataPrivacy(settings.privacy || { analytics: true, dataRetention: "30days", shareWithTeam: false });

        applySettings(settings);
      }
    } catch (error) {
      // Fallback to local storage
      const savedSettings = localStorage.getItem('zed-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setUserName(settings.userProfile?.name || "User");
        setUserAvatar(settings.userProfile?.avatar || "👤");
        setInterfaceLanguage(settings.userProfile?.language || "en");
        setTimezone(settings.userProfile?.timezone || "auto");
        setUserTheme(settings.appearance?.theme || "dark");
        setAiPersonality(settings.aiPersonality?.style || "professional");
        setResponseLength(settings.aiPersonality?.responseLength || "balanced");
        setChatBehavior(settings.chatBehavior || { autoSave: true, quickReplies: true, typingIndicator: true, readReceipts: true });
        setAccessibilitySettings(settings.accessibility || { highContrast: false, largeText: false, reducedMotion: false, screenReader: false });
        setNotificationSettings(settings.notifications || { sounds: true, desktop: true, email: false });
        setDataPrivacy(settings.privacy || { analytics: true, dataRetention: "30days", shareWithTeam: false });

        applySettings(settings);
      }
    }
  };

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const handleMicrophoneToggle = async () => {
    if (!isRecording) {
      try {
        // Start recording
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setIsRecording(true);

        toast({
          title: "Recording Started",
          description: "Voice recording in progress...",
        });

        // TODO: Implement actual recording logic with MediaRecorder
        setTimeout(() => {
          setIsRecording(false);
          stream.getTracks().forEach(track => track.stop());
          toast({
            title: "Recording Complete",
            description: "Voice message recorded",
          });
        }, 5000); // Auto-stop after 5 seconds for demo

      } catch (error) {
        toast({
          title: "Recording Failed",
          description: "Failed to access microphone",
          variant: "destructive",
        });
      }
    } else {
      setIsRecording(false);
      toast({
        title: "Recording Stopped",
        description: "Voice recording stopped",
      });
    }
  };

  const handleTranslate = async (languageCode: string) => {
    if (!inputValue.trim()) {
      toast({
        title: "Translation Error",
        description: "No text to translate",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiRequest('/api/translate', 'POST', {
        text: inputValue,
        targetLanguage: languageCode
      });

      setInputValue(response.translatedText || inputValue);
      setIsTranslateMenuOpen(false);

      toast({
        title: "Translation Complete",
        description: `Text translated to ${languageCode.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Translation Failed",
        description: "Failed to translate text",
        variant: "destructive",
      });
    }
  };

  // Memory Functions - Connected to Zebulon Oracle Database


  // Removed unused handleSyncWithZebulon and handleFullMemoryPanel to fix TS errors
  // Add missing state for memory panel loading and data to fix TS errors
  // ...existing code...
  // Add a no-op for handleQRCodeScan to fix TS error (replace with real logic if needed)
  const handleQRCodeScan = () => {
    toast({ title: "QR Code Scan", description: "QR code scanning not implemented." });
  };

  // Signal Functions - Satellite Connection Management
  const [signalPanelData, setSignalPanelData] = useState({
    connected: true,
    signalStrength: 85,
    latency: 42,
    autoConnect: true,
    lowLatency: false
  });

  const handleSatelliteConnection = async () => {
    try {
      const response = await apiRequest('/api/satellite/status', 'GET');
      setSignalPanelData(prev => ({
        ...prev,
        connected: response.connected || false,
        signalStrength: response.signalStrength || 0,
        latency: response.latency || 0
      }));
      toast({
        title: "Satellite Status",
        description: `Signal: ${response.signalStrength}% • Latency: ${response.latency}ms`,
      });
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "Failed to check satellite status",
        variant: "destructive",
      });
    }
  };

  const handleSignalBoost = async () => {
    try {
      const response = await apiRequest('/api/satellite/boost', 'POST');
      setSignalPanelData(prev => ({
        ...prev,
        signalStrength: response.newSignalStrength || prev.signalStrength + 10
      }));
      toast({
        title: "Signal Boost",
        description: `Signal boosted to ${response.newSignalStrength || signalPanelData.signalStrength + 10}%`,
      });
    } catch (error) {
      toast({
        title: "Boost Failed",
        description: "Failed to boost signal strength",
        variant: "destructive",
      });
    }
  };

  const handleNetworkDiagnostics = async () => {
    try {
      const response = await apiRequest('/api/satellite/diagnostics', 'GET');
      toast({
        title: "Network Diagnostics",
        description: `Latency: ${response.latency || '42'}ms • Status: ${response.status || 'Optimal'}`,
      });
    } catch (error) {
      toast({
        title: "Diagnostics Failed",
        description: "Failed to run network diagnostics",
        variant: "destructive",
      });
    }
  };

  const handleEmergencyProtocol = async () => {
    try {
      await apiRequest('/api/satellite/emergency', 'POST');
      toast({
        title: "Emergency Protocol",
        description: "Emergency communication protocol activated",
      });
    } catch (error) {
      toast({
        title: "Protocol Failed",
        description: "Failed to activate emergency protocol",
        variant: "destructive",
      });
    }
  };

  // Streaming-safe, robust message flow
  const handleSend = async () => {
    if (!inputValue.trim() || isStreaming) return;
    const message = inputValue.trim();
    const clientMessageId = nanoid();
    const userMessage: ChatMessage = {
      id: clientMessageId,
      content: message,
      sender: 'user',
      timestamp: Date.now(),
      type: 'text',
      status: 'done',
    };
    const aiMessageId = nanoid();
    const pendingAI: ChatMessage = {
      id: aiMessageId,
      content: '',
      sender: 'ai',
      timestamp: Date.now(),
      type: 'text',
      status: 'streaming',
    };
    setMessages(prev => {
      const filtered = prev.filter(msg => !(msg.sender === 'ai' && (msg.status === 'streaming' || msg.status === 'error')));
      return [...filtered, userMessage, pendingAI];
    });
    setInputValue("");
    setIsLoading(true);
    setIsStreaming(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let accumulated = '';
    try {
      // Use new streamChat signature (no token, no checkHealth)
      console.log("[ChatArea] Sending message:", message);
      await streamChat(
        message,
        (chunk: string) => {
          accumulated += chunk;
          setMessages(prev => prev.map(msg =>
            msg.id === aiMessageId
              ? { ...msg, content: accumulated, status: 'streaming' }
              : msg
          ));
        },
        abortController.signal
      );
      setMessages(prev => prev.map(msg =>
        msg.id === aiMessageId
          ? { ...msg, content: accumulated, status: 'done' }
          : msg
      ));
      console.log("[ChatArea] Message sent and streamed successfully.");
      toast({
        title: "Message Sent",
        description: "Your message has been sent to ZED",
      });
    } catch (err: any) {
      setMessages(prev => prev.map(msg =>
        msg.id === aiMessageId
          ? { ...msg, content: err.message || "Failed to get a response.", status: 'error' }
          : msg
      ));
      setInputValue(message); // restore input for retry
      console.error("[ChatArea] Message failed:", err);
      toast({
        title: "Message Failed",
        description: err.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className="flex-1 flex h-full relative overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col h-full relative overflow-hidden">
          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {/* Floating orbs */}
            <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-r from-purple-600/10 to-cyan-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-40 right-20 w-48 h-48 bg-gradient-to-r from-pink-500/10 to-purple-600/10 rounded-full blur-3xl" />
            <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-gradient-to-r from-cyan-500/10 to-pink-500/10 rounded-full blur-2xl" />

            {/* Large glowing ZED logo centerpiece - Original design */}
            {/* Background - Original with animated gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-purple-900/20 animate-gradient-x"></div>

            {/* Large ZED AI logo background centerpiece */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
              <div className="relative">
                {/* Outer glow ring */}
                <div className="absolute inset-0 w-96 h-96 md:w-[40rem] md:h-[40rem] bg-gradient-to-r from-purple-500/5 via-cyan-500/5 to-pink-500/5 rounded-full blur-3xl animate-pulse" />

                {/* Inner glow ring */}
                <div className="absolute inset-12 bg-gradient-to-r from-purple-500/8 via-cyan-500/8 to-pink-500/8 rounded-full blur-2xl" />

                {/* Actual ZED AI logo container */}
                <div className="relative w-96 h-96 md:w-[40rem] md:h-[40rem] flex items-center justify-center">
                  <img
                    src="/Zed-ai-logo_1753468041342.png"
                    alt="ZED AI"
                    className="w-64 h-64 md:w-96 md:h-96 opacity-15 scale-100 object-contain"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Header - Original Design */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 relative flex-shrink-0 bg-black/80 backdrop-blur-sm z-10">
            {/* Left side - Menu button and ZED branding */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                {/* Menu button with outline */}
                <button
                  onClick={onSidebarToggle}
                  className="w-10 h-10 p-2 rounded-lg border-2 border-white/20 hover:border-purple-500/50 bg-transparent hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-blue-500/20 transition-all duration-300 hover:scale-105 flex items-center justify-center text-white/80 hover:text-white"
                  title="Open Menu"
                >
                  <Menu size={20} />
                </button>
                <div className="text-left">
                  <h1 className="text-lg md:text-xl font-bold">
                    <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(168,85,247,0.4)] filter [text-shadow:_0_2px_8px_rgba(168,85,247,0.6),_0_4px_16px_rgba(6,182,212,0.4)] relative inline-block transform hover:scale-105 transition-transform duration-200">
                      ZED
                      <span className="absolute inset-0 bg-gradient-to-r from-purple-600 via-cyan-600 to-pink-600 bg-clip-text text-transparent opacity-30 blur-[1px] -z-10">ZED</span>
                    </span>
                  </h1>
                  <p className="text-xs md:text-sm text-muted-foreground">Enhanced AI Assistant</p>
                </div>
              </div>
            </div>

            {/* Right side - WiFi signal, satellite panel, and memory panel */}
            <div className="flex items-center space-x-2">
              {/* WiFi Signal Icon */}
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSocialFeed(!showSocialFeed)}
                  className="text-muted-foreground hover:text-cyan-400 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 9L12 2L23 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5 13L12 8L19 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 17L12 14L16 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="12" cy="20" r="1" fill="currentColor" />
                  </svg>
                </Button>
              </div>

              {/* Memory Dropdown Button - Compact design like Signal */}
              <div className="relative memory-dropdown-container" ref={memoryDropdownRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowMemoryPanel(!showMemoryPanel);
                  }}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-full transition-colors ${showMemoryPanel
                    ? 'bg-purple-500/20 border border-purple-500/30 text-purple-300'
                    : 'bg-purple-500/10 border border-purple-500/20 text-muted-foreground hover:text-purple-400'
                    }`}
                >
                  <Brain size={12} className="text-purple-400" />
                  <span className="text-xs font-medium">Memory</span>
                  <ChevronDown size={10} className={`transition-transform ${showMemoryPanel ? 'rotate-180' : ''}`} />
                </Button>
              </div>

              {/* MemoryPanel Overlay (always on top) */}
              {showMemoryPanel && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center pointer-events-none">
                  <div className="pointer-events-auto">
                    <MemoryPanel isOpen={showMemoryPanel} onClose={() => setShowMemoryPanel(false)} />
                  </div>
                </div>,
                document.body
              )}

              {/* Satellite Signal Gauge Dropdown */}
              <div className="relative satellite-dropdown-container" ref={signalDropdownRef}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSatelliteDropdownOpen(!satelliteDropdownOpen)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-full transition-colors ${satelliteDropdownOpen
                    ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-300'
                    : 'bg-cyan-500/10 border border-cyan-500/20 text-muted-foreground hover:text-cyan-400'
                    }`}
                >
                  <div className="relative">
                    <Satellite size={12} className={`${signalPanelData.connected ? "text-cyan-400 satellite-signal" : "text-gray-400"} transition-colors duration-300`} />
                    {/* Signal Strength Gauge */}
                    {signalPanelData.connected && (
                      <div className="absolute -top-1 -right-1">
                        <div className="flex space-x-px">
                          <div className={`w-0.5 h-1 rounded-full transition-all duration-300 ${signalPanelData.signalStrength > 25 ? 'bg-cyan-400 signal-bar-animate signal-bar-delay-1' : 'bg-gray-500'}`}></div>
                          <div className={`w-0.5 h-1.5 rounded-full transition-all duration-300 ${signalPanelData.signalStrength > 50 ? 'bg-cyan-400 signal-bar-animate signal-bar-delay-2' : 'bg-gray-500'}`}></div>
                          <div className={`w-0.5 h-2 rounded-full transition-all duration-300 ${signalPanelData.signalStrength > 75 ? 'bg-cyan-400 signal-bar-animate signal-bar-delay-3' : 'bg-gray-500'}`}></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-medium">Signal</span>
                  <ChevronDown size={10} className={`transition-transform ${satelliteDropdownOpen ? 'rotate-180' : ''}`} />
                </Button>
              </div>

              {/* SatellitePanel Overlay (always on top) */}
              {satelliteDropdownOpen && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-start justify-end p-4 pointer-events-none">
                  <div className="w-52 bg-gray-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-lg shadow-2xl z-[99999] overflow-hidden pointer-events-auto mt-16 mr-4">
                    {/* Compact Connection Status Header */}
                    <div className="px-2 py-1.5 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-blue-500/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${signalPanelData.connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                          <span className="text-[10px] font-medium text-cyan-300">
                            {signalPanelData.connected ? 'Online' : 'Offline'}
                          </span>
                          {signalPanelData.connected && (
                            <span className="text-[9px] text-gray-400">{signalPanelData.latency}ms</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="text-[10px] text-cyan-400 font-mono">{signalPanelData.signalStrength}%</div>
                          <div className="flex space-x-px">
                            <div className={`w-0.5 h-1.5 rounded-full ${signalPanelData.signalStrength > 25 ? 'bg-cyan-400' : 'bg-gray-600'}`}></div>
                            <div className={`w-0.5 h-2 rounded-full ${signalPanelData.signalStrength > 50 ? 'bg-cyan-400' : 'bg-gray-600'}`}></div>
                            <div className={`w-0.5 h-2.5 rounded-full ${signalPanelData.signalStrength > 75 ? 'bg-cyan-400' : 'bg-gray-600'}`}></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Compact Quick Actions Grid */}
                    <div className="p-1.5 grid grid-cols-2 gap-1">
                      <button
                        className="px-1.5 py-1 text-[10px] text-cyan-300 hover:bg-cyan-500/10 rounded text-left flex items-center space-x-1"
                        onClick={handleSignalBoost}
                      >
                        <Zap size={10} />
                        <span>Boost</span>
                      </button>

                      <button
                        className="px-1.5 py-1 text-[10px] text-cyan-300 hover:bg-cyan-500/10 rounded text-left flex items-center space-x-1"
                        onClick={handleNetworkDiagnostics}
                      >
                        <Activity size={10} />
                        <span>Diag</span>
                      </button>

                      <button
                        className="px-1.5 py-1 text-[10px] text-cyan-300 hover:bg-cyan-500/10 rounded text-left flex items-center space-x-1"
                        onClick={handleSatelliteConnection}
                      >
                        <RefreshCw size={10} />
                        <span>Reconnect</span>
                      </button>

                      <button
                        className="px-1.5 py-1 text-[10px] text-red-400 hover:bg-red-500/10 rounded text-left flex items-center space-x-1"
                        onClick={handleEmergencyProtocol}
                      >
                        <AlertTriangle size={10} />
                        <span>Emergency</span>
                      </button>
                    </div>

                    {/* Compact Toggle Controls */}
                    <div className="px-1.5 pb-1.5 space-y-1">
                      <div className="flex items-center justify-between py-0.5 hover:bg-white/5 rounded cursor-pointer"
                        onClick={() => setSignalPanelData(prev => ({ ...prev, autoConnect: !prev.autoConnect }))}>
                        <span className="text-[10px] text-gray-300">Auto-Connect</span>
                        <div className={`w-5 h-2.5 rounded-full relative transition-colors ${signalPanelData.autoConnect ? 'bg-cyan-500/30' : 'bg-gray-600'}`}>
                          <div className={`absolute top-0.5 w-1.5 h-1.5 bg-white rounded-full transition-transform ${signalPanelData.autoConnect ? 'translate-x-2.5' : 'translate-x-0.5'}`}></div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between py-0.5 hover:bg-white/5 rounded cursor-pointer"
                        onClick={() => setSignalPanelData(prev => ({ ...prev, lowLatency: !prev.lowLatency }))}>
                        <span className="text-[10px] text-gray-300">Low Latency</span>
                        <div className={`w-5 h-2.5 rounded-full relative transition-colors ${signalPanelData.lowLatency ? 'bg-cyan-500/30' : 'bg-gray-600'}`}>
                          <div className={`absolute top-0.5 w-1.5 h-1.5 bg-white rounded-full transition-transform ${signalPanelData.lowLatency ? 'translate-x-2.5' : 'translate-x-0.5'}`}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>,
                document.body
              )}
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 min-h-0 overflow-y-auto px-2 md:px-4 py-2 md:py-3 relative z-10 bg-black/20 backdrop-blur-sm">
            {/* Messages Container */}
            <div className="max-w-4xl mx-auto h-full flex flex-col justify-end">
              {/* Chat Messages Display */}
              <div className="flex-1 overflow-y-auto pb-4 space-y-3 bg-gray-900/30 backdrop-blur-sm border border-gray-700/20 rounded-lg p-4">
                {messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-gray-400">
                      <div className="text-4xl mb-4">💬</div>
                      <p className="text-lg font-medium">Start a conversation with ZED</p>
                      <p className="text-sm">Ask me anything - I'm here to help!</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div key={message.id} className="w-full">
                      {message.sender === 'user' ? (
                        // User message - right aligned
                        <div className="flex justify-end mb-3">
                          <div className="flex items-end space-x-2 max-w-[80%]">
                            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-3 rounded-2xl rounded-br-md shadow-lg">
                              <p className="text-sm leading-relaxed">{message.content}</p>
                              <p className="text-xs mt-1 text-purple-100 text-right">
                                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              U
                            </div>
                          </div>
                        </div>
                      ) : (
                        // AI message - left aligned
                        <div className="flex justify-start mb-3">
                          <div className="flex items-end space-x-2 max-w-[80%]">
                            <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              Z
                            </div>
                            <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-600/30 text-gray-100 p-3 rounded-2xl rounded-bl-md shadow-lg">
                              <p className="text-sm leading-relaxed">
                                {message.content}
                                {message.status === 'streaming' && <span className="animate-pulse text-gray-400 ml-1">▍</span>}
                              </p>
                              <p className="text-xs mt-1 text-gray-400">
                                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              {message.status === 'error' && (
                                <button
                                  className="mt-2 text-xs text-red-400 underline hover:text-red-300"
                                  onClick={() => {
                                    setInputValue(messages.find(m => m.sender === 'user' && m.timestamp === message.timestamp - 1)?.content || '');
                                    setMessages(prev => prev.filter(m => m.id !== message.id));
                                  }}
                                >
                                  Retry
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* Loading indicator */}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 text-gray-100 p-3 rounded-2xl">
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]"></div>
                        </div>
                        <span className="text-xs text-gray-400">ZED is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Auto-scroll anchor */}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          {/* Input Area - Clean and aligned with embedded buttons */}
          <div className="border-t border-white/10 p-3 md:p-4 relative flex-shrink-0 bg-black/80 backdrop-blur-sm z-10">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end space-x-3">
                {/* Embedded action buttons */}
                <div className="flex items-center space-x-1 pb-1">
                  {/* Scanner/Upload button with menu - more embedded */}
                  <div className="relative" ref={scannerMenuRef}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsScannerMenuOpen(!isScannerMenuOpen)}
                      className="h-10 w-10 p-0 hover:bg-white/10 text-muted-foreground hover:text-white transition-all duration-200 rounded-lg border border-white/10 hover:border-white/20"
                      title="Scanner & Upload"
                    >
                      <Plus size={16} />
                    </Button>

                    {isScannerMenuOpen && (
                      <div className="absolute bottom-full left-0 mb-1 bg-gray-900/95 backdrop-blur-xl border border-purple-500/30 rounded-lg shadow-xl p-2 z-[9999] w-56 drop-shadow-2xl">
                        <div className="space-y-1">
                          <button
                            onClick={handlePhotoFromGallery}
                            className="w-full flex items-center space-x-3 p-2 text-left hover:bg-purple-500/20 rounded-lg transition-colors text-sm text-gray-300 hover:text-white"
                          >
                            <FolderOpen size={16} className="text-blue-400" />
                            <span>Photo from Gallery</span>
                          </button>

                          <button
                            onClick={handleFileUploadFromScanner}
                            className="w-full flex items-center space-x-3 p-2 text-left hover:bg-purple-500/20 rounded-lg transition-colors text-sm text-gray-300 hover:text-white"
                          >
                            <Upload size={16} className="text-green-400" />
                            <span>Upload File</span>
                          </button>

                          <button
                            onClick={handleTakePhoto}
                            className="w-full flex items-center space-x-3 p-2 text-left hover:bg-purple-500/20 rounded-lg transition-colors text-sm text-gray-300 hover:text-white"
                          >
                            <Camera size={16} className="text-yellow-400" />
                            <span>Take Photo</span>
                          </button>

                          <button
                            onClick={handleScanSearch}
                            className="w-full flex items-center space-x-3 p-2 text-left hover:bg-purple-500/20 rounded-lg transition-colors text-sm text-gray-300 hover:text-white"
                          >
                            <ScanLine size={16} className="text-cyan-400" />
                            <span>Scan & Search</span>
                          </button>

                          <button
                            onClick={handleQRCodeScan}
                            className="w-full flex items-center space-x-3 p-2 text-left hover:bg-purple-500/20 rounded-lg transition-colors text-sm text-gray-300 hover:text-white"
                          >
                            <QrCode size={16} className="text-purple-400" />
                            <span>Scan QR Code</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Emoji button with picker - more embedded */}
                  <div className="relative" ref={emojiPickerRef}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                      className="h-10 w-10 p-0 hover:bg-white/10 text-muted-foreground hover:text-white transition-all duration-200 rounded-lg border border-white/10 hover:border-white/20"
                      title="Add emoji"
                    >
                      <Smile size={16} />
                    </Button>

                    {isEmojiPickerOpen && (
                      <div className="absolute bottom-full left-0 mb-1 bg-gray-900/95 backdrop-blur-xl border border-purple-500/30 rounded-lg shadow-lg p-2 z-50 w-48">
                        <div className="grid grid-cols-6 gap-0.5 text-sm">
                          {['😊', '😂', '❤️', '👍', '🎉', '🔥', '💯', '✨', '🚀', '💪', '🙌', '👏'].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleEmojiSelect(emoji)}
                              className="p-1 hover:bg-purple-500/20 rounded text-center transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* GIF button with picker - more embedded */}
                  <div className="relative" ref={gifPickerRef}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsGifPickerOpen(!isGifPickerOpen)}
                      className="h-10 w-10 p-0 hover:bg-white/10 text-muted-foreground hover:text-white transition-all duration-200 rounded-lg border border-white/10 hover:border-white/20"
                      title="Add GIF"
                    >
                      <Image size={16} />
                    </Button>

                    {isGifPickerOpen && (
                      <div className="absolute bottom-full left-0 mb-1 bg-gray-900/95 backdrop-blur-xl border border-purple-500/30 rounded-lg shadow-lg p-2 z-50 w-56 max-h-64 overflow-y-auto">
                        <div className="space-y-2">
                          {/* Compact GIF Search */}
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Search..."
                              value={gifSearchQuery}
                              onChange={(e) => setGifSearchQuery(e.target.value)}
                              className="w-full px-2 py-1 bg-gray-800/50 border border-gray-600/30 rounded text-white text-xs placeholder-gray-400 focus:outline-none focus:border-purple-500/50"
                            />
                            {gifSearchQuery && (
                              <button
                                onClick={() => setGifSearchQuery("")}
                                aria-label="Clear search"
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                              >
                                <X size={10} />
                              </button>
                            )}
                          </div>

                          {/* Compact Categories */}
                          {!gifSearchQuery && (
                            <div className="grid grid-cols-2 gap-1">
                              {[
                                { category: 'Happy', emoji: '😊', keywords: 'happy smile joy' },
                                { category: 'Funny', emoji: '😂', keywords: 'funny laugh comedy' },
                                { category: 'Love', emoji: '❤️', keywords: 'love heart romance' },
                                { category: 'Party', emoji: '🎉', keywords: 'excited celebration party' }
                              ].map((item) => (
                                <button
                                  key={item.category}
                                  onClick={() => setGifSearchQuery(item.keywords)}
                                  className="flex items-center space-x-1 p-1 bg-gray-800/30 hover:bg-purple-500/20 rounded text-xs transition-colors"
                                >
                                  <span className="text-xs">{item.emoji}</span>
                                  <span className="text-gray-300 text-xs">{item.category}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Compact GIF Grid */}
                          <div className="grid grid-cols-3 gap-1">
                            {(gifSearchQuery ?
                              [`${gifSearchQuery}_1`, `${gifSearchQuery}_2`, `${gifSearchQuery}_3`] :
                              ['trending_1', 'trending_2', 'trending_3']
                            ).map((gifId, index) => (
                              <button
                                key={gifId}
                                onClick={() => handleGifSelect(gifId)}
                                className="aspect-square bg-gray-800/30 rounded-lg overflow-hidden hover:ring-2 hover:ring-purple-500/50 transition-all group relative"
                              >
                                <div className="w-full h-full bg-gradient-to-br from-purple-500/20 via-cyan-500/20 to-pink-500/20 flex items-center justify-center">
                                  <div className="text-center">
                                    <div className="text-2xl group-hover:scale-110 transition-transform">
                                      {gifSearchQuery ?
                                        (gifSearchQuery.includes('happy') ? '😊' :
                                          gifSearchQuery.includes('funny') ? '😂' :
                                            gifSearchQuery.includes('love') ? '❤️' :
                                              gifSearchQuery.includes('excited') ? '🎉' :
                                                gifSearchQuery.includes('cool') ? '😎' :
                                                  gifSearchQuery.includes('wow') ? '🤯' : '🎬') :
                                        ['🚀', '💯', '✨', '🔥'][index]
                                      }
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">GIF</div>
                                  </div>
                                </div>
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <div className="text-white text-xs font-medium">Click to send</div>
                                </div>
                              </button>
                            ))}
                          </div>

                          {/* No results message */}
                          {gifSearchQuery && gifSearchQuery.length > 2 && (
                            <div className="text-center text-gray-500 text-sm py-4">
                              <div className="mb-2">🔍</div>
                              <div>No GIFs found for "{gifSearchQuery}"</div>
                              <div className="text-xs mt-1">Try different keywords</div>
                            </div>
                          )}

                        </div>
                      </div>
                    )}
                  </div>

                  {/* Microphone button - more embedded */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMicrophoneToggle}
                    className={`h-10 w-10 p-0 hover:bg-white/10 transition-all duration-200 rounded-lg border border-white/10 hover:border-white/20 ${isRecording
                      ? 'text-red-500 bg-red-500/10 border-red-500/30'
                      : 'text-muted-foreground hover:text-white'
                      }`}
                    title={isRecording ? "Stop recording" : "Start voice recording"}
                  >
                    <Mic size={16} />
                  </Button>

                  {/* Translate button with language menu - more embedded */}
                  <div className="relative" ref={translateMenuRef}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsTranslateMenuOpen(!isTranslateMenuOpen)}
                      className="h-10 w-10 p-0 hover:bg-white/10 text-muted-foreground hover:text-white transition-all duration-200 rounded-lg border border-white/10 hover:border-white/20 disabled:opacity-50"
                      title="Translate"
                      disabled={!inputValue.trim()}
                    >
                      <Languages size={16} />
                    </Button>

                    {isTranslateMenuOpen && (
                      <div className="absolute bottom-full left-0 mb-2 bg-popover border border-border rounded-lg shadow-lg p-2 z-50 min-w-32">
                        <div className="space-y-1">
                          {[
                            { code: 'es', name: 'Spanish' },
                            { code: 'fr', name: 'French' },
                            { code: 'de', name: 'German' },
                            { code: 'it', name: 'Italian' },
                            { code: 'pt', name: 'Portuguese' },
                            { code: 'ja', name: 'Japanese' },
                            { code: 'ko', name: 'Korean' },
                            { code: 'zh', name: 'Chinese' }
                          ].map((lang) => (
                            <button
                              key={lang.code}
                              onClick={() => handleTranslate(lang.code)}
                              className="w-full text-left px-2 py-1 text-sm hover:bg-accent rounded transition-colors"
                            >
                              {lang.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Text input area */}
                <div className="flex-1 relative">
                  <div className="relative border border-purple-500/30 rounded-lg bg-purple-900/30 backdrop-blur-sm overflow-hidden focus-within:ring-1 focus-within:ring-purple-400">
                    <Textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type your message..."
                      className="min-h-[48px] max-h-32 resize-none border-0 bg-transparent px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none w-full text-white"
                      rows={1}
                    />
                  </div>
                </div>

                {/* Send button */}
                {isStreaming ? (
                  <Button
                    onClick={handleStop}
                    className="h-12 w-12 shrink-0 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-lg"
                  >
                    Stop
                  </Button>
                ) : (
                  <Button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isStreaming}
                    className="h-12 w-12 shrink-0 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 disabled:opacity-50 rounded-lg"
                  >
                    <Send size={20} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Settings Modal */}
      {
        showAdvancedSettings && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-gray-900/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-gray-900/95 backdrop-blur-xl border-b border-purple-500/20 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Settings className="text-purple-400" size={24} />
                    <h2 className="text-xl font-bold text-white">Advanced Settings & Personalization</h2>
                  </div>
                  <button
                    onClick={() => setShowAdvancedSettings(false)}
                    aria-label="Close Settings"
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X size={20} className="text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-8">
                {/* Theme & Appearance */}
                <section>
                  <div className="flex items-center space-x-3 mb-4">
                    <Palette className="text-cyan-400" size={20} />
                    <h3 className="text-lg font-semibold text-white">Theme & Appearance</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Theme Mode</label>
                      <div className="flex space-x-2">
                        {[
                          { value: "dark", label: "Dark", icon: Moon },
                          { value: "light", label: "Light", icon: Sun },
                          { value: "auto", label: "Auto", icon: Monitor }
                        ].map(({ value, label, icon: Icon }) => (
                          <button
                            key={value}
                            onClick={() => setUserTheme(value)}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all ${userTheme === value
                              ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                              : 'bg-gray-800/50 border-gray-600/30 text-gray-300 hover:bg-gray-700/50'
                              }`}
                          >
                            <Icon size={16} />
                            <span className="text-sm">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* User Profile & Personalization */}
                <section>
                  <div className="flex items-center space-x-3 mb-4">
                    <Settings className="text-green-400" size={20} />
                    <h3 className="text-lg font-semibold text-white">User Profile</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Display Name</label>
                        <input
                          type="text"
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600/30 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-green-500/50"
                          placeholder="Enter your name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Avatar Emoji</label>
                        <div className="flex space-x-2">
                          {['👤', '🙂', '😊', '🤓', '🎭', '🚀', '🌟', '💎'].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => setUserAvatar(emoji)}
                              className={`w-10 h-10 rounded-lg border transition-all ${userAvatar === emoji
                                ? 'bg-green-500/20 border-green-500/50 text-green-300'
                                : 'bg-gray-800/50 border-gray-600/30 hover:bg-gray-700/50'
                                }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Interface Language</label>
                        <select
                          value={interfaceLanguage}
                          onChange={(e) => setInterfaceLanguage(e.target.value)}
                          aria-label="Interface Language"
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600/30 rounded-lg text-white text-sm focus:outline-none focus:border-green-500/50"
                        >
                          <option value="en">English</option>
                          <option value="es">Español</option>
                          <option value="fr">Français</option>
                          <option value="de">Deutsch</option>
                          <option value="ja">日本語</option>
                          <option value="zh">中文</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Timezone</label>
                        <select
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          aria-label="Timezone"
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600/30 rounded-lg text-white text-sm focus:outline-none focus:border-green-500/50"
                        >
                          <option value="auto">Auto-detect</option>
                          <option value="utc">UTC</option>
                          <option value="est">Eastern Time</option>
                          <option value="pst">Pacific Time</option>
                          <option value="gmt">GMT</option>
                          <option value="cet">Central European</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Chat Behavior */}
                <section>
                  <div className="flex items-center space-x-3 mb-4">
                    <MessageSquare className="text-blue-400" size={20} />
                    <h3 className="text-lg font-semibold text-white">Chat Behavior</h3>
                  </div>
                  <div className="space-y-4">
                    {[
                      { key: "autoSave", label: "Auto-save Conversations", desc: "Automatically save your chat history" },
                      { key: "quickReplies", label: "Quick Reply Suggestions", desc: "Show suggested responses during chat" },
                      { key: "typingIndicator", label: "Typing Indicator", desc: "Show when AI is generating response" },
                      { key: "readReceipts", label: "Read Receipts", desc: "Show when messages are read" }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                        <div>
                          <div className="text-sm font-medium text-white">{label}</div>
                          <div className="text-xs text-gray-400">{desc}</div>
                        </div>
                        <button
                          onClick={() => setChatBehavior(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                          aria-label={`Toggle ${label}`}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${chatBehavior[key as keyof typeof chatBehavior] ? 'bg-blue-500' : 'bg-gray-600'
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${chatBehavior[key as keyof typeof chatBehavior] ? 'translate-x-6' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Accessibility */}
                <section>
                  <div className="flex items-center space-x-3 mb-4">
                    <Monitor className="text-orange-400" size={20} />
                    <h3 className="text-lg font-semibold text-white">Accessibility</h3>
                  </div>
                  <div className="space-y-4">
                    {[
                      { key: "highContrast", label: "High Contrast Mode", desc: "Increase contrast for better visibility" },
                      { key: "largeText", label: "Large Text", desc: "Use larger fonts throughout the interface" },
                      { key: "reducedMotion", label: "Reduced Motion", desc: "Minimize animations and transitions" },
                      { key: "screenReader", label: "Screen Reader Support", desc: "Enhanced compatibility with screen readers" }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                        <div>
                          <div className="text-sm font-medium text-white">{label}</div>
                          <div className="text-xs text-gray-400">{desc}</div>
                        </div>
                        <button
                          onClick={() => setAccessibilitySettings(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                          aria-label={`Toggle ${label}`}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${accessibilitySettings[key as keyof typeof accessibilitySettings] ? 'bg-orange-500' : 'bg-gray-600'
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${accessibilitySettings[key as keyof typeof accessibilitySettings] ? 'translate-x-6' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* AI Personality */}
                <section>
                  <div className="flex items-center space-x-3 mb-4">
                    <Brain className="text-pink-400" size={20} />
                    <h3 className="text-lg font-semibold text-white">AI Personality</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Response Style</label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                          { value: "professional", label: "Professional", desc: "Formal, detailed responses" },
                          { value: "casual", label: "Casual", desc: "Friendly, conversational tone" },
                          { value: "technical", label: "Technical", desc: "Precise, code-focused answers" }
                        ].map(({ value, label, desc }) => (
                          <button
                            key={value}
                            onClick={() => setAiPersonality(value)}
                            className={`p-4 rounded-lg border text-left transition-all ${aiPersonality === value
                              ? 'bg-pink-500/20 border-pink-500/50'
                              : 'bg-gray-800/50 border-gray-600/30 hover:bg-gray-700/50'
                              }`}
                          >
                            <div className="font-medium text-white text-sm">{label}</div>
                            <div className="text-xs text-gray-400 mt-1">{desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Response Length</label>
                      <div className="flex space-x-2">
                        {[
                          { value: "concise", label: "Concise" },
                          { value: "balanced", label: "Balanced" },
                          { value: "detailed", label: "Detailed" }
                        ].map(({ value, label }) => (
                          <button
                            key={value}
                            onClick={() => setResponseLength(value)}
                            className={`px-4 py-2 rounded-lg border text-sm transition-all ${responseLength === value
                              ? 'bg-pink-500/20 border-pink-500/50 text-pink-300'
                              : 'bg-gray-800/50 border-gray-600/30 text-gray-300 hover:bg-gray-700/50'
                              }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Notifications */}
                <section>
                  <div className="flex items-center space-x-3 mb-4">
                    <Bell className="text-cyan-400" size={20} />
                    <h3 className="text-lg font-semibold text-white">Notifications</h3>
                  </div>
                  <div className="space-y-4">
                    {[
                      { key: "sounds", label: "Sound Notifications", desc: "Play sound for new messages" },
                      { key: "desktop", label: "Desktop Notifications", desc: "Show browser notifications" },
                      { key: "email", label: "Email Notifications", desc: "Send email for important updates" }
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                        <div>
                          <div className="text-sm font-medium text-white">{label}</div>
                          <div className="text-xs text-gray-400">{desc}</div>
                        </div>
                        <button
                          onClick={() => setNotificationSettings(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
                          aria-label={`Toggle ${label}`}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationSettings[key as keyof typeof notificationSettings] ? 'bg-cyan-500' : 'bg-gray-600'
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationSettings[key as keyof typeof notificationSettings] ? 'translate-x-6' : 'translate-x-1'
                              }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Privacy & Data */}
                <section>
                  <div className="flex items-center space-x-3 mb-4">
                    <Shield className="text-green-400" size={20} />
                    <h3 className="text-lg font-semibold text-white">Privacy & Data</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-white">Analytics & Telemetry</div>
                        <div className="text-xs text-gray-400">Help improve <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent font-semibold drop-shadow-[0_1px_2px_rgba(168,85,247,0.3)] [text-shadow:_0_1px_4px_rgba(168,85,247,0.4)]">ZED</span> with usage data</div>
                      </div>
                      <button
                        onClick={() => setDataPrivacy(prev => ({ ...prev, analytics: !prev.analytics }))}
                        aria-label="Toggle Analytics & Telemetry"
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dataPrivacy.analytics ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${dataPrivacy.analytics ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Data Retention Period</label>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { value: "7days", label: "7 Days" },
                          { value: "30days", label: "30 Days" },
                          { value: "90days", label: "90 Days" },
                          { value: "forever", label: "Forever" }
                        ].map(({ value, label }) => (
                          <button
                            key={value}
                            onClick={() => setDataPrivacy(prev => ({ ...prev, dataRetention: value }))}
                            className={`px-3 py-2 rounded-lg border text-sm transition-all ${dataPrivacy.dataRetention === value
                              ? 'bg-green-500/20 border-green-500/50 text-green-300'
                              : 'bg-gray-800/50 border-gray-600/30 text-gray-300 hover:bg-gray-700/50'
                              }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                      <div>
                        <div className="text-sm font-medium text-white">Share with Team</div>
                        <div className="text-xs text-gray-400">Allow team members to see your preferences</div>
                      </div>
                      <button
                        onClick={() => setDataPrivacy(prev => ({ ...prev, shareWithTeam: !prev.shareWithTeam }))}
                        aria-label="Toggle Share with Team"
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dataPrivacy.shareWithTeam ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${dataPrivacy.shareWithTeam ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-xl border-t border-purple-500/20 p-6">
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowAdvancedSettings(false)}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    className="px-6 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white text-sm rounded-lg transition-all"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </>
  );
}