<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { createRecipe, type RecipeFields } from '$lib/data/recipes';
	import RecipeForm from '$lib/components/RecipeForm.svelte';

	const blank: RecipeFields = {
		title: '',
		servings: null,
		ingredients: [],
		steps: [],
		tags: [],
		source_url: null,
		notes: null
	};

	async function handleSave(fields: RecipeFields) {
		const url = await createRecipe(fields);
		// Replace so the browser back button skips the empty create form.
		await goto(`${base}/recipes/${encodeURIComponent(url)}`, { replaceState: true });
	}

	function handleCancel() {
		void goto(`${base}/`);
	}
</script>

<header class="px-4 pt-5">
	<a href={`${base}/`} class="font-mono text-xs tracking-wide text-muted uppercase hover:text-ink"
		>← Recipes</a
	>
</header>

<RecipeForm initial={blank} mode="create" onSave={handleSave} onCancel={handleCancel} />
