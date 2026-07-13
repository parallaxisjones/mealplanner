import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import type { AutomergeUrl, DocumentId } from '@automerge/automerge-repo/slim';
import { getRepo, getWorkspaceUrl, setWorkspaceRoot } from './repo';
import { getPhotoBlob, putPhoto } from './photos';
import type {
	CollectionDoc,
	MealPlanDoc,
	MealSlot,
	PlanEntry,
	RecipeDoc,
	ShoppingItem,
	ShoppingListDoc,
	WorkspaceDoc
} from '$lib/domain/types';

const FORMAT = 1;
const MANIFEST = 'meal-plan.json';

export interface ImportSummary {
	recipes: number;
	collections: number;
	plans: number;
	items: number;
}

/**
 * Export the entire workspace to a `.mealplan` zip: a JSON manifest where all
 * cross-references are rewritten to portable UUIDs, plus the referenced photo
 * blobs. Automerge document URLs are regenerated on import, so UUIDs are the
 * stable identity that survives the round-trip.
 */
export async function exportWorkspace(): Promise<Blob> {
	const repo = await getRepo();
	const ws = (await repo.find<WorkspaceDoc>(await getWorkspaceUrl())).doc();

	const recipeUrlToId = new Map<string, string>();
	const recipes: RecipeDoc[] = [];
	for (const url of ws.recipe_ids) {
		try {
			const doc = (await repo.find<RecipeDoc>(url as AutomergeUrl)).doc();
			recipeUrlToId.set(url, doc.id);
			recipes.push({ ...doc });
		} catch {
			/* skip missing */
		}
	}

	const collectionUrlToId = new Map<string, string>();
	const collections: CollectionDoc[] = [];
	for (const url of ws.collection_ids) {
		try {
			const doc = (await repo.find<CollectionDoc>(url as AutomergeUrl)).doc();
			collectionUrlToId.set(url, doc.id);
			collections.push({
				...doc,
				recipe_ids: doc.recipe_ids.map((r) => recipeUrlToId.get(r)).filter((x): x is string => !!x)
			});
		} catch {
			/* skip */
		}
	}

	const mapEntry = (e: PlanEntry) => ({
		recipe_id: recipeUrlToId.get(e.recipe_id) ?? '',
		servings: e.servings,
		note: e.note
	});
	const mealPlans: { week: string; days: Record<string, Record<MealSlot, ReturnType<typeof mapEntry>[]>> }[] =
		[];
	for (const week of Object.keys(ws.plans)) {
		try {
			const doc = (await repo.find<MealPlanDoc>(ws.plans[week] as AutomergeUrl)).doc();
			const days: Record<string, Record<MealSlot, ReturnType<typeof mapEntry>[]>> = {};
			for (const date of Object.keys(doc.days)) {
				const dp = doc.days[date];
				days[date] = {
					breakfast: dp.breakfast.map(mapEntry).filter((e) => e.recipe_id),
					lunch: dp.lunch.map(mapEntry).filter((e) => e.recipe_id),
					dinner: dp.dinner.map(mapEntry).filter((e) => e.recipe_id),
					snack: dp.snack.map(mapEntry).filter((e) => e.recipe_id)
				};
			}
			mealPlans.push({ week: doc.week, days });
		} catch {
			/* skip */
		}
	}

	let shoppingList: { active_week: string | null; items: unknown[] } | null = null;
	if (ws.shopping_list_url) {
		const doc = (await repo.find<ShoppingListDoc>(ws.shopping_list_url as AutomergeUrl)).doc();
		shoppingList = {
			active_week: doc.active_week,
			items: doc.items.map((it) => ({
				...it,
				source_recipes: it.source_recipes.map((r) => recipeUrlToId.get(r)).filter(Boolean)
			}))
		};
	}

	const manifest = {
		format: FORMAT,
		exported_at: new Date().toISOString(),
		current_week: ws.current_week,
		recipe_order: ws.recipe_ids.map((u) => recipeUrlToId.get(u)).filter(Boolean),
		collection_order: ws.collection_ids.map((u) => collectionUrlToId.get(u)).filter(Boolean),
		recipes,
		collections,
		mealPlans,
		shoppingList
	};

	const files: Record<string, Uint8Array> = { [MANIFEST]: strToU8(JSON.stringify(manifest)) };
	for (const hash of new Set(recipes.map((r) => r.photo_hash).filter((h): h is string => !!h))) {
		const blob = await getPhotoBlob(hash);
		if (blob) files[`photos/${hash}`] = new Uint8Array(await blob.arrayBuffer());
	}
	return new Blob([zipSync(files) as BlobPart], { type: 'application/zip' });
}

