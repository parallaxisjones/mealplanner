import { describe, it, expect } from 'vitest';
import { scaleFactor, formatQuantity } from './scaler';

describe('scaleFactor', () => {
	it('scales up and down by servings ratio', () => {
		expect(scaleFactor(4, 8)).toBe(2);
		expect(scaleFactor(4, 2)).toBe(0.5);
	});

	it('is 1 when either servings value is missing or zero', () => {
		expect(scaleFactor(null, 4)).toBe(1);
		expect(scaleFactor(4, null)).toBe(1);
		expect(scaleFactor(0, 4)).toBe(1);
	});
});

describe('formatQuantity', () => {
	it('drops trailing zeros', () => {
		expect(formatQuantity(2)).toBe('2');
		expect(formatQuantity(1.5)).toBe('1.5');
		expect(formatQuantity(3.0)).toBe('3');
	});

	it('rounds to two decimals', () => {
		expect(formatQuantity(2 / 3)).toBe('0.67');
	});
});
