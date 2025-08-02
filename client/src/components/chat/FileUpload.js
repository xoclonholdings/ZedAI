"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.default = FileUpload;
var react_1 = require("react");
var react_query_1 = require("@tanstack/react-query");
var button_1 = require("@/components/ui/button");
var card_1 = require("@/components/ui/card");
var progress_1 = require("@/components/ui/progress");
var lucide_react_1 = require("lucide-react");
var use_toast_1 = require("@/hooks/use-toast");
function FileUpload(_a) {
    var _this = this;
    var conversationId = _a.conversationId, onUpload = _a.onUpload, onClose = _a.onClose;
    var _b = (0, react_1.useState)(false), dragActive = _b[0], setDragActive = _b[1];
    var _c = (0, react_1.useState)([]), uploadingFiles = _c[0], setUploadingFiles = _c[1];
    var fileInputRef = (0, react_1.useRef)(null);
    var toast = (0, use_toast_1.useToast)().toast;
    var queryClient = (0, react_query_1.useQueryClient)();
    var uploadMutation = (0, react_query_1.useMutation)({
        mutationFn: function (files) { return __awaiter(_this, void 0, void 0, function () {
            var formData, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        formData = new FormData();
                        files.forEach(function (file) {
                            formData.append('files', file);
                        });
                        return [4 /*yield*/, fetch("/api/conversations/".concat(conversationId, "/upload"), {
                                method: 'POST',
                                body: formData,
                            })];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new Error('Upload failed');
                        }
                        return [2 /*return*/, response.json()];
                }
            });
        }); },
        onSuccess: function (data) {
            toast({
                title: "Upload successful",
                description: "".concat(data.files.length, " file(s) processed successfully")
            });
            // Refresh files list
            queryClient.invalidateQueries({
                queryKey: ["/api/conversations", conversationId, "files"]
            });
            onUpload(uploadingFiles.map(function (uf) { return uf.file; }));
            setUploadingFiles([]);
        },
        onError: function (error) {
            toast({
                title: "Upload failed",
                description: error instanceof Error ? error.message : "Failed to upload files",
                variant: "destructive"
            });
            setUploadingFiles([]);
        }
    });
    var handleDrag = function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        }
        else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };
    var handleDrop = function (e) {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(Array.from(e.dataTransfer.files));
        }
    };
    var handleFileInput = function (e) {
        if (e.target.files && e.target.files[0]) {
            handleFiles(Array.from(e.target.files));
        }
    };
    var handleFiles = function (files) {
        // Validate file types and sizes
        var validFiles = files.filter(function (file) {
            var maxSize = 32 * 1024 * 1024 * 1024; // 32GB
            var allowedTypes = [
                'text/plain',
                'text/csv',
                'application/pdf',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'application/json',
                'text/markdown'
            ];
            if (file.size > maxSize) {
                toast({
                    title: "File too large",
                    description: "".concat(file.name, " exceeds 32GB limit"),
                    variant: "destructive"
                });
                return false;
            }
            if (!allowedTypes.includes(file.type)) {
                toast({
                    title: "Unsupported file type",
                    description: "".concat(file.name, " is not a supported file type"),
                    variant: "destructive"
                });
                return false;
            }
            return true;
        });
        if (validFiles.length === 0)
            return;
        // Initialize upload state
        var newUploadingFiles = validFiles.map(function (file) { return ({
            file: file,
            progress: 0,
            status: "uploading"
        }); });
        setUploadingFiles(newUploadingFiles);
        // Simulate upload progress
        newUploadingFiles.forEach(function (uploadingFile, index) {
            var interval = setInterval(function () {
                setUploadingFiles(function (prev) {
                    return prev.map(function (uf, i) {
                        return i === index
                            ? __assign(__assign({}, uf), { progress: Math.min(uf.progress + 10, 90) }) : uf;
                    });
                });
            }, 100);
            setTimeout(function () {
                clearInterval(interval);
                setUploadingFiles(function (prev) {
                    return prev.map(function (uf, i) {
                        return i === index
                            ? __assign(__assign({}, uf), { progress: 100, status: "processing" }) : uf;
                    });
                });
            }, 1000);
        });
        // Start actual upload
        uploadMutation.mutate(validFiles);
    };
    var getFileIcon = function (file) {
        if (file.type.startsWith('image/'))
            return <lucide_react_1.Image size={16}/>;
        if (file.type.includes('csv') || file.type.includes('excel'))
            return <lucide_react_1.FileSpreadsheet size={16}/>;
        if (file.type === 'text/plain')
            return <lucide_react_1.FileText size={16}/>;
        return <lucide_react_1.File size={16}/>;
    };
    var formatFileSize = function (bytes) {
        if (bytes === 0)
            return '0 Bytes';
        var k = 1024;
        var sizes = ['Bytes', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    return (<div className="p-4 bg-gray-50">
      <card_1.Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Upload Files</h3>
          <button_1.Button variant="ghost" size="sm" onClick={onClose}>
            <lucide_react_1.X size={16}/>
          </button_1.Button>
        </div>

        {/* Upload Area */}
        <div className={"border-2 border-dashed rounded-lg p-8 text-center transition-colors ".concat(dragActive
            ? "border-primary bg-primary/5"
            : "border-gray-300 hover:border-gray-400")} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} onClick={function () { var _a; return (_a = fileInputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }}>
          <lucide_react_1.Upload className="mx-auto mb-4 text-gray-400" size={48}/>
          <p className="text-lg font-medium text-gray-700 mb-2">
            Drop files here or click to browse
          </p>
          <p className="text-sm text-gray-500">
            Supports CSV, Excel, PDF, images, text files up to 32GB
          </p>
          
          <input ref={fileInputRef} type="file" multiple onChange={handleFileInput} className="hidden" accept=".csv,.xlsx,.pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.json"/>
        </div>

        {/* Uploading Files */}
        {uploadingFiles.length > 0 && (<div className="mt-6 space-y-3">
            <h4 className="text-sm font-medium text-gray-900">Uploading Files</h4>
            {uploadingFiles.map(function (uploadingFile, index) { return (<div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="text-gray-500">
                    {getFileIcon(uploadingFile.file)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadingFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(uploadingFile.file.size)}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {uploadingFile.status === "completed" && (<lucide_react_1.CheckCircle className="text-green-500" size={16}/>)}
                    {uploadingFile.status === "error" && (<lucide_react_1.AlertCircle className="text-red-500" size={16}/>)}
                    <span className="text-xs text-gray-500 capitalize">
                      {uploadingFile.status}
                    </span>
                  </div>
                </div>
                
                {uploadingFile.status === "uploading" && (<div className="mt-2">
                    <progress_1.Progress value={uploadingFile.progress} className="h-1"/>
                  </div>)}
                
                {uploadingFile.error && (<p className="mt-2 text-xs text-red-600">{uploadingFile.error}</p>)}
              </div>); })}
          </div>)}
      </card_1.Card>
    </div>);
}
