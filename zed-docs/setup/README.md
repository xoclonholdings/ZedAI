# ZED AI Setup Guide

## Prerequisites

Before setting up ZED AI, ensure you have:

- **Node.js** (v18 or later)
- **npm** (v9 or later)
- **Git** for version control
- **Ollama** (for local AI processing)
- **VS Code** (recommended for development)

## Installation

### 1. Clone Repository
```bash
git clone https://github.com/xoclonholdings/ZedAI.git
cd ZedAI
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Install Ollama (Required for AI)
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download
```

### 4. Start Ollama Service
```bash
# Start Ollama daemon
ollama serve

# In another terminal, pull a model
ollama pull llama2
```

## Development Setup

### 1. Environment Configuration
Create environment files:

```bash
# Copy example environment file
cp .env.example .env

# Edit with your settings
nano .env
```

**Environment Variables:**
```env
NODE_ENV=development
OLLAMA_API_URL=http://localhost:11434
PORT=9999
```

### 2. Start Development Server
```bash
# Start Netlify dev server
npm run dev

# Or start static server
python3 -m http.server 8888
```

### 3. Access ZED AI Interface
Open your browser and navigate to:
- **Netlify Dev**: http://localhost:9999/zed-ui/interfaces/zed-neural-interface.html
- **Static Server**: http://localhost:8888/zed-ui/interfaces/zed-neural-interface.html

## Project Structure Setup

### Understanding the Folder Structure
```
zed-front-end/
├── 🛡️ zed-ui/                     # NEVER DELETE - Contains UI
├── ⚙️ zed-backend/                 # Backend functions
├── 🧠 zed-memory/                 # Memory management
├── ⚙️ zed-config/                 # Configuration files
├── 📚 zed-docs/                   # Documentation
├── 🗄️ zed-temp/                   # Temporary files
└── 📦 legacy/                     # Legacy/old files
```

### Critical Protection Rules
1. **NEVER delete zed-ui/ folder** - Contains all interface files
2. **Read DO_NOT_DELETE_WARNING.txt** before any cleanup
3. **Move files to legacy/ before deletion**
4. **Always backup before major changes**

## Netlify Configuration

### 1. Install Netlify CLI
```bash
npm install -g netlify-cli
```

### 2. Login to Netlify
```bash
netlify login
```

### 3. Initialize Netlify Site
```bash
netlify init
```

### 4. Configure Build Settings
Netlify will automatically detect the configuration from `netlify.toml`:
```toml
[build]
  functions = "./zed-backend/netlify-functions"
  command = "npm run build"

[dev]
  functions = "./zed-backend/netlify-functions"
```

## Database Setup (Optional)

For persistent memory storage beyond temporary files:

### 1. PostgreSQL (Recommended)
```bash
# Install PostgreSQL
brew install postgresql  # macOS
sudo apt install postgresql  # Ubuntu

# Start service
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Ubuntu
```

### 2. Environment Configuration
```env
DATABASE_URL=postgresql://username:password@localhost:5432/zed_ai
```

## Testing Setup

### 1. Install Testing Dependencies
```bash
npm install --save-dev jest @types/jest ts-jest
```

### 2. Create Test Configuration
```json
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts']
};
```

### 3. Run Tests
```bash
npm test
```

## Troubleshooting

### Common Issues

#### 1. Ollama Connection Failed
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama service
ollama serve
```

#### 2. Netlify Functions Not Loading
```bash
# Check function directory
ls -la zed-backend/netlify-functions/

# Verify netlify.toml configuration
cat netlify.toml
```

#### 3. UI Not Loading
```bash
# Check if UI files exist
ls -la zed-ui/interfaces/

# Verify redirect configuration
cat index.html
```

#### 4. Memory Upload Issues
```bash
# Check permissions
chmod 755 zed-memory/

# Verify storage directory
ls -la zed-memory/storage/
```

### Debugging Tips

1. **Check browser console** for JavaScript errors
2. **Monitor network tab** for API call failures
3. **Review Netlify function logs** for backend issues
4. **Verify file permissions** for upload functionality

## IDE Setup (VS Code)

### Recommended Extensions
```json
// .vscode/extensions.json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "netlify.netlify-vscode"
  ]
}
```

### VS Code Settings
```json
// .vscode/settings.json
{
  "typescript.preferences.includePackageJsonAutoImports": "auto",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true
  }
}
```

## Security Considerations

### 1. API Security
- Enable rate limiting for production
- Implement authentication for sensitive operations
- Validate all input data

### 2. File Upload Security
- Limit file sizes and types
- Scan uploaded files for malware
- Use temporary storage with cleanup

### 3. Environment Security
- Never commit .env files
- Use environment-specific configurations
- Rotate API keys regularly

## Next Steps

After completing setup:

1. **Test all endpoints** using the API documentation
2. **Upload sample memory data** to test compression
3. **Customize UI theme** in zed-ui/themes/
4. **Configure production deployment** on Netlify
5. **Set up monitoring** and alerts

## Support

For setup issues:
1. Check this documentation first
2. Review troubleshooting section
3. Check GitHub issues
4. Contact support team

---

**⚠️ Remember: Always protect the zed-ui/ folder - it contains your entire interface!**