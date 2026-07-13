import { describe, it, expect } from 'vitest';
import { parsedToRecipeDoc, buildRecipeManifest, frontmatterDateToIso } from './vaultImport';
import type { ParsedMarkdownRecipe } from './markdownRecipe';

const base: ParsedMarkdownRecipe = {
	title: 'Risotto',
	ingredients: ['1 medium onion', '5 cups raw rice'],
	steps: ['Saute the onion.', 'Add the rice.'],
	servings: 6,
	source_url: null,
	notes: 'Comforting.',
	tags: ['nonna-donini'],
	created: '2025-07-12'
};

describe('frontmatterDateToIso', () => {
	it('converts a full ISO created stamp', () => {
		expect(frontmatterDateToIso('2017-11-10T04:07:50+00:00', 'FB')).toBe('2017-11-10T04:07:50.000Z');
	});
	it('falls back when created is null or unparseable', () => {
		expect(frontmatterDateToIso(null, 'FB')).toBe('FB');
		expect(frontmatterDateToIso('not-a-date', 'FB')).toBe('FB');
	});
});

describe('parsedToRecipeDoc', () => {
	it('maps ingredient strings through parseIngredient into structured fields', () => {
		const doc = parsedToRecipeDoc(base, '2026-07-11T00:00:00.000Z');
		expect(doc.ingredients[1]).toMatchObject({ quantity: 5, unit: 'cup', name: 'raw rice', original: '5 cups raw rice' });
	});
	it('sets schema 1, null photo, and carries scalar fields', () => {
		const doc = parsedToRecipeDoc(base, '2026-07-11T00:00:00.000Z');
		expect(doc.schema).toBe(1);
		expect(doc.photo_hash).toBeNull();
		expect(doc.servings).toBe(6);
		expect(doc.tags).toEqual(['nonna-donini']);
		expect(doc.steps).toEqual(['Saute the onion.', 'Add the rice.']);
		expect(typeof doc.id).toBe('string');
	});
	it('uses frontmatter created as created_at and now as updated_at', () => {
		const doc = parsedToRecipeDoc(base, '2026-07-11T00:00:00.000Z');
		expect(doc.created_at).toBe('2025-07-12T00:00:00.000Z');
		expect(doc.updated_at).toBe('2026-07-11T00:00:00.000Z');
	});
});

describe('buildRecipeManifest', () => {
	it('produces a FORMAT-1 recipes-only manifest whose order matches the ids', () => {
		const docs = [parsedToRecipeDoc(base), parsedToRecipeDoc({ ...base, title: 'Amaretti' })];
		const m = buildRecipeManifest(docs, '2026-07-11T00:00:00.000Z');
		expect(m.format).toBe(1);
		expect(m.recipe_order).toEqual(docs.map((d) => d.id));
		expect(m.recipes).toBe(docs);
		expect(m.collections).toEqual([]);
		expect(m.mealPlans).toEqual([]);
		expect(m.shoppingList).toBeNull();
		expect(m.current_week).toBeNull();
	});
});
