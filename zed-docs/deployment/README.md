# ZED AI Deployment Guide

## Deployment Options

ZED AI supports multiple deployment strategies:

1. **Netlify (Recommended)** - Serverless deployment with automatic scaling
2. **Static Hosting** - Simple static file hosting with external API
3. **Docker** - Containerized deployment for any platform
4. **Self-hosted** - Traditional server deployment

## Netlify Deployment (Recommended)

### Prerequisites
- Netlify account
- GitHub repository
- Node.js environment

### Step-by-Step Deployment

#### 1. Prepare Repository
```bash
# Ensure clean build
npm run build

# Verify structure
ls -la zed-backend/netlify-functions/
ls -la zed-ui/interfaces/
```

#### 2. Configure Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init
```

#### 3. Environment Variables
Set in Netlify dashboard or CLI:
```bash
netlify env:set NODE_ENV production
netlify env:set OLLAMA_API_URL https://your-ollama-service.com
netlify env:set MEMORY_STORAGE_PATH /tmp/zed_memory
```

#### 4. Deploy
```bash
# Preview deployment
netlify deploy

# Production deployment
netlify deploy --prod
```

### Netlify Configuration

#### Build Settings
```toml
# netlify.toml
[build]
  functions = "./zed-backend/netlify-functions"
  command = "npm run build"
  publish = "."

[dev]
  functions = "./zed-backend/netlify-functions"
  port = 9999

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/zed-ui/interfaces/zed-neural-interface.html"
  status = 200

[[headers]]
  for = "/api/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Headers = "Content-Type, Authorization"
    Access-Control-Allow-Methods = "GET, POST, PUT, DELETE, OPTIONS"

[[headers]]
  for = "/zed-ui/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000"
```

#### Function Configuration
```javascript
// netlify/functions/function-config.js
module.exports = {
  timeout: 30000,
  memory: 1024,
  runtime: "nodejs18.x"
};
```

## Static Hosting Deployment

### Suitable For:
- Simple hosting needs
- External AI API integration
- CDN-based distribution

### Providers:
- **GitHub Pages**
- **Vercel**
- **AWS S3 + CloudFront**
- **Firebase Hosting**

### Configuration:

#### GitHub Pages
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
    - name: Install dependencies
      run: npm install
    - name: Build
      run: npm run build
    - name: Deploy
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./
```

#### Vercel
```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "zed-ui/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/",
      "dest": "/zed-ui/interfaces/zed-neural-interface.html"
    },
    {
      "src": "/zed-ui/(.*)",
      "dest": "/zed-ui/$1"
    }
  ]
}
```

## Docker Deployment

### Dockerfile
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY zed-ui/ ./zed-ui/
COPY zed-backend/ ./zed-backend/
COPY zed-config/ ./zed-config/
COPY index.html ./

# Install Ollama
RUN apk add --no-cache curl
RUN curl -fsSL https://ollama.ai/install.sh | sh

# Expose ports
EXPOSE 3000 11434

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start script
COPY docker-start.sh ./
RUN chmod +x docker-start.sh

CMD ["./docker-start.sh"]
```

### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  zed-ai:
    build: .
    ports:
      - "3000:3000"
      - "11434:11434"
    environment:
      - NODE_ENV=production
      - OLLAMA_API_URL=http://localhost:11434
    volumes:
      - zed-memory:/app/zed-memory/storage
      - ollama-data:/root/.ollama
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  zed-memory:
  ollama-data:
```

### Docker Start Script
```bash
#!/bin/sh
# docker-start.sh

# Start Ollama in background
ollama serve &

# Wait for Ollama to be ready
sleep 10

# Pull default model
ollama pull llama2

# Start the application
exec node server.js
```

## Self-Hosted Deployment

### Server Requirements
- **OS**: Ubuntu 20.04+ or CentOS 8+
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 50GB for models and data
- **CPU**: 4 cores minimum
- **Network**: Stable internet connection

