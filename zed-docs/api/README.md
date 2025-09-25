# ZED AI API Documentation

## Overview

ZED AI provides a RESTful API through Netlify Functions for seamless interaction with the neural interface system.

## Base URL

```
Production: https://your-netlify-site.netlify.app/api
Development: http://localhost:9999/api
```

## Authentication

Currently, no authentication is required. All endpoints are publicly accessible with CORS enabled.

## Endpoints

### 1. Chat System

#### Send Message to ZED AI
```http
POST /api/chat
Content-Type: application/json

{
  "message": "Hello ZED, how are you?"
}
```

**Response:**
```json
{
  "reply": "Hello! I'm ZED, your neural interface assistant. I'm functioning optimally and ready to help you.",
  "timestamp": "2025-09-23T10:30:00.000Z",
  "conversation_id": "conv_1234567890"
}
```

**Error Response:**
```json
{
  "error": "Message is required",
  "status": 400
}
```

### 2. Memory Upload System

#### Upload Memory Data
```http
POST /api/memory-upload
Content-Type: application/json

{
  "type": "text",
  "data": "This is some text content to be stored in memory",
  "metadata": {
    "source": "user_upload",
    "category": "notes",
    "tags": ["important", "personal"]
  }
}
```

**Memory Types:**
- `text` - Plain text content
- `conversation` - Chat conversations
- `image_batch` - Multiple images
- `mixed_folder` - Mixed content types

**Response:**
```json
{
  "success": true,
  "upload_id": "memory_1695456789123_abc123def",
  "processing_result": {
    "type": "text",
    "original_size": 1024,
    "compressed_size": 256,
    "compression_ratio": 75,
    "file_path": "/tmp/zed_memory/memory_1695456789123_abc123def/content.txt.gz",
    "searchable": true
  },
  "message": "Memory uploaded and organized successfully"
}
```

#### Query Memory Data
```http
GET /api/memory-upload?search=keyword&type=text&limit=10
```

**Query Parameters:**
- `search` (optional) - Search term to filter memories
- `type` (optional) - Filter by memory type
- `limit` (optional) - Maximum results to return (default: 10)

**Response:**
```json
{
  "memories": [
    {
      "upload_id": "memory_1695456789123_abc123def",
      "type": "text",
      "created": "2025-09-23T10:30:00.000Z",
      "metadata": {
        "source": "user_upload",
        "category": "notes"
      },
      "processing_result": {
        "compressed_size": 256,
        "compression_ratio": 75
      },
      "status": "processed"
    }
  ],
  "total": 1,
  "search": "keyword",
  "type": "text"
}
```

#### Delete Memory Entry
```http
DELETE /api/memory-upload
Content-Type: application/json

{
  "upload_id": "memory_1695456789123_abc123def",
  "confirm": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Memory memory_1695456789123_abc123def deleted successfully"
}
```

### 3. System Health

#### Check System Health
```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-09-23T10:30:00.000Z",
  "uptime": "2h 45m 30s",
  "memory": {
    "used": "512MB",
    "available": "1.5GB"
  },
  "functions": {
    "chat": "operational",
    "memory-upload": "operational",
    "health": "operational"
  },
  "ollama": {
    "status": "connected",
    "model": "llama2",
    "response_time": "1.2s"
  }
}
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `400` - Bad Request (missing/invalid parameters)
- `404` - Not Found
- `405` - Method Not Allowed
- `500` - Internal Server Error

**Error Response Format:**
```json
{
  "error": "Description of the error",
  "message": "Detailed error message",
  "status": 400,
  "timestamp": "2025-09-23T10:30:00.000Z"
}
```

## Rate Limiting

Currently, no rate limiting is implemented. Consider implementing rate limiting for production use.

## CORS

All endpoints include CORS headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
```

## Data Compression

The memory upload system automatically compresses data:

- **Text content**: gzip compression (70-90% reduction)
- **JSON data**: gzip compression (60-80% reduction)
- **Binary data**: Stored as-is with metadata

## Memory Storage Structure

Uploaded memories are stored in the following structure:
```
/tmp/zed_memory/
├── memory_1695456789123_abc123def/
│   ├── content.txt.gz
│   └── metadata.json
├── memory_1695456790456_def456ghi/
│   ├── conversation_0.json.gz
│   └── conversation_1.json.gz
└── memory_index.json
```

## Examples

### JavaScript/TypeScript
```typescript
// Send chat message
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello ZED!' })
});
const data = await response.json();
console.log(data.reply);

// Upload memory
const uploadResponse = await fetch('/api/memory-upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'text',
    data: 'Important note to remember',
    metadata: { category: 'notes' }
  })
});
```

### Python
```python
import requests

# Send chat message
response = requests.post('/api/chat', json={
    'message': 'Hello ZED!'
})
print(response.json()['reply'])

# Upload memory
upload_response = requests.post('/api/memory-upload', json={
    'type': 'text',
    'data': 'Important note to remember',
    'metadata': {'category': 'notes'}
})
```

### curl
```bash
# Send chat message
curl -X POST /api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello ZED!"}'

# Check system health
curl /api/health
```

## Webhooks (Future Enhancement)

Future versions may include webhook support for real-time notifications:
- Memory upload completion
- Chat message responses
- System health alerts