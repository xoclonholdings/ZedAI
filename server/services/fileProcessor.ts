import fs from "fs";
import path from "path";
import multer from "multer";
import * as yauzl from "yauzl";
import * as mammoth from "mammoth";
import pdfParse from "pdf-parse";
import {
  EXTRACTABLE_UPLOAD_MIME_TYPES,
  IMAGE_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_FILE_SIZE_BYTES,
} from "../../shared/upload-policy";
import { UPLOADS_DIR } from "../utils/repoPaths";

// =========================
// MULTER CONFIG
// =========================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = UPLOADS_DIR;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeOriginalName}`;
    cb(null, name);
  }
});

const ACCEPTED_MIME_TYPES = new Set<string>([
  ...EXTRACTABLE_UPLOAD_MIME_TYPES,
  ...IMAGE_UPLOAD_MIME_TYPES,
]);

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".csv": "text/csv",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".zip": "application/zip",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function resolvedMimeType(fileName: string, suppliedMimeType: string): string {
  if (ACCEPTED_MIME_TYPES.has(suppliedMimeType)) return suppliedMimeType;
  return MIME_TYPE_BY_EXTENSION[path.extname(fileName).toLowerCase()] || suppliedMimeType;
}

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
    files: 20,
  },
  fileFilter: (_req, file, cb) => {
    const mimeType = resolvedMimeType(file.originalname, file.mimetype);
    if (ACCEPTED_MIME_TYPES.has(mimeType)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${file.mimetype || path.extname(file.originalname) || "unknown"}`));
  },
});

// =========================
// TYPES
// =========================

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

// =========================
// FILE READERS
// =========================

export async function processTextFile(filePath: string): Promise<string> {
  return await fs.promises.readFile(filePath, "utf-8");
}

export async function processCsvFile(filePath: string): Promise<any> {
  const content = await fs.promises.readFile(filePath, "utf-8");

  const lines = content.split("\n").filter(l => l.trim());
  if (!lines.length) return { error: "Empty CSV" };

  const headers = lines[0].split(",").map(h => h.trim());

  const rows = lines.slice(1).map(line => {
    const values = line.split(",");
    const row: any = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });

  return {
    headers,
    rows: rows.slice(0, 1000),
    totalRows: rows.length,
    preview: rows.slice(0, 10)
  };
}

export async function processDocxFile(filePath: string): Promise<string> {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

export async function processZipFile(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const extracted: any[] = [];

    yauzl.open(filePath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);

      zip.readEntry();

      zip.on("entry", entry => {
        if (/\/$/.test(entry.fileName)) {
          zip.readEntry();
        } else {
          zip.openReadStream(entry, (err, stream) => {
            if (err) return reject(err);

            const chunks: Buffer[] = [];

            stream.on("data", c => chunks.push(c));
            stream.on("end", () => {
              const content = Buffer.concat(chunks).toString("utf-8");

              extracted.push({
                fileName: entry.fileName,
                content: content.slice(0, 10000),
                size: entry.uncompressedSize
              });

              zip.readEntry();
            });
          });
        }
      });

      zip.on("end", () => {
        resolve({
          extractedFiles: extracted,
          totalFiles: extracted.length
        });
      });
    });
  });
}

export async function processPdfFile(filePath: string): Promise<string> {
  const buffer = await fs.promises.readFile(filePath);
  try {
    const parsed = await pdfParse(buffer);
    const text = parsed.text?.trim();
    if (!text) {
      throw new Error("No extractable text was found in this PDF. It may be scanned or image-only.");
    }
    return text;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to parse PDF: ${detail}`);
  }
}

// =========================
// MAIN PROCESSOR
// =========================

export async function processFile(
  filePath: string,
  mimeType: string,
  originalName?: string,
): Promise<ProcessedFile> {

  const fileName = path.basename(filePath);
  const stats = await fs.promises.stat(filePath);
  const sourceName = originalName || fileName;
  const effectiveMimeType = resolvedMimeType(sourceName, mimeType);

  const result: ProcessedFile = {
    id: fileName,
    fileName,
    originalName: sourceName,
    mimeType: effectiveMimeType,
    size: stats.size
  };

  try {
    let extractedContent = "";
    let analysis: any = {};

    switch (effectiveMimeType) {

      case "text/plain":
      case "text/markdown":
      case "application/json":
        extractedContent = await processTextFile(filePath);
        analysis = { type: "text", length: extractedContent.length };
        break;

      case "text/csv":
      case "application/vnd.ms-excel":
        const csv = await processCsvFile(filePath);
        extractedContent = JSON.stringify(csv, null, 2);
        analysis = {
          type: "csv",
          rows: csv.totalRows,
          columns: csv.headers?.length || 0
        };
        break;

      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        extractedContent = await processDocxFile(filePath);
        analysis = { type: "docx", length: extractedContent.length };
        break;

      case "application/zip":
      case "application/x-zip-compressed":
        const zip = await processZipFile(filePath);
        extractedContent = JSON.stringify(zip, null, 2);
        analysis = {
          type: "zip",
          files: zip.totalFiles
        };
        break;

      case "image/jpeg":
      case "image/png":
      case "image/webp":
      case "image/gif":
        throw new Error("Image analysis is not connected yet. The image was not added to ZAR's knowledge.");

      case "application/pdf":
        extractedContent = await processPdfFile(filePath);
        analysis = { type: "pdf" };
        break;

      default:
        throw new Error(`Unsupported file type: ${effectiveMimeType}`);
    }

    result.extractedContent = extractedContent;
    result.analysis = analysis;

  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error";
  }

  return result;
}

// =========================
// CLEANUP
// =========================

export async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {}
}
