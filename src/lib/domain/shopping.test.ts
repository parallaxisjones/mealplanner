import { describe, it, expect } from 'vitest';
import { aggregateIngredients, type PlannedRecipeIngredients } from './shopping';
import type { Ingredient } from './types';

const ing = (quantity: number | null, unit: string | null, name: string): Ingredient => ({
	quantity,
	unit,
	name,
	notes: null,
	original: ''
});

// Recipe A serves 2, planned for 4 → factor 2.
const A: PlannedRecipeIngredients = {
	recipeUrl: 'A',
	recipeServings: 2,
	plannedServings: 4,
	ingredients: [ing(2, 'cup', 'flour'), ing(null, null, 'salt')]
};
// Recipe B serves 4, planned for 4 → factor 1.
const B: PlannedRecipeIngredients = {
	recipeUrl: 'B',
	recipeServings: 4,
	plannedServings: 4,
	ingredients: [ing(1, 'cup', 'flour'), ing(null, null, 'salt'), ing(200, 'ml', 'milk')]
};

describe('aggregateIngredients', () => {
	it('sums numeric quantities for the same name + unit and unions sources', () => {
		const items = aggregateIngredients([A, B]);
		const flour = items.find((i) => i.name.toLowerCase() === 'flour' && i.unit === 'cup');
		expect(flour).toBeDefined();
		expect(flour!.quantity).toBe(5); // 2*2 + 1*1
		expect([...flour!.source_recipes].sort()).toEqual(['A', 'B']);
	});

	it('collapses non-numeric (null-quantity) contributors into one line', () => {
		const items = aggregateIngredients([A, B]);
		const salt = items.filter((i) => i.name.toLowerCase() === 'salt');
		expect(salt).toHaveLength(1);
		expect(salt[0].quantity).toBe(null);
		expect([...salt[0].source_recipes].sort()).toEqual(['A', 'B']);
	});

	it('keeps different units as separate lines (no conversion)', () => {
		const C: PlannedRecipeIngredients = {
			recipeUrl: 'C',
			recipeServings: 1,
			plannedServings: 1,
			ingredients: [ing(1, 'cup', 'milk')]
		};
		const milk = aggregateIngredients([B, C]).filter((i) => i.name.toLowerCase() === 'milk');
		expect(milk).toHaveLength(2);
		expect(new Set(milk.map((m) => m.unit))).toEqual(new Set(['ml', 'cup']));
	});
});
