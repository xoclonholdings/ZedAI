# 🎨 ZED Frontend Component Library
## UI Component Specifications & Implementation Guide

---

## 🏗️ **Component Architecture**

### **Component Hierarchy**
```
App
├── Router
├── AuthProvider
└── QueryProvider
    ├── Layout
    │   ├── Header
    │   ├── Sidebar
    │   └── MainContent
    └── Pages
        ├── Chat
        ├── Login
        ├── Settings
        └── Admin
```

---

## 🎯 **Core UI Components**

### **Button Component**
```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}

// Styling variants
const buttonVariants = {
  primary: 'bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600',
  secondary: 'bg-gray-700 hover:bg-gray-600 border border-gray-600',
  ghost: 'hover:bg-gray-800 text-purple-400 hover:text-purple-300',
  danger: 'bg-red-600 hover:bg-red-700 text-white'
};
```

### **Input Component**
```typescript
interface InputProps {
  type?: 'text' | 'password' | 'email' | 'search';
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

// Cyberpunk styling
const inputStyle = `
  bg-black border border-gray-700 rounded-lg px-4 py-2
  text-white placeholder-gray-400
  focus:border-purple-500 focus:ring-1 focus:ring-purple-500
  transition-colors duration-200
`;
```

### **Card Component**
```typescript
interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  gradient?: boolean;
}

// Base card styling
const cardStyle = `
  bg-gray-900 border border-gray-800 rounded-xl p-6
  shadow-lg backdrop-blur-sm
`;

// Gradient variant
const gradientCard = `
  bg-gradient-to-br from-gray-900/50 to-gray-800/50
  border border-purple-500/20
`;
```

---

## 🔐 **Authentication Components**

### **LoginForm Component**
```typescript
interface LoginFormProps {
  onLogin: (credentials: LoginCredentials) => Promise<void>;
  loading?: boolean;
  error?: string;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, loading, error }) => {
  return (
    <Card className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
          ZED
        </h1>
        <p className="text-gray-400 mt-2">Welcome back</p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <Input
          type="text"
          placeholder="Username"
          value={username}
          onChange={setUsername}
          icon={<User size={16} />}
        />
        
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={setPassword}
          icon={<Lock size={16} />}
        />
        
        {error && (
          <div className="text-red-400 text-sm mt-2">{error}</div>
        )}
        
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          className="w-full mt-6"
        >
          Sign In
        </Button>
      </form>
    </Card>
  );
};
```

### **AuthGuard Component**
```typescript
const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return <>{children}</>;
};
```

---

## 💬 **Chat Components**

### **ChatArea Component**
```typescript
interface ChatAreaProps {
  conversationId: string;
}

const ChatArea: React.FC<ChatAreaProps> = ({ conversationId }) => {
  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="border-b border-gray-800 p-4">
        <h2 className="text-lg font-semibold text-white">
          Conversation
        </h2>
      </div>
      
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>
      
      {/* Chat Input */}
      <div className="border-t border-gray-800 p-4">
        <ChatInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  );
};
```

