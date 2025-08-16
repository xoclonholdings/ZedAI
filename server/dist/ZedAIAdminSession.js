"use strict";
// ZedAIAdminSession.ts
//
// INSTALL DEPENDENCIES:
// npm install chokidar express cors body-parser node-fetch
// npm install --save-dev @types/chokidar @types/express @types/cors @types/body-parser @types/node-fetch
//
// If you see missing module errors at runtime, run the above commands.
//
// Self-contained AdminSession module for ZedAI
// - Auto-loads and watches ZedAI_data for changes
// - Migrates old 'zed' fields to 'ai'
// - Persists memory in ZedAI_memory.json
// - addInteraction() calls live backend AI
// - queryMemory() searches file names/paths
// - Express backend exposes /api/respond with CORS
// - TypeScript-safe imports
// - Exports AdminSession for frontend use
//
// Folder structure:
//   /ZedAI_data/         // Admin memory files
//   /ZedAI_memory.json   // Persistent memory
//   /server/ZedAIAdminSession.ts // This module
//
// Usage:
//   import { AdminSession } from './server/ZedAIAdminSession';
//   await AdminSession.addInteraction('Hello AI');
//   const results = AdminSession.queryMemory('searchTerm');
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
exports.AdminSession = void 0;
// Runtime module check and install instructions
const requiredModules = [
    'chokidar', 'express', 'cors', 'body-parser', 'node-fetch'
];
for (const mod of requiredModules) {
    try {
        require.resolve(mod);
    }
    catch {
        console.warn(`Module '${mod}' is missing. Run: npm install ${mod}`);
    }
}
// ZedAIAdminSession.ts
//
// INSTALL DEPENDENCIES:
// npm install chokidar express cors body-parser node-fetch
// npm install --save-dev @types/chokidar @types/express @types/cors @types/body-parser @types/node-fetch
//
// Self-contained AdminSession module for ZedAI
// - Auto-loads and watches ZedAI_data for changes
// - Migrates old 'zed' fields to 'ai'
// - Persists memory in ZedAI_memory.json
// - addInteraction() calls live backend AI
// - queryMemory() searches file names/paths
// - Express backend exposes /api/respond with CORS
// - TypeScript-safe imports
// - Exports AdminSession for frontend use
//
// Folder structure:
//   /ZedAI_data/         // Admin memory files
//   /ZedAI_memory.json   // Persistent memory
//   /server/ZedAIAdminSession.ts // This module
//
// Usage:
//   import { AdminSession } from './server/ZedAIAdminSession';
//   await AdminSession.addInteraction('Hello AI');
//   const results = AdminSession.queryMemory('searchTerm');
//
// ZedAIAdminSession.ts
//
// Self-contained AdminSession module for ZedAI
// - Auto-loads and watches ZedAI_data for changes
// - Migrates old 'zed' fields to 'ai'
// - Persists memory in ZedAI_memory.json
// - addInteraction() calls live backend AI
// - queryMemory() searches file names/paths
// - Express backend exposes /api/respond with CORS
// - TypeScript-safe imports
// - Exports AdminSession for frontend use
//
// Folder structure:
//   /ZedAI_data/         // Admin memory files
//   /ZedAI_memory.json   // Persistent memory
//   /server/ZedAIAdminSession.ts // This module
//
// Usage:
//   import { AdminSession } from './server/ZedAIAdminSession';
//   await AdminSession.addInteraction('Hello AI');
//   const results = AdminSession.queryMemory('searchTerm');
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const chokidar = __importStar(require("chokidar"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const body_parser_1 = __importDefault(require("body-parser"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const DATA_DIR = path.resolve(__dirname, '../ZedAI_data');
const MEMORY_FILE = path.resolve(__dirname, '../ZedAI_memory.json');
function migrateZedToAi(memory) {
    if (!memory || !Array.isArray(memory.conversationHistory))
        return { conversationHistory: [] };
    return {
        conversationHistory: memory.conversationHistory.map((entry) => ({
            turn: entry.turn,
            user: entry.user,
            ai: entry.ai ?? entry.zed ?? '',
            context: entry.context,
        })),
    };
}
class AdminSessionClass {
    constructor() {
        this.ZedMemory = { conversationHistory: [] };
        this.watcher = null;
        this.loadMemory();
        this.watchDataDir();
    }
    loadMemory() {
        if (fs.existsSync(MEMORY_FILE)) {
            const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
            let mem = {};
            try {
                mem = JSON.parse(raw);
            }
            catch { }
            this.ZedMemory = migrateZedToAi(mem);
        }
        else {
            this.ZedMemory = { conversationHistory: [] };
        }
        this.saveMemory();
    }
    saveMemory() {
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.ZedMemory, null, 2));
    }
    watchDataDir() {
        this.watcher = chokidar.watch(DATA_DIR, { ignoreInitial: true, persistent: true });
        this.watcher.on('all', () => this.loadMemory());
    }
    async addInteraction(interaction) {
        const turn = this.ZedMemory.conversationHistory.length + 1;
        const user = 'admin';
        const ai = await this.callLiveAI(interaction);
        const entry = { turn, user, ai };
        this.ZedMemory.conversationHistory.push(entry);
        this.saveMemory();
        return entry;
    }
    async callLiveAI(input) {
        try {
            const res = await (0, node_fetch_1.default)('http://localhost:3000/api/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input }),
            });
            const data = (await res.json());
            return data.reply ?? '';
        }
        catch (e) {
            return 'AI backend unavailable.';
        }
    }
    queryMemory(search) {
        return this.ZedMemory.conversationHistory.filter(entry => entry.user.includes(search) ||
            entry.ai.includes(search) ||
            (entry.context && JSON.stringify(entry.context).includes(search)));
    }
}
exports.AdminSession = new AdminSessionClass();
// Express backend setup
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(body_parser_1.default.json());
app.options('/api/respond', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(200);
});
app.post('/api/respond', async (req, res) => {
    const input = req.body.input ?? '';
    // Integrate with real ZedAI logic here
    const reply = `AI response to: ${input}`; // Replace with actual AI logic
    res.json({ reply });
});
app.listen(3000, () => {
    console.log('ZedAI Admin backend running on port 3000');
});
// End of ZedAIAdminSession.ts
