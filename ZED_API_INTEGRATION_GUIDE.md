# 🏗️ ZED Frontend API Integration Guide
## Complete Backend Integration Documentation

---

## 🔗 **API Base Configuration**

### **Server Endpoints**
```javascript
// Primary API Server (Full Features)
const API_BASE_URL = 'http://localhost:5001'

// Simple Chat Server (Lightweight)
const CHAT_API_URL = 'http://localhost:3001'

// WebSocket for real-time features
const WS_URL = 'ws://localhost:5001'
```

### **Headers & CORS**
```javascript
// Required headers for all requests
const defaultHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

// CORS is pre-configured for port 5173
// Credentials are automatically included
```

---

## 🔐 **Authentication API**

### **Login Endpoint**
```javascript
POST /api/login
Content-Type: application/json

// Request body
{
  "username": "Admin",
  "password": "Zed2025"
}

// Success response (200)
{
  "success": true,
  "user": {
    "id": "user_id",
    "username": "Admin",
    "role": "admin"
  }
}

// Error response (401)
{
  "error": "Invalid credentials"
}
```

### **User Status**
```javascript
GET /api/auth/user

// Success response (200) - authenticated
{
  "user": {
    "id": "user_id",
    "username": "Admin",
    "role": "admin"
  }
}

// Error response (401) - not authenticated
{
  "error": "Not authenticated"
}
```

### **Logout**
```javascript
POST /api/logout

// Success response (200)
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 💬 **Chat API Endpoints**

### **Conversations Management**
```javascript
// Get all conversations
GET /api/conversations
// Response: Array of conversation objects

// Create new conversation
POST /api/conversations
{
  "title": "New Conversation"
}
// Response: Created conversation object

// Get conversation by ID
GET /api/conversations/:id
// Response: Conversation object with metadata

// Delete conversation
DELETE /api/conversations/:id
// Response: Success confirmation
```

### **Messages API**
```javascript
// Get conversation messages
GET /api/conversations/:id/messages
// Response: Array of message objects

// Send new message
POST /api/conversations/:id/messages
{
  "content": "Your message here",
  "type": "user"
}
// Response: Created message object

// Example message object
{
  "id": "msg_123",
  "conversationId": "conv_456",
  "content": "Hello world",
  "type": "user", // or "assistant"
  "timestamp": "2025-08-02T10:30:00Z",
  "metadata": {
    "processingTime": 1200,
    "model": "gpt-4"
  }
}
```

### **Streaming Responses**
```javascript
// For real-time AI responses
POST /api/conversations/:id/messages/stream
{
  "content": "Your message",
  "stream": true
}

// Server-Sent Events response
// Each chunk: data: {"delta": "partial response text"}
// Final chunk: data: {"done": true}
```

---

## 📁 **File Upload API**

### **Single File Upload**
```javascript
POST /api/upload
Content-Type: multipart/form-data

// Form data
const formData = new FormData();
formData.append('file', fileObject);
formData.append('conversationId', 'conv_123');

// Success response
{
  "success": true,
  "file": {
    "id": "file_456",
    "filename": "document.pdf",
    "originalName": "My Document.pdf",
    "size": 1024000,
    "mimetype": "application/pdf",
    "url": "/uploads/file_456_document.pdf",
    "uploadedAt": "2025-08-02T10:30:00Z"
  },
  "analysis": {
    "type": "document",
    "summary": "This appears to be a technical specification document...",
    "metadata": {
      "pages": 15,
      "wordCount": 3500
    }
  }
}
```

### **Image Upload with Analysis**
```javascript
POST /api/upload
// Form data with image file

// Response includes AI analysis
{
  "success": true,
  "file": { /* file object */ },
  "analysis": {
    "type": "image",
    "description": "A cyberpunk-themed interface design with purple and cyan gradients...",
    "objects": ["interface", "buttons", "text"],
    "colors": ["purple", "cyan", "black"],
    "qrCodes": [ // If any QR codes detected
      {
        "content": "https://example.com",
        "position": { "x": 100, "y": 200 }
      }
    ]
  }
}
```

### **QR Code Processing**
```javascript
POST /api/upload/qr
// For QR code specific processing

// Response
{
  "success": true,
  "qrCodes": [
    {
      "content": "https://example.com",
      "type": "url",
      "position": { "x": 150, "y": 300 }
    }
  ],
  "file": { /* file object */ }
}
```

### **Batch Upload**
```javascript
POST /api/upload/batch
Content-Type: multipart/form-data

// Multiple files in form data
// Response: Array of file objects with individual analysis
```

---

## 🧠 **Memory System API**

### **Memory Storage**
```javascript
// Store memory entry
POST /api/memory
{
  "type": "conversation" | "document" | "user_preference" | "learned_fact",
  "content": "Memory content",
  "importance": 7, // 1-10 scale
  "associations": ["tag1", "tag2"]
}

