export * from "./types";
export * from "./cache";
export * from "./fallback";
export * from "./base";

// ❌ DO NOT export databaseStorage for now
// export * from "./databaseStorage";

// ✅ Force fallback storage as primary
import { fallbackStorage } from "./fallback";

export const storage = fallbackStorage;