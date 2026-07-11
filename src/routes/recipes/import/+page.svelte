<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import RecipeForm from '$lib/components/RecipeForm.svelte';
	import { createRecipe, type RecipeFields } from '$lib/data/recipes';
	import { parseIngredient } from '$lib/domain/ingredients';

	let url = $state('');
	let loading = $state(false);
	let error = $state('');
	let draft = $state<RecipeFields | null>(null);
	let parsedVia = $state('');

	function toServings(raw: string | null): number | null {
		const n = parseInt(raw ?? '', 10);
		return Number.isFinite(n) && n > 0 ? n : null;
	}

	async function fetchRecipe() {
		if (!url.trim()) return;
		loading = true;
		error = '';
		draft = null;
		try {
			const res = await fetch(`${base}/api/import?url=${encodeURIComponent(url.trim())}`);
			const data = await res.json();
			if (!res.ok) {
				error = data?.error ?? 'Import failed.';
				return;
			}
			draft = {
				title: data.title ?? '',
				servings: toServings(data.servings),
				ingredients: (data.ingredients ?? []).map((s: string) => parseIngredient(s)),
				steps: data.steps ?? [],
				tags: [],
				source_url: data.source_url ?? url.trim(),
				notes: null,
				photo_hash: null
			};
			parsedVia = data.parsed_via ?? '';
		} catch {
			error = 'Could not reach the import service.';
		} finally {
			loading = false;
		}
	}

	async function handleSave(fields: RecipeFields) {
		const created = await createRecipe(fields);
		await goto(`${base}/recipes/${encodeURIComponent(created)}`, { replaceState: true });
	}
</script>

<header class="px-4 pt-5">
	<a href={`${base}/`} class="font-mono text-xs tracking-wide text-muted uppercase hover:text-ink"
		>← Recipes</a
	>
</header>

{#if !draft}
	<div class="px-4 pt-4">
		<h1 class="font-serif text-2xl text-ink">Import from a link</h1>
		<p class="mt-1 mb-4 text-sm text-muted">
			Paste a recipe URL and we'll pull in the title, ingredients, and steps for you to review.
		</p>
		<div class="flex gap-2">
			<input
				bind:value={url}
				onkeydown={(e) => e.key === 'Enter' && fetchRecipe()}
				placeholder="https://…"
				inputmode="url"
				class="flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-herb"
			/>
			<button
				onclick={fetchRecipe}
				disabled={loading || !url.trim()}
				class="rounded-full bg-btn px-5 py-2 text-sm font-semibold text-on-btn disabled:opacity-50"
				>{loading ? 'Fetching…' : 'Fetch'}</button
			>
		</div>
		{#if error}
			<p class="mt-3 text-sm text-danger">{error}</p>
		{/if}
	</div>
{:else}
	<div class="px-4 pt-3">
		<p class="font-mono text-xs text-muted">
			Parsed via {parsedVia} · review and save
		</p>
	</div>
	{#key draft}
		<RecipeForm initial={draft} mode="create" onSave={handleSave} onCancel={() => (draft = null)} />
	{/key}
{/if}
