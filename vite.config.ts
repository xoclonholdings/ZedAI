import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./client/src"),
            "@shared": path.resolve(__dirname, "./shared"),
        },
    },
    root: "./client",
    server: {
        port: 5173,
        host: true,
        proxy: {
            "/api": {
                target: "http://localhost:5001",
                changeOrigin: true,
                secure: false,
            },
        },
    },
    build: {
        outDir: "../dist/client",
        emptyOutDir: true,
        sourcemap: false,
    },
});
