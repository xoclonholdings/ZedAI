// ZedAIAdminSession.ts

import fs from "fs";
import path from "path";
import * as chokidar from "chokidar";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const DATA_DIR = path.resolve(__dirname, "ZedAI_data");
const MEMORY_FILE = path.resolve(__dirname, "ZedAI_memory.json");

type ConversationEntry = {
  turn: number;
  user: string;
  ai: string;
  context?: object;
};

type ZedAIMemory = {
  conversationHistory: ConversationEntry[];
};

function migrateZedToAi(memory: any): ZedAIMemory {
  if (!memory || !Array.isArray(memory.conversationHistory)) return { conversationHistory: [] };
  return {
    conversationHistory: memory.conversationHistory.map((entry: any) => ({
      turn: entry.turn,
      user: entry.user,
      ai: entry.ai ?? entry.zed ?? "",
      context: entry.context,
    })),
  };
}

class AdminSession {
  private memory: ZedAIMemory = { conversationHistory: [] };
  private watcher: chokidar.FSWatcher | null = null;

  constructor() {
    this.loadMemory();
    this.watchDataDir();
  }

  private loadMemory() {
    if (fs.existsSync(MEMORY_FILE)) {
      const raw = fs.readFileSync(MEMORY_FILE, "utf8");
      let mem = {};
      try { mem = JSON.parse(raw); } catch {}
      this.memory = migrateZedToAi(mem);
    } else {
      this.memory = { conversationHistory: [] };
    }
    this.saveMemory();
  }

  private saveMemory() {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.memory, null, 2));
  }

  private watchDataDir() {
    this.watcher = chokidar.watch(DATA_DIR, { ignoreInitial: true, persistent: true });
    this.watcher.on("all", () => this.loadMemory());
  }

  async addInteraction(interaction: string): Promise<ConversationEntry> {
    const turn = this.memory.conversationHistory.length + 1;
    const user = "admin";
    const ai = await this.callLiveAI(interaction);
    const entry: ConversationEntry = { turn, user, ai };
    this.memory.conversationHistory.push(entry);
    this.saveMemory();
    return entry;
  }

  async callLiveAI(input: string): Promise<string> {
    // Replace with your live backend AI endpoint
    try {
      const res = await fetch("http://localhost:3000/api/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = (await res.json()) as { reply?: string };
      return data.reply ?? "";
    } catch (e) {
      return "AI backend unavailable.";
    }
  }

  queryMemory(search: string): ConversationEntry[] {
    return this.memory.conversationHistory.filter(
      entry =>
        entry.user.includes(search) ||
        entry.ai.includes(search) ||
        (entry.context && JSON.stringify(entry.context).includes(search))
    );
  }

  getMemory(): ZedAIMemory {
    return this.memory;
  }
}

// Express backend
const app = express();
app.use(cors());
app.use(express.json());

app.options("/api/respond", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(200);
});

app.post("/api/respond", async (req, res) => {
  const input = req.body.input ?? "";
  // Integrate with your live ZedAI logic here
  const reply = `AI response to: ${input}`; // Replace with actual AI logic
  res.json({ reply });
});

app.listen(3000, () => {
  console.log("ZedAI Admin backend running on port 3000");
});

// Export AdminSession for frontend use
export { AdminSession };
