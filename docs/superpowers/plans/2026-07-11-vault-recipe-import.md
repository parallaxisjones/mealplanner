# Vault Recipe Batch Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse the Obsidian vault's recipe notes into a `.mealplan` file and let the user import them into the app without wiping existing data.

**Architecture:** A pure, node-testable Markdown parser (`markdownRecipe.ts`) and pure doc/manifest builders (`vaultImport.ts`) do all the logic. A thin Node script (`scripts/import-vault.ts`, run via `tsx`) does file I/O and zipping, reusing the app's own `parseIngredient`, `uuidv7`, and `normalizeTags`. A new `importRecipesOnly` append path in `backup.ts` plus a non-destructive Settings control loads the file.

**Tech Stack:** TypeScript, SvelteKit (Svelte 5 runes), vitest (node env), fflate, tsx, Automerge (`automerge-repo`), pnpm.

## Global Constraints

- **Node ≥ 20** (global Web Crypto for `uuidv7`; `tsx` runtime).
- Domain modules under `src/lib/domain/` stay **free of Svelte/Automerge imports** and use **relative** imports between each other (so they run under node vitest and under `tsx`). Precedent: `worker/import.ts` imports `../src/lib/domain/recipeImport`.
- vitest runs with `expect: { requireAssertions: true }` — **every test must assert**.
- Reuse, do not reinvent: `parseIngredient` (`src/lib/domain/ingredients.ts`), `uuidv7` (`src/lib/domain/ids.ts`), `normalizeTag`/`normalizeTags` (`src/lib/domain/tags.ts`).
- `.mealplan` = a zip whose manifest file is named exactly `meal-plan.json`, with `format: 1`.
- Package manager is **pnpm**. Do not push branches. Commit with `git -c commit.gpgsign=false` (signing fails headless in this environment).
- Match existing Settings-page conventions: Svelte 5 runes (`$state`), Tailwind utility classes already used there.

---

### Task 1: Markdown recipe parser (`markdownRecipe.ts`)

Pure function: one note's Markdown → structured recipe, or a typed skip reason. This is the bulk of the logic and is fully node-tested.

**Files:**
- Create: `src/lib/domain/markdownRecipe.ts`
- Test: `src/lib/domain/markdownRecipe.test.ts`

**Interfaces:**
- Consumes: `normalizeTag`, `normalizeTags` from `./tags`.
- Produces:
  - `interface ParsedMarkdownRecipe { title: string; ingredients: string[]; steps: string[]; servings: number | null; source_url: string | null; notes: string | null; tags: string[]; created: string | null; }`
  - `type AnalyzeResult = { ok: true; recipe: ParsedMarkdownRecipe } | { ok: false; reason: string; hadTitle: boolean; ingredientCount: number; stepCount: number }`
  - `function analyzeMarkdownRecipe(md: string): AnalyzeResult`
  - `function parseMarkdownRecipe(md: string): ParsedMarkdownRecipe | null`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/domain/markdownRecipe.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseMarkdownRecipe, analyzeMarkdownRecipe } from './markdownRecipe';

const webClip = `---
created: 2017-11-10T04:07:50+00:00
type: card
tags:
  - recipe
  - indian
  - chicken
---
up:: [[Cooking]]

# [Easy 20 Minute Butter Chicken](https://gimmedelicious.com/butter-chicken/)

Quick 20-minute butter chicken is creamy and packed full of flavor.

![img](https://example.com/a.jpg)

### Ingredients

- 1 tablespoon oil
- 1 medium onion (diced)
- 1 cup heavy cream

### Instructions

- Heat a skillet and cook the onions.
- Add the cream and simmer.
`;

const nonna = `---
created: 2025-07-12
tags:
  - nonna-donini
  - recipe
---

# Risotto

A simple comforting risotto.

**Servings:** 6

## Ingredients

- 1 medium onion
- 5 cups raw rice

## Instructions

1. Saute the onion.
2. Add the rice and stir.

## Notes

- Clarified the tomato gravy quantity.
`;

