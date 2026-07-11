<script lang="ts">
	import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
	import { getWorkspaceUrl } from '$lib/data/repo';
	import { useDocument } from '$lib/data/useDocument.svelte';
	import {
		getShoppingListUrl,
		generateFromWeek,
		addManualItem,
		toggleItem,
		removeItem,
		clearAll
	} from '$lib/data/shoppingList';
	import { loadRecipeSummaries, type RecipeSummary } from '$lib/data/recipes';
	import { formatQuantity } from '$lib/domain/scaler';
	import { formatWeekRange, todayWeekKey } from '$lib/domain/week';
	import type { ShoppingItem, ShoppingListDoc, WorkspaceDoc } from '$lib/domain/types';

	let wsUrl = $state<AutomergeUrl | undefined>(undefined);
	$effect(() => {
		void getWorkspaceUrl().then((u) => (wsUrl = u));
	});
	const ws = useDocument<WorkspaceDoc>(() => wsUrl);

	let listUrl = $state<AutomergeUrl | undefined>(undefined);
	$effect(() => {
		void getShoppingListUrl().then((u) => (listUrl = u));
	});
	const list = useDocument<ShoppingListDoc>(() => listUrl);

	let recipes = $state<RecipeSummary[]>([]);
	$effect(() => {
		const ids = ws.doc?.recipe_ids;
		if (!ids) return;
		void loadRecipeSummaries([...ids]).then((r) => (recipes = r));
	});
	const titleMap = $derived(new Map(recipes.map((r) => [r.url, r.title])));

	const items = $derived(list.doc?.items ?? []);
	const unchecked = $derived(items.filter((i) => !i.checked));
	const checked = $derived(items.filter((i) => i.checked));
	const planWeek = $derived(ws.doc?.current_week ?? todayWeekKey());

	let manual = $state('');
	async function addManual() {
		if (!manual.trim()) return;
		await addManualItem(manual);
		manual = '';
	}

	async function generate() {
		await generateFromWeek(planWeek);
	}
	async function clear() {
		if (confirm('Clear the whole list? This cannot be undone.')) await clearAll();
	}

	function qtyLabel(item: ShoppingItem): string {
		const q = item.quantity == null ? '' : formatQuantity(item.quantity);
		return [q, item.unit ?? ''].filter(Boolean).join(' ');
	}
	function sources(item: ShoppingItem): string {
		const names = item.source_recipes.map((u) => titleMap.get(u)).filter(Boolean);
		return names.length ? `from ${names.join(', ')}` : '';
	}
</script>

{#snippet row(item: ShoppingItem)}
	<li class="flex items-center gap-3 py-2">
		<input
			type="checkbox"
			checked={item.checked}
			onchange={() => toggleItem(item.id)}
			aria-label={`Check off ${item.name}`}
			class="h-5 w-5 shrink-0 accent-[var(--c-herb)]"
		/>
		<div class="min-w-0 flex-1 {item.checked ? 'text-muted line-through' : 'text-ink'}">
			<span class="text-sm">
				{#if qtyLabel(item)}<span class="font-mono text-xs text-muted">{qtyLabel(item)}</span> {/if}{item.name}
			</span>
			{#if sources(item)}<div class="truncate text-[0.7rem] text-muted">{sources(item)}</div>{/if}
		</div>
		<button
			onclick={() => removeItem(item.id)}
			aria-label={`Remove ${item.name}`}
			class="px-1 text-lg leading-none text-muted hover:text-danger">×</button
		>
	</li>
{/snippet}

<header class="flex items-baseline justify-between px-4 pt-6 pb-2">
	<div>
		<h1 class="font-serif text-3xl text-ink">Shopping</h1>
		{#if list.doc?.active_week}
			<p class="font-mono text-xs text-muted">from {formatWeekRange(list.doc.active_week)}</p>
		{/if}
	</div>
	<div class="flex items-center gap-3">
		<button onclick={generate} class="font-mono text-xs tracking-wide text-herb uppercase hover:underline"
			>Regenerate</button
		>
		{#if items.length}
			<button onclick={clear} class="font-mono text-xs tracking-wide text-danger uppercase hover:underline"
				>Clear</button
			>
		{/if}
	</div>
</header>

<div class="flex gap-2 px-4 py-2">
	<input
		bind:value={manual}
		onkeydown={(e) => e.key === 'Enter' && addManual()}
		placeholder="Add an item, e.g. 2 lb apples…"
		class="flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none focus:border-herb"
	/>
	<button
		onclick={addManual}
		disabled={!manual.trim()}
		class="rounded-full bg-btn px-4 py-2 text-sm font-semibold text-on-btn disabled:opacity-50">Add</button
	>
</div>

<section class="px-4">
	{#if !list.ready}
		<p class="py-16 text-center text-muted">Loading…</p>
	{:else if items.length === 0}
		<div class="mt-8 rounded-xl border border-dashed border-line px-6 py-12 text-center">
			<p class="text-sm text-muted">Your list is empty.</p>
			<button
				onclick={generate}
				class="mt-4 rounded-full bg-btn px-5 py-2 text-sm font-semibold text-on-btn"
				>Generate from this week</button
			>
		</div>
	{:else}
		<ul class="divide-y divide-line">
			{#each unchecked as item (item.id)}{@render row(item)}{/each}
		</ul>
		{#if checked.length}
			<ul class="mt-3 divide-y divide-line border-t border-line pt-1">
				{#each checked as item (item.id)}{@render row(item)}{/each}
			</ul>
		{/if}
	{/if}
</section>
