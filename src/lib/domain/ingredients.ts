import type { Ingredient } from './types';

/**
 * Known measurement units mapped to a normalized lowercase singular form. Only
 * words in this whitelist are treated as units — so "olive oil" keeps "olive"
 * in the name instead of mistaking it for a unit. Normalizing plurals here lets
 * the shopping-list aggregator group "2 cups" with "1 cup" (this is grouping,
 * NOT unit conversion).
 */
const UNIT_MAP: Record<string, string> = {
	cup: 'cup',
	cups: 'cup',
	tablespoon: 'tbsp',
	tablespoons: 'tbsp',
	tbsp: 'tbsp',
	tbsps: 'tbsp',
	tbs: 'tbsp',
	teaspoon: 'tsp',
	teaspoons: 'tsp',
	tsp: 'tsp',
	tsps: 'tsp',
	ounce: 'oz',
	ounces: 'oz',
	oz: 'oz',
	pound: 'lb',
	pounds: 'lb',
	lb: 'lb',
	lbs: 'lb',
	gram: 'g',
	grams: 'g',
	g: 'g',
	kilogram: 'kg',
	kilograms: 'kg',
	kg: 'kg',
	milliliter: 'ml',
	milliliters: 'ml',
	ml: 'ml',
	liter: 'l',
	liters: 'l',
	litre: 'l',
	litres: 'l',
	l: 'l',
	clove: 'clove',
	cloves: 'clove',
	can: 'can',
	cans: 'can',
	pinch: 'pinch',
	pinches: 'pinch',
	dash: 'dash',
	dashes: 'dash',
	slice: 'slice',
	slices: 'slice',
	stick: 'stick',
	sticks: 'stick',
	package: 'package',
	packages: 'package',
	pkg: 'package',
	quart: 'quart',
	quarts: 'quart',
	qt: 'quart',
	pint: 'pint',
	pints: 'pint',
	pt: 'pint',
	gallon: 'gallon',
	gallons: 'gallon',
	gal: 'gallon'
};

/** Parse a numeric quantity token: integer, decimal, fraction, or mixed number. */
function parseQuantity(token: string): number | null {
	const s = token.trim();
	const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
	if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
	const frac = s.match(/^(\d+)\/(\d+)$/);
	if (frac) return Number(frac[1]) / Number(frac[2]);
	if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
	return null;
}

/**
 * Parse a single free-typed ingredient line into structured fields, always
 * preserving the raw text in `original` for display fidelity. Ranges take the
 * low bound; parentheticals become `notes`.
 */
export function parseIngredient(raw: string): Ingredient {
	let working = raw.trim();

	// Pull a parenthetical out into notes.
	let notes: string | null = null;
	const paren = working.match(/\(([^)]*)\)/);
	if (paren) {
		notes = paren[1].trim() || null;
		const idx = paren.index ?? 0;
		working = (working.slice(0, idx) + working.slice(idx + paren[0].length)).replace(/\s+/g, ' ').trim();
	}

	// Pull a leading quantity: a range (low bound), a mixed number, or a single value.
	let quantity: number | null = null;
	let consumed = 0;
	const range = working.match(/^(\d+(?:\.\d+)?)\s*(?:-|to)\s*\d+(?:\.\d+)?\b/i);
	const mixed = working.match(/^\d+\s+\d+\/\d+\b/);
	const single = working.match(/^\d+\/\d+|^\d+(?:\.\d+)?/);
	if (range) {
		quantity = Number(range[1]);
		consumed = range[0].length;
	} else if (mixed) {
		quantity = parseQuantity(mixed[0]);
		consumed = mixed[0].length;
	} else if (single) {
		quantity = parseQuantity(single[0]);
		consumed = single[0].length;
	}
	let rest = working.slice(consumed).trim();

	// Optional unit — only when the next word is a recognized measurement unit.
	let unit: string | null = null;
	const token = rest.match(/^([A-Za-z]+)\b/);
	if (token) {
		const normalized = UNIT_MAP[token[1].toLowerCase()];
		if (normalized) {
			unit = normalized;
			rest = rest.slice(token[0].length).trim();
		}
	}

	return { quantity, unit, name: rest.trim(), notes, original: raw.trim() };
}

/** Parse a multi-line ingredient block, trimming and skipping blank lines. */
export function parseIngredients(text: string): Ingredient[] {
	return text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => parseIngredient(line));
}
