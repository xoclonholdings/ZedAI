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
exports.ZedCorePage = void 0;
var react_1 = require("react");
var card_1 = require("../ui/card");
var button_1 = require("../ui/button");
var input_1 = require("../ui/input");
var label_1 = require("../ui/label");
var textarea_1 = require("../ui/textarea");
var tabs_1 = require("../ui/tabs");
var badge_1 = require("../ui/badge");
var progress_1 = require("../ui/progress");
var lucide_react_1 = require("lucide-react");
var alert_1 = require("../ui/alert");
var ZedCorePage = function (_a) {
    var _b;
    var userId = _a.userId, _c = _a.isAdmin, isAdmin = _c === void 0 ? false : _c;
    var _d = (0, react_1.useState)(null), userCore = _d[0], setUserCore = _d[1];
    var _e = (0, react_1.useState)(null), adminCore = _e[0], setAdminCore = _e[1];
    var _f = (0, react_1.useState)(null), memoryStats = _f[0], setMemoryStats = _f[1];
    var _g = (0, react_1.useState)(true), loading = _g[0], setLoading = _g[1];
    var _h = (0, react_1.useState)(null), error = _h[0], setError = _h[1];
    var _j = (0, react_1.useState)('overview'), activeTab = _j[0], setActiveTab = _j[1];
    var _k = (0, react_1.useState)(0), compressionProgress = _k[0], setCompressionProgress = _k[1];
    var _l = (0, react_1.useState)(false), isCompressing = _l[0], setIsCompressing = _l[1];
    // Form states
    var _m = (0, react_1.useState)({ title: '', url: '', tags: '' }), newBookmark = _m[0], setNewBookmark = _m[1];
    var _o = (0, react_1.useState)(null), uploadFile = _o[0], setUploadFile = _o[1];
    var _p = (0, react_1.useState)({}), preferences = _p[0], setPreferences = _p[1];
    (0, react_1.useEffect)(function () {
        loadZedCore();
    }, [userId]);
    var loadZedCore = function () { return __awaiter(void 0, void 0, void 0, function () {
        var userResponse, userData, adminResponse, adminData, statsResponse, statsData, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 10, 11, 12]);
                    setLoading(true);
                    setError(null);
                    return [4 /*yield*/, fetch("/api/zed/memory/".concat(userId), {
                            headers: { 'x-user-id': userId }
                        })];
                case 1:
                    userResponse = _a.sent();
                    if (!userResponse.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, userResponse.json()];
                case 2:
                    userData = _a.sent();
                    setUserCore(userData);
                    setPreferences(userData.preferences);
                    _a.label = 3;
                case 3: return [4 /*yield*/, fetch('/api/zed/memory/admin', {
                        headers: { 'x-user-id': userId }
                    })];
                case 4:
                    adminResponse = _a.sent();
                    if (!adminResponse.ok) return [3 /*break*/, 6];
                    return [4 /*yield*/, adminResponse.json()];
                case 5:
                    adminData = _a.sent();
                    setAdminCore(adminData);
                    _a.label = 6;
                case 6: return [4 /*yield*/, fetch("/api/zed/memory/".concat(userId, "/stats"), {
                        headers: { 'x-user-id': userId }
                    })];
                case 7:
                    statsResponse = _a.sent();
                    if (!statsResponse.ok) return [3 /*break*/, 9];
                    return [4 /*yield*/, statsResponse.json()];
                case 8:
                    statsData = _a.sent();
                    setMemoryStats(statsData);
                    _a.label = 9;
                case 9: return [3 /*break*/, 12];
                case 10:
                    err_1 = _a.sent();
                    setError(err_1.message);
                    return [3 /*break*/, 12];
                case 11:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 12: return [2 /*return*/];
            }
        });
    }); };
    var handleCompress = function () { return __awaiter(void 0, void 0, void 0, function () {
        var progressInterval, response, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    setIsCompressing(true);
                    setCompressionProgress(0);
                    progressInterval = setInterval(function () {
                        setCompressionProgress(function (prev) { return Math.min(prev + 10, 90); });
                    }, 200);
                    return [4 /*yield*/, fetch("/api/zed/memory/".concat(userId, "/compress"), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': userId
                            }
                        })];
                case 1:
                    response = _a.sent();
                    clearInterval(progressInterval);
                    setCompressionProgress(100);
                    if (!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, loadZedCore()];
                case 2:
                    _a.sent(); // Reload data
                    setTimeout(function () {
                        setIsCompressing(false);
                        setCompressionProgress(0);
                    }, 1000);
                    return [3 /*break*/, 4];
                case 3: throw new Error('Compression failed');
                case 4: return [3 /*break*/, 6];
                case 5:
                    err_2 = _a.sent();
                    setError(err_2.message);
                    setIsCompressing(false);
                    setCompressionProgress(0);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var handleAddBookmark = function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, fetch("/api/zed/memory/".concat(userId, "/bookmarks"), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': userId
                            },
                            body: JSON.stringify({
                                title: newBookmark.title,
                                url: newBookmark.url,
                                tags: newBookmark.tags.split(',').map(function (t) { return t.trim(); })
                            })
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) return [3 /*break*/, 3];
                    setNewBookmark({ title: '', url: '', tags: '' });
                    return [4 /*yield*/, loadZedCore()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3: throw new Error('Failed to add bookmark');
                case 4: return [3 /*break*/, 6];
                case 5:
                    err_3 = _a.sent();
                    setError(err_3.message);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var handleFileUpload = function () { return __awaiter(void 0, void 0, void 0, function () {
        var formData, response, err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!uploadFile)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 6, , 7]);
                    formData = new FormData();
                    formData.append('file', uploadFile);
                    formData.append('userId', userId);
                    return [4 /*yield*/, fetch("/api/zed/memory/".concat(userId, "/upload"), {
                            method: 'POST',
                            headers: { 'x-user-id': userId },
                            body: formData
                        })];
                case 2:
                    response = _a.sent();
                    if (!response.ok) return [3 /*break*/, 4];
                    setUploadFile(null);
                    return [4 /*yield*/, loadZedCore()];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4: throw new Error('Upload failed');
                case 5: return [3 /*break*/, 7];
                case 6:
                    err_4 = _a.sent();
                    setError(err_4.message);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var handleUpdatePreferences = function () { return __awaiter(void 0, void 0, void 0, function () {
        var response, err_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    return [4 /*yield*/, fetch("/api/zed/memory/".concat(userId, "/preferences"), {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-user-id': userId
                            },
                            body: JSON.stringify(preferences)
                        })];
                case 1:
                    response = _a.sent();
                    if (!response.ok) return [3 /*break*/, 3];
                    return [4 /*yield*/, loadZedCore()];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3: throw new Error('Failed to update preferences');
                case 4: return [3 /*break*/, 6];
                case 5:
                    err_5 = _a.sent();
                    setError(err_5.message);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var formatBytes = function (bytes) {
        if (bytes === 0)
            return '0 Bytes';
        var k = 1024;
        var sizes = ['Bytes', 'KB', 'MB', 'GB'];
        var i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    if (loading) {
        return (<div className="flex items-center justify-center h-64">
        <div className="text-center">
          <lucide_react_1.Brain className="h-8 w-8 animate-spin mx-auto mb-2"/>
          <p>Loading ZED Core...</p>
        </div>
      </div>);
    }
    return (<div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <lucide_react_1.Brain className="h-8 w-8 text-blue-600"/>
            ZED Core Memory
          </h1>
          <p className="text-gray-600 mt-1">
            Personal AI memory and knowledge management
          </p>
        </div>
        <div className="flex gap-2">
          <button_1.Button onClick={handleCompress} disabled={isCompressing} variant="outline">
            <Compress className="h-4 w-4 mr-2"/>
            {isCompressing ? 'Compressing...' : 'Compress Memory'}
          </button_1.Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (<alert_1.Alert variant="destructive">
          <lucide_react_1.AlertCircle className="h-4 w-4"/>
          <alert_1.AlertDescription>{error}</alert_1.AlertDescription>
        </alert_1.Alert>)}

      {/* Compression Progress */}
      {isCompressing && (<card_1.Card>
          <card_1.CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Compressing memory...</span>
                <span>{compressionProgress}%</span>
              </div>
              <progress_1.Progress value={compressionProgress}/>
            </div>
          </card_1.CardContent>
        </card_1.Card>)}

      {/* Main Content */}
      <tabs_1.Tabs value={activeTab} onValueChange={setActiveTab}>
        <tabs_1.TabsList className="grid w-full grid-cols-6">
          <tabs_1.TabsTrigger value="overview">Overview</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="conversations">Conversations</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="uploads">Uploads</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="generations">Generations</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="bookmarks">Bookmarks</tabs_1.TabsTrigger>
          <tabs_1.TabsTrigger value="settings">Settings</tabs_1.TabsTrigger>
        </tabs_1.TabsList>

        {/* Overview Tab */}
        <tabs_1.TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Memory Stats */}
            <card_1.Card>
              <card_1.CardHeader>
                <card_1.CardTitle className="text-lg">Memory Statistics</card_1.CardTitle>
              </card_1.CardHeader>
              <card_1.CardContent className="space-y-4">
                {memoryStats && (<>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Conversations</p>
                        <p className="font-semibold">{memoryStats.totalConversations}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Uploads</p>
                        <p className="font-semibold">{memoryStats.totalUploads}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Generations</p>
                        <p className="font-semibold">{memoryStats.totalGenerations}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Bookmarks</p>
                        <p className="font-semibold">{memoryStats.totalBookmarks}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <p className="text-gray-600 text-sm">Memory Size</p>
                      <p className="font-semibold">{formatBytes(memoryStats.memorySize)}</p>
                    </div>
                  </>)}
              </card_1.CardContent>
            </card_1.Card>

            {/* Admin Core Summary */}
            {adminCore && (<card_1.Card>
                <card_1.CardHeader>
                  <card_1.CardTitle className="text-lg">Admin ZED Core</card_1.CardTitle>
                  <card_1.CardDescription>Base template and knowledge</card_1.CardDescription>
                </card_1.CardHeader>
                <card_1.CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Version</p>
                    <badge_1.Badge variant="secondary">{adminCore.version}</badge_1.Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Default Modules</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {adminCore.defaultModules.map(function (module) { return (<badge_1.Badge key={module} variant="outline" className="text-xs">
                          {module}
                        </badge_1.Badge>); })}
                    </div>
                  </div>
                  <button_1.Button variant="outline" size="sm" className="w-full">
                    <lucide_react_1.Eye className="h-3 w-3 mr-1"/>
                    View Details
                  </button_1.Button>
                </card_1.CardContent>
              </card_1.Card>)}

            {/* User Core Info */}
            {userCore && (<card_1.Card>
                <card_1.CardHeader>
                  <card_1.CardTitle className="text-lg">Your ZED Instance</card_1.CardTitle>
                  <card_1.CardDescription>Personal AI core</card_1.CardDescription>
                </card_1.CardHeader>
                <card_1.CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600">Created</p>
                    <p className="text-sm">{new Date(userCore.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Last Updated</p>
                    <p className="text-sm">{new Date(userCore.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Roles</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {userCore.roles.map(function (role) { return (<badge_1.Badge key={role.id} variant="outline" className="text-xs">
                          {role.name}
                        </badge_1.Badge>); })}
                    </div>
                  </div>
                </card_1.CardContent>
              </card_1.Card>)}
          </div>
        </tabs_1.TabsContent>

        {/* Conversations Tab */}
        <tabs_1.TabsContent value="conversations" className="space-y-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Conversation History</card_1.CardTitle>
              <card_1.CardDescription>
                Your chat history and threaded conversations
              </card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent>
              {(userCore === null || userCore === void 0 ? void 0 : userCore.conversations.length) ? (<div className="space-y-3">
                  {userCore.conversations.slice(0, 10).map(function (conversation) { return (<div key={conversation.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{conversation.title}</h4>
                          <p className="text-sm text-gray-600">Route: {conversation.route}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {conversation.messages.length} messages • 
                            Updated {new Date(conversation.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button_1.Button variant="ghost" size="sm">
                          <lucide_react_1.MessageSquare className="h-4 w-4"/>
                        </button_1.Button>
                      </div>
                    </div>); })}
                  {userCore.conversations.length > 10 && (<p className="text-center text-sm text-gray-500">
                      ... and {userCore.conversations.length - 10} more conversations
                    </p>)}
                </div>) : (<p className="text-center text-gray-500 py-8">
                  No conversations yet. Start chatting to build your memory!
                </p>)}
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>

        {/* Uploads Tab */}
        <tabs_1.TabsContent value="uploads" className="space-y-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>File Uploads</card_1.CardTitle>
              <card_1.CardDescription>
                Your uploaded images and documents
              </card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent className="space-y-4">
              {/* Upload Form */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <div className="text-center space-y-2">
                  <lucide_react_1.Upload className="h-8 w-8 mx-auto text-gray-400"/>
                  <div>
                    <label_1.Label htmlFor="file-upload" className="cursor-pointer">
                      <span className="text-blue-600 hover:text-blue-500">Upload a file</span>
                      <input_1.Input id="file-upload" type="file" className="hidden" onChange={function (e) { var _a; return setUploadFile(((_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0]) || null); }} accept="image/*,.pdf,.txt,.md,.json,.csv"/>
                    </label_1.Label>
                    <p className="text-xs text-gray-500">
                      Images, PDFs, text files up to 50MB
                    </p>
                  </div>
                  {uploadFile && (<div className="mt-2">
                      <p className="text-sm">{uploadFile.name}</p>
                      <button_1.Button onClick={handleFileUpload} size="sm" className="mt-2">
                        Upload
                      </button_1.Button>
                    </div>)}
                </div>
              </div>

              {/* Uploaded Files */}
              {(userCore === null || userCore === void 0 ? void 0 : userCore.uploads.length) ? (<div className="space-y-2">
                  {userCore.uploads.slice(0, 10).map(function (upload) { return (<div key={upload.id} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <p className="font-medium text-sm">{upload.filename}</p>
                        <p className="text-xs text-gray-500">
                          {upload.type} • {new Date(upload.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <button_1.Button variant="ghost" size="sm">
                        <lucide_react_1.Download className="h-4 w-4"/>
                      </button_1.Button>
                    </div>); })}
                </div>) : (<p className="text-center text-gray-500 py-4">
                  No uploads yet
                </p>)}
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>

        {/* Generations Tab */}
        <tabs_1.TabsContent value="generations" className="space-y-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Generated Content</card_1.CardTitle>
              <card_1.CardDescription>
                AI-generated documents, code, and analyses
              </card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent>
              {(userCore === null || userCore === void 0 ? void 0 : userCore.generations.length) ? (<div className="space-y-3">
                  {userCore.generations.slice(0, 10).map(function (generation) { return (<div key={generation.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-medium">{generation.title}</h4>
                          <badge_1.Badge variant="secondary" className="text-xs">
                            {generation.type}
                          </badge_1.Badge>
                          <p className="text-xs text-gray-500 mt-1">
                            Generated {new Date(generation.generatedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <button_1.Button variant="ghost" size="sm">
                          <lucide_react_1.Download className="h-4 w-4"/>
                        </button_1.Button>
                      </div>
                    </div>); })}
                </div>) : (<p className="text-center text-gray-500 py-8">
                  No generated content yet
                </p>)}
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>

        {/* Bookmarks Tab */}
        <tabs_1.TabsContent value="bookmarks" className="space-y-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>Bookmarks</card_1.CardTitle>
              <card_1.CardDescription>
                Saved links and content for quick access
              </card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent className="space-y-4">
              {/* Add Bookmark Form */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-medium">Add Bookmark</h4>
                <div className="grid grid-cols-1 gap-3">
                  <input_1.Input placeholder="Bookmark title" value={newBookmark.title} onChange={function (e) { return setNewBookmark(function (prev) { return (__assign(__assign({}, prev), { title: e.target.value })); }); }}/>
                  <input_1.Input placeholder="URL" value={newBookmark.url} onChange={function (e) { return setNewBookmark(function (prev) { return (__assign(__assign({}, prev), { url: e.target.value })); }); }}/>
                  <input_1.Input placeholder="Tags (comma separated)" value={newBookmark.tags} onChange={function (e) { return setNewBookmark(function (prev) { return (__assign(__assign({}, prev), { tags: e.target.value })); }); }}/>
                  <button_1.Button onClick={handleAddBookmark} disabled={!newBookmark.title}>
                    <lucide_react_1.BookmarkPlus className="h-4 w-4 mr-2"/>
                    Add Bookmark
                  </button_1.Button>
                </div>
              </div>

              {/* Bookmarks List */}
              {(userCore === null || userCore === void 0 ? void 0 : userCore.bookmarks.length) ? (<div className="space-y-2">
                  {userCore.bookmarks.map(function (bookmark) { return (<div key={bookmark.id} className="border rounded-lg p-3">
                      <h4 className="font-medium">{bookmark.title}</h4>
                      {bookmark.url && (<p className="text-sm text-blue-600 hover:underline cursor-pointer">
                          {bookmark.url}
                        </p>)}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {bookmark.tags.map(function (tag) { return (<badge_1.Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </badge_1.Badge>); })}
                      </div>
                    </div>); })}
                </div>) : (<p className="text-center text-gray-500 py-4">
                  No bookmarks yet
                </p>)}
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>

        {/* Settings Tab */}
        <tabs_1.TabsContent value="settings" className="space-y-4">
          <card_1.Card>
            <card_1.CardHeader>
              <card_1.CardTitle>ZED Preferences</card_1.CardTitle>
              <card_1.CardDescription>
                Customize your AI's behavior and appearance
              </card_1.CardDescription>
            </card_1.CardHeader>
            <card_1.CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label_1.Label htmlFor="theme">Theme</label_1.Label>
                  <select id="theme" className="w-full p-2 border rounded" value={preferences.theme || 'light'} onChange={function (e) { return setPreferences(function (prev) { return (__assign(__assign({}, prev), { theme: e.target.value })); }); }}>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>
                <div>
                  <label_1.Label htmlFor="language">Language</label_1.Label>
                  <select id="language" className="w-full p-2 border rounded" value={preferences.language || 'en'} onChange={function (e) { return setPreferences(function (prev) { return (__assign(__assign({}, prev), { language: e.target.value })); }); }}>
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </select>
                </div>
                <div>
                  <label_1.Label htmlFor="responseStyle">Response Style</label_1.Label>
                  <select id="responseStyle" className="w-full p-2 border rounded" value={preferences.responseStyle || 'concise'} onChange={function (e) { return setPreferences(function (prev) { return (__assign(__assign({}, prev), { responseStyle: e.target.value })); }); }}>
                    <option value="concise">Concise</option>
                    <option value="detailed">Detailed</option>
                    <option value="creative">Creative</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label_1.Label htmlFor="customPrompts">Custom System Prompt</label_1.Label>
                <textarea_1.Textarea id="customPrompts" placeholder="Add custom instructions for your ZED..." value={((_b = preferences.customPrompts) === null || _b === void 0 ? void 0 : _b.system) || ''} onChange={function (e) { return setPreferences(function (prev) { return (__assign(__assign({}, prev), { customPrompts: __assign(__assign({}, prev.customPrompts), { system: e.target.value }) })); }); }} rows={4}/>
              </div>

              <button_1.Button onClick={handleUpdatePreferences}>
                <lucide_react_1.Settings className="h-4 w-4 mr-2"/>
                Save Preferences
              </button_1.Button>
            </card_1.CardContent>
          </card_1.Card>
        </tabs_1.TabsContent>
      </tabs_1.Tabs>
    </div>);
};
exports.ZedCorePage = ZedCorePage;
