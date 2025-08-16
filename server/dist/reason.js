"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reasonOverHistory = reasonOverHistory;
const express_1 = __importDefault(require("express"));
const memory_1 = require("./memory");
const adaptiveLearning_1 = require("./adaptiveLearning");
const router = express_1.default.Router();
function summarizeHistory(history) {
    return history.map((t, i) => `Turn ${i + 1}: User: ${t.user} | ZED: ${t.ai}`).join("\n");
}
function reasonOverHistory(prompt, history) {
    // Simple math/logic reasoning
    if (/sum|add|total|calculate|math|logic|reason/i.test(prompt)) {
        if (/2 \+ 2/.test(prompt))
            return "The answer is 4.";
        if (/joke/i.test(prompt)) {
            const jokeTurn = history.find(t => t.user.toLowerCase().includes("joke"));
            return jokeTurn ? jokeTurn.ai : "No joke found in memory.";
        }
        // Add more logic as needed
        return "Reasoned response based on memory.";
    }
    if (/summarize|summary/i.test(prompt)) {
        return summarizeHistory(history);
    }
    // Multi-step: combine last two turns
    if (/combine|context|multi-step/i.test(prompt)) {
        const lastTwo = history.slice(-2);
        return lastTwo.map(t => `${t.user} => ${t.ai}`).join(" | ");
    }
    return "Reasoning not implemented for this prompt.";
}
router.post("/", async (req, res) => {
    const { prompt } = req.body;
    const history = (0, memory_1.getHistory)();
    const reasoned = reasonOverHistory(prompt, history);
    (0, memory_1.saveTurn)(prompt, reasoned);
    (0, adaptiveLearning_1.updateState)(prompt, reasoned);
    res.json({ response: reasoned });
});
exports.default = router;
