<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { base } from '$app/paths';

	let { children } = $props();

	const tabs = [
		{ href: '/', label: 'Recipes', icon: '🍳', active: (id: string) => id === '/' || id.startsWith('/recipes') },
		{ href: '/plan', label: 'Plan', icon: '🗓️', active: (id: string) => id.startsWith('/plan') },
		{ href: '/list', label: 'List', icon: '🛒', active: (id: string) => id.startsWith('/list') },
		{ href: '/settings', label: 'Settings', icon: '⚙️', active: (id: string) => id.startsWith('/settings') }
	];

	const routeId = $derived(page.route.id ?? '/');
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="mx-auto flex min-h-dvh max-w-2xl flex-col">
	<main class="flex-1 pb-20">
		{@render children()}
	</main>

	<nav
		class="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/90 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90"
	>
		<div class="mx-auto flex max-w-2xl">
			{#each tabs as tab (tab.href)}
				{@const isActive = tab.active(routeId)}
				<a
					href={`${base}${tab.href}`}
					aria-current={isActive ? 'page' : undefined}
					class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors {isActive
						? 'text-emerald-600 dark:text-emerald-400'
						: 'text-gray-500 dark:text-gray-400'}"
				>
					<span class="text-lg leading-none">{tab.icon}</span>
					{tab.label}
				</a>
			{/each}
		</div>
	</nav>
</div>
