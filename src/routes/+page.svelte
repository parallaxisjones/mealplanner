<script lang="ts">
	import { base } from '$app/paths';
	import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
	import { getWorkspaceUrl } from '$lib/data/repo';
	import { useDocument } from '$lib/data/useDocument.svelte';
	import { createRecipe, loadRecipeSummaries, type RecipeSummary } from '$lib/data/recipes';
	import type { WorkspaceDoc } from '$lib/domain/types';

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

	let creating = $state(false);
	async function addRecipe() {
		creating = true;
		try {
			await createRecipe({ title: 'Untitled recipe' });
		} finally {
			creating = false;
		}
	}
</script>

<header class="flex items-center justify-between px-4 pt-6 pb-3">
	<h1 class="text-2xl font-bold tracking-tight">Recipes</h1>
	<button
		onclick={addRecipe}
		disabled={creating}
		class="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
	>
		+ Add recipe
	</button>
</header>

<section class="px-4">
	{#if !ws.ready}
		<p class="py-16 text-center text-gray-400">Loading…</p>
	{:else if summaries.length === 0}
		<div class="py-16 text-center text-gray-400">
			<p class="text-4xl">🍽️</p>
			<p class="mt-3">No recipes yet.</p>
			<p class="text-sm">Tap “Add recipe” to start your collection.</p>
		</div>
	{:else}
		<ul class="space-y-2">
			{#each summaries as recipe (recipe.url)}
				<li>
					<a
						href={`${base}/recipes/${encodeURIComponent(recipe.url)}`}
						class="block rounded-xl border border-gray-200 bg-white px-4 py-3 font-medium shadow-sm transition hover:border-emerald-300 dark:border-gray-800 dark:bg-gray-900"
					>
						{recipe.title || 'Untitled'}
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
