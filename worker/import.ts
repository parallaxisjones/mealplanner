/// <reference types="@cloudflare/workers-types" />
import { parse, type HTMLElement } from 'node-html-parser';
import { parseRecipeJsonLd, type ParsedRecipe } from '../src/lib/domain/recipeImport';

const UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0';
const MAX_BYTES = 3_000_000;

/** Block non-public hosts before fetching a user-supplied URL (SSRF guard). */
function isBlockedHost(hostname: string): boolean {
	const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');
	if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal'))
		return true;
	if (h.includes(':')) return true; // IPv6 literal — recipe sites use hostnames
	const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (v4) {
		const a = Number(v4[1]);
		const b = Number(v4[2]);
		if (a === 0 || a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254))
			return true;
	}
	return false;
}

function textList(root: HTMLElement, selectors: string[]): string[] {
	for (const sel of selectors) {
		const els = root.querySelectorAll(sel);
		const items = els.map((e) => e.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean);
		if (items.length) return items;
	}
	return [];
}

function parseMicrodata(root: HTMLElement): ParsedRecipe | null {
	const scope = root.querySelector('[itemtype*="schema.org/Recipe"]');
	if (!scope) return null;
	const name = scope.querySelector('[itemprop="name"]')?.textContent.trim() ?? '';
	const ingredients = scope
		.querySelectorAll('[itemprop="recipeIngredient"], [itemprop="ingredients"]')
		.map((e) => e.textContent.trim())
		.filter(Boolean);
	const steps = scope
		.querySelectorAll('[itemprop="recipeInstructions"]')
		.map((e) => e.textContent.trim())
		.filter(Boolean);
	if (!name || ingredients.length === 0) return null;
	const img = scope.querySelector('[itemprop="image"]');
	return {
		title: name,
		ingredients,
		steps,
		image: img?.getAttribute('src') ?? img?.getAttribute('content') ?? null,
		servings: scope.querySelector('[itemprop="recipeYield"]')?.textContent.trim() || null,
		total_time: scope.querySelector('[itemprop="totalTime"]')?.getAttribute('datetime') ?? null
	};
}

function parseHeuristic(root: HTMLElement, _url: string): ParsedRecipe | null {
	const title =
		root.querySelector('h1')?.textContent.trim() ||
		root.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
		root.querySelector('title')?.textContent.trim() ||
		'';
	const ingredients = textList(root, [
		'[class*="recipe-ingredient"] li',
		'[class*="ingredient-list"] li',
		'[class*="ingredient"] li',
		'.ingredients li'
	]);
	const steps = textList(root, [
		'[class*="instruction"] li',
		'[class*="step"] li',
		'[class*="direction"] li',
		'[class*="method"] li'
	]);
	if (ingredients.length === 0 || steps.length === 0) return null;
	return {
		title,
		ingredients,
		steps,
		image: root.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null,
		servings: null,
		total_time: null
	};
}

export async function handleImport(request: Request): Promise<Response> {
	const target = new URL(request.url).searchParams.get('url');
	if (!target) return Response.json({ error: 'Missing url' }, { status: 400 });

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(target);
	} catch {
		return Response.json({ error: 'Invalid URL' }, { status: 400 });
	}
	if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
		return Response.json({ error: 'Only http(s) URLs are allowed' }, { status: 400 });
	}
	if (isBlockedHost(parsedUrl.hostname)) {
		return Response.json({ error: 'That host is not allowed' }, { status: 400 });
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 12_000);
	let html: string;
	try {
		const res = await fetch(parsedUrl.toString(), {
			headers: { 'user-agent': UA, accept: 'text/html,*/*' },
			redirect: 'follow',
			signal: controller.signal
		});
		if (!res.ok) return Response.json({ error: `Fetch failed (${res.status})` }, { status: 502 });
		const buf = await res.arrayBuffer();
		html = new TextDecoder().decode(buf.slice(0, MAX_BYTES));
	} catch {
		return Response.json({ error: 'Could not fetch that page' }, { status: 502 });
	} finally {
		clearTimeout(timeout);
	}

	const root = parse(html);
	const nodes: unknown[] = [];
	for (const script of root.querySelectorAll('script[type="application/ld+json"]')) {
		try {
			nodes.push(JSON.parse(script.textContent));
		} catch {
			/* skip malformed block */
		}
	}

	let parsed = parseRecipeJsonLd(nodes);
	let via = 'jsonld';
	if (!parsed) {
		parsed = parseMicrodata(root);
		via = 'microdata';
	}
	if (!parsed) {
		parsed = parseHeuristic(root, parsedUrl.toString());
		via = 'heuristic';
	}
	if (!parsed) {
		return Response.json({ error: 'No recipe found on that page' }, { status: 422 });
	}

	return Response.json({ ...parsed, parsed_via: via, source_url: parsedUrl.toString() });
}
