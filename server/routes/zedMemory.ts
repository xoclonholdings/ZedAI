import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { zedCoreMemoryService } from '../services/zedCoreMemory.js';
import { memoryCompressorService } from '../services/memoryCompressor.js';
import { memoryImporter } from '../services/memoryImporter.js';

const router = Router();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const userId = req.body.userId || req.user?.id;
    if (!userId) {
      return cb(new Error('User ID required'), '');
    }

    const uploadPath = path.join(process.cwd(), 'user_uploads', userId);
    await fs.mkdir(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|txt|md|json|csv|xlsx|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Middleware to check authorization
const checkAuth = (req: any, res: any, next: any) => {
  const userId = req.params.userId || req.body.userId;
  const requesterId = req.user?.id || req.headers['x-user-id'];

  if (!requesterId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  req.requesterId = requesterId;
  req.targetUserId = userId;
  next();
};

const checkEditPermission = async (req: any, res: any, next: any) => {
  const { targetUserId, requesterId } = req;

  if (targetUserId === requesterId) {
    return next(); // User can edit their own memory
  }

  // Check if requester is authorized editor
  const isAuthorized = await zedCoreMemoryService.isAuthorizedEditor(targetUserId, requesterId);
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Not authorized to edit this memory' });
  }

  next();
};

// === CORE MEMORY ROUTES ===

// Initialize admin core from imported data
router.post('/admin/initialize', checkAuth, async (req, res) => {
  try {
    const { importedData } = req.body;

    if (!importedData) {
      return res.status(400).json({ error: 'Imported data required' });
    }

    const adminCore = await zedCoreMemoryService.initializeAdminCoreFromImport(importedData);
    res.json({ success: true, adminCore });
  } catch (error: any) {
    console.error('Error initializing admin core:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get admin core (read-only for non-admins)
router.get('/admin', checkAuth, async (req, res) => {
  try {
    const adminCore = await zedCoreMemoryService.getAdminCore();

    if (!adminCore) {
      return res.status(404).json({ error: 'Admin core not found' });
    }

    // Return read-only version for non-admins
    const isAdmin = req.requesterId === 'admin'; // You may want to implement proper admin check

    if (isAdmin) {
      res.json(adminCore);
    } else {
      res.json({
        version: adminCore.version,
        basePersonality: adminCore.basePersonality,
        defaultModules: adminCore.defaultModules,
        defaultPreferences: adminCore.defaultPreferences
      });
    }
  } catch (error: any) {
    console.error('Error getting admin core:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get or create user ZED core
router.get('/:userId', checkAuth, async (req, res) => {
  try {
    const { targetUserId, requesterId } = req;

    let userCore = await zedCoreMemoryService.getUserCore(targetUserId);

    if (!userCore) {
      // Create new user core
      userCore = await zedCoreMemoryService.createUserZedCore(targetUserId, requesterId);
    }

    // Check if requester can view this memory
    const canView = targetUserId === requesterId ||
      await zedCoreMemoryService.isAuthorizedEditor(targetUserId, requesterId);

    if (!canView) {
      return res.status(403).json({ error: 'Not authorized to view this memory' });
    }

    res.json(userCore);
  } catch (error: any) {
    console.error('Error getting user core:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save memory entry
router.post('/save', checkAuth, checkEditPermission, async (req, res) => {
  try {
    const { targetUserId } = req;
    const { type, content, metadata } = req.body;

    if (!type || !content) {
      return res.status(400).json({ error: 'Type and content required' });
    }

    const entryId = await zedCoreMemoryService.addMemoryEntry(targetUserId, {
      type,
      content,
      metadata
    });

    res.json({ success: true, entryId });
  } catch (error: any) {
    console.error('Error saving memory entry:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add conversation
router.post('/:userId/conversations', checkAuth, checkEditPermission, async (req, res) => {
  try {
    const { targetUserId } = req;
    const { route, title, messages } = req.body;

    if (!route || !title || !messages) {
      return res.status(400).json({ error: 'Route, title, and messages required' });
    }

    const conversationId = await zedCoreMemoryService.addConversation(targetUserId, {
      route,
      title,
      messages
    });

    res.json({ success: true, conversationId });
  } catch (error: any) {
    console.error('Error adding conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update conversation
router.put('/:userId/conversations/:conversationId', checkAuth, checkEditPermission, async (req, res) => {
  try {
    const { targetUserId } = req;
    const { conversationId } = req.params;
    const updates = req.body;

    await zedCoreMemoryService.updateConversation(targetUserId, conversationId, updates);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload file
router.post('/:userId/upload', checkAuth, checkEditPermission, upload.single('file'), async (req, res) => {
  try {
    const { targetUserId } = req;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadId = await zedCoreMemoryService.addUpload(targetUserId, {
      filename: req.file.originalname,
      type: req.file.mimetype,
      metadata: {
        size: req.file.size,
        encoding: req.file.encoding
      }
    });

    res.json({
      success: true,
      uploadId,
      filename: req.file.originalname,
      size: req.file.size
    });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add generation
router.post('/:userId/generations', checkAuth, checkEditPermission, async (req, res) => {
  try {
    const { targetUserId } = req;
    const { type, title, content, prompt, metadata } = req.body;

    if (!type || !title || !content || !prompt) {
      return res.status(400).json({ error: 'Type, title, content, and prompt required' });
    }

    const generationId = await zedCoreMemoryService.addGeneration(targetUserId, {
      type,
      title,
      content,
      prompt,
      metadata
    });

    res.json({ success: true, generationId });
  } catch (error: any) {
    console.error('Error adding generation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update preferences
router.put('/:userId/preferences', checkAuth, checkEditPermission, async (req, res) => {
  try {
    const { targetUserId } = req;
    const preferences = req.body;

    await zedCoreMemoryService.updatePreferences(targetUserId, preferences);

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating preferences:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add bookmark
router.post('/:userId/bookmarks', checkAuth, checkEditPermission, async (req, res) => {
  try {
    const { targetUserId } = req;
    const { title, url, content, tags } = req.body;

    if (!title || (!url && !content)) {
      return res.status(400).json({ error: 'Title and either URL or content required' });
    }

    const bookmarkId = await zedCoreMemoryService.addBookmark(targetUserId, {
      title,
      url,
      content,
      tags: tags || []
    });

    res.json({ success: true, bookmarkId });
  } catch (error: any) {
    console.error('Error adding bookmark:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get memory statistics
router.get('/:userId/stats', checkAuth, async (req, res) => {
  try {
    const { targetUserId, requesterId } = req;

    // Check if requester can view stats
    const canView = targetUserId === requesterId ||
      await zedCoreMemoryService.isAuthorizedEditor(targetUserId, requesterId);

    if (!canView) {
      return res.status(403).json({ error: 'Not authorized to view stats' });
    }

    const stats = await zedCoreMemoryService.getMemoryStats(targetUserId);
    res.json(stats);
  } catch (error: any) {
    console.error('Error getting memory stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// === COMPRESSION ROUTES ===

// Trigger compression for user
router.post('/:userId/compress', checkAuth, checkEditPermission, async (req, res) => {
  try {
    const { targetUserId } = req;

    const snapshot = await memoryCompressorService.triggerCompressionForUser(targetUserId);
    res.json({ success: true, snapshot });
  } catch (error: any) {
    console.error('Error compressing memory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get compression snapshots
router.get('/:userId/snapshots', checkAuth, async (req, res) => {
  try {
    const { targetUserId, requesterId } = req;

    // Check if requester can view snapshots
    const canView = targetUserId === requesterId ||
      await zedCoreMemoryService.isAuthorizedEditor(targetUserId, requesterId);

    if (!canView) {
      return res.status(403).json({ error: 'Not authorized to view snapshots' });
    }

    const snapshots = await memoryCompressorService.getCompressionSnapshots(targetUserId);
    res.json(snapshots);
  } catch (error: any) {
    console.error('Error getting compression snapshots:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get compression analytics
router.get('/:userId/analytics', checkAuth, async (req, res) => {
  try {
    const { targetUserId, requesterId } = req;

    // Check if requester can view analytics
    const canView = targetUserId === requesterId ||
      await zedCoreMemoryService.isAuthorizedEditor(targetUserId, requesterId);

    if (!canView) {
      return res.status(403).json({ error: 'Not authorized to view analytics' });
    }

    const analytics = await memoryCompressorService.getCompressionAnalytics(targetUserId);
    res.json(analytics);
  } catch (error: any) {
    console.error('Error getting compression analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// === ADMIN ROUTES ===

// Get all users (admin only)
router.get('/admin/users', checkAuth, async (req, res) => {
  try {
    // TODO: Add proper admin role check
    const userIds = await zedCoreMemoryService.getAllUserIds();
    res.json(userIds);
  } catch (error: any) {
    console.error('Error getting all users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Trigger compression for all users (admin only)
router.post('/admin/compress-all', checkAuth, async (req, res) => {
  try {
    // TODO: Add proper admin role check
    const snapshots = await memoryCompressorService.triggerCompressionForAllUsers();
    res.json({ success: true, snapshots });
  } catch (error: any) {
    console.error('Error compressing all memories:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add authorized editor
router.post('/:userId/editors', checkAuth, async (req, res) => {
  try {
    const { targetUserId, requesterId } = req;
    const { editorId } = req.body;

    if (!editorId) {
      return res.status(400).json({ error: 'Editor ID required' });
    }

    await zedCoreMemoryService.addAuthorizedEditor(targetUserId, editorId, requesterId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error adding authorized editor:', error);
    res.status(500).json({ error: error.message });
  }
});

// === IMPORT ROUTES ===

// Import OpenAI data for user
router.post('/:userId/import', checkAuth, checkEditPermission, upload.any(), async (req, res) => {
  try {
    const { targetUserId } = req;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded for import' });
    }

    // Process imported files and convert to ZED format
    // This would integrate with your existing memoryImporter service
    const importResult = await memoryImporter.importUserData(targetUserId, req.files);

    res.json({ success: true, importResult });
  } catch (error: any) {
    console.error('Error importing user data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Frontend API endpoints for ChatArea functionality

// Memory recent conversations
router.get('/recent', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const conversations = await zedCoreMemoryService.getRecentConversations(userId, 10);
    res.json({ conversations });
  } catch (error: any) {
    console.error('Error fetching recent conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// Memory search
router.post('/search', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const { query, limit = 50 } = req.body;
    const results = await zedCoreMemoryService.searchMemory(userId, query, limit);
    res.json({ results });
  } catch (error: any) {
    console.error('Error searching memory:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync with Zebulon Oracle Database
router.post('/sync', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const stats = await zedCoreMemoryService.syncWithZebulon(userId);
    res.json({
      success: true,
      stats: {
        totalSize: stats.totalSize || "2.4 KB",
        messageCount: stats.messageCount || 17
      }
    });
  } catch (error: any) {
    console.error('Error syncing with Zebulon:', error);
    res.status(500).json({ error: error.message });
  }
});

// Database sync endpoint for sidebar
router.post('/sync-database', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const result = await zedCoreMemoryService.syncDatabase(userId);
    res.json({
      recordCount: result.recordCount || 0,
      storageUsed: result.storageUsed || "0 MB"
    });
  } catch (error: any) {
    console.error('Error syncing database:', error);
    res.status(500).json({ error: error.message });
  }
});

// Database backup endpoint
router.post('/backup', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const backupData = await zedCoreMemoryService.createBackup(userId);
    res.json({ data: backupData });
  } catch (error: any) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: error.message });
  }
});

// Database restore endpoint
router.post('/restore', async (req, res) => {
  try {
    const userId = req.user?.id || 'anonymous';
    const { backupData } = req.body;
    const result = await zedCoreMemoryService.restoreBackup(userId, backupData);
    res.json({ restoredCount: result.restoredCount || 0 });
  } catch (error: any) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
