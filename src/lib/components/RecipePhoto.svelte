<script lang="ts">
	import { getPhotoObjectUrl } from '$lib/data/photos';

	let {
		hash,
		alt = '',
		class: className = ''
	}: { hash: string | null; alt?: string; class?: string } = $props();

	let url = $state<string | null>(null);

	$effect(() => {
		url = null;
		const h = hash;
		if (!h) return;
		let cancelled = false;
		void getPhotoObjectUrl(h).then((u) => {
			if (!cancelled) url = u;
		});
		return () => {
			cancelled = true;
		};
	});
</script>

{#if url}
	<img src={url} {alt} class={className} loading="lazy" />
{/if}
