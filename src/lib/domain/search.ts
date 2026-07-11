import Fuse from 'fuse.js';

export interface SearchableRecipe {
	url: string;
	title: string;
	tags: string[];
	ingredientNames: string[];
}

/**
 * Build a fuzzy searcher over a set of recipes. Matches are weighted
 * title > tags > ingredient names, with typo tolerance. An empty query returns
 * every recipe in its original order.
 */
export function createRecipeSearcher<T extends SearchableRecipe>(recipes: T[]): (query: string) => T[] {
	const fuse = new Fuse(recipes, {
		includeScore: true,
		ignoreLocation: true,
		threshold: 0.45,
		keys: [
			{ name: 'title', weight: 0.6 },
			{ name: 'tags', weight: 0.25 },
			{ name: 'ingredientNames', weight: 0.15 }
		]
	});

	return (query: string): T[] => {
		const q = query.trim();
		if (!q) return recipes;
		return fuse.search(q).map((result) => result.item);
	};
}
