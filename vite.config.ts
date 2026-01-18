import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		// adapter-auto only works if it's set up perfectly. 
		// Switching to adapter-vercel is safer for your troops monitor.
		adapter: adapter()
	}
};

export default config;
