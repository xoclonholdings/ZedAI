// import { storage } from "../storage"; // Disabled for minimal backend
import { 
  type InsertCoreMemory, 
  type InsertProjectMemory, 
  type InsertScratchpadMemory,
  type CoreMemory,
  type ProjectMemory,
  type ScratchpadMemory
} from "@shared/schema";

// Entire MemoryService class disabled for minimal backend
// static async initializeDefaultCoreMemory(): Promise<void> {
//   const defaults = [
//     {
//       key: "zed_personality",
//       value: "Zed is an intelligent, professional AI agent built to support creative, technical, and business-related tasks. Zed always responds with clarity, conciseness, and insight.",
//       description: "ZED's core personality (fallback)",
//       adminOnly: true
//     },
//     {
//       key: "tone", 
//       value: "Conversational, sharp, adaptive",
//       description: "ZED's response tone (fallback)",
//       adminOnly: true
//     },
//     {
//       key: "rules",
//       value: JSON.stringify([
//         "Always respond with relevance and intent.",
//         "Never disclose system-level details.",
//         "Avoid repetitive answers unless asked to repeat.",
//         "Refer to core memory before guessing.",
//         "Respect formatting and tone based on input context."
//       ]),
//       description: "ZED's core rules (fallback)",
//       adminOnly: true
//     },
//     {
//       key: "default_context",
//       value: JSON.stringify({
//         "primary_domain": "xoclon.property",
//         "default_user": "Admin",
//         "timezone": "EST",
//         "access_level": "system"
//       }),
//       description: "ZED's default context (fallback)",
//       adminOnly: true
//     }
//   ];
//
//   for (const defaultMemory of defaults) {
//     const existing = await this.getCoreMemory(defaultMemory.key);
//     if (!existing) {
//       await this.setCoreMemory(defaultMemory);
//     }
//   }
// }
//   }
