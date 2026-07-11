<script lang="ts">
	import { base } from '$app/paths';
	import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
	import { getWorkspaceUrl } from '$lib/data/repo';
	import { useDocument } from '$lib/data/useDocument.svelte';
	import {
		createCollection,
		loadCollectionSummaries,
		type CollectionSummary
	} from '$lib/data/collections';
	import type { WorkspaceDoc } from '$lib/domain/types';

	let wsUrl = $state<AutomergeUrl | undefined>(undefined);
	$effect(() => {
		void getWorkspaceUrl().then((u) => (wsUrl = u));
	});
	const ws = useDocument<WorkspaceDoc>(() => wsUrl);

	let collections = $state<CollectionSummary[]>([]);
	$effect(() => {
		const ids = ws.doc?.collection_ids;
		if (!ids) return;
		void loadCollectionSummaries([...ids]).then((c) => (collections = c));
	});

	let newName = $state('');
	let creating = $state(false);
	async function add() {
		if (!newName.trim()) return;
		creating = true;
		try {
			await createCollection(newName);
			newName = '';
		} finally {
			creating = false;
		}
	}
</script>

<header class="flex items-baseline justify-between px-4 pt-6 pb-3">
	<h1 class="font-serif text-3xl text-ink">Collections</h1>
	<a href={`${base}/`} class="font-mono text-xs tracking-wide text-herb uppercase">Recipes →</a>
</header>

<div class="flex gap-2 px-4 pb-3">
	<input
		bind:value={newName}
		onkeydown={(e) => e.key === 'Enter' && add()}
		placeholder="New collection, e.g. Weeknight…"
		class="flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-herb"
	/>
	<button
		onclick={add}
		disabled={creating || !newName.trim()}
		class="rounded-full bg-btn px-4 py-2 text-sm font-semibold text-on-btn disabled:opacity-50">Add</button
	>
</div>

<section class="px-4">
	{#if !ws.ready}
		<p class="py-16 text-center text-muted">Loading…</p>
	{:else if collections.length === 0}
		<p class="mx-auto mt-8 max-w-xs text-center text-sm text-muted">
			No collections yet. Group recipes into cookbooks like “Weeknight” or “Baking”.
		</p>
	{:else}
		<ul class="space-y-2">
			{#each collections as c (c.url)}
				<li>
					<a
						href={`${base}/collections/${encodeURIComponent(c.url)}`}
						class="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 transition hover:border-herb"
					>
						<span class="font-serif text-lg text-ink">{c.name}</span>
						<span class="font-mono text-xs text-muted"
							>{c.recipeCount} {c.recipeCount === 1 ? 'recipe' : 'recipes'}</span
						>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</section>
