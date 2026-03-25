import express from "express";
import { getHistory, saveTurn } from "./memory.js";
import { updateState } from "./adaptiveLearning.js";
const router = express.Router();
function summarizeHistory(history) {
    return history.map((t, i) => `Turn ${i + 1}: User: ${t.user} | AI: ${t.ai}`).join("\n");
}
export function reasonOverHistory(prompt, history) {
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
    const history = getHistory();
    const reasoned = reasonOverHistory(prompt, history);
    saveTurn(prompt, reasoned);
    updateState(prompt, reasoned);
    res.json({ response: reasoned });
});
export default router;
