import { ChromaClient, Collection } from "chromadb";
import fs from "fs/promises";
import path from "path";
import { HUB_SHARED_MEMORY_DIR } from "../utils/repoPaths";

const CHROMA_URL = process.env.CHROMA_URL || "http://localhost:8000";
const SEMANTIC_DIR = path.resolve(HUB_SHARED_MEMORY_DIR, "semantic");

const COLLECTIONS = {
  working: "zed_working",
  episodic: "zed_episodic",
  semantic: "zed_semantic",
  consensus: "zed_consensus",
} as const;

type CollectionKey = keyof typeof COLLECTIONS;

let client: ChromaClient | null = null;
let online = false;
let checkedAt = 0;
const RECHECK_MS = 60_000;

async function getClient(): Promise<ChromaClient | null> {
  const now = Date.now();
  if (now - checkedAt < RECHECK_MS) return online ? client : null;
  checkedAt = now;

  try {
    const c = new ChromaClient({ path: CHROMA_URL });
    await c.heartbeat();
    client = c;
    online = true;
    console.log("[ChromaService] Connected to ChromaDB at", CHROMA_URL);
    return client;
  } catch {
    client = null;
    online = false;
    return null;
  }
}

async function getOrCreateCollection(c: ChromaClient, key: CollectionKey): Promise<Collection> {
  return c.getOrCreateCollection({ name: COLLECTIONS[key] });
}

export interface VectorEntry {
  id: string;
  document: string;
  metadata: Record<string, string | number | boolean>;
}

export async function addToCollection(key: CollectionKey, entry: VectorEntry): Promise<boolean> {
  const c = await getClient();
  if (!c) {
    await fallbackWrite(key, entry);
    return false;
  }
  try {
    const col = await getOrCreateCollection(c, key);
    await col.add({
      ids: [entry.id],
      documents: [entry.document],
      metadatas: [entry.metadata],
    });
    await fallbackWrite(key, entry);
    return true;
  } catch (err) {
    console.warn("[ChromaService] add failed:", err);
    await fallbackWrite(key, entry);
    return false;
  }
}

export async function queryCollection(
  key: CollectionKey,
  queryText: string,
  nResults = 5
): Promise<VectorEntry[]> {
  const c = await getClient();
  if (!c) {
    return fallbackRead(key, nResults);
  }
  try {
    const col = await getOrCreateCollection(c, key);
    const results = await col.query({ queryTexts: [queryText], nResults });
    const ids = results.ids[0] || [];
    const documents = results.documents[0] || [];
    const metadatas = results.metadatas[0] || [];
    return ids.map((id, i) => ({
      id,
      document: documents[i] || "",
      metadata: (metadatas[i] as Record<string, string | number | boolean>) || {},
    }));
  } catch (err) {
    console.warn("[ChromaService] query failed:", err);
    return fallbackRead(key, nResults);
  }
}

async function fallbackWrite(key: CollectionKey, entry: VectorEntry): Promise<void> {
  try {
    const dir = path.join(SEMANTIC_DIR, key);
    await fs.mkdir(dir, { recursive: true });
    const filename = `${entry.id}.json`;
    await fs.writeFile(path.join(dir, filename), JSON.stringify({ ...entry, savedAt: new Date().toISOString() }, null, 2));
  } catch (err) {
    console.warn("[ChromaService] Fallback filesystem write failed:", err);
  }
}

async function fallbackRead(key: CollectionKey, limit: number): Promise<VectorEntry[]> {
  const results: VectorEntry[] = [];
  // Read from keyed subdirectory (current path)
  try {
    const dir = path.join(SEMANTIC_DIR, key);
    await fs.mkdir(dir, { recursive: true });
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort().slice(-limit);
    for (const f of files) {
      try {
        const raw = await fs.readFile(path.join(dir, f), "utf-8");
        const data = JSON.parse(raw);
        results.push({ id: data.id, document: data.document, metadata: data.metadata });
      } catch {}
    }
  } catch {}
  // Also migrate any old-style files from the root semantic dir (legacy path)
  if (key === "semantic" && results.length < limit) {
    try {
      const rootFiles = (await fs.readdir(SEMANTIC_DIR))
        .filter((f) => f.endsWith(".json") && !f.startsWith("."))
        .sort()
        .slice(-(limit - results.length));
      const subdir = path.join(SEMANTIC_DIR, key);
      for (const f of rootFiles) {
        const srcPath = path.join(SEMANTIC_DIR, f);
        try {
          const raw = await fs.readFile(srcPath, "utf-8");
          const data = JSON.parse(raw);
          if (data.id && data.document) {
            results.push({ id: data.id, document: data.document, metadata: data.metadata || {} });
            // Migrate to new location
            await fs.rename(srcPath, path.join(subdir, f)).catch(() => {});
          }
        } catch {}
      }
    } catch {}
  }
  return results.slice(-limit);
}

export async function storeResearchBrief(brief: {
  topic: string;
  date: string;
  confidence: string;
  keyFindings: string[];
  implications: string;
  recommendedAction: string;
}): Promise<void> {
  const id = `research-${Date.now()}`;
  const document = `Topic: ${brief.topic}\n\nFindings:\n${brief.keyFindings.join("\n")}\n\nImplications: ${brief.implications}\n\nAction: ${brief.recommendedAction}`;
  await addToCollection("semantic", {
    id,
    document,
    metadata: {
      topic: brief.topic,
      date: brief.date,
      confidence: brief.confidence,
    },
  });
}

export async function querySimilarResearch(topic: string, limit = 3): Promise<string> {
  const results = await queryCollection("semantic", topic, limit);
  if (results.length === 0) return "";
  return results.map((r) => `Prior research: ${r.document.slice(0, 300)}`).join("\n\n");
}

export function isChromaOnline(): boolean {
  return online;
}
