import { describe, it, expect } from 'vitest';
import { normalizeTag, normalizeTags } from './tags';

describe('normalizeTag', () => {
	it('trims and lowercases', () => {
		expect(normalizeTag('  Weeknight  ')).toBe('weeknight');
	});

	it('collapses internal whitespace', () => {
		expect(normalizeTag('Quick   Meal')).toBe('quick meal');
	});
});

describe('normalizeTags', () => {
	it('normalizes, drops empties, and dedupes preserving first-seen order', () => {
		expect(normalizeTags(['Dinner', 'dinner', ' FAST ', '', '  '])).toEqual(['dinner', 'fast']);
	});
});
