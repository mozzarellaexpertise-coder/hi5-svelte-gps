import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		fs: {
			// Allows Vite to serve the Leaflet assets correctly
			allow: ['..']
		}
	}
});