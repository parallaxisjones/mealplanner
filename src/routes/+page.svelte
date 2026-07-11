<script lang="ts">
	import { base } from '$app/paths';
	import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
	import { getWorkspaceUrl } from '$lib/data/repo';
	import { useDocument } from '$lib/data/useDocument.svelte';
	import { loadRecipeSummaries, type RecipeSummary } from '$lib/data/recipes';
	import { createRecipeSearcher } from '$lib/domain/search';
	import type { WorkspaceDoc } from '$lib/domain/types';
	import RecipeCard from '$lib/components/RecipeCard.svelte';

	let wsUrl = $state<AutomergeUrl | undefined>(undefined);
	$effect(() => {
		void getWorkspaceUrl().then((u) => (wsUrl = u));
	});

	const ws = useDocument<WorkspaceDoc>(() => wsUrl);

	let summaries = $state<RecipeSummary[]>([]);
	$effect(() => {
		const ids = ws.doc?.recipe_ids;
		if (!ids) return;
		void loadRecipeSummaries([...ids]).then((s) => (summaries = s));
	});

	// Debounced fuzzy search.
	let queryInput = $state('');
	let query = $state('');
	let debounce: ReturnType<typeof setTimeout>;
	function onSearchInput(value: string) {
		queryInput = value;
		clearTimeout(debounce);
		debounce = setTimeout(() => (query = value), 150);
	}

	const searcher = $derived(createRecipeSearcher(summaries));
	const allTags = $derived([...new Set(summaries.flatMap((s) => s.tags))].sort());
	let activeTags = $state<string[]>([]);
	function toggleTag(tag: string) {
		activeTags = activeTags.includes(tag)
			? activeTags.filter((t) => t !== tag)
			: [...activeTags, tag];
	}

	const results = $derived.by(() => {
		let list = query.trim() ? searcher(query) : summaries;
		if (activeTags.length) list = list.filter((r) => activeTags.every((t) => r.tags.includes(t)));
		return list;
	});
</script>

<header class="flex items-baseline justify-between px-4 pt-6 pb-3">
	<h1 class="font-serif text-3xl text-ink">Recipes</h1>
	<div class="flex items-center gap-4">
		<a
			href={`${base}/collections`}
			class="font-mono text-xs tracking-wide text-herb uppercase hover:underline">Collections</a
		>
		<a
			href={`${base}/recipes/new`}
			class="rounded-full bg-btn px-4 py-2 text-sm font-semibold text-on-btn shadow-sm transition hover:opacity-90"
			>+ New</a
		>
	</div>
</header>

{#if ws.ready && summaries.length > 0}
	<div class="space-y-3 px-4 pb-3">
		<input
			value={queryInput}
			oninput={(e) => onSearchInput(e.currentTarget.value)}
			placeholder="Search recipes, ingredients, tags…"
			aria-label="Search recipes"
			class="w-full rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-herb"
		/>
		{#if allTags.length}
			<div class="flex flex-wrap gap-1.5">
				{#each allTags as tag (tag)}
					<button
						type="button"
						onclick={() => toggleTag(tag)}
						aria-pressed={activeTags.includes(tag)}
						class="rounded-full px-2.5 py-0.5 font-mono text-[0.7rem] transition {activeTags.includes(tag)
							? 'bg-btn text-on-btn'
							: 'bg-chip text-chip-ink hover:opacity-80'}">#{tag}</button
					>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<section class="px-4">
	{#if !ws.ready}
		<p class="py-16 text-center text-muted">Loading…</p>
	{:else if summaries.length === 0}
		<div class="mt-10 rounded-xl border border-dashed border-line px-6 py-14 text-center">
			<p class="font-serif text-xl text-ink">Your recipe box is empty</p>
			<p class="mx-auto mt-2 max-w-xs text-sm text-muted">
				Add your first recipe and it lives right here in your browser.
			</p>
			<a
				href={`${base}/recipes/new`}
				class="mt-5 inline-block rounded-full bg-btn px-5 py-2 text-sm font-semibold text-on-btn"
				>+ New recipe</a
			>
		</div>
	{:else if results.length === 0}
		<p class="py-12 text-center text-muted">No recipes match your search.</p>
	{:else}
		<ul class="space-y-3">
			{#each results as recipe (recipe.url)}
				<li><RecipeCard {recipe} /></li>
			{/each}
		</ul>
	{/if}
</section>
