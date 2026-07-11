# Increment 13 — Vault recipe batch import

**Date:** 2026-07-11
**Status:** Approved design, pending spec review

## Problem

Parker keeps ~50–70 recipes as Markdown notes in an Obsidian vault
(`~/Documents/notes`) — clean web-clip cards under `+ Cards/` and `+ Sources/`,
and a tidied family cookbook under `+ Spaces/Nonna Donini Recipes/`. He wants
every one of them available in the Meal Planner app.

The app is **local-first**: recipes are Automerge documents in the browser's
IndexedDB, discovered through a single `WorkspaceDoc` index. There is no server
database to bulk-load. The only bulk ingress today is **Settings → Import**,
which reads a `.mealplan` zip — and that import **replaces** the entire
workspace.

## Decisions (chosen with the user)

1. **Delivery: a batch script that emits one `.mealplan` file.** A Node script
   walks the vault, parses every recipe, and writes a single `.mealplan` zip.
   The user imports it once. This reuses the existing, tested import pipeline
   and gets everything in at once. (Rejected: in-app multi-file upload and
   paste-one-at-a-time — more UI for a one-time corpus.)
2. **Curation: auto-detect, no approval gate.** A structural heuristic decides
   what is a recipe; the script generates the file directly and the user prunes
   anything unwanted inside the app. No mid-way review UI.
3. **Import mode: append, not replace.** The user has existing data. A new
   `importRecipesOnly` path adds the vault recipes alongside existing recipes,
   plans, and collections. The destructive full import is left untouched.
4. **Tags: carry frontmatter tags across**, dropping the generic `recipe` tag,
   normalized to match `RecipeDoc.tags`.

## Architecture

Two new units; everything else is reused.

### New: `src/lib/domain/markdownRecipe.ts` (pure, unit-tested)

Mirrors `recipeImport.ts`: no Svelte/Automerge imports, so it stays trivially
testable and could later power an in-app "paste markdown" mode without rework.

```ts
export interface ParsedMarkdownRecipe {
  title: string;
  ingredients: string[];   // raw ingredient lines
  steps: string[];
  servings: number | null;
  source_url: string | null;
  notes: string | null;
  tags: string[];          // normalized, 'recipe' dropped
  created: string | null;  // frontmatter `created`, if present
}

/** Parse one note's markdown, or null if it isn't a recipe. */
export function parseMarkdownRecipe(md: string): ParsedMarkdownRecipe | null;
```

Extraction rules:

- **Frontmatter** — if the file starts with a `---` block, parse it minimally
  for `tags` (YAML list or `[a, b]`), `created`, and `servings`. No general YAML
  dependency; a small purpose-built reader is enough for this vault's shape.
- **Title** — first `# H1`. If it is `# [Text](url)`, `title = Text` and
  `source_url = url` (this is how web clips carry provenance). Otherwise
  `source_url = null`.
- **Ingredients** — first heading matching `/ingredients/i`; collect the
  following list items (`-`, `*`, or `N.`) until the next heading; strip the
  list marker and trim.
- **Steps** — first heading matching
  `/instructions|directions|method|steps|preparation/i`; same list collection,
  numbered or bulleted.
- **Servings** — `**Servings:** N` line, else frontmatter `servings`, else null.
- **Notes** — the intro paragraph between the title and the first section
  (images stripped) plus any `## Notes` section, joined by a blank line; null
  if empty.
- **Tags** — frontmatter tags minus `recipe`, trimmed/lowercased/deduped.

### Recipe-detection heuristic

A note is a recipe **iff** it has a title **and** ≥2 ingredient list-items
**and** ≥1 step. This structurally rejects the false positives without a
denylist:

- Project/milestone docs (`+ Projects/Meal Planner/*`), research notes, and
  `kitchen-assistant` prompts — no `Ingredients`-list + `Steps` pair.
- MOC/index files (e.g. `Nonna Donini's Cookbook.md`) — a list of links, no
  ingredients section.
- Idea/meta notes (`Thanksgiving Appetizer ideas`, `Mise En Place`,
  `Fridge forage`) — fail the list/step structure.

One note = one recipe; multi-recipe notes are **not** split (v1 scope).
Near-duplicates (e.g. three Arroz con Pollo variants) are all kept; the user
prunes in-app.

### New: `scripts/import-vault.ts` (Node glue)

- Imports domain code by **relative path** (`../src/lib/domain/markdownRecipe`,
  `../src/lib/domain/ingredients`, `../src/lib/domain/ids`) — the same approach
  `worker/import.ts` already uses to consume `src/lib` from outside SvelteKit.
