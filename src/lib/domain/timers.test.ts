import { describe, it, expect } from 'vitest';
import { segmentStep, type StepSegment, type TimerSegment } from './timers';

const timers = (segs: StepSegment[]): TimerSegment[] =>
	segs.filter((s): s is TimerSegment => s.kind === 'timer');

describe('segmentStep', () => {
	it('detects "20 minutes" as a 1200s timer and preserves surrounding text', () => {
		const segs = segmentStep('Simmer for 20 minutes, then stir.');
		expect(timers(segs)).toHaveLength(1);
		expect(timers(segs)[0].seconds).toBe(1200);
		expect(segs.map((s) => s.text).join('')).toBe('Simmer for 20 minutes, then stir.');
	});

	it('takes the larger bound of a range', () => {
		expect(timers(segmentStep('Bake 1 to 2 hours.'))[0].seconds).toBe(7200);
		expect(timers(segmentStep('Cook 5 to 7 minutes'))[0].seconds).toBe(420);
	});

	it('handles seconds and abbreviations', () => {
		expect(timers(segmentStep('Rest 45 seconds'))[0].seconds).toBe(45);
		expect(timers(segmentStep('Wait 5 min'))[0].seconds).toBe(300);
		expect(timers(segmentStep('Chill 1 hr'))[0].seconds).toBe(3600);
	});

	it('does not match temperatures or quantities', () => {
		expect(timers(segmentStep('Preheat to 425 F'))).toHaveLength(0);
		expect(timers(segmentStep('Add 2 cups flour'))).toHaveLength(0);
	});

	it('matches only the duration in a mixed sentence', () => {
		const t = timers(segmentStep('Preheat to 425 degrees for 20 minutes'));
		expect(t).toHaveLength(1);
		expect(t[0].seconds).toBe(1200);
	});

	it('returns a single text segment when there is no timer', () => {
		expect(segmentStep('Mix well.')).toEqual([{ kind: 'text', text: 'Mix well.' }]);
	});
});
