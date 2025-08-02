import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { MemoryImporter } from '../services/memoryImporter';
import { PersonalityLoader } from '../services/personalityLoader';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/memory-imports/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || 
        file.mimetype === 'application/x-zip-compressed' ||
        file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

/**
 * POST /api/memory/import
 * Import OpenAI data export (Admin only)
 */
router.post('/import', upload.single('export'), async (req, res) => {
  try {
    // Check admin authentication
    const user = req.session?.user;
    if (!user || user.accessLevel !== 'admin') {
      return res.status(403).json({ 
        error: 'Admin access required for memory import' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        error: 'No export file provided' 
      });
    }

    console.log(`[MEMORY IMPORT] Starting import process for file: ${req.file.originalname}`);

    // Extract ZIP file
    const extractPath = path.join('uploads/memory-imports/extracted', Date.now().toString());
    await fs.mkdir(extractPath, { recursive: true });

    // Use a simple extraction method (you might want to use a proper ZIP library)
    const { execSync } = require('child_process');
    execSync(`unzip -q "${req.file.path}" -d "${extractPath}"`);

    // Import the data
    const personalityData = await MemoryImporter.importOpenAIExport(extractPath);

    // Save to ZED memory system
    await MemoryImporter.saveToZEDMemory(personalityData, true);

    // Clean up temporary files
    await fs.rm(req.file.path);
    await fs.rm(extractPath, { recursive: true });

    // Get updated stats
    const stats = await PersonalityLoader.getPersonalityStats();

    res.json({
      success: true,
      message: 'OpenAI export imported successfully',
      stats: {
        contextualMemoryCount: stats.contextualMemoryCount,
        interactionHistoryCount: stats.interactionHistoryCount,
        knowledgeDomainCount: stats.knowledgeDomainCount,
        importDate: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[MEMORY IMPORT] Import failed:', error);
    
    // Clean up on error
    if (req.file) {
      try {
        await fs.rm(req.file.path);
      } catch (cleanupError) {
        console.error('[MEMORY IMPORT] Cleanup error:', cleanupError);
      }
    }

    res.status(500).json({
      error: 'Failed to import memory data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/memory/import-folder
 * Import from extracted folder (Admin only)
 */
router.post('/import-folder', async (req, res) => {
  try {
    // Check admin authentication
    const user = req.session?.user;
    if (!user || user.accessLevel !== 'admin') {
      return res.status(403).json({ 
        error: 'Admin access required for memory import' 
      });
    }

    const { folderPath } = req.body;
    if (!folderPath) {
      return res.status(400).json({ 
        error: 'Folder path is required' 
      });
    }

    console.log(`[MEMORY IMPORT] Starting folder import from: ${folderPath}`);

    // Verify folder exists
    try {
      await fs.access(folderPath);
    } catch (error) {
      return res.status(400).json({ 
        error: 'Folder path does not exist or is not accessible' 
      });
    }

    // Import the data
    const personalityData = await MemoryImporter.importOpenAIExport(folderPath);

    // Save to ZED memory system
    await MemoryImporter.saveToZEDMemory(personalityData, true);

    // Get updated stats
    const stats = await PersonalityLoader.getPersonalityStats();

    res.json({
      success: true,
      message: 'Memory data imported successfully from folder',
      stats: {
        contextualMemoryCount: stats.contextualMemoryCount,
        interactionHistoryCount: stats.interactionHistoryCount,
        knowledgeDomainCount: stats.knowledgeDomainCount,
        importDate: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[MEMORY IMPORT] Folder import failed:', error);
    res.status(500).json({
      error: 'Failed to import memory data from folder',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/memory/stats
 * Get personality and memory statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await PersonalityLoader.getPersonalityStats();
    res.json(stats);
  } catch (error) {
    console.error('[MEMORY STATS] Error getting stats:', error);
    res.status(500).json({
      error: 'Failed to get memory statistics'
    });
  }
});

/**
 * POST /api/memory/toggle-personality
 * Toggle between enhanced and standard personality (Admin only)
 */
router.post('/toggle-personality', async (req, res) => {
  try {
    // Check admin authentication
    const user = req.session?.user;
    if (!user || user.accessLevel !== 'admin') {
      return res.status(403).json({ 
        error: 'Admin access required' 
      });
    }

    const { personalityMode } = req.body;
    if (!personalityMode || !['enhanced', 'standard'].includes(personalityMode)) {
      return res.status(400).json({ 
        error: 'Invalid personality mode. Must be "enhanced" or "standard"' 
      });
    }

    // Update user session
    req.session.user.personalityMode = personalityMode;

    res.json({
      success: true,
      message: `Personality mode switched to ${personalityMode}`,
      currentMode: personalityMode
    });

  } catch (error) {
    console.error('[MEMORY TOGGLE] Error toggling personality:', error);
    res.status(500).json({
      error: 'Failed to toggle personality mode'
    });
  }
});

/**
 * DELETE /api/memory/admin-personality
 * Delete admin personality data (Admin only)
 */
router.delete('/admin-personality', async (req, res) => {
  try {
    // Check admin authentication
    const user = req.session?.user;
    if (!user || user.accessLevel !== 'admin') {
      return res.status(403).json({ 
        error: 'Admin access required' 
      });
    }

    const { MemoryService } = await import('../services/memoryService');

    // Delete all admin personality data
    const adminKeys = [
      'admin_zed_personality',
      'admin_communication_style',
      'admin_knowledge_domains',
      'admin_response_patterns',
      'admin_import_metadata'
    ];

    for (const key of adminKeys) {
      try {
        // Since deleteCoreMemory doesn't exist, we'll set to null/empty
        await MemoryService.setCoreMemory(key, '');
      } catch (error) {
        console.warn(`[MEMORY DELETE] Key ${key} not found or already deleted`);
      }
    }

    // Delete memory chunks by setting to empty
    let chunkIndex = 0;
    while (chunkIndex < 20) { // Reasonable limit instead of infinite loop
      try {
        await MemoryService.setCoreMemory(`admin_contextual_memory_${chunkIndex}`, '');
        await MemoryService.setCoreMemory(`admin_interaction_history_${chunkIndex}`, '');
        chunkIndex++;
      } catch (error) {
        console.warn(`[MEMORY DELETE] Chunk ${chunkIndex} not found`);
        chunkIndex++;
      }
    }

    res.json({
      success: true,
      message: 'Admin personality data deleted successfully'
    });

  } catch (error) {
    console.error('[MEMORY DELETE] Error deleting admin personality:', error);
    res.status(500).json({
      error: 'Failed to delete admin personality data'
    });
  }
});

export default router;
