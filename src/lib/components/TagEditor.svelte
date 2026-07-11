<script lang="ts">
	import { normalizeTag } from '$lib/domain/tags';

	let { tags = $bindable([]) }: { tags: string[] } = $props();
	let draft = $state('');

	function commitDraft() {
		const parts = draft.split(',').map(normalizeTag).filter(Boolean);
		if (parts.length) {
			const next = [...tags];
			for (const p of parts) if (!next.includes(p)) next.push(p);
			tags = next;
		}
		draft = '';
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			commitDraft();
		} else if (e.key === 'Backspace' && draft === '' && tags.length) {
			tags = tags.slice(0, -1);
		}
	}
</script>

<div class="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-2 focus-within:border-herb">
	{#each tags as tag (tag)}
		<span class="inline-flex items-center gap-1 rounded-full bg-chip px-2.5 py-0.5 font-mono text-xs text-chip-ink">
			#{tag}
			<button
				type="button"
				onclick={() => (tags = tags.filter((t) => t !== tag))}
				aria-label={`Remove ${tag}`}
				class="opacity-60 hover:text-danger hover:opacity-100">×</button
			>
		</span>
	{/each}
	<input
		bind:value={draft}
		onkeydown={onKeydown}
		onblur={commitDraft}
		placeholder={tags.length ? '' : 'Add tags, comma-separated…'}
		class="min-w-28 flex-1 bg-transparent px-1 py-0.5 text-sm outline-none"
	/>
</div>
