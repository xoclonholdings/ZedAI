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
exports.default = ChatSidebar;
var react_1 = require("react");
var button_1 = require("@/components/ui/button");
var use_toast_1 = require("@/hooks/use-toast");
var badge_1 = require("@/components/ui/badge");
var lucide_react_1 = require("lucide-react");
var zLogoPath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iemVkR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTg1NWY3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMwOGNmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZWI0ODk5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0idXJsKCN6ZWRHcmFkaWVudCkiLz4KICA8cGF0aCBkPSJNOCAxMmgyMGwtMTIgOGgyMHYzSDE0bDEyLThIOHYtM3oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPgo8L3N2Zz4K";
var wouter_1 = require("wouter");
var react_query_1 = require("@tanstack/react-query");
var useAuth_1 = require("@/hooks/useAuth");
var queryClient_1 = require("@/lib/queryClient");
var LogoutButton_1 = require("@/components/auth/LogoutButton");
function ChatSidebar(_a) {
    var _this = this;
    var _b = _a.conversations, conversations = _b === void 0 ? [] : _b, onClose = _a.onClose, _c = _a.isMobile, isMobile = _c === void 0 ? false : _c, onMenuClick = _a.onMenuClick;
    var location = (0, wouter_1.useLocation)()[0];
    var queryClient = (0, react_query_1.useQueryClient)();
    var _d = (0, react_1.useState)(false), isCollapsed = _d[0], setIsCollapsed = _d[1];
    var _e = (0, react_1.useState)(false), isUploadingPicture = _e[0], setIsUploadingPicture = _e[1];
    var _f = (0, react_1.useState)(false), showSettings = _f[0], setShowSettings = _f[1];
    var _g = (0, react_1.useState)("chat"), currentMode = _g[0], setCurrentMode = _g[1];
    var _h = (0, react_1.useState)(true), notifications = _h[0], setNotifications = _h[1];
    var _j = (0, react_1.useState)(true), darkMode = _j[0], setDarkMode = _j[1];
    var _k = (0, react_1.useState)(false), dataSharing = _k[0], setDataSharing = _k[1];
    var _l = (0, react_1.useState)(true), analytics = _l[0], setAnalytics = _l[1];
    var user = (0, useAuth_1.useAuth)().user;
    var toast = (0, use_toast_1.useToast)().toast;
    var createConversationMutation = (0, react_query_1.useMutation)({
        mutationFn: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, queryClient_1.apiRequest)("/api/conversations", "POST", {
                            title: "New Conversation",
                            mode: "chat"
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        onSuccess: function (data) {
            queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
            window.history.pushState({}, '', "/chat/".concat(data.id));
        },
    });
    var deleteConversationMutation = (0, react_query_1.useMutation)({
        mutationFn: function (id) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, queryClient_1.apiRequest)("/api/conversations/".concat(id), "DELETE")];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        onSuccess: function () {
            queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
        },
    });
    var formatDate = function (dateInput) {
        if (!dateInput)
            return "";
        var date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        var now = new Date();
        var diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
        if (diffInHours < 24) {
            return "Today";
        }
        else if (diffInHours < 168) {
            return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
        }
        else {
            return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
        }
    };
    var handleDeleteConversation = function (e, id) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    e.stopPropagation();
                    return [4 /*yield*/, deleteConversationMutation.mutateAsync(id)];
                case 1:
                    _a.sent();
                    if (location.includes(id)) {
                        window.history.pushState({}, '', '/chat');
                    }
                    return [2 /*return*/];
            }
        });
    }); };
    if (isCollapsed) {
        return (<div className="w-16 flex flex-col items-center py-4 space-y-4 zed-glass border-r border-white/10 backdrop-blur-xl">
        <button_1.Button onClick={function () { return setIsCollapsed(false); }} variant="ghost" size="sm" className="w-10 h-10 zed-button rounded-xl">
          <lucide_react_1.MessageSquare size={20}/>
        </button_1.Button>
        
        <button_1.Button onClick={function () { return createConversationMutation.mutate(); }} className="w-10 h-10 zed-gradient rounded-xl zed-button p-0" disabled={createConversationMutation.isPending}>
          <lucide_react_1.Plus size={20}/>
        </button_1.Button>

        {/* Collapsed Status */}
        <div className="w-full">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>);
    }
    return (<div className={"".concat(isMobile ? 'w-full h-screen-mobile' : 'w-80 h-full', " flex flex-col relative zed-glass ").concat(isMobile ? '' : 'border-r', " border-purple-500/30 backdrop-blur-xl")}>
      {/* Cyberpunk Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-4 w-20 h-20 bg-purple-600/10 rounded-full blur-2xl zed-float"/>
        <div className="absolute bottom-20 right-4 w-16 h-16 bg-cyan-500/10 rounded-full blur-xl zed-float" style={{ animationDelay: '3s' }}/>
      </div>

      {/* Header */}
      <div className="p-2 sm:p-3 border-b border-white/10 relative z-10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {/* Logo Button - Compact and Clickable */}
            <button_1.Button variant="ghost" size="sm" className="w-10 h-10 p-1.5 rounded-lg hover:bg-gradient-to-r hover:from-pink-500/20 hover:via-purple-500/20 hover:to-blue-500/20 transition-all duration-300 hover:scale-105 border border-transparent hover:border-purple-500/50" onClick={function (e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('ZED logo button clicked!', { isMobile: isMobile, onClose: onClose, onMenuClick: onMenuClick });
            if (isMobile && onClose) {
                onClose();
            }
            else if (onMenuClick) {
                onMenuClick();
            }
        }}>
              <img src={zLogoPath} alt="Z" className="w-6 h-6"/>
            </button_1.Button>
            
            <div className="text-left">
              <h1 className="text-sm font-bold">
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">ZED</span>
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">AI Assistant</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <LogoutButton_1.default />
            {isMobile ? (<button_1.Button onClick={onClose} variant="ghost" size="sm" className="w-8 h-8 zed-button rounded-lg p-0 text-muted-foreground hover:text-foreground">
                <lucide_react_1.X size={14}/>
              </button_1.Button>) : (<button_1.Button onClick={function () { return setIsCollapsed(true); }} variant="ghost" size="sm" className="w-8 h-8 zed-button rounded-lg p-0 text-muted-foreground hover:text-foreground">
                <lucide_react_1.X size={14}/>
              </button_1.Button>)}
          </div>
        </div>

        {/* Compact New Chat Button */}
        <button_1.Button onClick={function () { return createConversationMutation.mutate(); }} disabled={createConversationMutation.isPending} className="w-full h-9 zed-gradient rounded-lg text-white font-medium transition-all duration-300 text-sm">
          <div className="flex items-center justify-center space-x-1.5">
            <lucide_react_1.Plus size={14}/>
            <span>New Chat</span>
            <lucide_react_1.Sparkles size={12} className="text-cyan-300"/>
          </div>
        </button_1.Button>

        {/* Settings & Controls */}
        <div className="mt-2 space-y-1">
          {/* Chat/Agent Mode Toggle */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
            <div className="flex items-center space-x-2">
              <div className={"w-4 h-4 rounded flex items-center justify-center ".concat(currentMode === 'chat' ? 'bg-cyan-500' : 'bg-purple-500')}>
                {currentMode === 'chat' ? <lucide_react_1.MessageSquare size={10} className="text-white"/> : <lucide_react_1.Bot size={10} className="text-white"/>}
              </div>
              <span className="text-xs font-medium">{currentMode === 'chat' ? 'Chat' : 'Agent'} Mode</span>
            </div>
            <button_1.Button variant="ghost" size="sm" onClick={function () { return setCurrentMode(currentMode === 'chat' ? 'agent' : 'chat'); }} className="h-6 w-12 p-0 rounded-full bg-white/10 relative">
              <div className={"absolute w-4 h-4 bg-white rounded-full transition-transform ".concat(currentMode === 'agent' ? 'translate-x-2' : '-translate-x-2')}/>
            </button_1.Button>
          </div>

          {/* Quick Settings Row */}
          <div className="flex items-center space-x-1">
            <button_1.Button variant="ghost" size="sm" onClick={function () { return setNotifications(!notifications); }} className={"flex-1 h-8 text-xs rounded-lg transition-colors ".concat(notifications ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-muted-foreground')}>
              <lucide_react_1.Bell size={12} className="mr-1"/>
              Alerts
            </button_1.Button>
            <button_1.Button variant="ghost" size="sm" onClick={function () { return setDataSharing(!dataSharing); }} className={"flex-1 h-8 text-xs rounded-lg transition-colors ".concat(dataSharing ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-muted-foreground')}>
              <lucide_react_1.Shield size={12} className="mr-1"/>
              Privacy
            </button_1.Button>
            <button_1.Button variant="ghost" size="sm" onClick={function () { return setAnalytics(!analytics); }} className={"flex-1 h-8 text-xs rounded-lg transition-colors ".concat(analytics ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-muted-foreground')}>
              <lucide_react_1.Database size={12} className="mr-1"/>
              Data
            </button_1.Button>
          </div>
        </div>
      </div>

      {/* Chat History Section */}
      <div className="flex-1 px-2 overflow-y-auto">
        {/* Section Header */}
        <div className="flex items-center justify-between py-2 px-1">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <h3 className="text-xs font-semibold text-foreground">Recent Chats</h3>
          </div>
          <badge_1.Badge variant="secondary" className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 border-purple-500/30">
            {(conversations && conversations.length) || 0}
          </badge_1.Badge>
        </div>

        <div className="space-y-1 pb-2">
          {Array.isArray(conversations) && conversations.length === 0 ? (<div className="text-center py-4 text-muted-foreground">
              <lucide_react_1.MessageSquare size={24} className="mx-auto mb-2 opacity-50"/>
              <p className="text-xs">Your conversations will appear here</p>
            </div>) : (Array.isArray(conversations) ? conversations.map(function (conversation) {
            var isActive = location === "/chat/".concat(conversation.id) || location === "/chat/".concat(conversation.id, "/");
            var date = conversation.updatedAt || conversation.createdAt;
            return (<div key={conversation.id} className={"\n                    group relative p-2 rounded-lg cursor-pointer transition-all zed-button\n                    ".concat(isActive
                    ? 'zed-glass border-purple-500/50 shadow-md shadow-purple-500/20'
                    : 'hover:bg-white/5', "\n                  ")} onClick={function () { return window.history.pushState({}, '', "/chat/".concat(conversation.id)); }}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-medium text-foreground truncate mb-1">
                        {conversation.title || 'New Conversation'}
                      </h3>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(date)}
                        </span>
                        {conversation.mode && (<span className={"text-xs px-1.5 py-0.5 rounded-full ".concat(conversation.mode === 'agent'
                        ? 'bg-purple-500/20 text-purple-400'
                        : 'bg-cyan-500/20 text-cyan-400')}>
                            {conversation.mode}
                          </span>)}
                      </div>
                    </div>
                    
                    <button_1.Button variant="ghost" size="sm" onClick={function (e) { return handleDeleteConversation(e, conversation.id); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/20 h-auto p-1 ml-1 rounded">
                      <lucide_react_1.Trash2 size={12}/>
                    </button_1.Button>
                  </div>
                </div>);
        }) : null)}
        </div>
      </div>

      {/* Compact User Profile */}
      <div className="p-1 border-t border-white/10">
        <div className="flex items-center space-x-2">
          <div className="relative group">
            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center overflow-hidden cursor-pointer hover:scale-105 transition-transform" onClick={function () { var _a; return (_a = document.getElementById('profile-upload')) === null || _a === void 0 ? void 0 : _a.click(); }}>
              {(user === null || user === void 0 ? void 0 : user.profileImageUrl) ? (<img src={user.profileImageUrl} alt={user.firstName || "User"} className="w-full h-full object-cover"/>) : (<lucide_react_1.User size={12} className="text-white"/>)}
            </div>
            <input id="profile-upload" type="file" accept="image/*" className="hidden" disabled={isUploadingPicture} onChange={function (e) { return __awaiter(_this, void 0, void 0, function () {
            var file, formData, response, result, error, error_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                        if (!file) return [3 /*break*/, 9];
                        setIsUploadingPicture(true);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 7, 8, 9]);
                        formData = new FormData();
                        formData.append('profilePicture', file);
                        return [4 /*yield*/, fetch('/api/auth/profile-picture', {
                                method: 'POST',
                                body: formData,
                            })];
                    case 2:
                        response = _b.sent();
                        if (!response.ok) return [3 /*break*/, 4];
                        return [4 /*yield*/, response.json()];
                    case 3:
                        result = _b.sent();
                        toast({
                            title: "Profile picture updated",
                            description: "Your profile picture has been successfully updated!",
                        });
                        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, response.json()];
                    case 5:
                        error = _b.sent();
                        throw new Error(error.error || 'Upload failed');
                    case 6: return [3 /*break*/, 9];
                    case 7:
                        error_1 = _b.sent();
                        console.error('Upload error:', error_1);
                        toast({
                            title: "Upload failed",
                            description: error_1 instanceof Error ? error_1.message : "Failed to upload profile picture. Please try again.",
                            variant: "destructive",
                        });
                        return [3 /*break*/, 9];
                    case 8:
                        setIsUploadingPicture(false);
                        // Reset the input so the same file can be selected again
                        e.target.value = '';
                        return [7 /*endfinally*/];
                    case 9: return [2 /*return*/];
                }
            });
        }); }}/>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center border border-black group-hover:bg-purple-400 transition-colors">
              {isUploadingPicture ? (<div className="w-2 h-2 border border-white border-t-transparent rounded-full animate-spin"/>) : (<lucide_react_1.Camera size={8} className="text-white"/>)}
            </div>
            {/* Hover tooltip */}
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              Click to upload photo
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {(user === null || user === void 0 ? void 0 : user.firstName) || (user === null || user === void 0 ? void 0 : user.email) || "ZED Admin"}
            </p>
            <div className="flex items-center space-x-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-1 border-t border-white/10 relative z-10">
        <div className="flex items-center justify-center space-x-1 text-xs text-muted-foreground">
          <lucide_react_1.Zap size={10} className="text-purple-400"/>
          <span className="text-xs">Powered by OpenAI</span>
          <div className="w-1 h-1 bg-purple-400 rounded-full"></div>
          <span className="text-xs">Local Auth</span>
        </div>
      </div>
    </div>);
}
