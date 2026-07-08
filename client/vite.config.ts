import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const manualChunkPackages: Record<string, string[]> = {
  react: ["react", "react-dom"],
  query: ["@tanstack/react-query"],
  markdown: ["react-markdown", "remark-gfm"],
  radix: [
    "@radix-ui/react-dialog",
    "@radix-ui/react-label",
    "@radix-ui/react-progress",
    "@radix-ui/react-select",
    "@radix-ui/react-slot",
    "@radix-ui/react-switch",
    "@radix-ui/react-toast",
    "@radix-ui/react-tooltip",
  ],
  icons: ["lucide-react"],
};

function manualChunks(id: string): string | undefined {
  if (!id.includes("node_modules")) return undefined;
  const normalizedId = id.replace(/\\/g, "/");

  for (const [chunkName, packages] of Object.entries(manualChunkPackages)) {
    if (packages.some((pkg) => normalizedId.includes(`/node_modules/${pkg}/`))) {
      return chunkName;
    }
  }

  return undefined;
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../shared"),
      "@assets": path.resolve(__dirname, "../attached_assets"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks,
      },
    },
  },
});
