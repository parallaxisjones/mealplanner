export interface TextSegment {
	kind: 'text';
	text: string;
}
export interface TimerSegment {
	kind: 'timer';
	text: string;
	seconds: number;
}
export type StepSegment = TextSegment | TimerSegment;

const UNIT_SECONDS: Record<string, number> = {
	second: 1,
	sec: 1,
	minute: 60,
	min: 60,
	hour: 3600,
	hr: 3600
};

// A number, an optional "to N" range, then a time-unit word. The trailing \b +
// required unit word is what keeps "425 F" and "2 cups" from matching.
const TIMER_SOURCE = '(\\d+)\\s*(?:to\\s*\\d+\\s*)?(second|sec|minute|min|hour|hr)s?\\b';

function durationSeconds(matchText: string, unit: string): number {
	// Range → take the larger bound (more forgiving), per the design.
	const numbers = (matchText.match(/\d+/g) ?? []).map(Number);
	const bound = numbers.length ? Math.max(...numbers) : 0;
	return bound * (UNIT_SECONDS[unit.toLowerCase()] ?? 0);
}

/**
 * Split a recipe step into text runs and timer chips. Rendering the returned
 * segments (rather than injecting HTML) keeps recipe text safe from XSS.
 */
export function segmentStep(step: string): StepSegment[] {
	const re = new RegExp(TIMER_SOURCE, 'gi');
	const segments: StepSegment[] = [];
	let last = 0;
	for (const match of step.matchAll(re)) {
		const index = match.index ?? 0;
		if (index > last) segments.push({ kind: 'text', text: step.slice(last, index) });
		segments.push({ kind: 'timer', text: match[0], seconds: durationSeconds(match[0], match[2]) });
		last = index + match[0].length;
	}
	if (last < step.length || segments.length === 0) {
		segments.push({ kind: 'text', text: step.slice(last) });
	}
	return segments;
}