const multiComponent = `# Pastiera

## Pie Crust

### Ingredients

- 2 cups flour
- 1 stick butter

### Instructions

1. Make the crust.

## Filling

### Ingredients

- 1 cup ricotta
- 2 eggs

### Instructions

1. Mix the filling.
2. Bake.
`;

const projectDoc = `# M1.1 - Foundation + Recipe CRUD

## Goal

Build the recipe data model.

## Tasks

- Define types
- Wire the repo
`;

const moc = `# Nonna Donini's Cookbook

## Table of Contents

- [[Risotto]]
- [[Amaretti]]
`;

describe('parseMarkdownRecipe', () => {
  it('parses a web clip: title, source_url from the title link, ingredients, steps', () => {
    const r = parseMarkdownRecipe(webClip)!;
    expect(r.title).toBe('Easy 20 Minute Butter Chicken');
    expect(r.source_url).toBe('https://gimmedelicious.com/butter-chicken/');
    expect(r.ingredients).toEqual(['1 tablespoon oil', '1 medium onion (diced)', '1 cup heavy cream']);
    expect(r.steps).toEqual(['Heat a skillet and cook the onions.', 'Add the cream and simmer.']);
  });

  it('drops the generic "recipe" tag and normalizes the rest', () => {
    const r = parseMarkdownRecipe(webClip)!;
    expect(r.tags).toEqual(['indian', 'chicken']);
  });

  it('folds the intro paragraph into notes and ignores images/metadata lines', () => {
    const r = parseMarkdownRecipe(webClip)!;
    expect(r.notes).toContain('Quick 20-minute butter chicken');
    expect(r.notes).not.toContain('![');
    expect(r.notes).not.toContain('up::');
  });

  it('parses servings and a Notes section (## headings, numbered steps)', () => {
    const r = parseMarkdownRecipe(nonna)!;
    expect(r.title).toBe('Risotto');
    expect(r.source_url).toBeNull();
    expect(r.servings).toBe(6);
    expect(r.steps).toEqual(['Saute the onion.', 'Add the rice and stir.']);
    expect(r.notes).toContain('Clarified the tomato gravy');
    expect(r.notes).toContain('A simple comforting risotto');
  });

  it('collects ALL ingredient/step sections for multi-component recipes', () => {
    const r = parseMarkdownRecipe(multiComponent)!;
    expect(r.ingredients).toEqual(['2 cups flour', '1 stick butter', '1 cup ricotta', '2 eggs']);
    expect(r.steps).toEqual(['Make the crust.', 'Mix the filling.', 'Bake.']);
  });

  it('exposes frontmatter created verbatim for later date mapping', () => {
    expect(parseMarkdownRecipe(nonna)!.created).toBe('2025-07-12');
  });

  it('returns null for a project doc (no ingredients/steps pair)', () => {
    expect(parseMarkdownRecipe(projectDoc)).toBeNull();
  });

  it('returns null for a MOC / table-of-contents file', () => {
    expect(parseMarkdownRecipe(moc)).toBeNull();
  });
});