- Recurses `*.md` under the vault path, reads each file, calls
  `parseMarkdownRecipe`.
- Maps each parsed recipe to a full `RecipeDoc` (see below).
- Builds the manifest and zips it with `fflate.zipSync` (already a dependency).
- Prints a report: `✓ parsed N · skipped M`, one line per skip with a reason.
- **Self-check**: re-opens the written zip, asserts the manifest parses and the
  recipe count matches before exiting 0.

Run via a new `package.json` script using **`tsx`** (added as a devDependency):

```
pnpm import:vault [vaultPath] [--out file]
# defaults: ~/Documents/notes  ->  ./vault-recipes.mealplan
```

### Field mapping → `RecipeDoc`

| RecipeDoc field | Source |
| --- | --- |
| `schema` | `1` |
| `id` | `uuidv7()` (portable identity for the manifest) |
| `title` | parsed title |
| `servings` | parsed servings |
| `ingredients` | `strings.map(parseIngredient)` — **reuse the app's own parser** so imported recipes behave identically to URL-imported ones; do not out-parse the app |
| `steps` | parsed steps |
| `tags` | parsed tags |
| `source_url` | parsed source_url |
| `notes` | parsed notes |
| `photo_hash` | `null` (images are remote URLs; embedding blobs is out of scope) |
| `created_at` | frontmatter `created` as ISO, else now |
| `updated_at` | now |

### `.mealplan` manifest emitted (matches `backup.ts` FORMAT 1)

```json
{
  "format": 1,
  "exported_at": "<ISO>",
  "current_week": null,
  "recipe_order": ["<uuid>", "..."],
  "collection_order": [],
  "recipes": [ /* full RecipeDoc objects */ ],
  "collections": [],
  "mealPlans": [],
  "shoppingList": null
}
```

No `photos/` entries (all `photo_hash` are null).

### New: `importRecipesOnly` in `src/lib/data/backup.ts`

```ts
/** Append the recipes from a .mealplan zip to the current workspace,
 *  leaving existing recipes, collections, plans, and shopping list intact. */
export async function importRecipesOnly(
  data: Uint8Array
): Promise<{ recipes: number }>;
```

- Unzip, read `meta = meal-plan.json`, guard `format <= FORMAT`.
- For each `manifest.recipes`: `repo.create<RecipeDoc>({ ...r, schema: 1 })`,
  then append `handle.url` to the current `WorkspaceDoc.recipe_ids`.
- Restore any `photos/*` entries via `putPhoto` (defensive; none expected here).
- Ignore `collections`/`mealPlans`/`shoppingList` — recipes only.
- Flush the new recipe docs **and** the workspace doc. Does **not** call
  `setWorkspaceRoot` (keeps the current workspace).

### Settings UI

In the existing **Backup** section of `src/routes/settings/+page.svelte`, add a
second control beside `Import backup`:

- Label **"Add recipes from a file"** with a hidden `.mealplan` file input.
- Handler `onAddRecipesFile` → `importRecipesOnly(data)` → message
  `Added N recipes. Reloading…` → `location.reload()` (reload refreshes the
  recipe list, matching the existing import's pattern).
- **No** destructive `confirm()` — the action is additive and cannot wipe data.

## Testing

- **Unit** (`src/lib/domain/markdownRecipe.test.ts`, vitest) over fixtures taken
  from real notes:
  - Positive: a clean `+ Cards` recipe; a `+ Sources` clip with
    `# [title](url)` (asserts `source_url`); a Nonna Donini entry with
    `**Servings:**` and numbered steps.
  - Negative (must return `null`): a milestone doc, a MOC/index file, an idea
    list.
  - Assert tag normalization (`recipe` dropped) and notes assembly.
- **Live run**: execute `pnpm import:vault` against the real vault; confirm the
  parsed/skipped counts are sane and spot-check a few parsed recipes. Then in
  the app, **Settings → Add recipes from a file → pick `vault-recipes.mealplan`**
  and confirm the recipes appear alongside existing data.

## Out of scope (v1)

- Splitting multi-recipe notes.
- Fetching/embedding recipe images as photo blobs.
- An in-app markdown paste/upload UI (the pure parser leaves the door open).
- De-duplicating near-identical recipes.

## Files touched

- `src/lib/domain/markdownRecipe.ts` (new)
- `src/lib/domain/markdownRecipe.test.ts` (new)
- `scripts/import-vault.ts` (new)
- `src/lib/data/backup.ts` (add `importRecipesOnly`)
- `src/routes/settings/+page.svelte` (add "Add recipes from a file")
- `package.json` (add `tsx` devDependency + `import:vault` script)
