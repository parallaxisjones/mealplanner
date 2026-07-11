/** Normalize a single tag: trim, lowercase, collapse internal whitespace. */
export function normalizeTag(tag: string): string {
	return tag.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Normalize a list of tags, drop empties, and dedupe preserving first-seen order. */
export function normalizeTags(tags: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const tag of tags) {
		const normalized = normalizeTag(tag);
		if (normalized && !seen.has(normalized)) {
			seen.add(normalized);
			out.push(normalized);
		}
	}
	return out;
}
