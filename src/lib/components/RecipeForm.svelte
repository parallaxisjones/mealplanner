<script lang="ts">
	import { untrack } from 'svelte';
	import IngredientEditor from './IngredientEditor.svelte';
	import StepEditor from './StepEditor.svelte';
	import TagEditor from './TagEditor.svelte';
	import RecipePhoto from './RecipePhoto.svelte';
	import { downscaleImage, putPhoto } from '$lib/data/photos';
	import type { RecipeFields } from '$lib/data/recipes';

	let {
		initial,
		mode = 'edit',
		onSave,
		onCancel,
		onDelete
	}: {
		initial: RecipeFields;
		mode?: 'create' | 'edit';
		onSave: (fields: RecipeFields) => void | Promise<void>;
		onCancel: () => void;
		onDelete?: () => void | Promise<void>;
	} = $props();

	// A local editable copy (source_url/notes as plain strings for binding). The
	// parent remounts this form per recipe via {#key}, so capturing `initial`
	// once is intentional.
	interface EditModel {
		title: string;
		servings: number | null;
		ingredients: RecipeFields['ingredients'];
		steps: string[];
		tags: string[];
		source_url: string;
		notes: string;
		photo_hash: string | null;
	}
	const seed = untrack(() => $state.snapshot(initial)) as RecipeFields;
	let model = $state<EditModel>({
		title: seed.title,
		servings: seed.servings,
		ingredients: structuredClone(seed.ingredients),
		steps: [...seed.steps],
		tags: [...seed.tags],
		source_url: seed.source_url ?? '',
		notes: seed.notes ?? '',
		photo_hash: seed.photo_hash
	});
	let saving = $state(false);
	let photoBusy = $state(false);

	async function onPickPhoto(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		photoBusy = true;
		try {
			model.photo_hash = await putPhoto(await downscaleImage(file));
		} finally {
			photoBusy = false;
			input.value = '';
		}
	}

	async function save() {
		saving = true;
		try {
			await onSave({
				title: model.title.trim(),
				servings:
					typeof model.servings === 'number' && model.servings > 0 ? model.servings : null,
				ingredients: model.ingredients.filter(
					(i) => i.name.trim() !== '' || i.original.trim() !== ''
				),
				steps: model.steps.map((s) => s.trim()).filter((s) => s !== ''),
				tags: model.tags,
				source_url: model.source_url.trim() || null,
				notes: model.notes.trim() || null,
				photo_hash: model.photo_hash
			});
		} finally {
			saving = false;
		}
	}
</script>

{#snippet heading(label: string)}
	<h3 class="mb-2 border-b border-line pb-1 font-mono text-xs tracking-widest text-muted uppercase">
		{label}
	</h3>
{/snippet}

<div class="space-y-6 px-4 pt-4">
	<input
		bind:value={model.title}
		placeholder="Recipe title"
		aria-label="Recipe title"
		class="w-full border-b border-line bg-transparent pb-1 font-serif text-2xl text-ink outline-none focus:border-herb"
	/>

	<div class="flex flex-wrap gap-4">
		<label class="flex items-center gap-2 font-mono text-xs tracking-wide text-muted uppercase">
			Servings
			<input
				type="number"
				min="1"
				bind:value={model.servings}
				placeholder="—"
				class="w-16 rounded-lg border border-line bg-surface px-2 py-1 text-center text-sm text-ink outline-none focus:border-herb"
			/>
		</label>
	</div>

	<section>
		{@render heading('Photo')}
		{#if model.photo_hash}
			<RecipePhoto
				hash={model.photo_hash}
				alt=""
				class="mb-3 max-h-56 w-full rounded-lg border border-line object-cover"
			/>
		{/if}
		<div class="flex items-center gap-3">
			<label
				class="cursor-pointer rounded-full border border-line px-4 py-1.5 text-sm text-ink transition hover:border-herb"
			>
				{model.photo_hash ? 'Replace photo' : 'Add photo'}
				<input type="file" accept="image/*" class="hidden" onchange={onPickPhoto} />
			</label>
			{#if model.photo_hash}
				<button
					type="button"
					onclick={() => (model.photo_hash = null)}
					class="font-mono text-xs text-danger hover:underline">Remove</button
				>
			{/if}
			{#if photoBusy}<span class="text-xs text-muted">Processing…</span>{/if}
		</div>
	</section>

	<section>
		{@render heading('Ingredients')}
		<IngredientEditor bind:ingredients={model.ingredients} />
	</section>

	<section>
		{@render heading('Steps')}
		<StepEditor bind:steps={model.steps} />
	</section>

	<section>
		{@render heading('Tags')}
		<TagEditor bind:tags={model.tags} />
	</section>

	<section>
		{@render heading('Notes')}
		<textarea
			bind:value={model.notes}
			rows="3"
			placeholder="Anything to remember…"
			class="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed outline-none focus:border-herb"
		></textarea>
	</section>

	<section>
		{@render heading('Source')}
		<input
			bind:value={model.source_url}
			placeholder="https://…"
			class="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-herb"
		/>
	</section>

	<div class="flex items-center gap-3 pt-2">
		<button
			type="button"
			onclick={save}
			disabled={saving}
			class="rounded-full bg-btn px-5 py-2 text-sm font-semibold text-on-btn shadow-sm transition hover:opacity-90 disabled:opacity-50"
		>
			{saving ? 'Saving…' : mode === 'create' ? 'Create recipe' : 'Save changes'}
		</button>
		<button type="button" onclick={onCancel} class="text-sm text-muted hover:text-ink">Cancel</button>
		{#if mode === 'edit' && onDelete}
			<button
				type="button"
				onclick={onDelete}
				class="ml-auto font-mono text-xs tracking-wide text-danger uppercase hover:underline"
			>
				Delete
			</button>
		{/if}
	</div>
</div>