describe('analyzeMarkdownRecipe', () => {
  it('reports a near-miss reason when steps are missing', () => {
    const md = '# Salad\n\n## Ingredients\n\n- lettuce\n- tomato\n';
    const res = analyzeMarkdownRecipe(md);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe('no steps');
      expect(res.hadTitle).toBe(true);
      expect(res.ingredientCount).toBe(2);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/lib/domain/markdownRecipe.test.ts`
Expected: FAIL — `Failed to resolve import "./markdownRecipe"` / functions not defined.

- [ ] **Step 3: Implement the parser**

Create `src/lib/domain/markdownRecipe.ts`:

```ts
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

	if (!title) return { ok: false, reason: 'no title', hadTitle: false, ingredientCount: ingredients.length, stepCount: steps.length };
	if (ingredients.length < 2)
		return {
			ok: false,
			reason: ingredients.length === 0 ? 'no ingredients' : 'only 1 ingredient',
			hadTitle: true,
			ingredientCount: ingredients.length,
			stepCount: steps.length
		};
	if (steps.length < 1) return { ok: false, reason: 'no steps', hadTitle: true, ingredientCount: ingredients.length, stepCount: steps.length };

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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/lib/domain/markdownRecipe.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/markdownRecipe.ts src/lib/domain/markdownRecipe.test.ts
git -c commit.gpgsign=false commit -m "feat: markdown recipe parser for vault notes"
```

---

### Task 2: Recipe-doc and manifest builders (`vaultImport.ts`)

Pure mapping from parsed recipes → `RecipeDoc` and → a FORMAT-1 manifest object. Node-testable because `parseIngredient`/`uuidv7` run in node.

**Files:**
- Create: `src/lib/domain/vaultImport.ts`
- Test: `src/lib/domain/vaultImport.test.ts`

**Interfaces:**
- Consumes: `ParsedMarkdownRecipe` from `./markdownRecipe`; `parseIngredient` from `./ingredients`; `uuidv7` from `./ids`; `RecipeDoc` from `./types`.
- Produces:
  - `function frontmatterDateToIso(created: string | null, fallbackIso: string): string`
  - `function parsedToRecipeDoc(parsed: ParsedMarkdownRecipe, nowIso?: string): RecipeDoc`
  - `interface RecipeManifest { format: 1; exported_at: string; current_week: null; recipe_order: string[]; collection_order: never[]; recipes: RecipeDoc[]; collections: never[]; mealPlans: never[]; shoppingList: null }`
  - `function buildRecipeManifest(recipes: RecipeDoc[], nowIso?: string): RecipeManifest`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/domain/vaultImport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parsedToRecipeDoc, buildRecipeManifest, frontmatterDateToIso } from './vaultImport';
import type { ParsedMarkdownRecipe } from './markdownRecipe';

const base: ParsedMarkdownRecipe = {
	title: 'Risotto',
	ingredients: ['1 medium onion', '5 cups raw rice'],
	steps: ['Saute the onion.', 'Add the rice.'],
	servings: 6,
	source_url: null,
	notes: 'Comforting.',
	tags: ['nonna-donini'],
	created: '2025-07-12'
};

describe('frontmatterDateToIso', () => {
	it('converts a full ISO created stamp', () => {
		expect(frontmatterDateToIso('2017-11-10T04:07:50+00:00', 'FB')).toBe('2017-11-10T04:07:50.000Z');
	});
	it('falls back when created is null or unparseable', () => {
		expect(frontmatterDateToIso(null, 'FB')).toBe('FB');
		expect(frontmatterDateToIso('not-a-date', 'FB')).toBe('FB');
	});
});

describe('parsedToRecipeDoc', () => {
	it('maps ingredient strings through parseIngredient into structured fields', () => {
		const doc = parsedToRecipeDoc(base, '2026-07-11T00:00:00.000Z');
		expect(doc.ingredients[1]).toMatchObject({ quantity: 5, unit: 'cup', name: 'raw rice', original: '5 cups raw rice' });
	});
	it('sets schema 1, null photo, and carries scalar fields', () => {
		const doc = parsedToRecipeDoc(base, '2026-07-11T00:00:00.000Z');
		expect(doc.schema).toBe(1);
		expect(doc.photo_hash).toBeNull();
		expect(doc.servings).toBe(6);
		expect(doc.tags).toEqual(['nonna-donini']);
		expect(doc.steps).toEqual(['Saute the onion.', 'Add the rice.']);
		expect(typeof doc.id).toBe('string');
	});
	it('uses frontmatter created as created_at and now as updated_at', () => {
		const doc = parsedToRecipeDoc(base, '2026-07-11T00:00:00.000Z');
		expect(doc.created_at).toBe('2025-07-12T00:00:00.000Z');
		expect(doc.updated_at).toBe('2026-07-11T00:00:00.000Z');
	});
});

describe('buildRecipeManifest', () => {
	it('produces a FORMAT-1 recipes-only manifest whose order matches the ids', () => {
		const docs = [parsedToRecipeDoc(base), parsedToRecipeDoc({ ...base, title: 'Amaretti' })];
		const m = buildRecipeManifest(docs, '2026-07-11T00:00:00.000Z');
		expect(m.format).toBe(1);
		expect(m.recipe_order).toEqual(docs.map((d) => d.id));
		expect(m.recipes).toBe(docs);
		expect(m.collections).toEqual([]);
		expect(m.mealPlans).toEqual([]);
		expect(m.shoppingList).toBeNull();
		expect(m.current_week).toBeNull();
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/lib/domain/vaultImport.test.ts`
Expected: FAIL — `Failed to resolve import "./vaultImport"`.

- [ ] **Step 3: Implement the builders**

Create `src/lib/domain/vaultImport.ts`:

```ts
// Pure builders: parsed vault recipes → RecipeDoc → a recipes-only .mealplan
// manifest (FORMAT 1, matching src/lib/data/backup.ts). No I/O here.
import type { RecipeDoc } from './types';
import { parseIngredient } from './ingredients';
import { uuidv7 } from './ids';
import type { ParsedMarkdownRecipe } from './markdownRecipe';

export function frontmatterDateToIso(created: string | null, fallbackIso: string): string {
	if (!created) return fallbackIso;
	const d = new Date(created);
	return Number.isNaN(d.getTime()) ? fallbackIso : d.toISOString();
}

export function parsedToRecipeDoc(parsed: ParsedMarkdownRecipe, nowIso = new Date().toISOString()): RecipeDoc {
	return {
		schema: 1,
		id: uuidv7(),
		title: parsed.title,
		servings: parsed.servings,
		ingredients: parsed.ingredients.map((line) => parseIngredient(line)),
		steps: parsed.steps,
		tags: parsed.tags,
		source_url: parsed.source_url,
		notes: parsed.notes,
		photo_hash: null,
		created_at: frontmatterDateToIso(parsed.created, nowIso),
		updated_at: nowIso
	};
}

export interface RecipeManifest {
	format: 1;
	exported_at: string;
	current_week: null;
	recipe_order: string[];
	collection_order: never[];
	recipes: RecipeDoc[];
	collections: never[];
	mealPlans: never[];
	shoppingList: null;
}

export function buildRecipeManifest(recipes: RecipeDoc[], nowIso = new Date().toISOString()): RecipeManifest {
	return {
		format: 1,
		exported_at: nowIso,
		current_week: null,
		recipe_order: recipes.map((r) => r.id),
		collection_order: [],
		recipes,
		collections: [],
		mealPlans: [],
		shoppingList: null
	};
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run src/lib/domain/vaultImport.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain/vaultImport.ts src/lib/domain/vaultImport.test.ts
git -c commit.gpgsign=false commit -m "feat: recipe-doc and manifest builders for vault import"
```

---

### Task 3: CLI script (`scripts/import-vault.ts`) + tooling

The thin I/O layer: walk the vault, parse, build, zip, write, report, self-check. Verified with a fixture directory (no browser needed).

**Files:**
- Create: `scripts/import-vault.ts`
- Modify: `package.json` (add `tsx` devDependency + `import:vault` script)

**Interfaces:**
- Consumes: `analyzeMarkdownRecipe` from `../src/lib/domain/markdownRecipe`; `parsedToRecipeDoc`, `buildRecipeManifest` from `../src/lib/domain/vaultImport`.
- Produces: a `.mealplan` file on disk; a stdout report. No exported API.

- [ ] **Step 1: Add `tsx` and the npm script**

Run:

```bash
pnpm add -D tsx
```

Then add to `package.json` `"scripts"` (keep the others):

```json
"import:vault": "tsx scripts/import-vault.ts"
```

- [ ] **Step 2: Implement the script**

Create `scripts/import-vault.ts`:

```ts
// Walk an Obsidian vault, parse every recipe note, and write a recipes-only
// .mealplan zip the app can import. Run: pnpm import:vault [vaultPath] [--out file]
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { analyzeMarkdownRecipe } from '../src/lib/domain/markdownRecipe';
import { parsedToRecipeDoc, buildRecipeManifest } from '../src/lib/domain/vaultImport';

function expandHome(p: string): string {
	return p.startsWith('~') ? homedir() + p.slice(1) : p;
}

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		if (name.startsWith('.')) continue; // skip .git, .obsidian, etc.
		const p = join(dir, name);
		if (statSync(p).isDirectory()) out.push(...walk(p));
		else if (name.toLowerCase().endsWith('.md')) out.push(p);
	}
	return out;
}

function main(): void {
	const args = process.argv.slice(2);
	const outIdx = args.indexOf('--out');
	const out = outIdx >= 0 ? args[outIdx + 1] : 'vault-recipes.mealplan';
	const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
	const vault = resolve(expandHome(positional[0] ?? join(homedir(), 'Documents', 'notes')));

	const files = walk(vault);
	const recipes = [];
	const nearMisses: string[] = [];
	let skipped = 0;

	for (const f of files) {
		const res = analyzeMarkdownRecipe(readFileSync(f, 'utf8'));
		if (res.ok) {
			recipes.push(parsedToRecipeDoc(res.recipe));
		} else {
			skipped++;
			// Only surface skips that looked like a recipe (had a title + some ingredients).
			if (res.hadTitle && res.ingredientCount >= 1) nearMisses.push(`  ✗ ${basename(f)} — ${res.reason}`);
		}
	}

	recipes.sort((a, b) => a.title.localeCompare(b.title));
	const manifest = buildRecipeManifest(recipes);
	const zip = zipSync({ 'meal-plan.json': strToU8(JSON.stringify(manifest)) });
	writeFileSync(out, zip);

	// Self-check: the file we just wrote must round-trip.
	const back = JSON.parse(strFromU8(unzipSync(readFileSync(out))['meal-plan.json']));
	if (back.format !== 1 || back.recipes.length !== recipes.length) {
		console.error('✗ self-check failed: written file did not round-trip');
		process.exit(1);
	}

	console.log(`✓ parsed ${recipes.length} · skipped ${skipped} (of ${files.length} .md files)`);
	if (nearMisses.length) {
		console.log(`\nNear-misses worth a look (had a title + ingredients):`);
		for (const line of nearMisses) console.log(line);
	}
	console.log(`\n→ wrote ${resolve(out)}`);
}

main();
```

- [ ] **Step 3: Build a fixture vault and run the script against it**

Run:

```bash
mkdir -p /tmp/vault-fixture/sub
printf '%s\n' '# [Butter Chicken](https://x.test/bc)' '' '### Ingredients' '' '- 1 tablespoon oil' '- 1 cup heavy cream' '' '### Instructions' '' '- Cook it.' > /tmp/vault-fixture/bc.md
printf '%s\n' '# Risotto' '' '## Ingredients' '' '- 1 onion' '- 5 cups rice' '' '## Instructions' '' '1. Saute.' '2. Stir.' > /tmp/vault-fixture/sub/risotto.md
printf '%s\n' '# Project Notes' '' '## Goal' '' '- do a thing' > /tmp/vault-fixture/notes.md
pnpm import:vault /tmp/vault-fixture --out /tmp/vault-fixture/out.mealplan
```

Expected stdout:

```
✓ parsed 2 · skipped 1 (of 3 .md files)

→ wrote /tmp/vault-fixture/out.mealplan
```

(The project-notes file is skipped silently — no title+ingredients near-miss.)

- [ ] **Step 4: Verify the written file's contents**

Run:

```bash
node -e "const {unzipSync,strFromU8}=require('fflate');const fs=require('fs');const m=JSON.parse(strFromU8(unzipSync(fs.readFileSync('/tmp/vault-fixture/out.mealplan'))['meal-plan.json']));console.log('format',m.format,'recipes',m.recipes.length,'titles',m.recipes.map(r=>r.title));console.log('bc.ingredient0',JSON.stringify(m.recipes.find(r=>r.title==='Butter Chicken').ingredients[0]));console.log('bc.source',m.recipes.find(r=>r.title==='Butter Chicken').source_url);"
```

Expected: `format 1 recipes 2 titles [ 'Butter Chicken', 'Risotto' ]`, ingredient0 shows `{"quantity":1,"unit":"tbsp","name":"oil",...}`, source `https://x.test/bc`.

- [ ] **Step 5: Type-check and commit**

```bash
pnpm check
git add scripts/import-vault.ts package.json pnpm-lock.yaml
git -c commit.gpgsign=false commit -m "feat: import-vault CLI script + tsx tooling"
```

Expected: `pnpm check` reports 0 errors.

---

### Task 4: Append import path + Settings control

Add a non-destructive import that appends recipes to the current workspace, and wire a Settings button to it. Verified live in a headless browser (the data layer needs IndexedDB, so it can't be node-unit-tested).

**Files:**
- Modify: `src/lib/data/backup.ts` (add `importRecipesOnly`; import already has `unzipSync`, `strFromU8`, `getWorkspaceUrl`, `putPhoto`, `DocumentId`, `AutomergeUrl`)
- Modify: `src/routes/settings/+page.svelte`

**Interfaces:**
- Consumes: existing `getRepo`, `getWorkspaceUrl` from `./repo`; `putPhoto` from `./photos`; `FORMAT`, `MANIFEST` constants already in `backup.ts`.
- Produces: `export async function importRecipesOnly(data: Uint8Array): Promise<{ recipes: number }>`

- [ ] **Step 1: Implement `importRecipesOnly` in `src/lib/data/backup.ts`**

Add at the end of the file (all imported names above are already imported by the module):

```ts
/**
 * Append the recipes from a `.mealplan` zip to the CURRENT workspace, leaving
 * existing recipes, collections, plans, and shopping list untouched. Each recipe
 * gets a fresh Automerge URL; only recipes are imported (collections/plans in the
 * file are ignored). Does not change the workspace root.
 */
export async function importRecipesOnly(data: Uint8Array): Promise<{ recipes: number }> {
	const files = unzipSync(data);
	const manifestBytes = files[MANIFEST];
	if (!manifestBytes) throw new Error('Not a valid file: missing meal-plan.json.');
	const manifest = JSON.parse(strFromU8(manifestBytes));
	if (typeof manifest.format !== 'number' || manifest.format > FORMAT) {
		throw new Error('This file was made by a newer version of the app.');
	}

	const repo = await getRepo();
	const ws = await repo.find<WorkspaceDoc>(await getWorkspaceUrl());
	const flushed: DocumentId[] = [];

	// Restore any embedded photos (defensive — vault files carry none).
	for (const name of Object.keys(files)) {
		if (name.startsWith('photos/') && !name.includes('..')) {
			await putPhoto(new Blob([files[name] as BlobPart]));
		}
	}

	const newUrls: AutomergeUrl[] = [];
	for (const r of manifest.recipes ?? []) {
		const handle = repo.create<RecipeDoc>({ ...r, schema: 1 });
		newUrls.push(handle.url);
		flushed.push(handle.documentId);
	}
	ws.change((w) => {
		for (const url of newUrls) w.recipe_ids.push(url);
	});
	flushed.push(ws.documentId);
	await repo.flush(flushed);

	return { recipes: newUrls.length };
}
```

- [ ] **Step 2: Wire the Settings control in `src/routes/settings/+page.svelte`**

Change the import line (top of `<script>`):

```ts
import { exportWorkspace, importWorkspace, importRecipesOnly } from '$lib/data/backup';
```

Add this handler after `onImportFile`:

```ts
	async function onAddRecipesFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		busy = true;
		message = '';
		try {
			const data = new Uint8Array(await file.arrayBuffer());
			const s = await importRecipesOnly(data);
			message = `Added ${s.recipes} recipes. Reloading…`;
			setTimeout(() => location.reload(), 900);
		} catch (e) {
			message = `Add failed: ${e instanceof Error ? e.message : String(e)}`;
			busy = false;
		}
	}
```

Add a second `<label>` immediately after the existing "Import backup" `<label>` (inside the same `flex` row):

```svelte
				<label
					class="cursor-pointer rounded-full border border-line px-5 py-2 text-sm text-ink transition hover:border-herb"
				>
					Add recipes from a file
					<input
						type="file"
						accept=".mealplan,.zip,application/zip"
						class="hidden"
						data-testid="add-recipes-input"
						onchange={onAddRecipesFile}
					/>
				</label>
```

- [ ] **Step 3: Type-check**

Run: `pnpm check`
Expected: 0 errors.

- [ ] **Step 4: Live-verify append semantics in a headless browser**

Write the verification driver to scratchpad (not committed):

`/private/tmp/claude-1256477969/-Users-pjones-dev-mealplanner/afc88f7f-cf52-4dba-a273-4ef3ce4c5731/scratchpad/verify-append.mjs`:

```js
import { chromium } from 'playwright';
import { zipSync, strToU8 } from 'fflate';
import { writeFileSync } from 'node:fs';

const mk = (titles) => {
	const recipes = titles.map((t, i) => ({
		schema: 1, id: `id-${t}-${i}`, title: t, servings: null,
		ingredients: [{ quantity: 1, unit: null, name: 'thing', notes: null, original: '1 thing' }],
		steps: ['do it'], tags: [], source_url: null, notes: null, photo_hash: null,
		created_at: '2020-01-01T00:00:00.000Z', updated_at: '2020-01-01T00:00:00.000Z'
	}));
	const manifest = { format: 1, exported_at: 'x', current_week: null, recipe_order: recipes.map((r) => r.id), collection_order: [], recipes, collections: [], mealPlans: [], shoppingList: null };
	return zipSync({ 'meal-plan.json': strToU8(JSON.stringify(manifest)) });
};
const dir = '/private/tmp/claude-1256477969/-Users-pjones-dev-mealplanner/afc88f7f-cf52-4dba-a273-4ef3ce4c5731/scratchpad';
writeFileSync(`${dir}/two.mealplan`, mk(['Alpha Soup', 'Beta Stew']));
writeFileSync(`${dir}/one.mealplan`, mk(['Gamma Cake']));

const browser = await chromium.launch();
const page = await browser.newPage();
const base = 'http://localhost:4173';
await page.goto(base);
await page.goto(`${base}/settings`);
await page.setInputFiles('[data-testid=add-recipes-input]', `${dir}/two.mealplan`);
await page.waitForTimeout(1500); // reload
await page.goto(`${base}/`);
const afterTwo = await page.getByText(/Alpha Soup|Beta Stew/).count();
await page.goto(`${base}/settings`);
await page.setInputFiles('[data-testid=add-recipes-input]', `${dir}/one.mealplan`);
await page.waitForTimeout(1500);
await page.goto(`${base}/`);
const alpha = await page.getByText('Alpha Soup').count();
const gamma = await page.getByText('Gamma Cake').count();
console.log(JSON.stringify({ afterTwo, alphaStillPresent: alpha, gamma }));
if (afterTwo < 2 || alpha < 1 || gamma < 1) { console.error('FAIL: append did not preserve prior recipes'); process.exit(1); }
console.log('PASS: recipes appended, prior recipes preserved');
await browser.close();
```

Run:

```bash
pnpm exec playwright install chromium
pnpm build && pnpm preview --port 4173 &
sleep 4
node /private/tmp/claude-1256477969/-Users-pjones-dev-mealplanner/afc88f7f-cf52-4dba-a273-4ef3ce4c5731/scratchpad/verify-append.mjs
kill %1
```

Expected: final line `PASS: recipes appended, prior recipes preserved`. (Recipe titles render on the home/recipes list via `RecipeCard`. If the home route isn't the list, adjust the driver to the actual recipes list route observed in `src/routes`.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/backup.ts src/routes/settings/+page.svelte
git -c commit.gpgsign=false commit -m "feat: append-only recipe import in Settings"
```

---

### Task 5: Acceptance — real vault run + import + spot-check

Prove the end-to-end goal against the actual vault, then finish the branch.

**Files:** none (produces `vault-recipes.mealplan` at repo root; git-ignore it in Step 3).

- [ ] **Step 1: Run against the real vault**

Run: `pnpm import:vault`
Expected: `✓ parsed N · skipped M (of ~700 .md files)` with N in the ~50–70 range, plus a short near-miss list. Eyeball the near-misses for any real recipe wrongly excluded; if one appears, note the file and its structure (do not change scope here — record it as a follow-up).

- [ ] **Step 2: Spot-check the generated file in a headless browser**

Reuse a Playwright driver (scratchpad) that imports `./vault-recipes.mealplan` via the Settings `add-recipes-input`, then:
- asserts the recipe count on the list ≈ N,
- opens "Risotto" and asserts it shows servings 6 and 7 ingredients,
- opens one web-clip recipe and asserts its source link is present.

Run it against `pnpm build && pnpm preview --port 4173`. Expected: assertions pass; print the observed recipe count.

- [ ] **Step 3: Keep the generated artifact out of git**

Add to `.gitignore`:

```
vault-recipes.mealplan
```

Run:

```bash
git add .gitignore
git -c commit.gpgsign=false commit -m "chore: ignore generated vault-recipes.mealplan"
```

- [ ] **Step 4: Full test + type-check gate**

Run: `pnpm test:unit -- --run && pnpm check`
Expected: all unit tests pass; 0 type errors.

- [ ] **Step 5: Report and hand off**

Report to the user: parsed/skipped counts, the near-miss list, and the exact steps for them to import in their own browser — **Settings → Add recipes from a file → pick `vault-recipes.mealplan`**. Then use the `superpowers:finishing-a-development-branch` skill to choose merge/PR/cleanup for branch `increment-13-vault-recipe-import`.

---

## Self-Review

**Spec coverage:**
- Batch script → `.mealplan` → Task 3. ✓
- Pure `markdownRecipe.ts` parser + structural detection → Task 1. ✓
- Reuse `parseIngredient` → Task 2. ✓
- Tags carried across, `recipe` dropped, normalized → Task 1 (parse) + Task 2 (passthrough). ✓
- `created_at` from frontmatter → Task 2 (`frontmatterDateToIso`). ✓
- Notes = intro + `## Notes` → Task 1. ✓
- Multi-component recipes (collect all sections) → Task 1. ✓
- `importRecipesOnly` append path (no root change, recipes only) → Task 4. ✓
- Non-destructive Settings control → Task 4. ✓
- Duplicates kept, prune in-app → no dedup logic anywhere (by design). ✓
- Photos out of scope → `photo_hash: null` in Task 2; defensive photo restore in Task 4. ✓
- Testing: pure units node-tested (Tasks 1–2), script fixture-verified (Task 3), append live-verified (Task 4), real vault accepted (Task 5). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every run step shows the command and expected output. ✓

**Type consistency:** `ParsedMarkdownRecipe` shape identical across Tasks 1→2. `analyzeMarkdownRecipe`/`parseMarkdownRecipe` names consistent Task 1→3. `parsedToRecipeDoc`/`buildRecipeManifest` names consistent Task 2→3. `importRecipesOnly(data: Uint8Array): Promise<{ recipes: number }>` consistent Task 4 def→UI call. `RecipeManifest` matches the FORMAT-1 shape `importWorkspace`/`importRecipesOnly` read. ✓
