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
exports.useChatMinimal = useChatMinimal;
var react_1 = require("react");
function useChatMinimal() {
    var _this = this;
    var _a = (0, react_1.useState)([
        {
            id: '1',
            content: 'Hello! I\'m ZED, your AI assistant. The server is now running!',
            role: 'assistant',
            timestamp: new Date().toISOString(),
            source: 'ZED_MINIMAL'
        }
    ]), messages = _a[0], setMessages = _a[1];
    var _b = (0, react_1.useState)(false), isLoading = _b[0], setIsLoading = _b[1];
    var sendMessage = function (content) { return __awaiter(_this, void 0, void 0, function () {
        var userMessage, response, data, assistantMessage_1, error_1, errorMessage_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!content.trim() || isLoading)
                        return [2 /*return*/];
                    userMessage = {
                        id: Date.now().toString(),
                        content: content.trim(),
                        role: 'user',
                        timestamp: new Date().toISOString()
                    };
                    setMessages(function (prev) { return __spreadArray(__spreadArray([], prev, true), [userMessage], false); });
                    setIsLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, fetch('/api/ask', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ content: content.trim() }),
                            credentials: 'include',
                        })];
                case 2:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Server error: ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 3:
                    data = _a.sent();
                    assistantMessage_1 = {
                        id: (Date.now() + 1).toString(),
                        content: data.message || 'ZED received your message.',
                        role: 'assistant',
                        timestamp: data.timestamp || new Date().toISOString(),
                        source: data.source || 'ZED'
                    };
                    setMessages(function (prev) { return __spreadArray(__spreadArray([], prev, true), [assistantMessage_1], false); });
                    return [3 /*break*/, 6];
                case 4:
                    error_1 = _a.sent();
                    console.error('Chat error:', error_1);
                    errorMessage_1 = {
                        id: (Date.now() + 2).toString(),
                        content: "ZED: I encountered an error: ".concat(error_1 instanceof Error ? error_1.message : 'Unknown error'),
                        role: 'assistant',
                        timestamp: new Date().toISOString(),
                        source: 'ZED_ERROR'
                    };
                    setMessages(function (prev) { return __spreadArray(__spreadArray([], prev, true), [errorMessage_1], false); });
                    return [3 /*break*/, 6];
                case 5:
                    setIsLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var clearMessages = function () {
        setMessages([{
                id: '1',
                content: 'Hello! I\'m ZED, your AI assistant. Chat cleared.',
                role: 'assistant',
                timestamp: new Date().toISOString(),
                source: 'ZED_MINIMAL'
            }]);
    };
    return {
        messages: messages,
        isLoading: isLoading,
        sendMessage: sendMessage,
        clearMessages: clearMessages,
        isStreaming: isLoading,
        streamingMessage: '',
        stopStreaming: function () { },
    };
}
