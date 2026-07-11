import { describe, it, expect } from 'vitest';
import { parseIngredient, parseIngredients } from './ingredients';

describe('parseIngredient', () => {
	it('parses "2 cups flour" into quantity, unit, name', () => {
		expect(parseIngredient('2 cups flour')).toEqual({
			quantity: 2,
			unit: 'cup',
			name: 'flour',
			notes: null,
			original: '2 cups flour'
		});
	});

	it('parses a simple fraction "1/2 tsp vanilla"', () => {
		const r = parseIngredient('1/2 tsp vanilla');
		expect(r.quantity).toBe(0.5);
		expect(r.unit).toBe('tsp');
		expect(r.name).toBe('vanilla');
	});

	it('parses a mixed number "1 1/2 cups sugar"', () => {
		const r = parseIngredient('1 1/2 cups sugar');
		expect(r.quantity).toBe(1.5);
		expect(r.unit).toBe('cup');
		expect(r.name).toBe('sugar');
	});

	it('parses a decimal quantity "1.5 cups sugar"', () => {
		const r = parseIngredient('1.5 cups sugar');
		expect(r.quantity).toBe(1.5);
		expect(r.unit).toBe('cup');
	});

	it('treats a count with no unit as quantity + name ("3 eggs")', () => {
		expect(parseIngredient('3 eggs')).toEqual({
			quantity: 3,
			unit: null,
			name: 'eggs',
			notes: null,
			original: '3 eggs'
		});
	});

	it('handles a bare name with no quantity ("salt")', () => {
		expect(parseIngredient('salt')).toEqual({
			quantity: null,
			unit: null,
			name: 'salt',
			notes: null,
			original: 'salt'
		});
	});

	it('does NOT treat the first word of a two-word name as a unit ("olive oil")', () => {
		expect(parseIngredient('olive oil')).toEqual({
			quantity: null,
			unit: null,
			name: 'olive oil',
			notes: null,
			original: 'olive oil'
		});
	});

	it('takes the low bound of a hyphen range but keeps the original ("2-3 cloves garlic")', () => {
		const r = parseIngredient('2-3 cloves garlic');
		expect(r.quantity).toBe(2);
		expect(r.unit).toBe('clove');
		expect(r.name).toBe('garlic');
		expect(r.original).toBe('2-3 cloves garlic');
	});

	it('takes the low bound of a "to" range ("2 to 3 cups water")', () => {
		const r = parseIngredient('2 to 3 cups water');
		expect(r.quantity).toBe(2);
		expect(r.unit).toBe('cup');
		expect(r.name).toBe('water');
	});

	it('extracts a parenthetical into notes ("flour (sifted)")', () => {
		expect(parseIngredient('flour (sifted)')).toEqual({
			quantity: null,
			unit: null,
			name: 'flour',
			notes: 'sifted',
			original: 'flour (sifted)'
		});
	});

	it('extracts notes while still parsing quantity and unit', () => {
		const r = parseIngredient('2 cups flour (sifted)');
		expect(r.quantity).toBe(2);
		expect(r.unit).toBe('cup');
		expect(r.name).toBe('flour');
		expect(r.notes).toBe('sifted');
	});

	it('normalizes the unit to lowercase singular but preserves name casing', () => {
		const r = parseIngredient('2 Tablespoons Olive Oil');
		expect(r.quantity).toBe(2);
		expect(r.unit).toBe('tbsp');
		expect(r.name).toBe('Olive Oil');
	});

	it('keeps an unrecognized unit-position word as part of the name', () => {
		// "large" is not a known unit, so "3 large eggs" -> name "large eggs"
		const r = parseIngredient('3 large eggs');
		expect(r.quantity).toBe(3);
		expect(r.unit).toBe(null);
		expect(r.name).toBe('large eggs');
	});
});

describe('parseIngredients', () => {
	it('splits lines, trims, and skips blank lines', () => {
		const result = parseIngredients('2 cups flour\n\n  1 tsp salt  \n');
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe('flour');
		expect(result[1]).toMatchObject({ quantity: 1, unit: 'tsp', name: 'salt', original: '1 tsp salt' });
	});
});
