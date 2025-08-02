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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var button_1 = require("@/components/ui/button");
var ____try__1 = require("@/    try {");
var targetUser = username || (user === null || user === void 0 ? void 0 : user.username) || 'sample-user';
var response = await (0, queryClient_1.apiRequest)("/api/zed/memory/".concat(targetUser), {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
});
if (response.ok) {
    var data = await response.json();
    setMemoryData(data);
}
else if (response.status === 403) {
    setError('Access denied: You can only view your own memory or admin memories.');
}
else {
    setError('Failed to load memory data');
}
try { }
catch (err) {
    /badge';
    import { Input } from '@/components/ui/input';
    import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
    import { ScrollArea } from '@/components/ui/scroll-area';
    import { Brain, Search, Heart, Calendar, MessageSquare, X, ChevronDown, ChevronRight, Clock, Database, User, Lock } from 'lucide-react';
    import { apiRequest } from '@/lib/queryClient';
    import { useAuth } from '@/hooks/useAuth';
    import type { User as UserType } from '@/types/auth';
    function MemoryPanel(_a) {
        var _this = this;
        var isOpen = _a.isOpen, onClose = _a.onClose, username = _a.username;
        var _b = (0, react_1.useState)(null), memoryData = _b[0], setMemoryData = _b[1];
        var _c = (0, react_1.useState)(''), searchTerm = _c[0], setSearchTerm = _c[1];
        var _d = (0, react_1.useState)(false), showFavoritesOnly = _d[0], setShowFavoritesOnly = _d[1];
        var _e = (0, react_1.useState)(null), expandedEntry = _e[0], setExpandedEntry = _e[1];
        var _f = (0, react_1.useState)(false), isLoading = _f[0], setIsLoading = _f[1];
        var _g = (0, react_1.useState)(null), error = _g[0], setError = _g[1];
        var user = (0, useAuth_1.useAuth)().user;
        // Load memory data when panel opens
        (0, react_1.useEffect)(function () {
            if (isOpen && username) {
                loadMemoryData();
            }
        }, [isOpen, username]);
        var loadMemoryData = function () { return __awaiter(_this, void 0, void 0, function () {
            var targetUser_1, response_1, data, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setIsLoading(true);
                        setError(null);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, 7, 8]);
                        targetUser_1 = username || (user === null || user === void 0 ? void 0 : user.username) || 'sample-user';
                        return [4 /*yield*/, (0, queryClient_1.apiRequest)("/api/zed/memory/".concat(targetUser_1))];
                    case 2:
                        response_1 = _a.sent();
                        if (!response_1.ok) return [3 /*break*/, 4];
                        return [4 /*yield*/, response_1.json()];
                    case 3:
                        data = _a.sent();
                        setMemoryData(data);
                        return [3 /*break*/, 5];
                    case 4:
                        if (response_1.status === 403) {
                            setError('Access denied: You can only view your own memory or admin memories.');
                        }
                        else {
                            setError('Failed to load memory data');
                        }
                        _a.label = 5;
                    case 5: return [3 /*break*/, 8];
                    case 6:
                        err_1 = _a.sent();
                        setError('Error loading memory: ' + err_1.message);
                        return [3 /*break*/, 8];
                    case 7:
                        setIsLoading(false);
                        return [7 /*endfinally*/];
                    case 8: return [2 /*return*/];
                }
            });
        }); };
        // Combine all data sources for unified search
        var allEntries = memoryData ? __spreadArray(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], memoryData.conversations.map(function (conv) { return ({
            id: conv.id,
            title: conv.title,
            type: 'conversation',
            date: conv.updatedAt,
            content: conv.messages.map(function (m) { return m.content; }).join(' ').substring(0, 500),
            isFavorited: false, // TODO: Implement favorites
            messages: conv.messages,
            route: conv.route
        }); }), true), memoryData.memoryEntries.map(function (entry) { return ({
            id: entry.id,
            title: "".concat(entry.type.charAt(0).toUpperCase() + entry.type.slice(1), " Entry"),
            type: entry.type,
            date: entry.timestamp,
            content: typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content).substring(0, 500),
            isFavorited: false, // TODO: Implement favorites
            metadata: entry.metadata
        }); }), true), memoryData.bookmarks.map(function (bookmark) { return ({
            id: bookmark.id,
            title: bookmark.title,
            type: 'bookmark',
            date: bookmark.createdAt,
            content: bookmark.content || bookmark.url || '',
            isFavorited: true, // Bookmarks are inherently favorited
            url: bookmark.url,
            tags: bookmark.tags
        }); }), true), memoryData.uploads.map(function (upload) { return ({
            id: upload.id,
            title: upload.filename,
            type: 'upload',
            date: upload.uploadedAt,
            content: "File: ".concat(upload.filename, " (").concat(upload.type, ")"),
            isFavorited: false,
            filename: upload.filename,
            path: upload.path,
            fileType: upload.type
        }); }), true), memoryData.generations.map(function (gen) { return ({
            id: gen.id,
            title: gen.title,
            type: 'generation',
            date: gen.generatedAt,
            content: gen.prompt,
            isFavorited: false,
            prompt: gen.prompt,
            generationType: gen.type
        }); }), true) : [];
        // Filter entries based on search and favorites
        var filteredEntries = allEntries.filter(function (entry) {
            var matchesSearch = !searchTerm ||
                entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.type.toLowerCase().includes(searchTerm.toLowerCase());
            var matchesFavorites = !showFavoritesOnly || entry.isFavorited;
            return matchesSearch && matchesFavorites;
        });
        var formatFileSize = function (sizeInBytes) {
            if (sizeInBytes < 1024)
                return "".concat(sizeInBytes, " B");
            if (sizeInBytes < 1024 * 1024)
                return "".concat((sizeInBytes / 1024).toFixed(1), " KB");
            return "".concat((sizeInBytes / (1024 * 1024)).toFixed(1), " MB");
        };
        var toggleFavorite = function (entryId) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                // TODO: Implement favorite toggle API call
                console.log('Toggle favorite for entry:', entryId);
                return [2 /*return*/];
            });
        }); };
        if (!isOpen)
            return null;
        return (<div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-background border-l border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-purple-500/10 to-pink-500/10">
          <div className="flex items-center space-x-3">
            <lucide_react_1.Brain className="h-6 w-6 text-purple-400"/>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                ZED Memory
              </h2>
              <p className="text-sm text-muted-foreground">
                {username ? "".concat(username, "'s Memory Core") : 'Personal Memory Core'}
              </p>
            </div>
          </div>
          <button_1.Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full">
            <lucide_react_1.X className="h-4 w-4"/>
          </button_1.Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (<div className="flex items-center justify-center h-full">
              <div className="text-center">
                <lucide_react_1.Brain className="h-12 w-12 text-purple-400 animate-pulse mx-auto mb-4"/>
                <p className="text-muted-foreground">Loading memory data...</p>
              </div>
            </div>) : error ? (<div className="flex items-center justify-center h-full">
              <div className="text-center text-red-400">
                <lucide_react_1.Lock className="h-12 w-12 mx-auto mb-4"/>
                <p>{error}</p>
              </div>
            </div>) : memoryData ? (<div className="h-full flex flex-col">
              {/* Summary Panel */}
              <div className="p-4 bg-muted/20 border-b border-border">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-purple-400">
                      {allEntries.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Entries</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-pink-400">
                      {formatFileSize(JSON.stringify(memoryData).length)}
                    </div>
                    <div className="text-xs text-muted-foreground">Memory Size</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-cyan-400">
                      {new Date(memoryData.updatedAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-muted-foreground">Last Updated</div>
                  </div>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="p-4 border-b border-border space-y-3">
                <div className="relative">
                  <lucide_react_1.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                  <input_1.Input placeholder="Search memories..." value={searchTerm} onChange={function (e) { return setSearchTerm(e.target.value); }} className="pl-10"/>
                </div>
                <div className="flex items-center justify-between">
                  <button_1.Button variant={showFavoritesOnly ? "secondary" : "ghost"} size="sm" onClick={function () { return setShowFavoritesOnly(!showFavoritesOnly); }} className="text-xs">
                    <lucide_react_1.Heart className={"h-3 w-3 mr-1 ".concat(showFavoritesOnly ? 'fill-current' : '')}/>
                    Favorites Only
                  </button_1.Button>
                  <____try__1.Badge variant="outline" className="text-xs">
                    {filteredEntries.length} entries
                  </____try__1.Badge>
                </div>
              </div>

              {/* Memory Entries */}
              <scroll_area_1.ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {filteredEntries.map(function (entry) { return (<card_1.Card key={entry.id} className="border-border/50 hover:border-purple-500/30 transition-colors">
                      <card_1.CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <button_1.Button variant="ghost" size="sm" onClick={function () { return setExpandedEntry(expandedEntry === entry.id ? null : entry.id); }} className="h-6 w-6 p-0">
                                {expandedEntry === entry.id ?
                        <lucide_react_1.ChevronDown className="h-3 w-3"/> :
                        <lucide_react_1.ChevronRight className="h-3 w-3"/>}
                              </button_1.Button>
                              <card_1.CardTitle className="text-sm">{entry.title}</card_1.CardTitle>
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <____try__1.Badge variant="outline" className="text-xs">
                                {entry.type}
                              </____try__1.Badge>
                              <div className="flex items-center text-xs text-muted-foreground">
                                <lucide_react_1.Calendar className="h-3 w-3 mr-1"/>
                                {new Date(entry.date).toLocaleDateString()}
                              </div>
                              {entry.type === 'conversation' && 'messages' in entry && entry.messages && (<div className="flex items-center text-xs text-muted-foreground">
                                  <lucide_react_1.MessageSquare className="h-3 w-3 mr-1"/>
                                  {entry.messages.length} messages
                                </div>)}
                            </div>
                          </div>
                          <button_1.Button variant="ghost" size="sm" onClick={function () { return toggleFavorite(entry.id); }} className="h-6 w-6 p-0">
                            <lucide_react_1.Heart className={"h-3 w-3 ".concat(entry.isFavorited ? 'fill-current text-red-400' : '')}/>
                          </button_1.Button>
                        </div>
                      </card_1.CardHeader>
                      
                      <card_1.CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {entry.content.substring(0, 150)}...
                        </p>
                        
                        {expandedEntry === entry.id && (<div className="mt-4 pt-4 border-t border-border/50">
                            <div className="space-y-3">
                              <div>
                                <h4 className="text-sm font-medium mb-2">
                                  {entry.type === 'conversation' ? 'Messages:' : 'Content:'}
                                </h4>
                                
                                {entry.type === 'conversation' && 'messages' in entry && entry.messages ? (<div className="space-y-2 max-h-64 overflow-y-auto">
                                    {entry.messages.map(function (msg, idx) { return (<div key={idx} className={"text-xs p-2 rounded ".concat(msg.role === 'user'
                                    ? 'bg-blue-500/10 border-l-2 border-blue-500'
                                    : 'bg-purple-500/10 border-l-2 border-purple-500')}>
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-medium capitalize">{msg.role}</span>
                                          <span className="text-muted-foreground">
                                            {new Date(msg.timestamp).toLocaleTimeString()}
                                          </span>
                                        </div>
                                        <div className="text-muted-foreground">
                                          {msg.content.substring(0, 300)}
                                          {msg.content.length > 300 && '...'}
                                        </div>
                                      </div>); })}
                                  </div>) : (<div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
                                    {entry.content}
                                  </div>)}
                              </div>
                              
                              {/* Additional metadata based on entry type */}
                              {entry.type === 'bookmark' && entry.url && (<div>
                                  <h4 className="text-sm font-medium mb-1">URL:</h4>
                                  <a href={entry.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline">
                                    {entry.url}
                                  </a>
                                </div>)}
                              
                              {entry.type === 'upload' && (<div>
                                  <h4 className="text-sm font-medium mb-1">File Info:</h4>
                                  <div className="text-xs text-muted-foreground">
                                    Type: {entry.fileType}<br />
                                    Path: {entry.path}
                                  </div>
                                </div>)}
                              
                              {entry.type === 'generation' && (<div>
                                  <h4 className="text-sm font-medium mb-1">Generation Type:</h4>
                                  <____try__1.Badge variant="outline" className="text-xs">
                                    {entry.generationType}
                                  </____try__1.Badge>
                                </div>)}
                            </div>
                          </div>)}
                      </card_1.CardContent>
                    </card_1.Card>); })}
                  
                  {filteredEntries.length === 0 && (<div className="text-center py-12">
                      <lucide_react_1.Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4"/>
                      <p className="text-muted-foreground">
                        {searchTerm || showFavoritesOnly
                        ? 'No memories match your filters'
                        : 'No memories found'}
                      </p>
                    </div>)}
                </div>
              </scroll_area_1.ScrollArea>
            </div>) : (<div className="flex items-center justify-center h-full">
              <div className="text-center">
                <lucide_react_1.Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4"/>
                <p className="text-muted-foreground">No memory data available</p>
              </div>
            </div>)}
        </div>
      </div>
    </div>);
    }
}
