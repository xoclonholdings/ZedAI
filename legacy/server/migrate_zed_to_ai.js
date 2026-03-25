// Migration script: Convert all 'zed' fields to 'ai' in ZedAI_memory.json
import fs from 'fs';
import path from 'path';
const MEMORY_FILE = path.join(__dirname, '../ZedAI_memory.json');
function migrateZedToAi() {
    if (!fs.existsSync(MEMORY_FILE)) {
        console.error('ZedAI_memory.json not found.');
        return;
    }
    const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
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
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
        console.log('Migration complete: All "zed" fields converted to "ai" in ZedAI_memory.json.');
    }
    else {
        console.log('No "zed" fields found. No changes made.');
    }
}
migrateZedToAi();
