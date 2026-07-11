<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
	import { useDocument } from '$lib/data/useDocument.svelte';
	import {
		renameCollection,
		deleteCollection,
		removeRecipeFromCollection,
		moveRecipeInCollection
	} from '$lib/data/collections';
	import { loadRecipeSummaries, type RecipeSummary } from '$lib/data/recipes';
	import type { CollectionDoc } from '$lib/domain/types';
	import RecipeCard from '$lib/components/RecipeCard.svelte';

	const id = $derived(page.params.id ?? '');
	const collection = useDocument<CollectionDoc>(() => id as AutomergeUrl);

	let recipes = $state<RecipeSummary[]>([]);
	$effect(() => {
		const ids = collection.doc?.recipe_ids;
		if (!ids) return;
		void loadRecipeSummaries([...ids]).then((r) => (recipes = r));
	});

	let editingName = $state(false);
	let nameDraft = $state('');
	function startRename() {
		nameDraft = collection.doc?.name ?? '';
		editingName = true;
	}
	async function saveName() {
		await renameCollection(id, nameDraft);
		editingName = false;
	}

	async function handleDelete() {
		if (!confirm('Delete this collection? Your recipes are not deleted.')) return;
		await deleteCollection(id);
		await goto(`${base}/collections`);
	}
</script>

{#if !collection.ready}
	<p class="py-16 text-center text-muted">Loading…</p>
{:else if !collection.doc}
	<div class="px-4 pt-16 text-center">
		<p class="font-serif text-xl text-ink">Collection not found</p>
		<a href={`${base}/collections`} class="mt-3 inline-block font-mono text-xs text-herb uppercase"
			>← Collections</a
		>
	</div>
{:else}
	<header class="px-4 pt-5">
		<a href={`${base}/collections`} class="font-mono text-xs tracking-wide text-muted uppercase hover:text-ink"
			>← Collections</a
		>
		<div class="mt-4 flex items-start justify-between gap-3">
			{#if editingName}
				<input
					bind:value={nameDraft}
					onkeydown={(e) => e.key === 'Enter' && saveName()}
					class="flex-1 border-b border-line bg-transparent pb-1 font-serif text-2xl text-ink outline-none focus:border-herb"
				/>
				<button onclick={saveName} class="shrink-0 rounded-full bg-btn px-4 py-1.5 text-sm text-on-btn"
					>Save</button
				>
			{:else}
				<h1 class="font-serif text-3xl leading-tight text-ink">{collection.doc.name}</h1>
				<button
					onclick={startRename}
					class="shrink-0 rounded-full border border-line px-4 py-1.5 text-sm text-ink hover:border-herb"
					>Rename</button
				>
			{/if}
		</div>
	</header>

	<section class="mt-5 px-4">
		{#if recipes.length === 0}
			<p class="py-10 text-center text-sm text-muted">
				No recipes yet. Open a recipe and use “Collections” to add it here.
			</p>
		{:else}
			<ul class="space-y-2">
				{#each recipes as r, i (r.url)}
					<li class="flex items-center gap-2">
						<div class="min-w-0 flex-1"><RecipeCard recipe={r} /></div>
						<div class="flex flex-col text-muted">
							<button
								onclick={() => moveRecipeInCollection(id, i, -1)}
								disabled={i === 0}
								aria-label="Move up"
								class="px-1 leading-none hover:text-ink disabled:opacity-30">↑</button
							>
							<button
								onclick={() => moveRecipeInCollection(id, i, 1)}
								disabled={i === recipes.length - 1}
								aria-label="Move down"
								class="px-1 leading-none hover:text-ink disabled:opacity-30">↓</button
							>
						</div>
						<button
							onclick={() => removeRecipeFromCollection(id, r.url)}
							aria-label="Remove from collection"
							class="px-1 text-lg leading-none text-muted hover:text-danger">×</button
						>
					</li>
				{/each}
			</ul>
		{/if}

		<button
			onclick={handleDelete}
			class="mt-8 font-mono text-xs tracking-wide text-danger uppercase hover:underline"
			>Delete collection</button
		>
	</section>
{/if}
