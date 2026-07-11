import process from 'node:process';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Static SPA. Prerendered static routes become their own .html; dynamic
			// routes fall back to 404.html, which GitHub Pages serves for unknown paths
			// so client-side deep links (e.g. /recipes/<url>) still boot the app.
			adapter: adapter({ fallback: '404.html', precompress: false, strict: false }),
			// GitHub Pages serves the app under a repo subpath in CI; empty in local dev.
			// relative: false → absolute asset URLs, so the 404.html SPA fallback works
			// when serving deep links at any path depth.
			paths: { base, relative: false },
			// The PWA plugin owns the service worker.
			serviceWorker: { register: false }
		}),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			injectRegister: false,
			strategies: 'generateSW',
			scope: `${base}/`,
			base: `${base}/`,
			manifest: {
				name: 'Meal Planner',
				short_name: 'Meals',
				description: 'A personal recipe keeper and weekly meal planner.',
				start_url: `${base}/`,
				scope: `${base}/`,
				display: 'standalone',
				background_color: '#faf8f4',
				theme_color: '#2f5d50',
				icons: [
					{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
					{ src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
				]
			},
			workbox: {
				// Precache the app shell + the Automerge wasm so it works fully offline.
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wasm}'],
				maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
			},
			devOptions: { enabled: false }
		})
	],
	// The Automerge WASM is loaded via a `?url` asset import + initializeWasm(url).
	// Pre-bundle the Automerge packages at server start so their CommonJS deps
	// (eventemitter3, cbor-x, …) get correct ESM-interop and Vite doesn't do a
	// disruptive mid-session reload.
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
