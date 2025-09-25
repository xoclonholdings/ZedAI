# ZED AI System Architecture

## Overview

ZED AI is built as a serverless neural interface system with a clear separation of concerns and protected UI components.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    ZED AI Neural Interface                  │
├─────────────────────────────────────────────────────────────┤
│                        Frontend Layer                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              zed-ui/ (Protected)                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │ Neural      │  │ Components  │  │ Themes      │ │   │
│  │  │ Interface   │  │             │  │             │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                       API Gateway                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │             Netlify Functions                       │   │
│  │  /api/chat  │  /api/memory-upload  │  /api/health   │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                      Backend Services                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │ Chat        │  │ Memory      │  │ Health      │ │   │
│  │  │ Service     │  │ Service     │  │ Monitor     │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                        AI Layer                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Ollama Integration                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │ LLaMA 2     │  │ Mistral     │  │ Code Llama  │ │   │
│  │  │ Model       │  │ Model       │  │ Model       │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                       Data Layer                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Memory Management                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │ Compression │  │ Indexing    │  │ Storage     │ │   │
│  │  │ Engine      │  │ System      │  │ System      │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. Frontend Layer (zed-ui/)

#### Protected UI Components
```
zed-ui/
├── interfaces/
│   └── zed-neural-interface.html    # Main interface
├── components/
│   ├── chat-component.js            # Chat functionality
│   ├── memory-upload.js             # Upload system
│   └── sidebar-nav.js               # Navigation
├── assets/
│   ├── styles.css                   # Cyberpunk styling
│   └── icons/                       # UI icons
└── themes/
    ├── cyberpunk-dark.css           # Default theme
    └── neural-green.css             # Alternative theme
```

**Key Features:**
- Cyberpunk aesthetic with neural terminology
- Responsive design with sidebar navigation
- Real-time chat interface
- Drag-and-drop memory upload
- System status monitoring

### 2. API Gateway Layer

#### Netlify Functions Router
```
zed-backend/netlify-functions/
├── chat.mts                         # Chat endpoint
├── health.mts                       # Health monitoring
└── memory-upload.mts                # Memory management
```

**Routing Configuration:**
```toml
# netlify.toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

### 3. Backend Services Layer

#### Service Architecture
```
zed-backend/
├── services/
│   ├── chat-service.ts              # Chat logic
│   ├── memory-service.ts            # Memory processing
│   └── health-service.ts            # Health monitoring
├── middleware/
│   ├── cors.ts                      # CORS handling
│   ├── validation.ts                # Input validation
│   └── error-handler.ts             # Error processing
└── api/
    ├── chat-api.ts                  # Chat API logic
    ├── memory-api.ts                # Memory API logic
    └── health-api.ts                # Health API logic
```

### 4. AI Integration Layer

#### Ollama Integration
```typescript
// AI Service Architecture
interface AIService {
  model: string;
  endpoint: string;
  processChat(message: string): Promise<string>;
  getModelStatus(): Promise<ModelStatus>;
}

class OllamaService implements AIService {
  model = 'llama2';
  endpoint = 'http://localhost:11434';
  
  async processChat(message: string): Promise<string> {
    // Direct Ollama integration
    const response = await fetch(`${this.endpoint}/api/generate`, {
      method: 'POST',
      body: JSON.stringify({
        model: this.model,
        prompt: message,
        stream: false
      })
    });
    return response.json();
  }
}
```

### 5. Data Management Layer

#### Memory System Architecture
```
zed-memory/
├── storage/
│   ├── memory-store.ts              # Storage interface
│   ├── file-manager.ts              # File operations
│   └── ZedAI_data/                  # Original data
├── compression/
│   ├── gzip-compressor.ts           # Text compression
│   ├── image-optimizer.ts           # Image compression
│   └── json-compressor.ts           # JSON compression
├── indexing/
│   ├── memory-index.ts              # Memory indexing
│   ├── search-engine.ts             # Search functionality
│   └── metadata-manager.ts          # Metadata handling
└── upload/
    ├── upload-handler.ts            # File upload logic
    ├── validation.ts                # File validation
    └── processor.ts                 # File processing
