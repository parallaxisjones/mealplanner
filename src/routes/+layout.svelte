<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { base } from '$app/paths';

	let { children } = $props();

	const tabs = [
		{ href: '/', label: 'Recipes', active: (id: string) => id === '/' || id.startsWith('/recipes') },
		{ href: '/plan', label: 'Plan', active: (id: string) => id.startsWith('/plan') },
		{ href: '/list', label: 'List', active: (id: string) => id.startsWith('/list') },
		{ href: '/settings', label: 'Settings', active: (id: string) => id.startsWith('/settings') }
	];

	const routeId = $derived(page.route.id ?? '/');
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="mx-auto flex min-h-dvh max-w-2xl flex-col">
	<main class="flex-1 pb-24">
		{@render children()}
	</main>

	<nav class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
		<div class="mx-auto flex max-w-2xl">
			{#each tabs as tab (tab.href)}
				{@const isActive = tab.active(routeId)}
				<a
					href={`${base}${tab.href}`}
					aria-current={isActive ? 'page' : undefined}
					class="flex flex-1 flex-col items-center gap-1 border-t-2 py-3 font-mono text-[0.7rem] tracking-wider uppercase transition-colors {isActive
						? 'border-herb text-herb'
						: 'border-transparent text-muted hover:text-ink'}"
				>
					{tab.label}
				</a>
			{/each}
		</div>
	</nav>
</div>
