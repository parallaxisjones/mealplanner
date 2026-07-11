import { describe, it, expect } from 'vitest';
import { estimateGrams, ingredientContribution, recipeTotals, perServing } from './nutrition';
import type { Ingredient, NutritionData, RecipeDoc } from './types';

const per100 = (o: Partial<NutritionData>): NutritionData => ({
	calories: null,
	protein_g: null,
	fat_g: null,
	carbs_g: null,
	fiber_g: null,
	sodium_mg: null,
	source: 'off',
	basis: 'per100g',
	fetched_at: 't',
	...o
});

const ing = (o: Partial<Ingredient>): Ingredient => ({
	quantity: null,
	unit: null,
	name: 'x',
	notes: null,
	original: '',
	...o
});

const recipe = (ingredients: Ingredient[], servings: number | null): RecipeDoc => ({
	schema: 2,
	id: 'r',
	title: 'R',
	servings,
	ingredients,
	steps: [],
	tags: [],
	source_url: null,
	notes: null,
	photo_hash: null,
	created_at: 't',
	updated_at: 't'
});

describe('estimateGrams', () => {
	it('converts mass units directly', () => {
		expect(estimateGrams(200, 'g')).toBe(200);
		expect(estimateGrams(1, 'kg')).toBe(1000);
		expect(estimateGrams(1, 'oz')).toBeCloseTo(28.35, 1);
	});
	it('converts volume units to ml at ~1 g/ml', () => {
		expect(estimateGrams(1, 'cup')).toBe(240);
		expect(estimateGrams(2, 'tbsp')).toBe(30);
		expect(estimateGrams(1, 'l')).toBe(1000);
	});
	it('returns null for counts / unknown units', () => {
		expect(estimateGrams(3, null)).toBeNull();
		expect(estimateGrams(2, 'clove')).toBeNull();
	});
});

describe('ingredientContribution', () => {
	it('scales per-100g data by estimated grams', () => {
		const c = ingredientContribution(ing({ quantity: 200, unit: 'g', nutrition: per100({ calories: 364, protein_g: 10 }) }));
		expect(c.counted).toBe(true);
		expect(c.totals.calories).toBe(728);
		expect(c.totals.protein_g).toBe(20);
	});
	it('uses a manual as_entered override directly (no gram scaling)', () => {
		const c = ingredientContribution(
			ing({ quantity: 1, unit: null, nutrition: { ...per100({ calories: 72, protein_g: 6 }), source: 'manual', basis: 'as_entered' } })
		);
		expect(c.counted).toBe(true);
		expect(c.totals.calories).toBe(72);
	});
	it('is uncounted when nutrition is missing or grams cannot be estimated', () => {
		expect(ingredientContribution(ing({ quantity: 2, unit: 'g' })).counted).toBe(false);
		expect(ingredientContribution(ing({ quantity: 3, unit: null, nutrition: per100({ calories: 50 }) })).counted).toBe(false);
	});
});

describe('recipeTotals / perServing', () => {
	it('sums counted ingredients and flags incompleteness', () => {
		const r = recipe(
			[
				ing({ quantity: 100, unit: 'g', nutrition: per100({ calories: 400 }) }),
				ing({ quantity: 1, unit: 'clove', nutrition: per100({ calories: 5 }) }) // grams unknown → uncounted
			],
			2
		);
		const t = recipeTotals(r);
		expect(t.totals.calories).toBe(400);
		expect(t.complete).toBe(false);
	});
	it('per-serving divides recipe totals by servings', () => {
		const r = recipe([ing({ quantity: 200, unit: 'g', nutrition: per100({ calories: 400 }) })], 2);
		expect(perServing(r).totals.calories).toBe(400); // 200g*400/100 = 800 total /2 servings
		expect(perServing(r).complete).toBe(true);
	});
});
