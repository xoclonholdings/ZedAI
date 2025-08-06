import { Router } from 'express';
import multer from 'multer';
import path from 'path';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// File upload endpoint
router.post('/upload', upload.array('files'), async (req, res) => {
    try {
        const files = req.files as Express.Multer.File[];
        const uploadedFiles = files.map(file => ({
            id: Date.now() + Math.random(),
            originalName: file.originalname,
            filename: file.filename,
            size: file.size,
            mimetype: file.mimetype,
            path: file.path,
            uploadedAt: new Date().toISOString()
        }));

        res.json({
            success: true,
            files: uploadedFiles,
            message: `Successfully uploaded ${files.length} file(s)`
        });
    } catch (error: any) {
        console.error('Error uploading files:', error);
        res.status(500).json({ error: error.message });
    }
});

// Translation endpoint
router.post('/translate', async (req, res) => {
    try {
        const { text, targetLanguage } = req.body;

        // Simple translation simulation (in production, use a real translation service)
        const translations: Record<string, string> = {
            'es': `[ES] ${text}`,
            'fr': `[FR] ${text}`,
            'de': `[DE] ${text}`,
            'it': `[IT] ${text}`,
            'pt': `[PT] ${text}`,
            'ru': `[RU] ${text}`,
            'ja': `[JA] ${text}`,
            'ko': `[KO] ${text}`,
            'zh': `[ZH] ${text}`
        };

        const translatedText = translations[targetLanguage] || `[${targetLanguage.toUpperCase()}] ${text}`;

        res.json({
            originalText: text,
            translatedText,
            targetLanguage,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('Error translating text:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
