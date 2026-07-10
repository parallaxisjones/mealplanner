// Domain types for the meal planner. This module is intentionally free of any
// Automerge or Svelte imports so the pure logic that uses it stays trivially
// testable. Cross-document references are stored as `DocUrl` strings, which are
// Automerge document URLs at runtime.

/** An Automerge document URL (e.g. `automerge:2j9k…`) at runtime. */
export type DocUrl = string;
export type RecipeUrl = DocUrl;
export type CollectionUrl = DocUrl;
export type MealPlanUrl = DocUrl;
export type ShoppingListUrl = DocUrl;

/** UUIDv7 — portable identity used only for JSON export/import remapping. */
export type UUID = string;
/** Local calendar date, e.g. `2026-04-27`. */
export type ISODate = string;
/** UTC timestamp, e.g. `2026-07-10T14:03:00.000Z`. */
export type ISOTime = string;
/** ISO week key, e.g. `2026-W18`. */
export type WeekKey = string;
/** Lowercase hex SHA-256 digest. */
export type Sha256 = string;

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

// ---------- Embedded value objects ----------

export interface Ingredient {
	/** 0.5 for "1/2"; low bound for a range; null if unspecified. */
	quantity: number | null;
	/** Normalized lowercase unit ("cup"); null if none / unrecognized. */
	unit: string | null;
	name: string;
	/** e.g. from a parenthetical: "finely chopped". */
	notes: string | null;
	/** The raw typed text, always preserved for display fidelity. */
	original: string;
}

export interface PlanEntry {
	recipe_id: RecipeUrl;
	/** Planned servings; null => use the recipe default (factor 1). */
	servings: number | null;
	note: string | null;
}

export interface DayPlan {
	breakfast: PlanEntry[];
	lunch: PlanEntry[];
	dinner: PlanEntry[];
	snack: PlanEntry[];
}

export interface ShoppingItem {
	id: UUID;
	name: string;
	quantity: number | null;
	unit: string | null;
	/** Contributing recipe URLs; empty for manually added items. */
	source_recipes: RecipeUrl[];
	/** Source week key; null => manually added. */
	source_week: WeekKey | null;
	checked: boolean;
	added_at: ISOTime;
}

// ---------- Documents (one Automerge doc each, except embedded value objects) ----------

export interface RecipeDoc {
	schema: 1;
	id: UUID;
	title: string;
	servings: number | null;
	ingredients: Ingredient[];
	steps: string[];
	/** Normalized: trimmed, lowercased, deduped. */
	tags: string[];
	source_url: string | null;
	notes: string | null;
	photo_hash: Sha256 | null;
	created_at: ISOTime;
	updated_at: ISOTime;
}

export interface CollectionDoc {
	schema: 1;
	id: UUID;
	name: string;
	/** Ordered recipe URLs. */
	recipe_ids: RecipeUrl[];
	created_at: ISOTime;
}

export interface MealPlanDoc {
	schema: 1;
	week: WeekKey;
	/** Keyed by local ISO date (Monday..Sunday). */
	days: Record<ISODate, DayPlan>;
}

export interface ShoppingListDoc {
	schema: 1;
	items: ShoppingItem[];
	active_week: WeekKey | null;
}

/**
 * Root/index document. Because automerge-repo has no query layer, this is the
 * sole discovery point: it maps every entity to the URL of its own document.
 */
export interface WorkspaceDoc {
	schema: 1;
	recipe_ids: RecipeUrl[];
	collection_ids: CollectionUrl[];
	current_week: WeekKey | null;
	/** Week key -> meal-plan document URL. */
	plans: Record<WeekKey, MealPlanUrl>;
	shopping_list_url: ShoppingListUrl | null;
}
