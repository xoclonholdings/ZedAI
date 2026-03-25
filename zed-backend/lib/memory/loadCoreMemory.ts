import fs from "fs";
import path from "path";

export function loadCoreMemory() {
  try {
    const filePath = path.resolve(
      process.cwd(),
      "zed-memory/core.memory.json"
    );

    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);

    return parsed;
  } catch (error) {
    console.error("Failed to load core memory:", error);
    return null;
  }
}
