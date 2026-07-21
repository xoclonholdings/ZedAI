import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import multer from "multer";
import * as yauzl from "yauzl";
import * as mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";

// =========================
// MULTER CONFIG
// =========================

const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 50 * 1024 * 1024); // 50MB default

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads";
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const name = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`;
    cb(null, name);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES
  }
});

// =========================
// TYPES
// =========================

export type ConversionStatus = "full" | "partial" | "failed";

export interface ProcessedFile {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  extractedContent?: string;
  analysis?: any;
  error?: string;
  checksum: string;
  parserUsed: string;
  conversionStatus: ConversionStatus;
  structuralMeta?: Record<string, unknown>;
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

export async function processDocxFile(filePath: string): Promise<{ text: string; warnings: string[] }> {
  const result = await mammoth.extractRawText({ path: filePath });
  return { text: result.value, warnings: (result.messages || []).map((m: any) => m.message) };
}

const MAX_ZIP_ENTRIES = 500;
const MAX_ZIP_TOTAL_BYTES = 200 * 1024 * 1024; // 200MB decompressed, across all entries
const MAX_ZIP_ENTRY_PREVIEW_BYTES = 10_000;

function isUnsafeZipEntryName(name: string): boolean {
  if (!name || name.startsWith("/") || name.startsWith("\\")) return true;
  const normalized = name.replace(/\\/g, "/");
  return normalized.split("/").some((segment) => segment === "..");
}

function isSymlinkEntry(entry: yauzl.Entry): boolean {
  // Unix mode bits are packed into the top 16 bits of externalFileAttributes;
  // 0xA000 is S_IFLNK (symbolic link).
  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  return (unixMode & 0xa000) === 0xa000;
}

export async function processZipFile(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const extracted: any[] = [];
    let totalBytes = 0;
    let entryCount = 0;
    let skipped = 0;

    yauzl.open(filePath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);

      zip.readEntry();

      zip.on("entry", entry => {
        entryCount += 1;

        if (entryCount > MAX_ZIP_ENTRIES) {
          skipped += 1;
          zip.close();
          resolve({
            extractedFiles: extracted,
            totalFiles: extracted.length,
            truncated: true,
            truncatedReason: `entry_limit_exceeded:${MAX_ZIP_ENTRIES}`,
            skipped,
          });
          return;
        }

        if (/\/$/.test(entry.fileName) || isUnsafeZipEntryName(entry.fileName) || isSymlinkEntry(entry)) {
          skipped += 1;
          zip.readEntry();
          return;
        }

        if (totalBytes + entry.uncompressedSize > MAX_ZIP_TOTAL_BYTES) {
          skipped += 1;
          zip.readEntry();
          return;
        }

        zip.openReadStream(entry, (err, stream) => {
          if (err) return reject(err);

          const chunks: Buffer[] = [];
          let received = 0;

          stream.on("data", c => {
            received += c.length;
            totalBytes += c.length;
            if (chunks.reduce((n, b) => n + b.length, 0) < MAX_ZIP_ENTRY_PREVIEW_BYTES) {
              chunks.push(c);
            }
          });
          stream.on("end", () => {
            const content = Buffer.concat(chunks).slice(0, MAX_ZIP_ENTRY_PREVIEW_BYTES).toString("utf-8");

            extracted.push({
              fileName: entry.fileName,
              content,
              size: entry.uncompressedSize,
              truncatedPreview: received > MAX_ZIP_ENTRY_PREVIEW_BYTES,
            });

            zip.readEntry();
          });
          stream.on("error", reject);
        });
      });

      zip.on("end", () => {
        resolve({
          extractedFiles: extracted,
          totalFiles: extracted.length,
          skipped,
        });
      });

      zip.on("error", reject);
    });
  });
}

export async function processImageFile(filePath: string): Promise<string> {
  const buffer = await fs.promises.readFile(filePath);
  return buffer.toString("base64"); // raw base64 only (no AI call)
}

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  pages: Array<{ page: number; text: string }>;
  info?: Record<string, unknown>;
}

export async function processPdfFile(filePath: string): Promise<PdfExtractionResult> {
  const data = await fs.promises.readFile(filePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return {
      text: result.text,
      pageCount: result.total,
      pages: result.pages.map((p) => ({ page: p.num, text: p.text })),
    };
  } finally {
    await parser.destroy().catch(() => {});
  }
}

export interface XlsxExtractionResult {
  sheets: Array<{ name: string; rowCount: number; columnCount: number; preview: unknown[][] }>;
  csvBySheet: Record<string, string>;
}

export async function processXlsxFile(filePath: string): Promise<XlsxExtractionResult> {
  const buffer = await fs.promises.readFile(filePath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheets: XlsxExtractionResult["sheets"] = [];
  const csvBySheet: Record<string, string> = {};

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    const columnCount = rows.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
    sheets.push({
      name: sheetName,
      rowCount: rows.length,
      columnCount,
      preview: rows.slice(0, 25),
    });
    csvBySheet[sheetName] = XLSX.utils.sheet_to_csv(sheet).slice(0, 20_000);
  }

  return { sheets, csvBySheet };
}

export interface PptxExtractionResult {
  slideCount: number;
  slides: Array<{ slide: number; text: string }>;
}

function slideNumberFromEntryName(name: string): number | null {
  const match = name.match(/ppt\/slides\/slide(\d+)\.xml$/i);
  return match ? Number(match[1]) : null;
}

function textFromSlideXml(xml: string): string {
  const runs = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)].map((m) => m[1]);
  return runs.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * PPTX is OOXML — a zip of slide XML parts. Rather than pull in a heavy
 * presentation-parsing dependency, we read the zip natively (yauzl,
 * already a dependency) and extract text runs from each slide's XML.
 */
export async function processPptxFile(filePath: string): Promise<PptxExtractionResult> {
  return new Promise((resolve, reject) => {
    const slides: Array<{ slide: number; text: string }> = [];

    yauzl.open(filePath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      zip.readEntry();

      zip.on("entry", (entry) => {
        const slideNum = slideNumberFromEntryName(entry.fileName);
        if (slideNum == null) {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (err, stream) => {
          if (err) return reject(err);
          const chunks: Buffer[] = [];
          stream.on("data", (c) => chunks.push(c));
          stream.on("end", () => {
            slides.push({ slide: slideNum, text: textFromSlideXml(Buffer.concat(chunks).toString("utf-8")) });
            zip.readEntry();
          });
          stream.on("error", reject);
        });
      });

      zip.on("end", () => {
        slides.sort((a, b) => a.slide - b.slide);
        resolve({ slideCount: slides.length, slides });
      });
      zip.on("error", reject);
    });
  });
}

async function computeChecksum(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = fs.createReadStream(filePath);
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  return hash.digest("hex");
}

// =========================
// MAIN PROCESSOR
// =========================

export async function processFile(filePath: string, mimeType: string): Promise<ProcessedFile> {

  const fileName = path.basename(filePath);
  const stats = await fs.promises.stat(filePath);
  const checksum = await computeChecksum(filePath);

  const result: ProcessedFile = {
    id: fileName,
    fileName,
    originalName: fileName,
    mimeType,
    size: stats.size,
    checksum,
    parserUsed: "none",
    conversionStatus: "failed",
  };

  try {
    let extractedContent = "";
    let analysis: any = {};
    let parserUsed = "none";
    let conversionStatus: ConversionStatus = "full";
    let structuralMeta: Record<string, unknown> | undefined;

    switch (mimeType) {

      case "text/plain":
      case "text/markdown":
        extractedContent = await processTextFile(filePath);
        analysis = { type: "text", length: extractedContent.length };
        parserUsed = "native-text";
        break;

      case "text/csv":
        const csv = await processCsvFile(filePath);
        extractedContent = JSON.stringify(csv, null, 2);
        analysis = {
          type: "csv",
          rows: csv.totalRows,
          columns: csv.headers?.length || 0
        };
        parserUsed = "native-csv";
        structuralMeta = { rows: csv.totalRows, columns: csv.headers?.length || 0 };
        break;

      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        const docx = await processDocxFile(filePath);
        extractedContent = docx.text;
        analysis = { type: "docx", length: docx.text.length, warnings: docx.warnings };
        parserUsed = "mammoth";
        conversionStatus = docx.warnings.length > 0 ? "partial" : "full";
        break;

      case "application/pdf": {
        const pdf = await processPdfFile(filePath);
        extractedContent = pdf.text;
        analysis = { type: "pdf", pageCount: pdf.pageCount };
        parserUsed = "pdf-parse";
        structuralMeta = { pageCount: pdf.pageCount, pages: pdf.pages.map((p) => ({ page: p.page, chars: p.text.length })) };
        conversionStatus = pdf.text.trim().length > 0 ? "full" : "partial";
        break;
      }

      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      case "application/vnd.ms-excel": {
        const xlsx = await processXlsxFile(filePath);
        extractedContent = Object.entries(xlsx.csvBySheet)
          .map(([sheet, csv]) => `## Sheet: ${sheet}\n${csv}`)
          .join("\n\n");
        analysis = { type: "xlsx", sheetCount: xlsx.sheets.length, sheets: xlsx.sheets.map((s) => ({ name: s.name, rows: s.rowCount, columns: s.columnCount })) };
        parserUsed = "xlsx";
        structuralMeta = { sheets: xlsx.sheets };
        conversionStatus = xlsx.sheets.length > 0 ? "full" : "partial";
        break;
      }

      case "application/vnd.openxmlformats-officedocument.presentationml.presentation": {
        const pptx = await processPptxFile(filePath);
        extractedContent = pptx.slides.map((s) => `## Slide ${s.slide}\n${s.text}`).join("\n\n");
        analysis = { type: "pptx", slideCount: pptx.slideCount };
        parserUsed = "native-pptx-zip";
        structuralMeta = { slideCount: pptx.slideCount, slidesWithText: pptx.slides.filter((s) => s.text.length > 0).length };
        conversionStatus = pptx.slideCount > 0 ? "full" : "partial";
        break;
      }

      case "application/zip":
      case "application/x-zip-compressed":
        const zip = await processZipFile(filePath);
        extractedContent = JSON.stringify(zip, null, 2);
        analysis = {
          type: "zip",
          files: zip.totalFiles,
          skipped: zip.skipped,
          truncated: Boolean(zip.truncated),
        };
        parserUsed = "yauzl";
        conversionStatus = zip.truncated ? "partial" : "full";
        structuralMeta = { totalFiles: zip.totalFiles, skipped: zip.skipped };
        break;

      case "image/jpeg":
      case "image/png":
      case "image/webp":
      case "image/gif":
        extractedContent = await processImageFile(filePath);
        analysis = { type: "image_base64" };
        parserUsed = "native-base64";
        break;

      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }

    result.extractedContent = extractedContent;
    result.analysis = analysis;
    result.parserUsed = parserUsed;
    result.conversionStatus = conversionStatus;
    result.structuralMeta = structuralMeta;

  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unknown error";
    result.conversionStatus = "failed";
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
