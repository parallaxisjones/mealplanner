import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
import { getRepo, getWorkspaceUrl } from './repo';
import { uuidv7 } from '$lib/domain/ids';
import type { CollectionDoc, WorkspaceDoc } from '$lib/domain/types';

export interface CollectionSummary {
	url: string;
	name: string;
	recipeCount: number;
}

/** Create a collection and register it in the workspace. Returns its URL. */
export async function createCollection(name: string): Promise<AutomergeUrl> {
	const repo = await getRepo();
	const wsUrl = await getWorkspaceUrl();
	const handle = repo.create<CollectionDoc>({
		schema: 1,
		id: uuidv7(),
		name: name.trim() || 'Untitled collection',
		recipe_ids: [],
		created_at: new Date().toISOString()
	});
	const ws = await repo.find<WorkspaceDoc>(wsUrl);
	ws.change((w) => {
		w.collection_ids.push(handle.url);
	});
	await repo.flush([handle.documentId, ws.documentId]);
	return handle.url;
}

export async function renameCollection(url: string, name: string): Promise<void> {
	const trimmed = name.trim();
	if (!trimmed) return;
	const repo = await getRepo();
	const handle = await repo.find<CollectionDoc>(url as AutomergeUrl);
	handle.change((c) => {
		c.name = trimmed;
	});
	await repo.flush([handle.documentId]);
}

export async function deleteCollection(url: string): Promise<void> {
	const repo = await getRepo();
	const wsUrl = await getWorkspaceUrl();
	const ws = await repo.find<WorkspaceDoc>(wsUrl);
	ws.change((w) => {
		const i = w.collection_ids.indexOf(url);
		if (i >= 0) w.collection_ids.splice(i, 1);
	});
	repo.delete(url as AutomergeUrl);
	await repo.flush([ws.documentId]);
}

export async function addRecipeToCollection(collectionUrl: string, recipeUrl: string): Promise<void> {
	const repo = await getRepo();
	const handle = await repo.find<CollectionDoc>(collectionUrl as AutomergeUrl);
	handle.change((c) => {
		if (!c.recipe_ids.includes(recipeUrl)) c.recipe_ids.push(recipeUrl);
	});
	await repo.flush([handle.documentId]);
}

export async function removeRecipeFromCollection(
	collectionUrl: string,
	recipeUrl: string
): Promise<void> {
	const repo = await getRepo();
	const handle = await repo.find<CollectionDoc>(collectionUrl as AutomergeUrl);
	handle.change((c) => {
		const i = c.recipe_ids.indexOf(recipeUrl);
		if (i >= 0) c.recipe_ids.splice(i, 1);
	});
	await repo.flush([handle.documentId]);
}

/** Move a recipe within a collection's ordering by delta (+1 down, -1 up). */
export async function moveRecipeInCollection(
	collectionUrl: string,
	index: number,
	delta: number
): Promise<void> {
	const repo = await getRepo();
	const handle = await repo.find<CollectionDoc>(collectionUrl as AutomergeUrl);
	handle.change((c) => {
		const to = index + delta;
		if (to < 0 || to >= c.recipe_ids.length) return;
		const [moved] = c.recipe_ids.splice(index, 1);
		c.recipe_ids.splice(to, 0, moved);
	});
	await repo.flush([handle.documentId]);
}

export async function loadCollectionSummaries(urls: string[]): Promise<CollectionSummary[]> {
	const repo = await getRepo();
	const out: CollectionSummary[] = [];
	for (const url of urls) {
		const doc = (await repo.find<CollectionDoc>(url as AutomergeUrl)).doc();
		out.push({ url, name: doc.name, recipeCount: doc.recipe_ids.length });
	}
	return out;
}

export interface CollectionMembership {
	url: string;
	name: string;
	includes: boolean;
}

/** For a recipe, report each collection and whether it currently includes the recipe. */
export async function loadCollectionsForRecipe(
	collectionUrls: string[],
	recipeUrl: string
): Promise<CollectionMembership[]> {
	const repo = await getRepo();
	const out: CollectionMembership[] = [];
	for (const url of collectionUrls) {
		const doc = (await repo.find<CollectionDoc>(url as AutomergeUrl)).doc();
		out.push({ url, name: doc.name, includes: doc.recipe_ids.includes(recipeUrl) });
	}
	return out;
}
