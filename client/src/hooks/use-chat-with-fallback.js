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
Object.defineProperty(exports, "__esModule", { value: true });
exports.useChatWithFallback = useChatWithFallback;
var use_chat_1 = require("./use-chat");
var use_chat_mock_1 = require("./use-chat-mock");
var use_chat_minimal_1 = require("./use-chat-minimal");
function useChatWithFallback(conversationId) {
    var USE_MOCK_MODE = true; // Temporarily enable mock mode while fixing server
    var USE_MINIMAL_SERVER = false; // Use minimal server instead of full server
    var realChat = (0, use_chat_1.useChat)(conversationId);
    var mockChat = (0, use_chat_mock_1.useChatMock)();
    var minimalChat = (0, use_chat_minimal_1.useChatMinimal)();
    if (USE_MOCK_MODE) {
        return {
            sendMessage: mockChat.sendMessage,
            messages: mockChat.messages,
            isStreaming: mockChat.isLoading,
            streamingMessage: '',
            stopStreaming: function () { },
            clearMessages: mockChat.clearMessages,
            isMockMode: true,
        };
    }
    if (USE_MINIMAL_SERVER) {
        return __assign(__assign({}, minimalChat), { isMockMode: false, isMinimalMode: true });
    }
    return __assign(__assign({}, realChat), { messages: [], clearMessages: function () { }, isMockMode: false });
}
