<script lang="ts">
	import { parseIngredient } from '$lib/domain/ingredients';
	import type { Ingredient } from '$lib/domain/types';

	let { ingredients = $bindable([]) }: { ingredients: Ingredient[] } = $props();

	function setRow(i: number, raw: string) {
		const next = [...ingredients];
		next[i] = parseIngredient(raw);
		ingredients = next;
	}

	function addRow() {
		ingredients = [...ingredients, parseIngredient('')];
	}

	function removeRow(i: number) {
		ingredients = ingredients.filter((_, j) => j !== i);
	}

	function onKeydown(e: KeyboardEvent, i: number) {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.currentTarget as HTMLInputElement).blur();
			if (i === ingredients.length - 1) addRow();
		}
	}
</script>

<div class="space-y-2">
	{#each ingredients as ing, i (i)}
		<div class="flex items-center gap-2">
			<input
				value={ing.original}
				onblur={(e) => setRow(i, e.currentTarget.value)}
				onkeydown={(e) => onKeydown(e, i)}
				placeholder="e.g. 2 cups flour"
				class="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-herb"
			/>
			<button
				type="button"
				onclick={() => removeRow(i)}
				aria-label="Remove ingredient"
				class="px-1 text-lg leading-none text-muted hover:text-danger">×</button
			>
		</div>
	{/each}
	<button
		type="button"
		onclick={addRow}
		class="font-mono text-xs tracking-wide text-herb hover:underline">+ add ingredient</button
	>
</div>
