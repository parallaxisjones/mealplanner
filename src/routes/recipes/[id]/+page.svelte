<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
	import { useDocument } from '$lib/data/useDocument.svelte';
	import { updateRecipe, deleteRecipe, type RecipeFields } from '$lib/data/recipes';
	import type { RecipeDoc } from '$lib/domain/types';
	import RecipeForm from '$lib/components/RecipeForm.svelte';

	const id = $derived(page.params.id ?? '');
	const recipe = useDocument<RecipeDoc>(() => id as AutomergeUrl);

	let editing = $state(false);
	// Return to view mode whenever we navigate to a different recipe.
	$effect(() => {
		id;
		editing = false;
	});

	function toFields(doc: RecipeDoc): RecipeFields {
		return {
			title: doc.title,
			servings: doc.servings,
			ingredients: doc.ingredients.map((i) => ({ ...i })),
			steps: [...doc.steps],
			tags: [...doc.tags],
			source_url: doc.source_url,
			notes: doc.notes
		};
	}

	async function handleSave(fields: RecipeFields) {
		await updateRecipe(id, fields);
		editing = false;
	}

	async function handleDelete() {
		if (!confirm('Delete this recipe? This cannot be undone.')) return;
		await deleteRecipe(id);
		await goto(`${base}/`);
	}
</script>

{#if !recipe.ready}
	<p class="py-16 text-center text-muted">Loading…</p>
{:else if !recipe.doc}
	<div class="px-4 pt-16 text-center">
		<p class="font-serif text-xl text-ink">Recipe not found</p>
		<a href={`${base}/`} class="mt-3 inline-block font-mono text-xs tracking-wide text-herb uppercase"
			>← Back to recipes</a
		>
	</div>
{:else if editing}
	<header class="px-4 pt-5">
		<button
			type="button"
			onclick={() => (editing = false)}
			class="font-mono text-xs tracking-wide text-muted uppercase hover:text-ink">← Cancel edit</button
		>
	</header>
	<RecipeForm
		initial={toFields(recipe.doc)}
		mode="edit"
		onSave={handleSave}
		onCancel={() => (editing = false)}
		onDelete={handleDelete}
	/>
{:else}
	<article class="px-4 pt-5 pb-4">
		<a href={`${base}/`} class="font-mono text-xs tracking-wide text-muted uppercase hover:text-ink"
			>← Recipes</a
		>

		<div class="mt-4 flex items-start justify-between gap-3">
			<h1 class="font-serif text-3xl leading-tight text-ink">
				{recipe.doc.title || 'Untitled recipe'}
			</h1>
			<button
				type="button"
				onclick={() => (editing = true)}
				class="shrink-0 rounded-full border border-line px-4 py-1.5 text-sm text-ink transition hover:border-herb"
				>Edit</button
			>
		</div>

		{#if recipe.doc.servings}
			<p class="mt-1 font-mono text-xs tracking-wider text-muted uppercase">
				{recipe.doc.servings} servings
			</p>
		{/if}

		{#if recipe.doc.tags.length}
			<div class="mt-3 flex flex-wrap gap-1.5">
				{#each recipe.doc.tags as tag (tag)}
					<span class="rounded-full bg-chip px-2 py-0.5 font-mono text-[0.68rem] text-chip-ink">#{tag}</span
					>
				{/each}
			</div>
		{/if}

		{#if recipe.doc.ingredients.length}
			<section class="mt-7">
				<h2 class="mb-2.5 border-b border-line pb-1 font-mono text-xs tracking-widest text-muted uppercase">
					Ingredients
				</h2>
				<ul class="space-y-1.5">
					{#each recipe.doc.ingredients as ing (ing.original + ing.name)}
						<li class="flex gap-2.5 text-ink">
							<span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-herb"></span>
							<span>{ing.original || ing.name}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if recipe.doc.steps.length}
			<section class="mt-7">
				<h2 class="mb-2.5 border-b border-line pb-1 font-mono text-xs tracking-widest text-muted uppercase">
					Steps
				</h2>
				<ol class="space-y-3.5">
					{#each recipe.doc.steps as step, i (i)}
						<li class="flex gap-3">
							<span class="mt-0.5 shrink-0 font-mono text-sm text-herb">{i + 1}.</span>
							<p class="leading-relaxed text-ink">{step}</p>
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		{#if recipe.doc.notes}
			<section class="mt-7">
				<h2 class="mb-2.5 border-b border-line pb-1 font-mono text-xs tracking-widest text-muted uppercase">
					Notes
				</h2>
				<p class="leading-relaxed whitespace-pre-wrap text-ink">{recipe.doc.notes}</p>
			</section>
		{/if}

		{#if recipe.doc.source_url}
			<section class="mt-7">
				<a
					href={recipe.doc.source_url}
					target="_blank"
					rel="noopener noreferrer"
					class="font-mono text-xs break-all text-herb hover:underline">Source ↗</a
				>
			</section>
		{/if}
	</article>
{/if}
