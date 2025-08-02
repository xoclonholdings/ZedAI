"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vite_1 = require("vite");
var plugin_react_1 = require("@vitejs/plugin-react");
var path_1 = require("path");
var node_url_1 = require("node:url");
var __dirname = path_1.default.dirname((0, node_url_1.fileURLToPath)(import.meta.url));
exports.default = (0, vite_1.defineConfig)({
    plugins: [
        (0, plugin_react_1.default)()
    ],
    resolve: {
        alias: {
            "@": path_1.default.resolve(__dirname, "./client/src"),
            "@shared": path_1.default.resolve(__dirname, "./shared"),
            "@assets": path_1.default.resolve(__dirname, "./client/src/assets"),
        },
    },
    root: "client",
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
        rollupOptions: {
            external: [],
        },
    },
    optimizeDeps: {
        include: [
            "react",
            "react-dom",
            "@tanstack/react-query",
            "lucide-react"
        ],
    },
    css: {
        postcss: {
            plugins: [],
        },
    },
});
