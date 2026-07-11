import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
import { base } from '$app/paths';
import { getRepo, getWorkspaceUrl } from './repo';
import type { NutritionCacheDoc, NutritionData, RecipeDoc, WorkspaceDoc } from '$lib/domain/types';

const normalizeName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** URL of the shared, synced nutrition cache doc (created lazily on first use). */
async function getCacheUrl(): Promise<AutomergeUrl> {
	const repo = await getRepo();
	const ws = await repo.find<WorkspaceDoc>(await getWorkspaceUrl());
	const existing = ws.doc().nutrition_cache_url;
	if (existing) return existing as AutomergeUrl;
	const cache = repo.create<NutritionCacheDoc>({ schema: 1, entries: {} });
	ws.change((w) => {
		w.nutrition_cache_url = cache.url;
	});
	await repo.flush([cache.documentId, ws.documentId]);
	return cache.url;
}

/** Look up one ingredient's nutrition: cache → /api/nutrition → cache. Null if unknown. */
export async function lookupNutrition(name: string): Promise<NutritionData | null> {
	const key = normalizeName(name);
	if (!key) return null;
	const repo = await getRepo();
	const cache = await repo.find<NutritionCacheDoc>(await getCacheUrl());
	const cached = cache.doc().entries[key];
	if (cached) return cached;
	try {
		const res = await fetch(`${base}/api/nutrition?name=${encodeURIComponent(key)}`);
		if (!res.ok) return null;
		const data = (await res.json()) as NutritionData;
		cache.change((c) => {
			c.entries[key] = data;
		});
		await repo.flush([cache.documentId]);
		return data;
	} catch {
		return null;
	}
}

/** Fire lookups for every ingredient lacking nutrition and store the results. */
export async function estimateRecipeNutrition(recipeUrl: string): Promise<void> {
	const repo = await getRepo();
	const handle = await repo.find<RecipeDoc>(recipeUrl as AutomergeUrl);
	const ingredients = handle.doc().ingredients;
	const found = new Map<number, NutritionData>();
	for (let i = 0; i < ingredients.length; i++) {
		if (ingredients[i].nutrition) continue;
		const data = await lookupNutrition(ingredients[i].name);
		if (data) found.set(i, data);
	}
	if (found.size === 0) return;
	handle.change((r) => {
		for (const [i, data] of found) r.ingredients[i].nutrition = data;
		r.schema = 2;
		r.updated_at = new Date().toISOString();
	});
	await repo.flush([handle.documentId]);
}

export type ManualMacros = Pick<
	NutritionData,
	'calories' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g' | 'sodium_mg'
>;

/** Set an authoritative manual override on one ingredient (its contribution as used). */
export async function setManualNutrition(
	recipeUrl: string,
	index: number,
	macros: ManualMacros
): Promise<void> {
	const repo = await getRepo();
	const handle = await repo.find<RecipeDoc>(recipeUrl as AutomergeUrl);
	handle.change((r) => {
		const ing = r.ingredients[index];
		if (!ing) return;
		ing.nutrition = { ...macros, source: 'manual', basis: 'as_entered', fetched_at: new Date().toISOString() };
		r.schema = 2;
		r.updated_at = new Date().toISOString();
	});
	await repo.flush([handle.documentId]);
}

/** Remove an ingredient's nutrition (reverts to auto-lookup on next estimate). */
export async function clearNutrition(recipeUrl: string, index: number): Promise<void> {
	const repo = await getRepo();
	const handle = await repo.find<RecipeDoc>(recipeUrl as AutomergeUrl);
	handle.change((r) => {
		if (r.ingredients[index]) r.ingredients[index].nutrition = null;
	});
	await repo.flush([handle.documentId]);
}
