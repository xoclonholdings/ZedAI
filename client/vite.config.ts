import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
	build: {
		target: 'esnext',
	},
	server: {
		host: '0.0.0.0',
		port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
		strictPort: false, // Allow Vite to find an available port
		watch: {
			usePolling: true,
		},
		headers: process.env.NODE_ENV === 'development' 
			? {
				// No CSP in development to avoid eval() issues
				'X-Content-Type-Options': 'nosniff',
				'X-Frame-Options': 'DENY',
				'X-XSS-Protection': '1; mode=block',
				'Referrer-Policy': 'strict-origin-when-cross-origin',
				'Permissions-Policy': 'geolocation=(), camera=(), microphone=()'
			}
			: {
				'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
				'X-Content-Type-Options': 'nosniff',
				'X-Frame-Options': 'DENY',
				'X-XSS-Protection': '1; mode=block',
				'Referrer-Policy': 'strict-origin-when-cross-origin',
				'Permissions-Policy': 'geolocation=(), camera=(), microphone=()'
			}
	},
	preview: {
		host: '0.0.0.0',
		port: process.env.PREVIEW_PORT ? parseInt(process.env.PREVIEW_PORT) : 4173,
		open: false,
		strictPort: false, // Allow Vite to find an available port
	},
});
