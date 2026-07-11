<script lang="ts">
	import { base } from '$app/paths';
	import type { RecipeSummary } from '$lib/data/recipes';
	import RecipePhoto from './RecipePhoto.svelte';

	let { recipe }: { recipe: RecipeSummary } = $props();
</script>

<a
	href={`${base}/recipes/${encodeURIComponent(recipe.url)}`}
	class="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm transition hover:border-herb hover:shadow"
>
	{#if recipe.photoHash}
		<RecipePhoto
			hash={recipe.photoHash}
			alt=""
			class="h-16 w-16 shrink-0 rounded-lg border border-line object-cover"
		/>
	{/if}
	<div class="min-w-0">
		<h2 class="truncate font-serif text-lg leading-snug text-ink">
			{recipe.title || 'Untitled recipe'}
		</h2>
		{#if recipe.tags.length}
			<div class="mt-1.5 flex flex-wrap gap-1.5">
				{#each recipe.tags as tag (tag)}
					<span class="rounded-full bg-chip px-2 py-0.5 font-mono text-[0.68rem] text-chip-ink"
						>#{tag}</span
					>
				{/each}
			</div>
		{/if}
	</div>
</a>
