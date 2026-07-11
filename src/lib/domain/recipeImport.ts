// Pure schema.org/Recipe JSON-LD extraction (no HTML/fetch — those live in the
// Worker). Handles the field-shape variety real sites emit.

export interface ParsedRecipe {
	title: string;
	ingredients: string[];
	steps: string[];
	image: string | null;
	servings: string | null;
	total_time: string | null;
}

type Obj = Record<string, unknown>;

function typeIncludesRecipe(t: unknown): boolean {
	if (typeof t === 'string') return t.toLowerCase().includes('recipe');
	if (Array.isArray(t)) return t.some((x) => typeof x === 'string' && x.toLowerCase().includes('recipe'));
	return false;
}

/** Recurse arrays / @graph wrappers to find the first node typed as a Recipe. */
function findRecipeNode(node: unknown): Obj | null {
	if (!node || typeof node !== 'object') return null;
	if (Array.isArray(node)) {
		for (const n of node) {
			const found = findRecipeNode(n);
			if (found) return found;
		}
		return null;
	}
	const obj = node as Obj;
	if (typeIncludesRecipe(obj['@type'])) return obj;
	if ('@graph' in obj) return findRecipeNode(obj['@graph']);
	return null;
}

function asString(v: unknown): string | null {
	if (typeof v === 'string') return v.trim() || null;
	if (typeof v === 'number') return String(v);
	return null;
}

function asStringArray(v: unknown): string[] {
	if (typeof v === 'string') return [v.trim()].filter(Boolean);
	if (Array.isArray(v)) return v.map((x) => asString(x)).filter((x): x is string => !!x);
	return [];
}

/** recipeInstructions: string | string[] | HowToStep[] | HowToSection[] → flat step strings. */
function normalizeInstructions(v: unknown): string[] {
	if (typeof v === 'string') {
		return v
			.split(/\r?\n+/)
			.map((s) => s.trim())
			.filter(Boolean);
	}
	if (!Array.isArray(v)) return [];
	const steps: string[] = [];
	for (const item of v) {
		if (typeof item === 'string') {
			if (item.trim()) steps.push(item.trim());
		} else if (item && typeof item === 'object') {
			const obj = item as Obj;
			if (Array.isArray(obj.itemListElement)) {
				steps.push(...normalizeInstructions(obj.itemListElement)); // HowToSection
			} else {
				const text = asString(obj.text) ?? asString(obj.name);
				if (text) steps.push(text);
			}
		}
	}
	return steps;
}

/** image: string | string[] | ImageObject → a single URL. */
function normalizeImage(v: unknown): string | null {
	if (typeof v === 'string') return v.trim() || null;
	if (Array.isArray(v)) {
		for (const item of v) {
			const url = normalizeImage(item);
			if (url) return url;
		}
		return null;
	}
	if (v && typeof v === 'object') return asString((v as Obj).url);
	return null;
}

/** Extract a recipe from an array of parsed JSON-LD nodes, or null if none. */
export function parseRecipeJsonLd(nodes: unknown[]): ParsedRecipe | null {
	let recipe: Obj | null = null;
	for (const node of nodes) {
		recipe = findRecipeNode(node);
		if (recipe) break;
	}
	if (!recipe) return null;
	return {
		title: asString(recipe.name) ?? '',
		ingredients: asStringArray(recipe.recipeIngredient),
		steps: normalizeInstructions(recipe.recipeInstructions),
		image: normalizeImage(recipe.image),
		servings: asString(recipe.recipeYield),
		total_time: asString(recipe.totalTime)
	};
}
