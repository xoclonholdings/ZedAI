import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "../../../shared"),
      "@assets": path.resolve(__dirname, "../../../assets"),
    },
  },
  build: {
    outDir: "./dist",
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:37745",
        changeOrigin: true,
      },
    },
  },
});