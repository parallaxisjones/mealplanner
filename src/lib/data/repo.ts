import { Repo, isValidAutomergeUrl, type AutomergeUrl } from '@automerge/automerge-repo/slim';
import { IndexedDBStorageAdapter } from '@automerge/automerge-repo-storage-indexeddb';
import { initAutomerge } from './automerge';
import type { ShoppingListDoc, WorkspaceDoc } from '$lib/domain/types';

const DB_NAME = 'mealplanner';
const ROOT_KEY = 'mealplanner.rootDocUrl';

let repoPromise: Promise<Repo> | undefined;

/**
 * The single, process-wide Automerge Repo, backed by IndexedDB. No network
 * adapter in v1 — this is the seam where a future sync adapter plugs in without
 * touching the rest of the app.
 */
export function getRepo(): Promise<Repo> {
	return (repoPromise ??= (async () => {
		await initAutomerge();
		return new Repo({
			storage: new IndexedDBStorageAdapter(DB_NAME),
			network: []
		});
	})());
}

/**
 * Return the workspace (root) document URL, creating the workspace and its
 * singleton shopping-list document on first run. The URL is persisted in
 * localStorage; the documents themselves persist via the IndexedDB adapter.
 */
export async function getWorkspaceUrl(): Promise<AutomergeUrl> {
	const repo = await getRepo();

	const stored = localStorage.getItem(ROOT_KEY);
	if (stored && isValidAutomergeUrl(stored)) return stored;

	const shoppingList = repo.create<ShoppingListDoc>({
		schema: 1,
		items: [],
		active_week: null
	});
	const workspace = repo.create<WorkspaceDoc>({
		schema: 1,
		recipe_ids: [],
		collection_ids: [],
		current_week: null,
		plans: {},
		shopping_list_url: shoppingList.url
	});

	// Persist to IndexedDB before committing the URL, so a reload/crash right
	// after first run can never leave localStorage pointing at a doc that was
	// only ever in memory (which would resolve as permanently "unavailable").
	await repo.flush([shoppingList.documentId, workspace.documentId]);
	localStorage.setItem(ROOT_KEY, workspace.url);
	return workspace.url;
}
