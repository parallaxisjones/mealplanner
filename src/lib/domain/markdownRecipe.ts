// Pure Markdown → recipe extraction for Obsidian vault notes. No Svelte/Automerge
// imports so it runs under node (vitest) and tsx. Mirrors recipeImport.ts in spirit.
import { normalizeTag, normalizeTags } from './tags';

export interface ParsedMarkdownRecipe {
	title: string;
	ingredients: string[];
	steps: string[];
	servings: number | null;
	source_url: string | null;
	notes: string | null;
	tags: string[];
	created: string | null;
}

export type AnalyzeResult =
	| { ok: true; recipe: ParsedMarkdownRecipe }
	| { ok: false; reason: string; hadTitle: boolean; ingredientCount: number; stepCount: number };

const HEADING = /^(#{1,6})\s+(.*)$/;
const INGREDIENTS_RE = /ingredient/i;
const STEPS_RE = /instruction|direction|method|steps|preparation/i;
const NOTES_RE = /^notes$/i;
const LIST_ITEM = /^(?:[-*+]\s+|\d+[.)]\s+)(.*)$/;
const IMAGE_LINE = /^!\[[^\]]*\]\([^)]*\)\s*$/;
const TITLE_LINK = /^\[([^\]]+)\]\(([^)]+)\)$/;
const SERVINGS_LINE = /^\*\*servings:?\*\*\s*(\d+)/i;
const OBSIDIAN_META = /^[\w][\w ]*::/; // e.g. "up:: [[Cooking]]"

interface Frontmatter {
	tags: string[];
	created: string | null;
	servings: number | null;
}

function unquote(s: string): string {
	return s.trim().replace(/^["']|["']$/g, '');
}

function splitFrontmatter(md: string): { fm: Frontmatter; body: string } {
	const fm: Frontmatter = { tags: [], created: null, servings: null };
	const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!m) return { fm, body: md };
	const body = md.slice(m[0].length);
	const lines = m[1].split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const created = line.match(/^created:\s*(.+)$/);
		if (created) fm.created = unquote(created[1]);
		const servings = line.match(/^servings:\s*(\d+)/i);
		if (servings) fm.servings = Number(servings[1]);
		const inline = line.match(/^tags:\s*\[(.*)\]\s*$/);
		if (inline) {
			fm.tags = inline[1].split(',').map(unquote).filter(Boolean);
		} else if (/^tags:\s*$/.test(line)) {
			for (let j = i + 1; j < lines.length; j++) {
				const item = lines[j].match(/^\s*-\s*(.+)$/);
				if (!item) break;
				fm.tags.push(unquote(item[1]));
			}
		}
	}
	return { fm, body };
}

export function analyzeMarkdownRecipe(md: string): AnalyzeResult {
	const { fm, body } = splitFrontmatter(md);
	const lines = body.split(/\r?\n/);

	let title = '';
	let source_url: string | null = null;
	let servings: number | null = fm.servings;
	const ingredients: string[] = [];
	const steps: string[] = [];
	const introLines: string[] = [];
	const notesLines: string[] = [];

	type Mode = 'pre' | 'ingredients' | 'steps' | 'notes' | 'other';
	let mode: Mode = 'pre';

	for (const raw of lines) {
		const h = raw.match(HEADING);
		if (h) {
			const level = h[1].length;
			const text = h[2].trim();
			if (level === 1 && !title) {
				const link = text.match(TITLE_LINK);
				if (link) {
					title = link[1].trim();
					source_url = link[2].trim();
				} else {
					title = text;
				}
				mode = 'pre';
			} else if (INGREDIENTS_RE.test(text)) {
				mode = 'ingredients';
			} else if (STEPS_RE.test(text)) {
				mode = 'steps';
			} else if (NOTES_RE.test(text)) {
				mode = 'notes';
			} else {
				mode = 'other';
			}
			continue;
		}
		const line = raw.trim();
		if (!line) continue;
		const li = line.match(LIST_ITEM);
		if (mode === 'ingredients') {
			if (li) ingredients.push(li[1].trim());
		} else if (mode === 'steps') {
			if (li) steps.push(li[1].trim());
		} else if (mode === 'notes') {
			notesLines.push(li ? li[1].trim() : line);
		} else if (mode === 'pre') {
			if (IMAGE_LINE.test(line) || OBSIDIAN_META.test(line) || /^#\S/.test(line)) continue;
			const s = line.match(SERVINGS_LINE);
			if (s) {
				servings = Number(s[1]);
				continue;
			}
			introLines.push(line);
		}
	}

	if (!title)
		return { ok: false, reason: 'no title', hadTitle: false, ingredientCount: ingredients.length, stepCount: steps.length };
	if (ingredients.length < 2)
		return {
			ok: false,
			reason: ingredients.length === 0 ? 'no ingredients' : 'only 1 ingredient',
			hadTitle: true,
			ingredientCount: ingredients.length,
			stepCount: steps.length
		};
	if (steps.length < 1)
		return { ok: false, reason: 'no steps', hadTitle: true, ingredientCount: ingredients.length, stepCount: steps.length };

	const noteParts: string[] = [];
	const intro = introLines.join(' ').trim();
	if (intro) noteParts.push(intro);
	const notes = notesLines.join('\n').trim();
	if (notes) noteParts.push(notes);

	return {
		ok: true,
		recipe: {
			title,
			ingredients,
			steps,
			servings,
			source_url,
			notes: noteParts.length ? noteParts.join('\n\n') : null,
			tags: normalizeTags(fm.tags).filter((t) => t !== normalizeTag('recipe')),
			created: fm.created
		}
	};
}

export function parseMarkdownRecipe(md: string): ParsedMarkdownRecipe | null {
	const res = analyzeMarkdownRecipe(md);
	return res.ok ? res.recipe : null;
}
