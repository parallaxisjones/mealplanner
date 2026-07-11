import { describe, it, expect } from 'vitest';
import { createRecipeSearcher, type SearchableRecipe } from './search';

const recipes: SearchableRecipe[] = [
	{
		url: 'a',
		title: 'Chicken Curry',
		tags: ['dinner', 'spicy'],
		ingredientNames: ['chicken', 'curry powder', 'onion']
	},
	{
		url: 'b',
		title: 'Buttermilk Pancakes',
		tags: ['breakfast'],
		ingredientNames: ['flour', 'egg', 'milk']
	},
	{
		url: 'c',
		title: 'Caprese Salad',
		tags: ['lunch', 'quick'],
		ingredientNames: ['tomato', 'basil', 'mozzarella']
	}
];

describe('createRecipeSearcher', () => {
	it('ranks a typo’d title match first', () => {
		const results = createRecipeSearcher(recipes)('chikn curry');
		expect(results[0].url).toBe('a');
	});

	it('finds a recipe by an ingredient name', () => {
		const results = createRecipeSearcher(recipes)('basil');
		expect(results[0].url).toBe('c');
	});

	it('matches a tag', () => {
		const results = createRecipeSearcher(recipes)('breakfast');
		expect(results.map((r) => r.url)).toContain('b');
	});

	it('returns all recipes in original order for an empty query', () => {
		const results = createRecipeSearcher(recipes)('   ');
		expect(results.map((r) => r.url)).toEqual(['a', 'b', 'c']);
	});
});
