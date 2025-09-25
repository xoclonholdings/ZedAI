import type { Handler } from '@netlify/functions';
import { createWriteStream, createReadStream, existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { join, extname, basename } from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import zlib from 'zlib';

const pipelineAsync = promisify(pipeline);

// Memory upload and organization function
const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const baseMemoryPath = '/tmp/zed_memory';
  
  // Ensure memory directory exists
  if (!existsSync(baseMemoryPath)) {
    mkdirSync(baseMemoryPath, { recursive: true });
  }

  try {
    switch (event.httpMethod) {
      case 'POST':
        return await handleMemoryUpload(event, baseMemoryPath, headers);
      case 'GET':
        return await handleMemoryQuery(event, baseMemoryPath, headers);
      case 'DELETE':
        return await handleMemoryCleanup(event, baseMemoryPath, headers);
      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Memory operation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Memory operation failed',
        message: errorMessage 
      })
    };
  }
};

async function handleMemoryUpload(event: any, baseMemoryPath: string, headers: any) {
  const body = JSON.parse(event.body || '{}');
  const { type, data, metadata } = body;

  if (!type || !data) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Type and data are required' })
    };
  }

  const uploadId = generateUploadId();
  const uploadPath = join(baseMemoryPath, uploadId);
  mkdirSync(uploadPath, { recursive: true });

  let result = {};

  switch (type) {
    case 'text':
      result = await processTextMemory(data, uploadPath, metadata);
      break;
    case 'conversation':
      result = await processConversationMemory(data, uploadPath, metadata);
      break;
    case 'image_batch':
      result = await processImageBatch(data, uploadPath, metadata);
      break;
    case 'mixed_folder':
      result = await processMixedFolder(data, uploadPath, metadata);
      break;
    default:
      throw new Error(`Unsupported memory type: ${type}`);
  }

  // Create memory index entry
  const memoryIndex = {
    upload_id: uploadId,
    type: type,
    created: new Date().toISOString(),
    metadata: metadata || {},
    processing_result: result,
    path: uploadPath,
    status: 'processed'
  };

  // Save memory index
  const indexPath = join(baseMemoryPath, 'memory_index.json');
  let existingIndex: any[] = [];
  if (existsSync(indexPath)) {
    try {
      const indexData = JSON.parse(readFileSync(indexPath, 'utf8'));
      existingIndex = Array.isArray(indexData) ? indexData : [];
    } catch (e) {
      existingIndex = [];
    }
  }

  existingIndex.push(memoryIndex);
  writeFileSync(indexPath, JSON.stringify(existingIndex, null, 2));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      upload_id: uploadId,
      processing_result: result,
      message: 'Memory uploaded and organized successfully'
    })
  };
}

async function processTextMemory(data: any, uploadPath: string, metadata: any) {
  const textContent = typeof data === 'string' ? data : JSON.stringify(data);
  const compressed = zlib.gzipSync(Buffer.from(textContent, 'utf8'));
  
  const filePath = join(uploadPath, 'content.txt.gz');
  writeFileSync(filePath, compressed);

  return {
    type: 'text',
    original_size: textContent.length,
    compressed_size: compressed.length,
    compression_ratio: Math.round((1 - compressed.length / textContent.length) * 100),
    file_path: filePath,
    searchable: true
  };
}

async function processConversationMemory(data: any, uploadPath: string, metadata: any) {
  const conversations = Array.isArray(data) ? data : [data];
  const processedConversations = [];

  for (const [index, conversation] of conversations.entries()) {
    const conversationFile = join(uploadPath, `conversation_${index}.json.gz`);
    const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(conversation, null, 2), 'utf8'));
    writeFileSync(conversationFile, compressed);

    processedConversations.push({
      index,
      file: conversationFile,
      message_count: conversation.messages?.length || 0,
      participants: conversation.participants || ['user', 'ai'],
      compressed_size: compressed.length
    });
  }

  return {
    type: 'conversations',
    conversation_count: conversations.length,
    total_messages: processedConversations.reduce((sum, conv) => sum + conv.message_count, 0),
    conversations: processedConversations
  };
}

