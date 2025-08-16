"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Migration script: Convert all 'zed' fields to 'ai' in ZedAI_memory.json
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const MEMORY_FILE = path_1.default.join(__dirname, '../ZedAI_memory.json');
function migrateZedToAi() {
    if (!fs_1.default.existsSync(MEMORY_FILE)) {
        console.error('ZedAI_memory.json not found.');
        return;
    }
    const raw = fs_1.default.readFileSync(MEMORY_FILE, 'utf8');
    let memory = JSON.parse(raw);
    let changed = false;
    if (memory.knowledge_base && Array.isArray(memory.knowledge_base.conversationHistory)) {
        for (const entry of memory.knowledge_base.conversationHistory) {
            if (entry.zed !== undefined) {
                entry.ai = entry.zed;
                delete entry.zed;
                changed = true;
            }
        }
    }
    if (changed) {
        fs_1.default.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
        console.log('Migration complete: All "zed" fields converted to "ai" in ZedAI_memory.json.');
    }
    else {
        console.log('No "zed" fields found. No changes made.');
    }
}
migrateZedToAi();