// Response
{
  "id": "memory_789",
  "type": "conversation",
  "content": "Memory content",
  "importance": 7,
  "timestamp": "2025-08-02T10:30:00Z",
  "associations": ["tag1", "tag2"]
}
```

### **Memory Retrieval**
```javascript
// Search memories
GET /api/memory/search?q=search_term&type=conversation&limit=10

// Get all memories
GET /api/memory?page=1&limit=50

// Get specific memory
GET /api/memory/:id

// Response: Array of memory objects or single memory object
```

### **Memory Management**
```javascript
// Update memory
PUT /api/memory/:id
{
  "importance": 9,
  "associations": ["updated", "tags"]
}

// Delete memory
DELETE /api/memory/:id

// Memory compression (automatic optimization)
POST /api/memory/compress
```

---

## ⚙️ **Settings API**

### **User Preferences**
```javascript
// Get user settings
GET /api/settings

// Update settings
PUT /api/settings
{
  "theme": "cyberpunk",
  "notifications": true,
  "aiCreativity": 0.7,
  "memoryRetention": 30 // days
}

// Response: Updated settings object
```

### **System Configuration**
```javascript
// Get system status
GET /api/system/status
{
  "status": "healthy",
  "uptime": 3600,
  "activeUsers": 1,
  "memoryUsage": {
    "used": "256MB",
    "total": "1GB"
  },
  "features": {
    "ollama": true,
    "database": true,
    "fileUpload": true
  }
}
```

---

## 📊 **Analytics & Monitoring**

### **Usage Statistics**
```javascript
// Get conversation stats
GET /api/analytics/conversations
{
  "total": 150,
  "thisMonth": 45,
  "averageLength": 12.5,
  "topTopics": ["coding", "design", "documentation"]
}

// File upload stats
GET /api/analytics/files
{
  "totalUploads": 78,
  "totalSize": "2.5GB",
  "typeBreakdown": {
    "images": 45,
    "documents": 28,
    "other": 5
  }
}
```

### **Health Monitoring**
```javascript
// Health check endpoint
GET /api/health
{
  "status": "ok",
  "timestamp": "2025-08-02T10:30:00Z",
  "services": {
    "database": "connected",
    "ai": "available",
    "fileStorage": "ok"
  }
}

// Detailed diagnostics
GET /api/diagnostics
// Extended health information
```

---

## 🔄 **WebSocket Integration**

### **Real-time Chat**
```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:5001');

// Message events
ws.on('message', (data) => {
  const message = JSON.parse(data);
  switch (message.type) {
    case 'message_start':
      // AI started responding
      break;
    case 'message_delta':
      // Partial AI response
      appendToMessage(message.delta);
      break;
    case 'message_complete':
      // AI response finished
      finalizeMessage(message.content);
      break;
    case 'typing_indicator':
      // Show typing indicator
      break;
  }
});

// Send message via WebSocket
ws.send(JSON.stringify({
  type: 'chat_message',
  conversationId: 'conv_123',
  content: 'Hello AI'
}));
```

---

## 🛠️ **Error Handling**

### **Standard Error Responses**
```javascript
// 400 - Bad Request
{
  "error": "Invalid request format",
  "details": "Missing required field: content"
}

// 401 - Unauthorized
{
  "error": "Authentication required"
}

// 403 - Forbidden
{
  "error": "Insufficient permissions"
}

// 404 - Not Found
{
  "error": "Conversation not found"
}

// 413 - Payload Too Large
{
  "error": "File too large",
  "maxSize": "32GB"
}

// 429 - Rate Limited
{
  "error": "Rate limit exceeded",
  "retryAfter": 60
}

// 500 - Internal Server Error
{
  "error": "Internal server error",
  "requestId": "req_123"
}
```

### **Client Error Handling**
```javascript
// Recommended error handling pattern
async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include',
      ...options
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

---

## 📱 **Mobile Optimization**

### **File Upload on Mobile**
```javascript
// Camera capture
const capturePhoto = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { 
      facingMode: 'environment', // Back camera
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  });
  
  // Canvas capture logic
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);
  
  canvas.toBlob(async (blob) => {
    const formData = new FormData();
    formData.append('file', blob, 'photo.jpg');
    
    const result = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });
  }, 'image/jpeg', 0.9);
};
```

---

## 🚀 **Performance Optimization**

### **Request Optimization**
```javascript
// Use React Query for caching
import { useQuery, useMutation } from '@tanstack/react-query';

// Cached conversation list
const useConversations = () => {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiCall('/api/conversations'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Optimistic updates for messages
const useSendMessage = () => {
  return useMutation({
    mutationFn: ({ conversationId, content }) => 
      apiCall(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      }),
    onMutate: async ({ conversationId, content }) => {
      // Optimistic update
      const previousMessages = queryClient.getQueryData(['messages', conversationId]);
      queryClient.setQueryData(['messages', conversationId], old => [
        ...old,
        { id: 'temp', content, type: 'user', timestamp: new Date() }
      ]);
      return { previousMessages };
    }
  });
};
```

---

This integration guide provides all the necessary API documentation for building a complete ZED frontend that seamlessly integrates with the prepared backend infrastructure.