### **ChatMessage Component**
```typescript
interface ChatMessageProps {
  message: {
    id: string;
    content: string;
    type: 'user' | 'assistant';
    timestamp: Date;
    attachments?: FileAttachment[];
  };
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.type === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
        isUser 
          ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white' 
          : 'bg-gray-800 text-gray-100'
      }`}>
        <p className="text-sm">{message.content}</p>
        
        {message.attachments && (
          <div className="mt-2 space-y-2">
            {message.attachments.map(attachment => (
              <FileAttachmentCard key={attachment.id} file={attachment} />
            ))}
          </div>
        )}
        
        <p className="text-xs opacity-70 mt-1">
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  );
};
```

### **ChatInput Component**
```typescript
interface ChatInputProps {
  onSendMessage: (content: string, files?: File[]) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled }) => {
  const [message, setMessage] = useState('');
  const [showFileUpload, setShowFileUpload] = useState(false);
  
  return (
    <div className="relative">
      <div className="flex items-end space-x-2">
        {/* File Upload Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFileUpload(true)}
          className="mb-2"
        >
          <Plus size={16} />
        </Button>
        
        {/* Message Input */}
        <div className="flex-1">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 resize-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            rows={1}
            disabled={disabled}
          />
        </div>
        
        {/* Send Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className="mb-2"
        >
          <Send size={16} />
        </Button>
      </div>
      
      {/* File Upload Modal */}
      {showFileUpload && (
        <FileUploadModal
          onClose={() => setShowFileUpload(false)}
          onFilesSelected={handleFilesSelected}
        />
      )}
    </div>
  );
};
```

### **ChatSidebar Component**
```typescript
const ChatSidebar: React.FC = () => {
  const { conversations, loading } = useConversations();
  
  return (
    <div className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-800">
        <Button
          variant="primary"
          className="w-full"
          onClick={createNewConversation}
        >
          <Plus size={16} className="mr-2" />
          New Chat
        </Button>
      </div>
      
      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-1">
            {conversations.map(conversation => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={activeConversationId === conversation.id}
                onClick={() => setActiveConversation(conversation.id)}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* User Menu */}
      <div className="p-4 border-t border-gray-800">
        <UserMenu />
      </div>
    </div>
  );
};
```

---

## 📁 **File Upload Components**

### **FileUploadModal Component**
```typescript
interface FileUploadModalProps {
  onClose: () => void;
  onFilesSelected: (files: File[]) => void;
}

const FileUploadModal: React.FC<FileUploadModalProps> = ({ onClose, onFilesSelected }) => {
  const [mode, setMode] = useState<'options' | 'files' | 'camera' | 'qr'>('options');
  
  return (
    <Modal onClose={onClose}>
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-white mb-4">
          Add to Chat
        </h3>
        
        {mode === 'options' && (
          <div className="grid grid-cols-2 gap-3">
            <UploadOption
              icon={<FolderOpen size={24} />}
              label="Browse Files"
              onClick={() => setMode('files')}
            />
            <UploadOption
              icon={<Image size={24} />}
              label="Photo Gallery"
              onClick={() => setMode('files')}
            />
            <UploadOption
              icon={<Camera size={24} />}
              label="Take Photo"
              onClick={() => setMode('camera')}
            />
            <UploadOption
              icon={<QrCode size={24} />}
              label="Scan QR Code"
              onClick={() => setMode('qr')}
            />
          </div>
        )}
        
        {mode === 'files' && (
          <FileSelector onFilesSelected={onFilesSelected} />
        )}
        
        {mode === 'camera' && (
          <CameraCapture onPhotoTaken={onFilesSelected} />
        )}
        
        {mode === 'qr' && (
          <QRScanner onQRDetected={onFilesSelected} />
        )}
      </div>
    </Modal>
  );
};
```

### **CameraCapture Component**
```typescript
const CameraCapture: React.FC<{ onPhotoTaken: (files: File[]) => void }> = ({ onPhotoTaken }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);
  
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStream(mediaStream);
    } catch (error) {
      console.error('Camera access failed:', error);
    }
  };
  
  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video && canvas) {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
          onPhotoTaken([file]);
        }
      }, 'image/jpeg', 0.9);
    }
  };
  
  return (
    <div className="space-y-4">
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Camera Controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <Button
            variant="primary"
            size="lg"
            onClick={capturePhoto}
            className="rounded-full w-16 h-16"
          >
            <Camera size={24} />
          </Button>
        </div>
      </div>
    </div>
  );
};
```

### **QRScanner Component**
```typescript
const QRScanner: React.FC<{ onQRDetected: (content: string) => void }> = ({ onQRDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  
  useEffect(() => {
    if (scanning) {
      startScanning();
    }
    return () => stopScanning();
  }, [scanning]);
  
  const scanQRCode = () => {
    const video = videoRef.current;
    if (!video) return;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx?.drawImage(video, 0, 0);
    
    // QR code detection logic would go here
    // For demo purposes, we'll simulate detection
    const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
    
    // In a real implementation, you'd use a QR code library
    // like @zxing/library or qr-scanner
    
    setTimeout(() => {
      // Simulated QR detection
      onQRDetected('https://example.com');
    }, 2000);
  };
  
  return (
    <div className="space-y-4">
      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        
        {/* QR Scanning Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="border-2 border-purple-500 rounded-lg w-48 h-48 animate-pulse">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-purple-400 rounded-tl-lg"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-purple-400 rounded-tr-lg"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-purple-400 rounded-bl-lg"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-purple-400 rounded-br-lg"></div>
          </div>
        </div>
        
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <Button
            variant="primary"
            onClick={scanQRCode}
            disabled={scanning}
          >
            {scanning ? 'Scanning...' : 'Scan QR Code'}
          </Button>
        </div>
      </div>
    </div>
  );
};
```

---

## 🎨 **Layout Components**

### **Header Component**
```typescript
const Header: React.FC = () => {
  const { user, logout } = useAuth();
  
  return (
    <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            ZED
          </h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <span className="text-gray-300">Welcome, {user?.username}</span>
          <Button variant="ghost" onClick={logout}>
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </header>
  );
};
```

### **Modal Component**
```typescript
interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const Modal: React.FC<ModalProps> = ({ children, onClose, size = 'md' }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className={`relative z-10 ${sizeClasses[size]}`}>
        {children}
      </div>
    </div>
  );
};
```

### **LoadingSpinner Component**
```typescript
const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };
  
  return (
    <div className="flex items-center justify-center">
      <div className={`${sizeClasses[size]} border-2 border-purple-500 border-t-transparent rounded-full animate-spin`} />
    </div>
  );
};
```

---

## 🎯 **Utility Components**

### **Toast Component**
```typescript
interface ToastProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ type, message, onClose }) => {
  const typeStyles = {
    success: 'bg-green-600 border-green-500',
    error: 'bg-red-600 border-red-500',
    warning: 'bg-yellow-600 border-yellow-500',
    info: 'bg-blue-600 border-blue-500'
  };
  
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg border ${typeStyles[type]} text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <span>{message}</span>
        <button onClick={onClose} className="ml-4 text-white/70 hover:text-white">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
```

### **FileAttachmentCard Component**
```typescript
const FileAttachmentCard: React.FC<{ file: FileAttachment }> = ({ file }) => {
  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return <Image size={16} />;
    if (mimetype.includes('pdf')) return <FileText size={16} />;
    if (mimetype.includes('video/')) return <Video size={16} />;
    return <File size={16} />;
  };
  
  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
      <div className="flex items-center space-x-3">
        <div className="text-purple-400">
          {getFileIcon(file.mimetype)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {file.originalName}
          </p>
          <p className="text-xs text-gray-400">
            {formatFileSize(file.size)}
          </p>
        </div>
        <Button variant="ghost" size="sm">
          <Download size={14} />
        </Button>
      </div>
      
      {file.analysis && (
        <div className="mt-2 text-xs text-gray-300">
          {file.analysis.summary || file.analysis.description}
        </div>
      )}
    </div>
  );
};
```

---

## 🎨 **Styling Guidelines**

### **Color Palette**
```css
:root {
  /* Primary Colors */
  --purple: #a855f7;
  --cyan: #06b6d4;
  --pink: #ec4899;
  
  /* Grays */
  --black: #000000;
  --gray-900: #111827;
  --gray-800: #1f2937;
  --gray-700: #374151;
  --gray-600: #4b5563;
  --gray-400: #9ca3af;
  
  /* Status Colors */
  --green: #10b981;
  --red: #ef4444;
  --yellow: #f59e0b;
  --blue: #3b82f6;
}
```

### **Animation Classes**
```css
/* Fade In */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

/* Pulse Gradient */
@keyframes pulseGradient {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.animate-pulse-gradient {
  animation: pulseGradient 2s ease-in-out infinite;
}

/* Slide In */
@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

.animate-slide-in {
  animation: slideIn 0.3s ease-out;
}
```

### **Responsive Breakpoints**
```css
/* Mobile First */
.container {
  @apply px-4;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    @apply px-6;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    @apply px-8;
  }
}

/* Large Desktop */
@media (min-width: 1280px) {
  .container {
    @apply px-12;
  }
}
```

---

This component library provides all the building blocks needed to create a cohesive, cyberpunk-themed ZED frontend that matches the system's capabilities and aesthetic requirements.
