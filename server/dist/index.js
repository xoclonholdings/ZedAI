"use strict";
// Minimal ZedAI backend server
// Provides /learn, /memory, /ai endpoints
// Integrates adaptive learning, persistent memory, and AI connection
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const adaptiveLearning_1 = require("./adaptiveLearning");
const memory_1 = require("./memory");
const aiConnection_1 = require("./aiConnection");
const reason_1 = __importStar(require("./reason"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8080;
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
// /learn endpoint: adaptive learning from user input
app.post('/learn', (req, res) => {
    try {
        const { input, response } = req.body;
        (0, adaptiveLearning_1.updateState)(input, response);
        res.json({ success: true });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ success: false, error: errorMsg });
    }
});
// /memory endpoint: persistent memory for conversation recall
app.get('/memory', (req, res) => {
    try {
        const history = (0, memory_1.getHistory)();
        res.json({ success: true, history });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ success: false, error: errorMsg });
    }
});
app.post('/memory', (req, res) => {
    try {
        const { user, ai } = req.body;
        (0, memory_1.saveTurn)(user, ai);
        res.json({ success: true });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ success: false, error: errorMsg });
    }
});
// /ai endpoint: get AI response, update memory and adaptive learning
app.post('/ai', async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
        const { input } = req.body;
        // Route reasoning queries to /reason
        if (/math|sum|calculate|logic|reason|summary|summarize|multi-step|context|combine/i.test(input)) {
            // Internal call to /reason
            const history = (0, memory_1.getHistory)();
            const reasoned = (0, reason_1.reasonOverHistory)(input, history);
            (0, memory_1.saveTurn)(input, reasoned);
            (0, adaptiveLearning_1.updateState)(input, reasoned);
            return res.json({ success: true, response: reasoned });
        }
        // Otherwise standard AI response
        const aiResponse = await (0, aiConnection_1.getAIResponse)(input);
        (0, memory_1.saveTurn)(input, aiResponse);
        (0, adaptiveLearning_1.updateState)(input, aiResponse);
        res.json({ success: true, response: aiResponse });
    }
    catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        res.status(500).json({ success: false, error: errorMsg });
    }
});
app.use('/reason', reason_1.default);
app.listen(PORT, () => {
    console.log(`ZedAI backend running on port ${PORT}`);
});
// Comments: This server is minimal, production-ready, and Railway deployable.
// All endpoints are integrated with core modules. CSP and security headers should be set via Caddyfile.
