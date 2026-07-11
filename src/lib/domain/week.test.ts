import { describe, it, expect } from 'vitest';
import { weekKeyOf, weekToDates, addWeeks } from './week';

describe('weekKeyOf', () => {
	it('uses the ISO week-year at a year boundary (Dec 29 2025 → 2026-W01)', () => {
		expect(weekKeyOf(new Date(2025, 11, 29))).toBe('2026-W01');
	});

	it('recognizes an ISO week 53 (Dec 28 2020 → 2020-W53)', () => {
		expect(weekKeyOf(new Date(2020, 11, 28))).toBe('2020-W53');
	});

	it('zero-pads the week number', () => {
		expect(weekKeyOf(new Date(2026, 0, 5))).toBe('2026-W02');
	});
});

describe('weekToDates', () => {
	it('returns Monday..Sunday as local ISO dates', () => {
		const dates = weekToDates('2026-W01');
		expect(dates).toHaveLength(7);
		expect(dates[0]).toBe('2025-12-29'); // Monday
		expect(dates[6]).toBe('2026-01-04'); // Sunday
	});
});

describe('addWeeks', () => {
	it('steps back across a year boundary', () => {
		expect(addWeeks('2026-W01', -1)).toBe('2025-W52');
	});

	it('steps forward out of a 53-week year', () => {
		expect(addWeeks('2020-W53', 1)).toBe('2021-W01');
	});

	it('round-trips through weekToDates', () => {
		expect(addWeeks('2026-W28', 0)).toBe('2026-W28');
	});
});