### Installation Script
```bash
#!/bin/bash
# install-zed-ai.sh

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Clone repository
git clone https://github.com/xoclonholdings/ZedAI.git
cd ZedAI

# Install dependencies
npm install

# Create systemd service
sudo cp deployment/zed-ai.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable zed-ai
sudo systemctl start zed-ai

# Configure nginx (optional)
sudo apt install nginx -y
sudo cp deployment/nginx.conf /etc/nginx/sites-available/zed-ai
sudo ln -s /etc/nginx/sites-available/zed-ai /etc/nginx/sites-enabled/
sudo systemctl restart nginx

echo "ZED AI installed successfully!"
echo "Access at: http://your-server-ip"
```

### Systemd Service
```ini
# zed-ai.service
[Unit]
Description=ZED AI Neural Interface
After=network.target

[Service]
Type=simple
User=zed-ai
WorkingDirectory=/home/zed-ai/ZedAI
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### Nginx Configuration
```nginx
# nginx.conf
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    location /zed-ui/ {
        root /home/zed-ai/ZedAI;
        try_files $uri $uri/ =404;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## SSL/TLS Configuration

### Let's Encrypt (Free SSL)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Custom SSL Certificate
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # ZED AI configuration
    location / {
        proxy_pass http://localhost:3000;
        # ... other proxy settings
    }
}
```

## Performance Optimization

### CDN Configuration
```yaml
# CloudFlare settings
cache_rules:
  - pattern: "/zed-ui/*"
    cache_level: "aggressive"
    edge_cache_ttl: 2592000  # 30 days
  
  - pattern: "/api/*"
    cache_level: "bypass"
    edge_cache_ttl: 0
```

### Compression Settings
```nginx
# Nginx compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/javascript
    application/xml+rss
    application/json;
```

## Monitoring and Logging

### Health Monitoring
```bash
# Health check script
#!/bin/bash
# health-check.sh

HEALTH_URL="http://localhost:3000/api/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "ZED AI is healthy"
    exit 0
else
    echo "ZED AI health check failed: $RESPONSE"
    exit 1
fi
```

### Log Configuration
```javascript
// logging.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console()
  ]
});

module.exports = logger;
```

## Backup and Recovery

### Backup Script
```bash
#!/bin/bash
# backup-zed-ai.sh

BACKUP_DIR="/backups/zed-ai"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup memory data
tar -czf $BACKUP_DIR/memory_$DATE.tar.gz zed-memory/storage/

# Backup configuration
tar -czf $BACKUP_DIR/config_$DATE.tar.gz zed-config/

# Backup UI (critical!)
tar -czf $BACKUP_DIR/ui_$DATE.tar.gz zed-ui/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "Backup completed: $DATE"
```

### Recovery Procedure
```bash
#!/bin/bash
# restore-zed-ai.sh

BACKUP_FILE=$1
RESTORE_DIR="/tmp/zed-restore"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.tar.gz>"
    exit 1
fi

# Extract backup
mkdir -p $RESTORE_DIR
tar -xzf $BACKUP_FILE -C $RESTORE_DIR

# Stop service
sudo systemctl stop zed-ai

# Restore files
cp -r $RESTORE_DIR/* ./

# Start service
sudo systemctl start zed-ai

echo "Restore completed from: $BACKUP_FILE"
```

## Security Hardening

### Firewall Configuration
```bash
# UFW firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### Application Security
```javascript
// security.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

app.use('/api/', limiter);
```

## Troubleshooting Deployment

### Common Issues

#### 1. Function Timeout
```javascript
// Increase timeout in netlify.toml
[functions]
  timeout = 30000
```

#### 2. Memory Issues
```javascript
// Increase memory in function config
module.exports = {
  timeout: 30000,
  memory: 1024
};
```

#### 3. Ollama Connection
```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Restart Ollama
sudo systemctl restart ollama
```

#### 4. UI Not Loading
```bash
# Verify UI files
ls -la zed-ui/interfaces/zed-neural-interface.html

# Check redirect configuration
cat netlify.toml
```

---

**⚠️ Deployment Warning: Always backup the zed-ui/ folder before deployment. It contains critical interface files!**