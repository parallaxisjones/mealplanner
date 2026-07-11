<script lang="ts">
	import { base } from '$app/paths';
	import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
	import { getWorkspaceUrl } from '$lib/data/repo';
	import { useDocument } from '$lib/data/useDocument.svelte';
	import { loadRecipeSummaries, type RecipeSummary } from '$lib/data/recipes';
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
</script>

<header class="flex items-baseline justify-between px-4 pt-6 pb-4">
	<h1 class="font-serif text-3xl text-ink">Recipes</h1>
	<a
		href={`${base}/recipes/new`}
		class="rounded-full bg-btn px-4 py-2 text-sm font-semibold text-on-btn shadow-sm transition hover:opacity-90"
		>+ New</a
	>
</header>

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
	{:else}
		<ul class="space-y-3">
			{#each summaries as recipe (recipe.url)}
				<li><RecipeCard {recipe} /></li>
			{/each}
		</ul>
	{/if}
</section>
