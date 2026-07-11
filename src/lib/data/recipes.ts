import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
import { getRepo, getWorkspaceUrl } from './repo';
import { uuidv7 } from '$lib/domain/ids';
import type { CollectionDoc, Ingredient, RecipeDoc, WorkspaceDoc } from '$lib/domain/types';

/** The user-editable fields of a recipe (everything except identity/timestamps/photo). */
export interface RecipeFields {
	title: string;
	servings: number | null;
	ingredients: Ingredient[];
	steps: string[];
	tags: string[];
	source_url: string | null;
	notes: string | null;
	photo_hash: string | null;
}

/** A fresh, empty recipe document (unsaved). */
export function blankRecipe(): RecipeDoc {
	const now = new Date().toISOString();
	return {
		schema: 1,
		id: uuidv7(),
		title: '',
		servings: null,
		ingredients: [],
		steps: [],
		tags: [],
		source_url: null,
		notes: null,
		photo_hash: null,
		created_at: now,
		updated_at: now
	};
}

/** Create a recipe document and register it in the workspace. Returns its URL. */
export async function createRecipe(fields: Partial<RecipeFields>): Promise<AutomergeUrl> {
	const repo = await getRepo();
	const wsUrl = await getWorkspaceUrl();
	const handle = repo.create<RecipeDoc>({ ...blankRecipe(), ...fields });
	const ws = await repo.find<WorkspaceDoc>(wsUrl);
	ws.change((w) => {
		w.recipe_ids.push(handle.url);
	});
	await repo.flush([handle.documentId, ws.documentId]);
	return handle.url;
}

/** Overwrite a recipe's editable fields and bump `updated_at`. */
export async function updateRecipe(url: string, fields: RecipeFields): Promise<void> {
	const repo = await getRepo();
	const handle = await repo.find<RecipeDoc>(url as AutomergeUrl);
	handle.change((r) => {
		r.title = fields.title;
		r.servings = fields.servings;
		r.ingredients = fields.ingredients;
		r.steps = fields.steps;
		r.tags = fields.tags;
		r.source_url = fields.source_url;
		r.notes = fields.notes;
		r.photo_hash = fields.photo_hash;
		r.updated_at = new Date().toISOString();
	});
	await repo.flush([handle.documentId]);
}

/**
 * Delete a recipe: remove it from the workspace index, from every collection
 * that references it, and from the repo.
 */
export async function deleteRecipe(url: string): Promise<void> {
	const repo = await getRepo();
	const wsUrl = await getWorkspaceUrl();
	const ws = await repo.find<WorkspaceDoc>(wsUrl);
	const collectionIds = [...ws.doc().collection_ids];
	ws.change((w) => {
		const i = w.recipe_ids.indexOf(url);
		if (i >= 0) w.recipe_ids.splice(i, 1);
	});

	const flushed = [ws.documentId];
	for (const cid of collectionIds) {
		const ch = await repo.find<CollectionDoc>(cid as AutomergeUrl);
		if (ch.doc().recipe_ids.includes(url)) {
			ch.change((c) => {
				const i = c.recipe_ids.indexOf(url);
				if (i >= 0) c.recipe_ids.splice(i, 1);
			});
			flushed.push(ch.documentId);
		}
	}

	repo.delete(url as AutomergeUrl);
	await repo.flush(flushed);
}

export interface RecipeSummary {
	url: string;
	title: string;
	tags: string[];
	photoHash: string | null;
	ingredientNames: string[];
}

/** Load lightweight summaries for a set of recipe URLs, preserving order. */
export async function loadRecipeSummaries(urls: string[]): Promise<RecipeSummary[]> {
	const repo = await getRepo();
	const summaries: RecipeSummary[] = [];
	for (const url of urls) {
		const handle = await repo.find<RecipeDoc>(url as AutomergeUrl);
		const doc = handle.doc();
		summaries.push({
			url,
			title: doc.title,
			tags: doc.tags,
			photoHash: doc.photo_hash,
			ingredientNames: doc.ingredients.map((i) => i.name).filter(Boolean)
		});
	}
	return summaries;
}
