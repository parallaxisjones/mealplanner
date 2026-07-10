import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
import { getRepo, getWorkspaceUrl } from './repo';
import { uuidv7 } from '$lib/domain/ids';
import type { RecipeDoc, WorkspaceDoc } from '$lib/domain/types';

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
export async function createRecipe(seed?: Partial<RecipeDoc>): Promise<AutomergeUrl> {
	const repo = await getRepo();
	const wsUrl = await getWorkspaceUrl();
	const handle = repo.create<RecipeDoc>({ ...blankRecipe(), ...seed });
	const ws = await repo.find<WorkspaceDoc>(wsUrl);
	ws.change((w) => {
		w.recipe_ids.push(handle.url);
	});
	await repo.flush([handle.documentId, ws.documentId]);
	return handle.url;
}

export interface RecipeSummary {
	url: string;
	title: string;
}

/** Load lightweight summaries for a set of recipe URLs, preserving order. */
export async function loadRecipeSummaries(urls: string[]): Promise<RecipeSummary[]> {
	const repo = await getRepo();
	const summaries: RecipeSummary[] = [];
	for (const url of urls) {
		const handle = await repo.find<RecipeDoc>(url as AutomergeUrl);
		summaries.push({ url, title: handle.doc().title });
	}
	return summaries;
}
