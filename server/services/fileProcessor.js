"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
exports.processTextFile = processTextFile;
exports.processZipFile = processZipFile;
exports.processDocxFile = processDocxFile;
exports.processCsvFile = processCsvFile;
exports.processImageFile = processImageFile;
exports.processPdfFile = processPdfFile;
exports.processFile = processFile;
exports.cleanupFile = cleanupFile;
var fs_1 = require("fs");
var path_1 = require("path");
var multer_1 = require("multer");
var yauzl = require("yauzl");
var mammoth = require("mammoth");
var openai_1 = require("./openai");
// Configure multer for file uploads
var storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        var uploadDir = "uploads";
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        var uniqueName = "".concat(Date.now(), "-").concat(Math.round(Math.random() * 1E9), "-").concat(file.originalname);
        cb(null, uniqueName);
    }
});
exports.upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 32 * 1024 * 1024 * 1024, // 32GB limit
    },
    fileFilter: function (req, file, cb) {
        // Allow common file types including zip and docx
        var allowedTypes = [
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
        }
        else {
            cb(new Error("File type ".concat(file.mimetype, " not supported")));
        }
    }
});
function processTextFile(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fs_1.default.promises.readFile(filePath, 'utf-8')];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_1 = _a.sent();
                    throw new Error("Failed to read text file: ".concat(error_1));
                case 3: return [2 /*return*/];
            }
        });
    });
}
// Process ZIP files and extract contents
function processZipFile(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    var extractedFiles = [];
                    yauzl.open(filePath, { lazyEntries: true }, function (err, zipfile) {
                        if (err)
                            return reject(err);
                        zipfile.readEntry();
                        zipfile.on("entry", function (entry) {
                            if (/\/$/.test(entry.fileName)) {
                                // Directory entry, skip
                                zipfile.readEntry();
                            }
                            else {
                                // File entry
                                zipfile.openReadStream(entry, function (err, readStream) {
                                    if (err)
                                        return reject(err);
                                    var chunks = [];
                                    readStream.on('data', function (chunk) { return chunks.push(chunk); });
                                    readStream.on('end', function () {
                                        var content = Buffer.concat(chunks).toString('utf-8');
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
                        zipfile.on("end", function () {
                            resolve({ extractedFiles: extractedFiles, totalFiles: extractedFiles.length });
                        });
                    });
                })];
        });
    });
}
// Process DOCX files 
function processDocxFile(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var result, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, mammoth.extractRawText({ path: filePath })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.value];
                case 2:
                    error_2 = _a.sent();
                    throw new Error("Failed to process DOCX file: ".concat(error_2));
                case 3: return [2 /*return*/];
            }
        });
    });
}
function processCsvFile(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var content, lines, headers_1, rows, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fs_1.default.promises.readFile(filePath, 'utf-8')];
                case 1:
                    content = _a.sent();
                    lines = content.split('\n').filter(function (line) { return line.trim(); });
                    if (lines.length === 0)
                        return [2 /*return*/, { error: "Empty CSV file" }];
                    headers_1 = lines[0].split(',').map(function (h) { return h.trim().replace(/"/g, ''); });
                    rows = lines.slice(1).map(function (line) {
                        var values = line.split(',').map(function (v) { return v.trim().replace(/"/g, ''); });
                        var row = {};
                        headers_1.forEach(function (header, index) {
                            row[header] = values[index] || '';
                        });
                        return row;
                    });
                    return [2 /*return*/, {
                            headers: headers_1,
                            rows: rows.slice(0, 1000), // Limit to first 1000 rows for processing
                            totalRows: rows.length,
                            preview: rows.slice(0, 10)
                        }];
                case 2:
                    error_3 = _a.sent();
                    throw new Error("Failed to process CSV file: ".concat(error_3));
                case 3: return [2 /*return*/];
            }
        });
    });
}
function processImageFile(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var imageBuffer, base64Image, error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, fs_1.default.promises.readFile(filePath)];
                case 1:
                    imageBuffer = _a.sent();
                    base64Image = imageBuffer.toString('base64');
                    return [4 /*yield*/, (0, openai_1.analyzeImage)(base64Image)];
                case 2: return [2 /*return*/, _a.sent()];
                case 3:
                    error_4 = _a.sent();
                    throw new Error("Failed to process image file: ".concat(error_4));
                case 4: return [2 /*return*/];
            }
        });
    });
}
function processPdfFile(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            try {
                // For now, return a placeholder - in production you'd use pdf-parse
                // const pdfParse = require('pdf-parse');
                // const dataBuffer = await fs.promises.readFile(filePath);
                // const data = await pdfParse(dataBuffer);
                // return data.text;
                return [2 /*return*/, "PDF processing not implemented in this version. Please use text or CSV files for now."];
            }
            catch (error) {
                throw new Error("Failed to process PDF file: ".concat(error));
            }
            return [2 /*return*/];
        });
    });
}
function processFile(filePath, mimeType) {
    return __awaiter(this, void 0, void 0, function () {
        var fileName, stats, result, extractedContent, analysis, _a, csvData, zipData, error_5;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    fileName = path_1.default.basename(filePath);
                    return [4 /*yield*/, fs_1.default.promises.stat(filePath)];
                case 1:
                    stats = _c.sent();
                    result = {
                        id: fileName,
                        fileName: fileName,
                        originalName: fileName,
                        mimeType: mimeType,
                        size: stats.size,
                    };
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 21, , 22]);
                    extractedContent = "";
                    analysis = {};
                    _a = mimeType;
                    switch (_a) {
                        case 'text/plain': return [3 /*break*/, 3];
                        case 'text/markdown': return [3 /*break*/, 3];
                        case 'text/csv': return [3 /*break*/, 6];
                        case 'image/jpeg': return [3 /*break*/, 8];
                        case 'image/png': return [3 /*break*/, 8];
                        case 'image/gif': return [3 /*break*/, 8];
                        case 'image/webp': return [3 /*break*/, 8];
                        case 'application/pdf': return [3 /*break*/, 10];
                        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return [3 /*break*/, 14];
                        case 'application/zip': return [3 /*break*/, 17];
                        case 'application/x-zip-compressed': return [3 /*break*/, 17];
                    }
                    return [3 /*break*/, 19];
                case 3: return [4 /*yield*/, processTextFile(filePath)];
                case 4:
                    extractedContent = _c.sent();
                    return [4 /*yield*/, (0, openai_1.analyzeText)(extractedContent, "extract_themes")];
                case 5:
                    analysis = _c.sent();
                    return [3 /*break*/, 20];
                case 6: return [4 /*yield*/, processCsvFile(filePath)];
                case 7:
                    csvData = _c.sent();
                    extractedContent = JSON.stringify(csvData, null, 2);
                    analysis = {
                        type: "csv_data",
                        summary: "CSV file with ".concat(((_b = csvData.headers) === null || _b === void 0 ? void 0 : _b.length) || 0, " columns and ").concat(csvData.totalRows || 0, " rows"),
                        headers: csvData.headers,
                        preview: csvData.preview
                    };
                    return [3 /*break*/, 20];
                case 8: return [4 /*yield*/, processImageFile(filePath)];
                case 9:
                    extractedContent = _c.sent();
                    analysis = {
                        type: "image_analysis",
                        description: extractedContent
                    };
                    return [3 /*break*/, 20];
                case 10: return [4 /*yield*/, processPdfFile(filePath)];
                case 11:
                    extractedContent = _c.sent();
                    if (!(extractedContent && extractedContent.length > 100)) return [3 /*break*/, 13];
                    return [4 /*yield*/, (0, openai_1.analyzeText)(extractedContent, "extract_themes")];
                case 12:
                    analysis = _c.sent();
                    _c.label = 13;
                case 13: return [3 /*break*/, 20];
                case 14: return [4 /*yield*/, processDocxFile(filePath)];
                case 15:
                    extractedContent = _c.sent();
                    return [4 /*yield*/, (0, openai_1.analyzeText)(extractedContent, "extract_themes")];
                case 16:
                    analysis = _c.sent();
                    return [3 /*break*/, 20];
                case 17: return [4 /*yield*/, processZipFile(filePath)];
                case 18:
                    zipData = _c.sent();
                    extractedContent = JSON.stringify(zipData, null, 2);
                    analysis = {
                        type: "zip_archive",
                        summary: "ZIP archive containing ".concat(zipData.totalFiles, " files"),
                        files: zipData.extractedFiles.map(function (f) { return f.fileName; }),
                        extractedFiles: zipData.extractedFiles
                    };
                    return [3 /*break*/, 20];
                case 19: throw new Error("Unsupported file type: ".concat(mimeType));
                case 20:
                    result.extractedContent = extractedContent;
                    result.analysis = analysis;
                    return [3 /*break*/, 22];
                case 21:
                    error_5 = _c.sent();
                    result.error = error_5 instanceof Error ? error_5.message : "Unknown processing error";
                    return [3 /*break*/, 22];
                case 22: return [2 /*return*/, result];
            }
        });
    });
}
function cleanupFile(filePath) {
    return __awaiter(this, void 0, void 0, function () {
        var error_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fs_1.default.promises.unlink(filePath)];
                case 1:
                    _a.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_6 = _a.sent();
                    console.error("Failed to cleanup file ".concat(filePath, ":"), error_6);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
