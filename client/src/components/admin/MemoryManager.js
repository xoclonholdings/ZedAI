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
exports.default = MemoryManager;
var react_1 = require("react");
var button_1 = require("@/components/ui/button");
var card_1 = require("@/components/ui/card");
var input_1 = require("@/components/ui/input");
var label_1 = require("@/components/ui/label");
var badge_1 = require("@/components/ui/badge");
var progress_1 = require("@/components/ui/progress");
var alert_1 = require("@/components/ui/alert");
var lucide_react_1 = require("lucide-react");
var queryClient_1 = require("@/lib/queryClient");
function MemoryManager() {
    var _this = this;
    var _a = (0, react_1.useState)(null), stats = _a[0], setStats = _a[1];
    var _b = (0, react_1.useState)(false), uploading = _b[0], setUploading = _b[1];
    var _c = (0, react_1.useState)(0), progress = _c[0], setProgress = _c[1];
    var _d = (0, react_1.useState)(null), message = _d[0], setMessage = _d[1];
    var _e = (0, react_1.useState)(""), folderPath = _e[0], setFolderPath = _e[1];
    var _f = (0, react_1.useState)('standard'), personalityMode = _f[0], setPersonalityMode = _f[1];
    // Load stats on component mount
    (0, react_1.useState)(function () {
        loadStats();
    });
    var loadStats = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, queryClient_1.apiRequest)('/api/memory/stats', 'GET')];
                case 1:
                    response = _a.sent();
                    setStats(response);
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _a.sent();
                    console.error('Failed to load memory stats:', error_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var handleFileUpload = function (event) { return __awaiter(_this, void 0, void 0, function () {
        var file, formData, progressInterval, response, result, error, error_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    file = (_a = event.target.files) === null || _a === void 0 ? void 0 : _a[0];
                    if (!file)
                        return [2 /*return*/];
                    setUploading(true);
                    setProgress(0);
                    setMessage(null);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 8, 9, 10]);
                    formData = new FormData();
                    formData.append('export', file);
                    progressInterval = setInterval(function () {
                        setProgress(function (prev) { return Math.min(prev + 10, 90); });
                    }, 500);
                    return [4 /*yield*/, fetch('/api/memory/import', {
                            method: 'POST',
                            body: formData,
                            credentials: 'include'
                        })];
                case 2:
                    response = _b.sent();
                    clearInterval(progressInterval);
                    setProgress(100);
                    if (!response.ok) return [3 /*break*/, 5];
                    return [4 /*yield*/, response.json()];
                case 3:
                    result = _b.sent();
                    setMessage({ type: 'success', text: result.message });
                    return [4 /*yield*/, loadStats()];
                case 4:
                    _b.sent();
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, response.json()];
                case 6:
                    error = _b.sent();
                    setMessage({ type: 'error', text: error.error || 'Upload failed' });
                    _b.label = 7;
                case 7: return [3 /*break*/, 10];
                case 8:
                    error_2 = _b.sent();
                    setMessage({ type: 'error', text: 'Upload failed: ' + error_2.message });
                    return [3 /*break*/, 10];
                case 9:
                    setUploading(false);
                    setProgress(0);
                    // Reset file input
                    event.target.value = '';
                    return [7 /*endfinally*/];
                case 10: return [2 /*return*/];
            }
        });
    }); };
    var handleFolderImport = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!folderPath.trim()) {
                        setMessage({ type: 'error', text: 'Please enter a folder path' });
                        return [2 /*return*/];
                    }
                    setUploading(true);
                    setMessage(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, (0, queryClient_1.apiRequest)('/api/memory/import-folder', 'POST', {
                            folderPath: folderPath.trim()
                        })];
                case 2:
                    response = _a.sent();
                    setMessage({ type: 'success', text: response.message });
                    return [4 /*yield*/, loadStats()];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 4:
                    error_3 = _a.sent();
                    setMessage({ type: 'error', text: 'Folder import failed: ' + error_3.message });
                    return [3 /*break*/, 6];
                case 5:
                    setUploading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var togglePersonality = function (mode) { return __awaiter(_this, void 0, void 0, function () {
        var error_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, (0, queryClient_1.apiRequest)('/api/memory/toggle-personality', 'POST', {
                            personalityMode: mode
                        })];
                case 1:
                    _a.sent();
                    setPersonalityMode(mode);
                    setMessage({ type: 'success', text: "Switched to ".concat(mode, " personality mode") });
                    return [3 /*break*/, 3];
                case 2:
                    error_4 = _a.sent();
                    setMessage({ type: 'error', text: 'Failed to toggle personality: ' + error_4.message });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var deleteAdminPersonality = function () { return __awaiter(_this, void 0, void 0, function () {
        var error_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!confirm('Are you sure you want to delete the admin personality data? This action cannot be undone.')) {
                        return [2 /*return*/];
                    }
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, (0, queryClient_1.apiRequest)('/api/memory/admin-personality', 'DELETE')];
                case 2:
                    _a.sent();
                    setMessage({ type: 'success', text: 'Admin personality data deleted successfully' });
                    return [4 /*yield*/, loadStats()];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    error_5 = _a.sent();
                    setMessage({ type: 'error', text: 'Failed to delete personality data: ' + error_5.message });
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (<div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
          ZED Memory Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Import OpenAI assistant memory and manage ZED's personality
        </p>
      </div>

      {/* Current Stats */}
      <card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle className="flex items-center space-x-2">
            <lucide_react_1.Brain className="w-5 h-5"/>
            <span>Memory Status</span>
          </card_1.CardTitle>
        </card_1.CardHeader>
        <card_1.CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{(stats === null || stats === void 0 ? void 0 : stats.contextualMemoryCount) || 0}</div>
              <div className="text-sm text-muted-foreground">Contextual Memories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-cyan-400">{(stats === null || stats === void 0 ? void 0 : stats.interactionHistoryCount) || 0}</div>
              <div className="text-sm text-muted-foreground">Interactions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-pink-400">{(stats === null || stats === void 0 ? void 0 : stats.knowledgeDomainCount) || 0}</div>
              <div className="text-sm text-muted-foreground">Knowledge Domains</div>
            </div>
            <div className="text-center">
              <badge_1.Badge variant={(stats === null || stats === void 0 ? void 0 : stats.adminPersonality) ? "default" : "secondary"}>
                {(stats === null || stats === void 0 ? void 0 : stats.adminPersonality) ? "Enhanced" : "Standard"}
              </badge_1.Badge>
              <div className="text-sm text-muted-foreground mt-1">Personality</div>
            </div>
          </div>
          
          {(stats === null || stats === void 0 ? void 0 : stats.lastImportDate) && (<div className="mt-4 text-sm text-muted-foreground">
              Last import: {new Date(stats.lastImportDate).toLocaleString()}
            </div>)}
        </card_1.CardContent>
      </card_1.Card>

      {/* Personality Mode Toggle */}
      <card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle className="flex items-center space-x-2">
            <lucide_react_1.Settings className="w-5 h-5"/>
            <span>Personality Mode</span>
          </card_1.CardTitle>
          <card_1.CardDescription>
            Toggle between enhanced (admin) and standard personality modes
          </card_1.CardDescription>
        </card_1.CardHeader>
        <card_1.CardContent>
          <div className="flex space-x-4">
            <button_1.Button variant={personalityMode === 'standard' ? 'default' : 'outline'} onClick={function () { return togglePersonality('standard'); }} className="flex-1">
              Standard Mode
            </button_1.Button>
            <button_1.Button variant={personalityMode === 'enhanced' ? 'default' : 'outline'} onClick={function () { return togglePersonality('enhanced'); }} disabled={!(stats === null || stats === void 0 ? void 0 : stats.adminPersonality)} className="flex-1">
              <lucide_react_1.Sparkles className="w-4 h-4 mr-2"/>
              Enhanced Mode
              {!(stats === null || stats === void 0 ? void 0 : stats.adminPersonality) && (<span className="ml-2 text-xs">(Import Required)</span>)}
            </button_1.Button>
          </div>
        </card_1.CardContent>
      </card_1.Card>

      {/* File Upload */}
      <card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle className="flex items-center space-x-2">
            <lucide_react_1.Upload className="w-5 h-5"/>
            <span>Import OpenAI Export</span>
          </card_1.CardTitle>
          <card_1.CardDescription>
            Upload your OpenAI assistant memory export (ZIP file)
          </card_1.CardDescription>
        </card_1.CardHeader>
        <card_1.CardContent>
          <div className="space-y-4">
            <div>
              <label_1.Label htmlFor="export-file">Select ZIP File</label_1.Label>
              <input_1.Input id="export-file" type="file" accept=".zip" onChange={handleFileUpload} disabled={uploading} className="mt-1"/>
            </div>
            
            {uploading && (<div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Uploading and processing...</span>
                  <span>{progress}%</span>
                </div>
                <progress_1.Progress value={progress} className="w-full"/>
              </div>)}
          </div>
        </card_1.CardContent>
      </card_1.Card>

      {/* Folder Import */}
      <card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle className="flex items-center space-x-2">
            <lucide_react_1.FolderOpen className="w-5 h-5"/>
            <span>Import from Folder</span>
          </card_1.CardTitle>
          <card_1.CardDescription>
            Import from an extracted folder path on the server
          </card_1.CardDescription>
        </card_1.CardHeader>
        <card_1.CardContent>
          <div className="space-y-4">
            <div>
              <label_1.Label htmlFor="folder-path">Folder Path</label_1.Label>
              <input_1.Input id="folder-path" value={folderPath} onChange={function (e) { return setFolderPath(e.target.value); }} placeholder="/path/to/openai/export/folder" disabled={uploading} className="mt-1"/>
            </div>
            <button_1.Button onClick={handleFolderImport} disabled={uploading || !folderPath.trim()} className="w-full">
              Import from Folder
            </button_1.Button>
          </div>
        </card_1.CardContent>
      </card_1.Card>

      {/* Management Actions */}
      {(stats === null || stats === void 0 ? void 0 : stats.adminPersonality) && (<card_1.Card>
          <card_1.CardHeader>
            <card_1.CardTitle className="flex items-center space-x-2">
              <lucide_react_1.Database className="w-5 h-5"/>
              <span>Memory Management</span>
            </card_1.CardTitle>
            <card_1.CardDescription>
              Manage imported personality data
            </card_1.CardDescription>
          </card_1.CardHeader>
          <card_1.CardContent>
            <button_1.Button variant="destructive" onClick={deleteAdminPersonality} className="w-full">
              <lucide_react_1.Trash2 className="w-4 h-4 mr-2"/>
              Delete Admin Personality Data
            </button_1.Button>
          </card_1.CardContent>
        </card_1.Card>)}

      {/* Messages */}
      {message && (<alert_1.Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' ? (<lucide_react_1.CheckCircle className="h-4 w-4"/>) : (<lucide_react_1.AlertCircle className="h-4 w-4"/>)}
          <alert_1.AlertDescription>{message.text}</alert_1.AlertDescription>
        </alert_1.Alert>)}

      {/* Instructions */}
      <card_1.Card>
        <card_1.CardHeader>
          <card_1.CardTitle>Instructions</card_1.CardTitle>
        </card_1.CardHeader>
        <card_1.CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>1. Export from OpenAI:</strong> Go to your OpenAI account settings and export your data.
            </p>
            <p>
              <strong>2. Upload ZIP:</strong> Upload the exported ZIP file using the form above.
            </p>
            <p>
              <strong>3. Enhanced Mode:</strong> Once imported, you can switch to enhanced mode for admin users.
            </p>
            <p>
              <strong>4. Standard Users:</strong> Regular users will always use the standard personality mode.
            </p>
          </div>
        </card_1.CardContent>
      </card_1.Card>
    </div>);
}
