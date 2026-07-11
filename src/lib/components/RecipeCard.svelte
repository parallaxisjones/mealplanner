<script lang="ts">
	import { base } from '$app/paths';
	import type { RecipeSummary } from '$lib/data/recipes';

	let { recipe }: { recipe: RecipeSummary } = $props();
</script>

<a
	href={`${base}/recipes/${encodeURIComponent(recipe.url)}`}
	class="block rounded-xl border border-line bg-surface px-4 py-3.5 shadow-sm transition hover:border-herb hover:shadow"
>
	<h2 class="font-serif text-lg leading-snug text-ink">{recipe.title || 'Untitled recipe'}</h2>
	{#if recipe.tags.length}
		<div class="mt-2 flex flex-wrap gap-1.5">
			{#each recipe.tags as tag (tag)}
				<span class="rounded-full bg-chip px-2 py-0.5 font-mono text-[0.68rem] text-chip-ink">#{tag}</span>
			{/each}
		</div>
	{/if}
</a>