/**
 * Import a `.mealplan` zip, recreating every document with fresh URLs, rewriting
 * all cross-references, and restoring photos. Replaces the current workspace
 * (the caller should reload afterwards).
 */
export async function importWorkspace(data: Uint8Array): Promise<ImportSummary> {
	const files = unzipSync(data);
	const manifestBytes = files[MANIFEST];
	if (!manifestBytes) throw new Error('Not a valid backup: missing meal-plan.json.');
	const manifest = JSON.parse(strFromU8(manifestBytes));
	if (typeof manifest.format !== 'number' || manifest.format > FORMAT) {
		throw new Error('This backup was made by a newer version of the app.');
	}

	const repo = await getRepo();
	const flushed: DocumentId[] = [];

	// Restore photos (content-addressed: putPhoto recomputes the hash from bytes).
	for (const name of Object.keys(files)) {
		if (name.startsWith('photos/') && !name.includes('..')) {
			await putPhoto(new Blob([files[name] as BlobPart]));
		}
	}

	const idToUrl = new Map<string, string>();
	for (const r of manifest.recipes ?? []) {
		const handle = repo.create<RecipeDoc>({ ...r, schema: 1 });
		idToUrl.set(r.id, handle.url);
		flushed.push(handle.documentId);
	}

	const collIdToUrl = new Map<string, string>();
	for (const c of manifest.collections ?? []) {
		const recipe_ids = (c.recipe_ids ?? [])
			.map((id: string) => idToUrl.get(id))
			.filter((x: string | undefined): x is string => !!x);
		const handle = repo.create<CollectionDoc>({
			schema: 1,
			id: c.id,
			name: c.name,
			recipe_ids,
			created_at: c.created_at ?? new Date().toISOString()
		});
		collIdToUrl.set(c.id, handle.url);
		flushed.push(handle.documentId);
	}

	const plans: Record<string, AutomergeUrl> = {};
	const mapSlot = (arr: { recipe_id: string; servings: number | null; note: string | null }[]) =>
		(arr ?? [])
			.map((e) => ({ recipe_id: idToUrl.get(e.recipe_id) ?? '', servings: e.servings, note: e.note ?? null }))
			.filter((e) => e.recipe_id) as PlanEntry[];
	for (const p of manifest.mealPlans ?? []) {
		const days: Record<string, Record<MealSlot, PlanEntry[]>> = {};
		for (const date of Object.keys(p.days ?? {})) {
			const dp = p.days[date];
			days[date] = {
				breakfast: mapSlot(dp.breakfast),
				lunch: mapSlot(dp.lunch),
				dinner: mapSlot(dp.dinner),
				snack: mapSlot(dp.snack)
			};
		}
		const handle = repo.create<MealPlanDoc>({ schema: 1, week: p.week, days });
		plans[p.week] = handle.url;
		flushed.push(handle.documentId);
	}

	const items: ShoppingItem[] = (manifest.shoppingList?.items ?? []).map((it: ShoppingItem) => ({
		...it,
		source_recipes: (it.source_recipes ?? [])
			.map((id: string) => idToUrl.get(id))
			.filter((x: string | undefined): x is string => !!x)
	}));
	const slHandle = repo.create<ShoppingListDoc>({
		schema: 1,
		items,
		active_week: manifest.shoppingList?.active_week ?? null
	});
	flushed.push(slHandle.documentId);

	const recipe_ids = (manifest.recipe_order ?? [])
		.map((id: string) => idToUrl.get(id))
		.filter((x: string | undefined): x is string => !!x);
	const collection_ids = (manifest.collection_order ?? [])
		.map((id: string) => collIdToUrl.get(id))
		.filter((x: string | undefined): x is string => !!x);
	const wsHandle = repo.create<WorkspaceDoc>({
		schema: 1,
		recipe_ids,
		collection_ids,
		current_week: manifest.current_week ?? null,
		plans,
		shopping_list_url: slHandle.url
	});
	flushed.push(wsHandle.documentId);

	await repo.flush(flushed);
	setWorkspaceRoot(wsHandle.url);

	return {
		recipes: recipe_ids.length,
		collections: collection_ids.length,
		plans: Object.keys(plans).length,
		items: items.length
	};
}

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