```

## Data Flow

### 1. Chat Message Flow
```
User Input → Frontend → API Gateway → Chat Service → Ollama → Memory Storage → Response
```

**Detailed Flow:**
1. User types message in neural interface
2. Frontend sends POST to `/api/chat`
3. Netlify function routes to chat service
4. Chat service processes with Ollama
5. Response stored in memory system
6. AI response sent back to frontend
7. UI updates with new message

### 2. Memory Upload Flow
```
File Upload → Validation → Processing → Compression → Indexing → Storage → Confirmation
```

**Detailed Flow:**
1. User drags files to upload area
2. Frontend validates file types/sizes
3. Files sent to `/api/memory-upload`
4. Backend processes each file type
5. Compression applied based on content
6. Memory index updated with metadata
7. Success response with compression stats

### 3. Health Monitoring Flow
```
System Check → Service Status → Resource Usage → AI Status → Aggregated Response
```

## Security Architecture

### 1. Input Validation
```typescript
interface ValidationLayer {
  validateChatMessage(message: string): boolean;
  validateFileUpload(file: File): boolean;
  sanitizeInput(input: string): string;
}
```

### 2. CORS Configuration
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};
```

### 3. File Security
- File type validation
- Size limits enforcement
- Temporary storage with cleanup
- No executable file uploads

## Performance Architecture

### 1. Compression Strategy
- **Text files**: gzip compression (70-90% reduction)
- **JSON data**: gzip compression (60-80% reduction)
- **Images**: Optimized compression based on format
- **Binary files**: Stored as-is with metadata

### 2. Memory Management
- Temporary file storage with automatic cleanup
- Memory indexing for fast searches
- Lazy loading of large datasets
- Efficient file streaming

### 3. Caching Strategy
- Static asset caching via Netlify CDN
- Memory index caching for search performance
- AI model response caching for common queries

## Scalability Architecture

### 1. Serverless Benefits
- Automatic scaling with demand
- Pay-per-use pricing model
- No server maintenance required
- Global CDN distribution

### 2. Horizontal Scaling
- Function-based architecture allows independent scaling
- Memory system can be migrated to cloud storage
- AI processing can use multiple models

### 3. Future Scaling Considerations
- Database integration for persistent storage
- Redis caching for session management
- Load balancing for high-traffic scenarios

## Deployment Architecture

### 1. Development Environment
```
Local Development → Git Repository → Netlify Preview → Testing
```

### 2. Production Environment
```
Git Push → Netlify Build → Function Deployment → CDN Distribution → Live Site
```

### 3. CI/CD Pipeline
- Automated testing on commit
- Preview deployments for pull requests
- Production deployment on merge to main
- Rollback capabilities

## Monitoring Architecture

### 1. Health Monitoring
- Function availability checks
- Resource usage monitoring
- AI service status tracking
- Error rate monitoring

### 2. Logging Strategy
- Structured logging with timestamps
- Error tracking and alerting
- Performance metrics collection
- User interaction analytics

### 3. Alerting System
- Function failure alerts
- High error rate notifications
- Resource usage warnings
- AI service downtime alerts

## Future Architecture Enhancements

### 1. Authentication Layer
- User authentication with JWT
- Role-based access control
- API key management
- Session management

### 2. Database Integration
- PostgreSQL for persistent storage
- Redis for caching and sessions
- Vector database for semantic search
- Time-series database for analytics

### 3. Advanced AI Features
- Multiple AI model support
- Model switching based on query type
- Fine-tuned models for specific domains
- AI model version management

---

**⚠️ Architecture Note: The zed-ui/ folder is protected and contains critical interface components. Any architectural changes must preserve this structure.**