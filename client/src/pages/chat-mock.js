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
exports.default = ChatMock;
var react_1 = require("react");
var use_chat_with_fallback_1 = require("@/hooks/use-chat-with-fallback");
var useAuthMock_1 = require("@/hooks/useAuthMock");
var button_1 = require("@/components/ui/button");
var input_1 = require("@/components/ui/input");
var card_1 = require("@/components/ui/card");
var lucide_react_1 = require("lucide-react");
function ChatMock() {
    var _this = this;
    var _a = (0, react_1.useState)(""), input = _a[0], setInput = _a[1];
    var chat = (0, use_chat_with_fallback_1.useChatWithFallback)();
    var mockAuth = (0, useAuthMock_1.useAuthMock)();
    var handleSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    if (!input.trim() || chat.isStreaming)
                        return [2 /*return*/];
                    return [4 /*yield*/, chat.sendMessage(input)];
                case 1:
                    _a.sent();
                    setInput("");
                    return [2 /*return*/];
            }
        });
    }); };
    var handleLogout = function () {
        mockAuth.logout();
        window.location.reload();
    };
    return (<div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800 p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-pink-400 bg-clip-text text-transparent">
            ZED AI Assistant
          </h1>
          {chat.isMockMode && (<p className="text-sm text-yellow-400">Running in Mock Mode</p>)}
        </div>
        <div className="flex gap-2">
          <button_1.Button onClick={chat.clearMessages} variant="outline" size="sm" className="border-gray-600 hover:bg-gray-800">
            <lucide_react_1.Trash2 className="w-4 h-4 mr-2"/>
            Clear
          </button_1.Button>
          <button_1.Button onClick={handleLogout} variant="outline" size="sm" className="border-gray-600 hover:bg-gray-800">
            <lucide_react_1.LogOut className="w-4 h-4 mr-2"/>
            Logout
          </button_1.Button>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chat.messages.map(function (message) { return (<card_1.Card key={message.id} className={"p-4 max-w-4xl ".concat(('role' in message ? message.role === 'user' : message.isUser)
                ? "ml-auto bg-blue-900/50 border-blue-800"
                : "mr-auto bg-gray-900/50 border-gray-700")}>
            <div className="flex items-start gap-3">
              <div className={"w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ".concat(('role' in message ? message.role === 'user' : message.isUser)
                ? "bg-blue-600 text-white"
                : "bg-gradient-to-r from-purple-500 to-cyan-500 text-white")}>
                {('role' in message ? message.role === 'user' : message.isUser) ? "U" : "Z"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">
                    {('role' in message ? message.role === 'user' : message.isUser) ? "You" : "ZED"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                  {message.source && (<span className="text-xs bg-gray-700 px-2 py-1 rounded">
                      {message.source}
                    </span>)}
                </div>
                <div className="text-gray-100 whitespace-pre-wrap">
                  {'content' in message ? message.content : message.message}
                </div>
              </div>
            </div>
          </card_1.Card>); })}
        
        {chat.isStreaming && (<card_1.Card className="p-4 max-w-4xl mr-auto bg-gray-900/50 border-gray-700">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center text-sm font-medium text-white">
                Z
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">ZED</span>
                  <span className="text-xs text-gray-500">typing...</span>
                </div>
                <div className="text-gray-100">
                  <div className="animate-pulse">●●●</div>
                </div>
              </div>
            </div>
          </card_1.Card>)}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="border-t border-gray-800 p-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <input_1.Input value={input} onChange={function (e) { return setInput(e.target.value); }} placeholder="Message ZED..." className="flex-1 bg-gray-900 border-gray-700 text-white placeholder-gray-400" disabled={chat.isStreaming}/>
          <button_1.Button type="submit" disabled={!input.trim() || chat.isStreaming} className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700">
            <lucide_react_1.Send className="w-4 h-4"/>
          </button_1.Button>
        </div>
      </form>
    </div>);
}
