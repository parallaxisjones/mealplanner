<script lang="ts">
	import type { RecipeDoc } from '$lib/domain/types';
	import { perServing } from '$lib/domain/nutrition';
	import { estimateRecipeNutrition, setManualNutrition, type ManualMacros } from '$lib/data/nutrition';

	let { recipe, recipeUrl }: { recipe: RecipeDoc; recipeUrl: string } = $props();

	const hasAny = $derived(recipe.ingredients.some((i) => i.nutrition));
	const ns = $derived(perServing(recipe));

	let busy = $state(false);
	async function estimate() {
		busy = true;
		try {
			await estimateRecipeNutrition(recipeUrl);
		} finally {
			busy = false;
		}
	}

	const kcal = (n: number | null) => (n == null ? '—' : String(Math.round(n)));
	const grams = (n: number | null) => (n == null ? '—' : String(Math.round(n * 10) / 10));

	let editIndex = $state<number | null>(null);
	const blank: ManualMacros = {
		calories: null,
		protein_g: null,
		fat_g: null,
		carbs_g: null,
		fiber_g: null,
		sodium_mg: null
	};
	let form = $state<ManualMacros>({ ...blank });

	function openEdit(i: number) {
		const n = recipe.ingredients[i].nutrition;
		form = n
			? {
					calories: n.calories,
					protein_g: n.protein_g,
					fat_g: n.fat_g,
					carbs_g: n.carbs_g,
					fiber_g: n.fiber_g,
					sodium_mg: n.sodium_mg
				}
			: { ...blank };
		editIndex = i;
	}
	async function saveOverride() {
		if (editIndex == null) return;
		await setManualNutrition(recipeUrl, editIndex, form);
		editIndex = null;
	}

	const fields: { key: keyof ManualMacros; label: string }[] = [
		{ key: 'calories', label: 'Calories' },
		{ key: 'protein_g', label: 'Protein (g)' },
		{ key: 'fat_g', label: 'Fat (g)' },
		{ key: 'carbs_g', label: 'Carbs (g)' },
		{ key: 'fiber_g', label: 'Fiber (g)' },
		{ key: 'sodium_mg', label: 'Sodium (mg)' }
	];
</script>

<section class="mt-7">
	<div class="mb-2.5 flex items-center justify-between border-b border-line pb-1">
		<h2 class="font-mono text-xs tracking-widest text-muted uppercase">Nutrition</h2>
		<button
			onclick={estimate}
			disabled={busy}
			class="font-mono text-[0.7rem] tracking-wide text-herb uppercase hover:underline disabled:opacity-50"
			>{busy ? 'Estimating…' : hasAny ? 'Re-estimate' : 'Estimate'}</button
		>
	</div>

	{#if !hasAny}
		<p class="text-sm text-muted">
			Estimate macros per serving from Open Food Facts. Rough figures — you can override any
			ingredient.
		</p>
	{:else}
		<p class="text-ink">
			<span class="font-serif text-2xl">~{kcal(ns.totals.calories)}</span>
			<span class="text-sm text-muted"> kcal / serving</span>
		</p>
		<p class="mt-0.5 font-mono text-xs text-muted">
			{grams(ns.totals.protein_g)}g protein · {grams(ns.totals.fat_g)}g fat · {grams(
				ns.totals.carbs_g
			)}g carbs
			{#if !ns.complete}· <span class="text-danger">estimate incomplete</span>{/if}
		</p>
	{/if}

	<ul class="mt-3 space-y-1">
			{#each recipe.ingredients as ing, i (i)}
				<li class="flex items-center justify-between gap-2 text-sm">
					<span class="min-w-0 truncate {ing.nutrition ? 'text-ink' : 'text-muted'}"
						>{ing.name}{#if ing.nutrition?.source === 'manual'}
							<span class="font-mono text-[0.6rem] text-herb">MANUAL</span>{/if}</span
					>
					<button onclick={() => openEdit(i)} class="shrink-0 font-mono text-[0.65rem] text-herb uppercase"
						>{ing.nutrition ? 'edit' : 'add'}</button
					>
				</li>
			{/each}
		</ul>
</section>

{#if editIndex !== null}
	<div class="fixed inset-0 z-40 flex items-end justify-center p-4 sm:items-center">
		<button
			type="button"
			aria-label="Close"
			class="absolute inset-0 bg-black/40"
			onclick={() => (editIndex = null)}
		></button>
		<div class="relative w-full max-w-sm rounded-2xl bg-surface p-4 shadow-xl">
			<h3 class="mb-3 font-serif text-lg text-ink">
				Override: {recipe.ingredients[editIndex].name}
			</h3>
			<p class="mb-3 text-xs text-muted">Values for this ingredient as used in the recipe.</p>
			<div class="grid grid-cols-2 gap-2">
				{#each fields as f (f.key)}
					<label class="font-mono text-[0.7rem] tracking-wide text-muted uppercase">
						{f.label}
						<input
							type="number"
							min="0"
							bind:value={form[f.key]}
							class="mt-0.5 w-full rounded-lg border border-line bg-bg px-2 py-1 text-sm text-ink outline-none focus:border-herb"
						/>
					</label>
				{/each}
			</div>
			<div class="mt-4 flex items-center gap-3">
				<button onclick={saveOverride} class="rounded-full bg-btn px-5 py-2 text-sm font-semibold text-on-btn"
					>Save override</button
				>
				<button onclick={() => (editIndex = null)} class="text-sm text-muted hover:text-ink">Cancel</button>
			</div>
		</div>
	</div>
{/if}
