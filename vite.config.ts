import process from 'node:process';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Static single-page-app: SPA fallback so the client router owns every route.
			adapter: adapter({ fallback: 'index.html', precompress: false, strict: false }),
			// GitHub Pages serves the app under a repo subpath in CI; empty in local dev.
			paths: { base: (process.env.BASE_PATH ?? '') as '' | `/${string}` },
			// The PWA plugin (added later) owns the service worker.
			serviceWorker: { register: false }
		})
	],
	// The Automerge WASM is loaded via a `?url` asset import + initializeWasm(url),
	// so no WASM Vite plugin is needed. Pre-bundle the Automerge packages at server
	// start (rather than on-demand) so (a) their CommonJS deps like eventemitter3
	// get correct ESM-interop default exports, and (b) Vite doesn't trigger a
	// disruptive mid-session "new dependencies optimized -> full reload".
	optimizeDeps: {
		include: [
			'@automerge/automerge/slim',
			'@automerge/automerge-repo/slim',
			'@automerge/automerge-repo-storage-indexeddb'
		]
	},
	// esnext keeps top-level await in the WASM glue intact for modern browsers.
	build: { target: 'esnext' },
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
