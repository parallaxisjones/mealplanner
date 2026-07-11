/** Servings scale factor; 1 when either side is missing or zero (no basis to scale). */
export function scaleFactor(recipeServings: number | null, plannedServings: number | null): number {
	if (recipeServings && plannedServings && recipeServings !== 0) {
		return plannedServings / recipeServings;
	}
	return 1;
}

/** Format a quantity for display: round to 2 decimals and drop trailing zeros. */
export function formatQuantity(n: number): string {
	return String(Math.round(n * 100) / 100);
}
