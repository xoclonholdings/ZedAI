# 🧠 ZED AI - Netlify Functions Backend

## Overview

ZED AI has been migrated to a **Netlify Functions** architecture for scalable, serverless deployment. This system provides:

- 🤖 **Ollama Integration**: Pure Ollama-powered AI (no OpenAI dependencies)
- 🗃️ **Memory Upload System**: Intelligent organization of large memory folders
- 💬 **Chat Interface**: Direct communication with ZED AI
- 🖼️ **Image Gallery**: Automated image organization by date
- 🗜️ **Compression**: Automatic text compression to save space
- 📊 **Health Monitoring**: Real-time system status

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
# This starts netlify dev on http://localhost:8888
```

### 3. Deploy to Netlify
```bash
npm run deploy
```

## 📡 API Endpoints

### Chat with ZED AI
```
POST /.netlify/functions/chat
Content-Type: application/json

{
  "message": "Hello ZED, how are you?",
  "model": "llama2"
}
```

### Upload Memory Data
```
POST /.netlify/functions/memory-upload
Content-Type: application/json

{
  "type": "text|conversation|image_batch|mixed_folder",
  "data": [...],
  "metadata": {...}
}
```

### Query Memories
```
GET /.netlify/functions/memory-upload?search=keyword&type=text&limit=10
```

### Health Check
```
GET /.netlify/functions/health
```

## 🗃️ Memory Upload System

ZED AI now includes an intelligent memory upload system that can:

### 1. **Text Memory Processing**
- Automatically compresses large text files (HTML, JSON, etc.)
- Achieves 70-90% compression ratio
- Maintains searchable indexes

### 2. **Conversation Archives**
- Processes chat logs and conversation data
- Extracts participants and message counts
- Creates searchable conversation index

### 3. **Image Organization**
- Organizes images by upload date
- Creates gallery metadata
- Preserves image quality (no compression)

### 4. **Mixed Content Folders**
- Automatically categorizes mixed content
- Separates text, images, and other files
- Applies appropriate processing to each type

## 🌐 Frontend Interface

Access the web interface at `http://localhost:8888` (or your deployed URL) to:

- **📤 Upload Memory Data**: Drag & drop large memory folders
- **💬 Chat with ZED**: Direct AI conversation interface
- **🔍 Browse Memories**: Search and explore uploaded content
- **📊 Monitor System**: Real-time health and status

## 🛠️ Configuration

### netlify.toml
The project includes proper Netlify configuration for:
- Function routing (`/api/*` → `/.netlify/functions/*`)
- CORS headers
- TypeScript compilation

### Environment Variables (Optional)
Set in Netlify dashboard:
```bash
OLLAMA_URL=http://localhost:11434
DEFAULT_MODEL=llama2
```

## 🏗️ Architecture

```
📁 Project Structure
├── 📁 netlify/functions/          # Serverless functions
│   ├── 🔧 chat.mts               # Ollama chat endpoint
│   ├── 📤 memory-upload.mts      # Memory processing system
│   └── 💓 health.mts             # System health check
├── 🌐 index.html                 # Frontend interface
├── ⚙️ netlify.toml               # Netlify configuration
├── 📦 package.json               # Dependencies
└── 📋 README.md                  # This file
```

## 💾 Memory Management

### How It Works
1. **Upload**: Drop large memory folders into the web interface
2. **Process**: ZED automatically categorizes and compresses content
3. **Organize**: Creates searchable indexes and galleries
4. **Store**: Saves in efficient, compressed format
5. **Access**: Query and retrieve through API or web interface

### Storage Benefits
- **Space Saving**: 70-90% compression for text files
- **Organization**: Automatic categorization by type and date
- **Search**: Full-text search across all uploaded content
- **Gallery**: Visual browsing for image collections

## 🚀 Deployment

### Netlify Deploy
1. Connect your Git repository to Netlify
2. Build settings are configured in `netlify.toml`
3. Push to main branch for automatic deployment

### Manual Deploy
```bash
netlify deploy --prod
```

---

**ZED AI - Your intelligent memory companion, now powered by Netlify Functions! 🧠✨**

Ready to organize and compress your large memory folders intelligently!
