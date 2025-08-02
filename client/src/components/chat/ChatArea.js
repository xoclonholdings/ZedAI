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
exports.default = ChatArea;
var react_1 = require("react");
var button_1 = require("@/components/ui/button");
var card_1 = require("@/components/ui/card");
var textarea_1 = require("@/components/ui/textarea");
var badge_1 = require("@/components/ui/badge");
var lucide_react_1 = require("lucide-react");
// Proper ZED logo with modern design
var zLogoPath = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iemVkR3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgogICAgICA8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTg1NWY3O3N0b3Atb3BhY2l0eToxIiAvPgogICAgICA8c3RvcCBvZmZzZXQ9IjUwJSIgc3R5bGU9InN0b3AtY29sb3I6IzMwOGNmZjtzdG9wLW9wYWNpdHk6MSIgLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojZWI0ODk5O3N0b3Atb3BhY2l0eToxIiAvPgogICAgPC9saW5lYXJHcmFkaWVudD4KICA8L2RlZnM+CiAgPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iOCIgZmlsbD0idXJsKCN6ZWRHcmFkaWVudCkiLz4KICA8cGF0aCBkPSJNOCAxMmgyMGwtMTIgOGgyMHYzSDE0bDEyLThIOHYtM3oiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuOSIvPgo8L3N2Zz4K";
var react_query_1 = require("@tanstack/react-query");
var queryClient_1 = require("@/lib/queryClient");
var FileUpload_1 = require("./FileUpload");
var ChatMessage_1 = require("./ChatMessage");
var SocialFeed_1 = require("../social/SocialFeed");
var InlineChatPanel_1 = require("./InlineChatPanel");
var MemoryPanel_1 = require("./MemoryPanel");
var use_chat_1 = require("@/hooks/use-chat");
var useAuth_1 = require("@/hooks/useAuth");
function ChatArea(_a) {
    var _this = this;
    var _b, _c;
    var conversation = _a.conversation, messages = _a.messages, files = _a.files, conversationId = _a.conversationId, _d = _a.isMobile, isMobile = _d === void 0 ? false : _d, onOpenSidebar = _a.onOpenSidebar;
    var _e = (0, react_1.useState)(""), inputValue = _e[0], setInputValue = _e[1];
    var _f = (0, react_1.useState)(false), showFileUpload = _f[0], setShowFileUpload = _f[1];
    var _g = (0, react_1.useState)(false), showSocialFeed = _g[0], setShowSocialFeed = _g[1];
    var _h = (0, react_1.useState)(false), showModeSelector = _h[0], setShowModeSelector = _h[1];
    var _j = (0, react_1.useState)(false), showMemoryPanel = _j[0], setShowMemoryPanel = _j[1];
    var _k = (0, react_1.useState)(false), hasStartedTyping = _k[0], setHasStartedTyping = _k[1];
    var _l = (0, react_1.useState)((conversation === null || conversation === void 0 ? void 0 : conversation.mode) || "chat"), currentMode = _l[0], setCurrentMode = _l[1];
    var textareaRef = (0, react_1.useRef)(null);
    var messagesEndRef = (0, react_1.useRef)(null);
    var queryClient = (0, react_query_1.useQueryClient)();
    var user = (0, useAuth_1.useAuth)().user;
    var _m = (0, use_chat_1.useChat)(conversationId), isStreaming = _m.isStreaming, streamingMessage = _m.streamingMessage, sendChatMessage = _m.sendMessage;
    var updateModeMutation = (0, react_query_1.useMutation)({
        mutationFn: function (mode) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!conversationId)
                            return [2 /*return*/];
                        return [4 /*yield*/, (0, queryClient_1.apiRequest)("/api/conversations/".concat(conversationId), "PATCH", { mode: mode })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        }); },
        onSuccess: function () {
            if (conversationId) {
                queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
            }
        },
    });
    // Debug logging for ChatArea
    console.log("💬 ChatArea Debug:", {
        conversationId: conversationId,
        messagesCount: messages.length,
        hasMessages: messages.length > 0,
        conversation: conversation === null || conversation === void 0 ? void 0 : conversation.id,
        firstMessage: (_c = (_b = messages[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.substring(0, 50)
    });
    var handleSend = function () { return __awaiter(_this, void 0, void 0, function () {
        var message, response, newConversation, error_1, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!inputValue.trim())
                        return [2 /*return*/];
                    message = inputValue.trim();
                    console.log("🚀 User sending message:", message);
                    console.log("📍 Conversation ID:", conversationId);
                    console.log("🎯 Current mode:", currentMode);
                    if (!!conversationId) return [3 /*break*/, 5];
                    console.error("❌ No conversation ID - creating new conversation");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, (0, queryClient_1.apiRequest)("POST", "/api/conversations", { mode: currentMode })];
                case 2:
                    response = _a.sent();
                    return [4 /*yield*/, response.json()];
                case 3:
                    newConversation = _a.sent();
                    window.history.pushState({}, '', "/chat/".concat(newConversation.id));
                    return [2 /*return*/];
                case 4:
                    error_1 = _a.sent();
                    console.error("❌ Failed to create conversation:", error_1);
                    return [2 /*return*/];
                case 5:
                    setInputValue("");
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    // Use the new AI routing sendMessage function from useChat
                    return [4 /*yield*/, sendChatMessage(message)];
                case 7:
                    // Use the new AI routing sendMessage function from useChat
                    _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    error_2 = _a.sent();
                    console.error("❌ Handle send error:", error_2);
                    return [3 /*break*/, 9];
                case 9: return [2 /*return*/];
            }
        });
    }); };
    var handleKeyDown = function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    var handleModeChange = function (mode) { return __awaiter(_this, void 0, void 0, function () {
        var error_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setCurrentMode(mode);
                    if (!conversationId) return [3 /*break*/, 4];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, updateModeMutation.mutateAsync(mode)];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_3 = _a.sent();
                    return [3 /*break*/, 4];
                case 4:
                    setShowModeSelector(false);
                    return [2 /*return*/];
            }
        });
    }); };
    var handleFileUpload = function (files) {
        if (conversationId) {
            queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "files"] });
        }
        setShowFileUpload(false);
    };
    var handleEmojiSelect = function (emoji) {
        setInputValue(function (prev) { return prev + emoji; });
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    };
    var handleGifSelect = function (gif) {
        setInputValue(function (prev) { return prev + "![GIF](".concat(gif, ")"); });
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    };
    var handleTranslate = function (text, targetLang) {
        if (inputValue.trim()) {
            setInputValue(function (prev) { return "[Translate to ".concat(targetLang, "]: ").concat(prev); });
        }
    };
    (0, react_1.useEffect)(function () {
        var _a;
        (_a = messagesEndRef.current) === null || _a === void 0 ? void 0 : _a.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingMessage]);
    (0, react_1.useEffect)(function () {
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = "".concat(textareaRef.current.scrollHeight, "px");
        }
        // Hide welcome message when user starts typing
        if (inputValue.trim() && !hasStartedTyping) {
            setHasStartedTyping(true);
        }
    }, [inputValue, hasStartedTyping]);
    return (<div className="flex-1 flex h-full relative overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Floating orbs */}
          <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-r from-purple-600/10 to-cyan-500/10 rounded-full blur-3xl zed-float"/>
          <div className="absolute bottom-40 right-20 w-48 h-48 bg-gradient-to-r from-pink-500/10 to-purple-600/10 rounded-full blur-3xl zed-float" style={{ animationDelay: '2s' }}/>
          <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-gradient-to-r from-cyan-500/10 to-pink-500/10 rounded-full blur-2xl zed-float" style={{ animationDelay: '4s' }}/>
          
          {/* Large glowing ZED logo centerpiece - Reactive to streaming */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              {/* Outer glow ring - Dynamic based on streaming state */}
              <div className={"absolute inset-0 w-96 h-96 md:w-[32rem] md:h-[32rem] bg-gradient-to-r rounded-full blur-3xl transition-all duration-500 ".concat(isStreaming
            ? 'from-purple-500/20 via-cyan-500/20 to-pink-500/20 animate-ping'
            : 'from-purple-500/8 via-cyan-500/8 to-pink-500/8 animate-pulse')}/>
              
              {/* Response pulse rings - Only visible when streaming */}
              {isStreaming && (<>
                  <div className="absolute inset-4 bg-gradient-to-r from-purple-500/25 via-cyan-500/25 to-pink-500/25 rounded-full blur-2xl animate-ping" style={{ animationDelay: '0.5s' }}/>
                  <div className="absolute inset-12 bg-gradient-to-r from-cyan-500/30 via-pink-500/30 to-purple-500/30 rounded-full blur-xl animate-ping" style={{ animationDelay: '1s' }}/>
                </>)}
              
              {/* Inner glow ring - Enhanced during streaming */}
              <div className={"absolute inset-8 rounded-full blur-2xl transition-all duration-300 ".concat(isStreaming
            ? 'bg-gradient-to-r from-purple-500/25 via-cyan-500/25 to-pink-500/25 zed-active-shimmer'
            : 'bg-gradient-to-r from-purple-500/15 via-cyan-500/15 to-pink-500/15 zed-shimmer')}/>
              
              {/* ZED logo container */}
              <div className="relative w-96 h-96 md:w-[32rem] md:h-[32rem] flex items-center justify-center">
                <img src={zLogoPath} alt="ZED" className={"w-48 h-48 md:w-80 md:h-80 transition-all duration-500 ".concat(isStreaming ? 'opacity-40 scale-105' : 'opacity-25 scale-100')} style={{
            filter: isStreaming
                ? "\n                        drop-shadow(0 0 60px rgba(168, 85, 247, 0.6))\n                        drop-shadow(0 0 120px rgba(59, 130, 246, 0.5))\n                        drop-shadow(0 0 180px rgba(236, 72, 153, 0.4))\n                        brightness(1.2)\n                        contrast(1.1)\n                      "
                : "\n                        drop-shadow(0 0 50px rgba(168, 85, 247, 0.4))\n                        drop-shadow(0 0 100px rgba(59, 130, 246, 0.3))\n                        drop-shadow(0 0 150px rgba(236, 72, 153, 0.2))\n                      ",
            animation: isStreaming
                ? 'zed-active-pulse 0.8s ease-in-out infinite alternate'
                : 'zed-glow-pulse 6s ease-in-out infinite alternate'
        }}/>
                
                {/* Shimmer overlay - Faster during streaming */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0" style={{
            animation: isStreaming
                ? 'shimmer-fast 2s ease-in-out infinite'
                : 'shimmer-sweep 8s ease-in-out infinite',
            background: isStreaming
                ? 'linear-gradient(45deg, transparent 20%, rgba(255,255,255,0.2) 30%, rgba(168,85,247,0.5) 50%, rgba(59,130,246,0.4) 70%, rgba(255,255,255,0.2) 80%, transparent 90%)'
                : 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 40%, rgba(168,85,247,0.3) 50%, rgba(59,130,246,0.2) 60%, rgba(255,255,255,0.1) 70%, transparent 80%)'
        }}/>
                
                {/* Active thinking indicator - Only during streaming */}
                {isStreaming && (<div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex space-x-3">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"/>
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}/>
                      <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.6s' }}/>
                    </div>
                  </div>)}
              </div>
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10 zed-glass relative z-10 flex-shrink-0">
          <button_1.Button variant="ghost" size="lg" className="flex items-center space-x-3 p-2 h-auto hover:bg-white/5 transition-all duration-300 rounded-lg hover:scale-105" onClick={function () {
            console.log('ChatArea ZED header clicked!', { isMobile: isMobile, onOpenSidebar: onOpenSidebar });
            if (onOpenSidebar) {
                onOpenSidebar();
            }
        }}>
            <img src={zLogoPath} alt="Z" className="w-6 h-6 md:w-8 md:h-8"/>
            <div className="text-left">
              <h1 className="text-lg md:text-xl font-bold">
                <span className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">ZED</span>
              </h1>
              <button_1.Button variant="ghost" size="sm" onClick={function (e) {
            e.stopPropagation();
            handleModeChange(currentMode === 'chat' ? 'agent' : 'chat');
        }} className="text-xs md:text-sm text-muted-foreground hover:text-foreground p-0 h-auto transition-colors">
                {currentMode === 'chat' ? 'Chat Mode' : 'Enhanced AI Assistant'}
                <lucide_react_1.Settings size={10} className="ml-1"/>
              </button_1.Button>
            </div>
          </button_1.Button>
          
          <div className="flex items-center space-x-2">
            <button_1.Button variant="ghost" size="sm" onClick={function () { return setShowSocialFeed(!showSocialFeed); }} className={"zed-button rounded-xl btn-touch ".concat(showSocialFeed ? 'text-purple-400' : 'text-muted-foreground')}>
              <lucide_react_1.Rss size={16}/>
            </button_1.Button>
            <button_1.Button variant="ghost" size="sm" onClick={function () { return setShowMemoryPanel(!showMemoryPanel); }} className={"zed-button rounded-xl btn-touch ".concat(showMemoryPanel ? 'text-purple-400' : 'text-muted-foreground')}>
              <lucide_react_1.Brain size={16} className="mr-1"/>
              Memory
            </button_1.Button>
          </div>
        </div>

        {/* Messages - Full Viewport Height */}
        <div className="flex-1 min-h-0 overflow-y-auto px-2 md:px-4 py-2 md:py-3 relative z-10">
          {/* Debug info */}
          {process.env.NODE_ENV === 'development' && (<div className="text-xs text-muted-foreground bg-red-900/20 p-1 rounded text-center">
              Debug: Messages: {messages.length}, Streaming: {isStreaming.toString()}, Typing: {hasStartedTyping.toString()}
            </div>)}
          
          {/* Messages Container - Flex Layout */}
          <div className="max-w-4xl mx-auto h-full flex flex-col justify-end">
            {messages.length > 0 ? (<div className="space-y-2 md:space-y-3">
                {messages.map(function (message) { return (<ChatMessage_1.default key={message.id} message={message}/>); })}
              </div>) : (<div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <lucide_react_1.MessageSquare size={48} className="mx-auto mb-4 opacity-50"/>
                  <p className="text-lg">No messages yet</p>
                  <p className="text-sm">Start your conversation with ZED</p>
                </div>
              </div>)}
          </div>

          {/* Streaming message */}
          {isStreaming && (<div className="flex items-start space-x-2 max-w-4xl mx-auto">
              <card_1.Card className="flex-1 p-3 md:p-4 zed-message zed-glow ml-2">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <img src={zLogoPath} alt="Z" className="w-3 h-3"/>
                    <span className="text-sm font-semibold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">ZED</span>
                  </div>  
                  <badge_1.Badge variant="outline" className="text-xs border-purple-500/30 text-purple-300">
                    <div className="flex items-center space-x-1">
                      <div className="w-1.5 h-1.5 bg-purple-400 rounded-full zed-typing"/>
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full zed-typing" style={{ animationDelay: '0.3s' }}/>
                      <div className="w-1.5 h-1.5 bg-pink-400 rounded-full zed-typing" style={{ animationDelay: '0.6s' }}/>
                    </div>
                  </badge_1.Badge>
                </div>
                <div className="prose prose-sm max-w-none">
                  {streamingMessage ? (<p className="whitespace-pre-wrap text-sm">{streamingMessage}</p>) : (<div className="flex items-center space-x-2 text-muted-foreground">
                      <lucide_react_1.Sparkles size={14} className="animate-pulse"/>
                      <span>Thinking...</span>
                    </div>)}
                </div>
              </card_1.Card>
            </div>)}

          <div ref={messagesEndRef}/>
        </div>

        {/* File Upload Area */}
        {showFileUpload && conversationId && (<FileUpload_1.default conversationId={conversationId} onUpload={handleFileUpload} onClose={function () { return setShowFileUpload(false); }}/>)}

        {/* Input Area */}
        <div className="border-t border-white/10 zed-glass p-2 md:p-3 relative z-10 flex-shrink-0">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <div className="relative border border-input rounded-lg bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring">
                  <div className="flex items-end">
                    {/* Left side: Inline Panel with emoji, GIF, translate, and settings */}
                    <div className="flex items-center pl-2 py-1.5 border-r border-input/50">
                      <InlineChatPanel_1.default onEmojiSelect={handleEmojiSelect} onGifSelect={handleGifSelect} onTranslate={handleTranslate}/>
                    </div>
                    
                    {/* Center: Text Area */}
                    <textarea_1.Textarea ref={textareaRef} value={inputValue} onChange={function (e) { return setInputValue(e.target.value); }} onKeyDown={handleKeyDown} placeholder={"Message ZED in ".concat(currentMode, " mode...")} className="flex-1 bg-transparent border-0 resize-none min-h-[40px] text-sm px-3 py-2 pr-16 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0" rows={1} disabled={isStreaming}/>
                    
                    {/* Right side: File upload, microphone, and send button */}
                    <div className="flex items-center space-x-1 pr-1.5">
                      <button_1.Button variant="ghost" size="sm" onClick={function () { return setShowFileUpload(true); }} className="h-6 w-6 p-0 text-muted-foreground hover:text-purple-400 transition-colors" disabled={isStreaming}>
                        <lucide_react_1.Paperclip size={12}/>
                      </button_1.Button>
                      <button_1.Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-cyan-400 transition-colors" disabled={isStreaming}>
                        <lucide_react_1.Mic size={12}/>
                      </button_1.Button>
                      <button_1.Button onClick={handleSend} size="sm" className="zed-gradient hover:shadow-md hover:shadow-purple-500/25 zed-button rounded-lg h-6 w-6 p-0 transition-all duration-200 hover:scale-105" disabled={!inputValue.trim() || isStreaming}>
                        <lucide_react_1.Send size={12}/>
                      </button_1.Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Feed Panel */}
      {showSocialFeed && !isMobile && (<div className="w-96 border-l border-white/10 zed-sidebar">
          <SocialFeed_1.default />
        </div>)}

      {/* Memory Panel */}
      <MemoryPanel_1.default isOpen={showMemoryPanel} onClose={function () { return setShowMemoryPanel(false); }} username={user === null || user === void 0 ? void 0 : user.username}/>
    </div>);
}