async function processImageBatch(data: any, uploadPath: string, metadata: any) {
  const images = Array.isArray(data) ? data : [data];
  const processedImages = [];

  const imageDir = join(uploadPath, 'images');
  mkdirSync(imageDir, { recursive: true });

  for (const [index, imageData] of images.entries()) {
    const imageFileName = `image_${index}.${imageData.format || 'png'}`;
    const imagePath = join(imageDir, imageFileName);

    if (imageData.base64) {
      const buffer = Buffer.from(imageData.base64, 'base64');
      writeFileSync(imagePath, buffer);
    }

    processedImages.push({
      index,
      filename: imageFileName,
      path: imagePath,
      metadata: imageData.metadata || {}
    });
  }

  const galleryIndex = {
    created: new Date().toISOString(),
    image_count: processedImages.length,
    images: processedImages
  };

  const galleryIndexPath = join(uploadPath, 'gallery_index.json');
  writeFileSync(galleryIndexPath, JSON.stringify(galleryIndex, null, 2));

  return {
    type: 'image_batch',
    image_count: processedImages.length,
    gallery_index: galleryIndexPath,
    images: processedImages
  };
}

async function processMixedFolder(data: any, uploadPath: string, metadata: any) {
  const textFiles = [];
  const imageFiles = [];
  const otherFiles = [];

  const items = Array.isArray(data) ? data : [data];

  for (const item of items) {
    const ext = item.filename ? extname(item.filename).toLowerCase() : '';
    
    if (['.txt', '.md', '.json', '.html'].includes(ext)) {
      const result = await processTextMemory(item.content, uploadPath, item.metadata);
      textFiles.push({ ...result, filename: item.filename });
    } else if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      const result = await processImageBatch([item], uploadPath, item.metadata);
      imageFiles.push(...result.images);
    } else {
      otherFiles.push(item);
    }
  }

  return {
    type: 'mixed_folder',
    text_files: textFiles.length,
    image_files: imageFiles.length,
    other_files: otherFiles.length,
    processed: {
      text: textFiles,
      images: imageFiles,
      other: otherFiles
    }
  };
}

async function handleMemoryQuery(event: any, baseMemoryPath: string, headers: any) {
  const queryParams = event.queryStringParameters || {};
  const { search, type, limit = 10 } = queryParams;

  const indexPath = join(baseMemoryPath, 'memory_index.json');
  if (!existsSync(indexPath)) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ memories: [], total: 0 })
    };
  }

  let memories = JSON.parse(readFileSync(indexPath, 'utf8'));

  if (type) {
    memories = memories.filter((memory: any) => memory.type === type);
  }

  if (search) {
    memories = memories.filter((memory: any) => 
      JSON.stringify(memory).toLowerCase().includes(search.toLowerCase())
    );
  }

  const limitedMemories = memories.slice(0, parseInt(limit));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      memories: limitedMemories,
      total: memories.length,
      search: search || null,
      type: type || null
    })
  };
}

async function handleMemoryCleanup(event: any, baseMemoryPath: string, headers: any) {
  const body = JSON.parse(event.body || '{}');
  const { upload_id, confirm } = body;

  if (!upload_id || !confirm) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'upload_id and confirm=true required' })
    };
  }

  const uploadPath = join(baseMemoryPath, upload_id);
  if (existsSync(uploadPath)) {
    rmSync(uploadPath, { recursive: true, force: true });
  }

  const indexPath = join(baseMemoryPath, 'memory_index.json');
  if (existsSync(indexPath)) {
    let memories = JSON.parse(readFileSync(indexPath, 'utf8'));
    memories = memories.filter((memory: any) => memory.upload_id !== upload_id);
    writeFileSync(indexPath, JSON.stringify(memories, null, 2));
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      message: `Memory ${upload_id} deleted successfully`
    })
  };
}

function generateUploadId(): string {
  return `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export { handler };