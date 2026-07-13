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
