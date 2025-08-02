import fs from "fs";
import path from "path";
import multer from "multer";
import * as yauzl from "yauzl";
import * as mammoth from "mammoth";
import { analyzeText, analyzeImage } from "./openai";

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

export const upload = multer({ 
  storage,
  limits: {
    fileSize: 32 * 1024 * 1024 * 1024, // 32GB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types including zip and docx
    const allowedTypes = [
      'text/plain',
      'text/csv',
      'application/pdf',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/zip',
      'application/x-zip-compressed',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/json',
      'text/markdown'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not supported`));
    }
  }
});

export interface ProcessedFile {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  extractedContent?: string;
  analysis?: any;
  error?: string;
}

export async function processTextFile(filePath: string): Promise<string> {
  try {
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read text file: ${error}`);
  }
}

// Process ZIP files and extract contents
export async function processZipFile(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const extractedFiles: any[] = [];
    
    yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      
      zipfile.readEntry();
      zipfile.on("entry", (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // Directory entry, skip
          zipfile.readEntry();
        } else {
          // File entry
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) return reject(err);
            
            const chunks: Buffer[] = [];
            readStream.on('data', (chunk) => chunks.push(chunk));
            readStream.on('end', () => {
              const content = Buffer.concat(chunks).toString('utf-8');
              extractedFiles.push({
                fileName: entry.fileName,
                content: content.slice(0, 10000), // Limit content size
                size: entry.uncompressedSize
              });
              zipfile.readEntry();
            });
          });
        }
      });
      
      zipfile.on("end", () => {
        resolve({ extractedFiles, totalFiles: extractedFiles.length });
      });
    });
  });
}

// Process DOCX files 
export async function processDocxFile(filePath: string): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    throw new Error(`Failed to process DOCX file: ${error}`);
  }
}

export async function processCsvFile(filePath: string): Promise<any> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) return { error: "Empty CSV file" };
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });
    
    return {
      headers,
      rows: rows.slice(0, 1000), // Limit to first 1000 rows for processing
      totalRows: rows.length,
      preview: rows.slice(0, 10)
    };
  } catch (error) {
    throw new Error(`Failed to process CSV file: ${error}`);
  }
}

export async function processImageFile(filePath: string): Promise<string> {
  try {
    const imageBuffer = await fs.promises.readFile(filePath);
    const base64Image = imageBuffer.toString('base64');
    
    return await analyzeImage(base64Image);
  } catch (error) {
    throw new Error(`Failed to process image file: ${error}`);
  }
}

export async function processPdfFile(filePath: string): Promise<string> {
  try {
    // For now, return a placeholder - in production you'd use pdf-parse
    // const pdfParse = require('pdf-parse');
    // const dataBuffer = await fs.promises.readFile(filePath);
    // const data = await pdfParse(dataBuffer);
    // return data.text;
    
    return "PDF processing not implemented in this version. Please use text or CSV files for now.";
  } catch (error) {
    throw new Error(`Failed to process PDF file: ${error}`);
  }
}

export async function processFile(filePath: string, mimeType: string): Promise<ProcessedFile> {
  const fileName = path.basename(filePath);
  const stats = await fs.promises.stat(filePath);
  
  const result: ProcessedFile = {
    id: fileName,
    fileName,
    originalName: fileName,
    mimeType,
    size: stats.size,
  };

  try {
    let extractedContent = "";
    let analysis: any = {};

    switch (mimeType) {
      case 'text/plain':
      case 'text/markdown':
        extractedContent = await processTextFile(filePath);
        analysis = await analyzeText(extractedContent, "extract_themes");
        break;
        
      case 'text/csv':
        const csvData = await processCsvFile(filePath);
        extractedContent = JSON.stringify(csvData, null, 2);
        analysis = {
          type: "csv_data",
          summary: `CSV file with ${csvData.headers?.length || 0} columns and ${csvData.totalRows || 0} rows`,
          headers: csvData.headers,
          preview: csvData.preview
        };
        break;
        
      case 'image/jpeg':
      case 'image/png':
      case 'image/gif':
      case 'image/webp':
        extractedContent = await processImageFile(filePath);
        analysis = {
          type: "image_analysis",
          description: extractedContent
        };
        break;
        
      case 'application/pdf':
        extractedContent = await processPdfFile(filePath);
        if (extractedContent && extractedContent.length > 100) {
          analysis = await analyzeText(extractedContent, "extract_themes");
        }
        break;
        
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        extractedContent = await processDocxFile(filePath);
        analysis = await analyzeText(extractedContent, "extract_themes");
        break;
        
      case 'application/zip':
      case 'application/x-zip-compressed':
        const zipData = await processZipFile(filePath);
        extractedContent = JSON.stringify(zipData, null, 2);
        analysis = {
          type: "zip_archive",
          summary: `ZIP archive containing ${zipData.totalFiles} files`,
          files: zipData.extractedFiles.map((f: any) => f.fileName),
          extractedFiles: zipData.extractedFiles
        };
        break;
        
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }

    result.extractedContent = extractedContent;
    result.analysis = analysis;
    
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown processing error";
  }

  return result;
}

export async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    console.error(`Failed to cleanup file ${filePath}:`, error);
  }
}
