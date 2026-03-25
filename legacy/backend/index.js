"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ZedAI backend entry
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const adaptiveLearning_1 = require("./adaptiveLearning");
const memory_1 = require("./memory");
const aiConnection_1 = require("./aiConnection");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 8080;
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
// /learn endpoint
app.post('/learn', (req, res) => {
    try {
        const { input, response } = req.body;
        (0, adaptiveLearning_1.updateState)(input, response);
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, error: String(err) });
    }
});
// /memory endpoint
app.get('/memory', (req, res) => {
    try {
        const history = (0, memory_1.getHistory)();
        res.json({ success: true, history });
    }
    catch (err) {
        res.status(500).json({ success: false, error: String(err) });
    }
});
app.post('/memory', (req, res) => {
    try {
        const { user, ai } = req.body;
        (0, memory_1.saveTurn)(user, ai);
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, error: String(err) });
    }
});
// /ai endpoint
app.post('/ai', async (req, res) => {
    try {
        const { input } = req.body;
        const aiResponse = await (0, aiConnection_1.getAIResponse)(input);
        (0, memory_1.saveTurn)(input, aiResponse);
        (0, adaptiveLearning_1.updateState)(input, aiResponse);
        res.json({ success: true, response: aiResponse });
    }
    catch (err) {
        res.status(500).json({ success: false, error: String(err) });
    }
});
app.listen(PORT, () => {
    console.log(`ZedAI backend running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map