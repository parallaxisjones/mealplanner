/// <reference types="@cloudflare/workers-types" />
import { handleImport } from './import';

// Single Worker for the Meal Planner: serves the static SPA (ASSETS binding) and
// hosts /api/* (recipe import, nutrition) and /sync/* (Automerge sync DO).

interface Env {
	ASSETS: Fetcher;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/api/health') {
			return Response.json({ ok: true, service: 'mealplanner' });
		}
		if (url.pathname === '/api/import') {
			return handleImport(request);
		}
		if (url.pathname.startsWith('/api/')) {
			return new Response('Not implemented yet', { status: 501 });
		}
		if (url.pathname.startsWith('/sync/')) {
			return new Response('Sync not available yet', { status: 501 });
		}

		// Everything else → the static SPA (with SPA fallback via assets config).
		return env.ASSETS.fetch(request);
	}
} satisfies ExportedHandler<Env>;
