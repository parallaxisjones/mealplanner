import type { Ingredient, NutritionData, RecipeDoc } from './types';

export const MACRO_KEYS = [
	'calories',
	'protein_g',
	'fat_g',
	'carbs_g',
	'fiber_g',
	'sodium_mg'
] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];
export type Totals = Record<MacroKey, number | null>;

export interface Contribution {
	totals: Totals;
	counted: boolean;
}

const emptyTotals = (): Totals => ({
	calories: null,
	protein_g: null,
	fat_g: null,
	carbs_g: null,
	fiber_g: null,
	sodium_mg: null
});

const MASS_G: Record<string, number> = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };
// Volume → millilitres; grams estimated at ~1 g/ml (rough, hence totals are "~").
const VOLUME_ML: Record<string, number> = { ml: 1, l: 1000, cup: 240, tbsp: 15, tsp: 5 };

/** Estimate an ingredient's mass in grams, or null when it can't be derived (counts, unknown units). */
export function estimateGrams(quantity: number | null, unit: string | null): number | null {
	if (quantity == null) return null;
	if (!unit) return null;
	const u = unit.toLowerCase();
	if (u in MASS_G) return quantity * MASS_G[u];
	if (u in VOLUME_ML) return quantity * VOLUME_ML[u];
	return null;
}

/** One ingredient's macro contribution to a recipe, and whether it could be counted. */
export function ingredientContribution(ing: Ingredient): Contribution {
	const n = ing.nutrition;
	if (!n) return { totals: emptyTotals(), counted: false };

	if (n.basis === 'as_entered') {
		const totals = emptyTotals();
		for (const k of MACRO_KEYS) totals[k] = n[k];
		return { totals, counted: true };
	}

	const grams = estimateGrams(ing.quantity, ing.unit);
	if (grams == null) return { totals: emptyTotals(), counted: false };
	const factor = grams / 100;
	const totals = emptyTotals();
	for (const k of MACRO_KEYS) totals[k] = n[k] == null ? null : (n[k] as number) * factor;
	return { totals, counted: true };
}

function addInto(acc: Totals, add: Totals): void {
	for (const k of MACRO_KEYS) {
		if (add[k] == null) continue;
		acc[k] = (acc[k] ?? 0) + (add[k] as number);
	}
}

export interface RecipeNutrition {
	totals: Totals;
	complete: boolean;
}

/** Sum ingredient contributions for a whole recipe. `complete` = every ingredient counted. */
export function recipeTotals(recipe: RecipeDoc): RecipeNutrition {
	const totals = emptyTotals();
	let complete = true;
	for (const ing of recipe.ingredients) {
		const c = ingredientContribution(ing);
		if (!c.counted) complete = false;
		addInto(totals, c.totals);
	}
	return { totals, complete };
}

function scale(totals: Totals, factor: number): Totals {
	const out = emptyTotals();
	for (const k of MACRO_KEYS) out[k] = totals[k] == null ? null : (totals[k] as number) * factor;
	return out;
}

/** Per-serving macros: recipe totals divided by servings (unchanged if servings missing). */
export function perServing(recipe: RecipeDoc): RecipeNutrition {
	const r = recipeTotals(recipe);
	if (!recipe.servings || recipe.servings <= 0) return r;
	return { totals: scale(r.totals, 1 / recipe.servings), complete: r.complete };
}

/** Sum per-serving macros across a day's planned entries (entry servings × per-serving). */
export function dayTotals(
	entries: { recipeId: string; servings: number | null }[],
	recipeById: Map<string, RecipeDoc>
): RecipeNutrition {
	const totals = emptyTotals();
	let complete = true;
	for (const entry of entries) {
		const recipe = recipeById.get(entry.recipeId);
		if (!recipe) {
			complete = false;
			continue;
		}
		const ps = perServing(recipe);
		if (!ps.complete) complete = false;
		addInto(totals, scale(ps.totals, entry.servings ?? recipe.servings ?? 1));
	}
	return { totals, complete };
}
