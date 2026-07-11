import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
import { getRepo, getWorkspaceUrl } from './repo';
import { uuidv7 } from '$lib/domain/ids';
import { parseIngredient } from '$lib/domain/ingredients';
import { aggregateIngredients, type PlannedRecipeIngredients } from '$lib/domain/shopping';
import { MEAL_SLOTS } from '$lib/domain/types';
import type {
	MealPlanDoc,
	RecipeDoc,
	ShoppingListDoc,
	WorkspaceDoc
} from '$lib/domain/types';

async function shoppingListUrl(): Promise<AutomergeUrl> {
	const repo = await getRepo();
	const ws = await repo.find<WorkspaceDoc>(await getWorkspaceUrl());
	return ws.doc().shopping_list_url as AutomergeUrl;
}

export const getShoppingListUrl = shoppingListUrl;

/**
 * Rebuild the auto-generated portion of the shopping list from a week's plan.
 * Manual items and other weeks' items are preserved; only auto items for this
 * exact week are replaced.
 */
export async function generateFromWeek(week: string): Promise<void> {
	const repo = await getRepo();
	const ws = await repo.find<WorkspaceDoc>(await getWorkspaceUrl());

	const planUrl = ws.doc().plans[week];
	const planned: PlannedRecipeIngredients[] = [];
	if (planUrl) {
		const plan = (await repo.find<MealPlanDoc>(planUrl as AutomergeUrl)).doc();
		for (const date of Object.keys(plan.days)) {
			const day = plan.days[date];
			for (const slot of MEAL_SLOTS) {
				for (const entry of day[slot]) {
					try {
						const recipe = (await repo.find<RecipeDoc>(entry.recipe_id as AutomergeUrl)).doc();
						planned.push({
							recipeUrl: entry.recipe_id,
							recipeServings: recipe.servings,
							plannedServings: entry.servings,
							ingredients: recipe.ingredients.map((i) => ({ ...i }))
						});
					} catch {
						// Recipe was deleted after being planned — skip it.
					}
				}
			}
		}
	}

	const aggregated = aggregateIngredients(planned);
	const now = new Date().toISOString();
	const handle = await repo.find<ShoppingListDoc>(ws.doc().shopping_list_url as AutomergeUrl);
	handle.change((list) => {
		for (let i = list.items.length - 1; i >= 0; i--) {
			if (list.items[i].source_week === week) list.items.splice(i, 1);
		}
		for (const a of aggregated) {
			list.items.push({
				id: uuidv7(),
				name: a.name,
				quantity: a.quantity,
				unit: a.unit,
				source_recipes: a.source_recipes,
				source_week: week,
				checked: false,
				added_at: now
			});
		}
		list.active_week = week;
	});
	await repo.flush([handle.documentId]);
}

/** Add a manually typed item (parsed like a recipe ingredient, e.g. "2 lb apples"). */
export async function addManualItem(text: string): Promise<void> {
	const parsed = parseIngredient(text);
	if (!parsed.name.trim()) return;
	const repo = await getRepo();
	const handle = await repo.find<ShoppingListDoc>(await shoppingListUrl());
	handle.change((list) => {
		list.items.push({
			id: uuidv7(),
			name: parsed.name,
			quantity: parsed.quantity,
			unit: parsed.unit,
			source_recipes: [],
			source_week: null,
			checked: false,
			added_at: new Date().toISOString()
		});
	});
	await repo.flush([handle.documentId]);
}

export async function toggleItem(id: string): Promise<void> {
	const repo = await getRepo();
	const handle = await repo.find<ShoppingListDoc>(await shoppingListUrl());
	handle.change((list) => {
		const item = list.items.find((x) => x.id === id);
		if (item) item.checked = !item.checked;
	});
	await repo.flush([handle.documentId]);
}

export async function removeItem(id: string): Promise<void> {
	const repo = await getRepo();
	const handle = await repo.find<ShoppingListDoc>(await shoppingListUrl());
	handle.change((list) => {
		const i = list.items.findIndex((x) => x.id === id);
		if (i >= 0) list.items.splice(i, 1);
	});
	await repo.flush([handle.documentId]);
}

/** Archive/clear the whole list (lossy — no history is kept, by design). */
export async function clearAll(): Promise<void> {
	const repo = await getRepo();
	const handle = await repo.find<ShoppingListDoc>(await shoppingListUrl());
	handle.change((list) => {
		list.items.splice(0, list.items.length);
		list.active_week = null;
	});
	await repo.flush([handle.documentId]);
}
