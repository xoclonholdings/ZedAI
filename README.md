# ZED AI - Neural Interface System# 🧠 ZED AI - Netlify Functions Backend



![ZED AI](https://img.shields.io/badge/ZED-AI%20Neural%20Interface-00ff41)## Overview

![Status](https://img.shields.io/badge/Status-Production%20Ready-00ff41)

![Backend](https://img.shields.io/badge/Backend-Netlify%20Functions-0099ff)ZED AI has been migrated to a **Netlify Functions** architecture for scalable, serverless deployment. This system provides:

![UI](https://img.shields.io/badge/UI-Cyberpunk%20Protected-00d4aa)

- 🤖 **Ollama Integration**: Pure Ollama-powered AI (no OpenAI dependencies)

## 🧠 Overview- 🗃️ **Memory Upload System**: Intelligent organization of large memory folders

- 💬 **Chat Interface**: Direct communication with ZED AI

ZED AI is an advanced neural interface system featuring:- 🖼️ **Image Gallery**: Automated image organization by date

- **Cyberpunk-styled user interface** with protected file structure- 🗜️ **Compression**: Automatic text compression to save space

- **Netlify Functions backend** for serverless deployment- 📊 **Health Monitoring**: Real-time system status

- **Intelligent memory management** with compression and organization

- **Ollama integration** for local AI processing## 🚀 Quick Start

- **Real-time chat interface** with persistent memory

### 1. Install Dependencies

## 🚀 Quick Start```bash

npm install

```bash```

# Install dependencies

npm install### 2. Start Development Server

```bash

# Start development servernpm run dev

npm run dev# This starts netlify dev on http://localhost:8888

```

# Access ZED AI Interface

http://localhost:9999/zed-ui/interfaces/zed-neural-interface.html### 3. Deploy to Netlify

``````bash

npm run deploy

## 📁 Project Structure```



```## 📡 API Endpoints

zed-front-end/

├── 🛡️ zed-ui/                     # PROTECTED UI COMPONENTS### Chat with ZED AI

│   ├── interfaces/                 # Main interface files```

│   │   └── zed-neural-interface.htmlPOST /.netlify/functions/chat

│   ├── components/                 # Reusable UI componentsContent-Type: application/json

│   ├── assets/                     # Static assets

│   ├── themes/                     # UI themes{

│   └── DO_NOT_DELETE_WARNING.txt   # Protection warning  "message": "Hello ZED, how are you?",

├── ⚙️ zed-backend/                 # Backend Functions  "model": "llama2"

│   ├── netlify-functions/          # Serverless functions}

│   │   ├── chat.mts               # AI chat endpoint```

│   │   ├── health.mts             # System health check

│   │   └── memory-upload.mts      # Memory upload system### Upload Memory Data

│   ├── api/                       # API endpoints```

│   ├── services/                  # Business logicPOST /.netlify/functions/memory-upload

│   └── middleware/                # Backend middlewareContent-Type: application/json

├── 🧠 zed-memory/                 # Memory Management

│   ├── storage/                   # Data storage{

│   │   └── ZedAI_data/           # Original memory data  "type": "text|conversation|image_batch|mixed_folder",

│   ├── compression/               # Compression utilities  "data": [...],

│   ├── upload/                    # File upload handlers  "metadata": {...}

│   └── indexing/                  # Memory indexing}

├── ⚙️ zed-config/                 # Configuration```

│   ├── deployment/                # Deployment configs

│   │   └── netlify.toml### Query Memories

│   ├── environment/               # Environment settings```

│   └── project/                   # Project configsGET /.netlify/functions/memory-upload?search=keyword&type=text&limit=10

│       ├── package.json```

│       └── tsconfig.json

├── 📚 zed-docs/                   # Documentation### Health Check

│   ├── api/                       # API documentation```

│   ├── setup/                     # Setup guidesGET /.netlify/functions/health

│   ├── architecture/              # System architecture```

│   └── deployment/                # Deployment guides

├── 🗄️ zed-temp/                   # Temporary files## 🗃️ Memory Upload System

└── 📦 legacy/                     # Legacy components

    ├── server/                    # Old server filesZED AI now includes an intelligent memory upload system that can:

    ├── backend/                   # Old backend files

    └── scripts/                   # Legacy scripts### 1. **Text Memory Processing**

```- Automatically compresses large text files (HTML, JSON, etc.)

- Achieves 70-90% compression ratio

## 🔧 Core Features- Maintains searchable indexes



### 🎨 Neural Interface### 2. **Conversation Archives**

- **Cyberpunk aesthetic** with black/green/blue color scheme- Processes chat logs and conversation data

- **Responsive sidebar navigation** with neural terminology- Extracts participants and message counts

- **Real-time chat interface** with ZED AI- Creates searchable conversation index

- **Memory upload system** with drag-and-drop functionality

- **System health monitoring** with live status indicators### 3. **Image Organization**

- Organizes images by upload date

### 🧠 Memory System- Creates gallery metadata

- **Intelligent file compression** (70-90% size reduction)- Preserves image quality (no compression)

- **Automatic organization** of uploaded data

- **Multiple memory types** (text, conversations, images, mixed)### 4. **Mixed Content Folders**

- **Searchable memory index** with metadata- Automatically categorizes mixed content

- **Persistent storage** with backup capabilities- Separates text, images, and other files

- Applies appropriate processing to each type

### ⚡ Backend Architecture

- **Netlify Functions** for serverless deployment## 🌐 Frontend Interface

- **Ollama integration** for local AI processing

- **CORS-enabled APIs** for cross-origin requestsAccess the web interface at `http://localhost:8888` (or your deployed URL) to:

- **TypeScript implementation** for type safety

- **Health monitoring** endpoints- **📤 Upload Memory Data**: Drag & drop large memory folders

- **💬 Chat with ZED**: Direct AI conversation interface

## 🔌 API Endpoints- **🔍 Browse Memories**: Search and explore uploaded content

- **📊 Monitor System**: Real-time health and status

### Chat System

```## 🛠️ Configuration

POST /api/chat

- Send messages to ZED AI### netlify.toml

- Persistent conversation memoryThe project includes proper Netlify configuration for:

- Ollama-powered responses- Function routing (`/api/*` → `/.netlify/functions/*`)

```- CORS headers

- TypeScript compilation

### Memory Management

```### Environment Variables (Optional)

POST /api/memory-uploadSet in Netlify dashboard:

- Upload and organize files```bash

- Automatic compressionOLLAMA_URL=http://localhost:11434

- Intelligent categorizationDEFAULT_MODEL=llama2

```

GET /api/memory-upload

- Query stored memories## 🏗️ Architecture

- Search and filter capabilities

```

DELETE /api/memory-upload📁 Project Structure

- Clean up memory entries├── 📁 netlify/functions/          # Serverless functions

- Selective deletion│   ├── 🔧 chat.mts               # Ollama chat endpoint

```│   ├── 📤 memory-upload.mts      # Memory processing system

│   └── 💓 health.mts             # System health check

### System Health├── 🌐 index.html                 # Frontend interface

```├── ⚙️ netlify.toml               # Netlify configuration

GET /api/health├── 📦 package.json               # Dependencies

- System status monitoring└── 📋 README.md                  # This file

- Resource usage stats```

- Function availability

```## 💾 Memory Management



## 🚀 Deployment### How It Works

1. **Upload**: Drop large memory folders into the web interface

### Netlify Deployment2. **Process**: ZED automatically categorizes and compresses content

```bash3. **Organize**: Creates searchable indexes and galleries

# Build and deploy4. **Store**: Saves in efficient, compressed format

npm run build5. **Access**: Query and retrieve through API or web interface

npm run deploy

### Storage Benefits

# Environment variables required:- **Space Saving**: 70-90% compression for text files

# - OLLAMA_API_URL (for AI processing)- **Organization**: Automatic categorization by type and date

# - NODE_ENV (production/development)- **Search**: Full-text search across all uploaded content

```- **Gallery**: Visual browsing for image collections



### Local Development## 🚀 Deployment

```bash

# Start development servers### Netlify Deploy

npm run dev                    # Netlify dev server1. Connect your Git repository to Netlify

python3 -m http.server 8888   # Alternative static server2. Build settings are configured in `netlify.toml`

3. Push to main branch for automatic deployment

# Access points:

# http://localhost:9999        # Netlify Functions### Manual Deploy

# http://localhost:8888        # Static server```bash

```netlify deploy --prod

```

## 🛡️ File Protection

---

### Critical UI Protection

- **zed-ui/** folder contains all interface files**ZED AI - Your intelligent memory companion, now powered by Netlify Functions! 🧠✨**

- **DO_NOT_DELETE_WARNING.txt** in UI folder

- **Separate naming** to prevent accidental deletionReady to organize and compress your large memory folders intelligently!

- **Legacy folder** for safe cleanup

### Backup Strategy
1. Always backup before major changes
2. Move files to legacy/ before deletion
3. Never delete zed-ui/ directly
4. Maintain version control

## 📊 Memory Compression

ZED AI automatically compresses uploaded files:
- **Text files**: 70-90% compression ratio
- **JSON data**: 60-80% compression ratio  
- **Conversation logs**: 80-95% compression ratio
- **Mixed content**: Variable compression

## 🔮 Future Enhancements

- [ ] Multi-user support with authentication
- [ ] Advanced memory search with semantic similarity
- [ ] Real-time collaborative features
- [ ] Plugin system for extensibility
- [ ] Mobile application
- [ ] Voice interface integration

## 📝 License

ISC License - ZED AI Neural Interface System

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test thoroughly (especially UI components)
4. Submit a pull request
5. **Never delete zed-ui/ folder**

---

**⚠️ IMPORTANT: The zed-ui/ folder contains critical interface files. Deletion will result in complete UI loss!**