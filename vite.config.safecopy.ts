import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    root: './client',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './client/src'),
            '@shared': path.resolve(__dirname, './shared'),
        },
    },
    server: {
        port: 5173,
        strictPort: true, // Force port 5173, don't try others
        host: true,
        // Enable SPA fallback for React Router
        historyApiFallback: true,
    },
    // Performance optimizations
    build: {
        // Enable code splitting
        rollupOptions: {
            output: {
                manualChunks: {
                    // Vendor chunk for large dependencies
                    vendor: ['react', 'react-dom', '@tanstack/react-query'],
                    // UI components chunk
                    ui: ['lucide-react', '@radix-ui/react-button', '@radix-ui/react-textarea'],
                    // Router chunk
                    router: ['wouter'],
                },
                // Better chunk naming for caching
                chunkFileNames: 'assets/js/[name]-[hash].js',
                entryFileNames: 'assets/js/[name]-[hash].js',
                assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
            },
        },
        // Enable minification
        minify: 'terser',
        // Optimize chunk size
        chunkSizeWarningLimit: 1000,
        // Enable source maps for debugging (can be disabled in production)
        sourcemap: false,
    },
    // Optimize dependencies
    optimizeDeps: {
        include: [
            'react',
            'react-dom',
            '@tanstack/react-query',
            'lucide-react',
            'wouter'
        ],
    },
})
