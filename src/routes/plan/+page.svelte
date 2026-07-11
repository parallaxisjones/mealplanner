<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
	import { getWorkspaceUrl } from '$lib/data/repo';
	import { useDocument } from '$lib/data/useDocument.svelte';
	import {
		getOrCreatePlan,
		addPlanEntry,
		removePlanEntry,
		setPlanEntryServings
	} from '$lib/data/mealplans';
	import { generateFromWeek } from '$lib/data/shoppingList';
	import { loadRecipeSummaries, type RecipeSummary } from '$lib/data/recipes';
	import { createRecipeSearcher } from '$lib/domain/search';
	import {
		todayWeekKey,
		addWeeks,
		weekToDates,
		formatWeekRange,
		formatDayLabel
	} from '$lib/domain/week';
	import type { MealPlanDoc, MealSlot, WorkspaceDoc } from '$lib/domain/types';

	const SLOTS: { key: MealSlot; label: string }[] = [
		{ key: 'breakfast', label: 'Breakfast' },
		{ key: 'lunch', label: 'Lunch' },
		{ key: 'dinner', label: 'Dinner' },
		{ key: 'snack', label: 'Snack' }
	];

	let wsUrl = $state<AutomergeUrl | undefined>(undefined);
	$effect(() => {
		void getWorkspaceUrl().then((u) => (wsUrl = u));
	});
	const ws = useDocument<WorkspaceDoc>(() => wsUrl);

	let week = $state('');
	$effect(() => {
		if (week || !ws.doc) return;
		week = ws.doc.current_week ?? todayWeekKey();
	});

	let planUrl = $state<AutomergeUrl | undefined>(undefined);
	$effect(() => {
		if (!week) return;
		void getOrCreatePlan(week).then((u) => (planUrl = u));
	});
	const plan = useDocument<MealPlanDoc>(() => planUrl);

	let recipes = $state<RecipeSummary[]>([]);
	$effect(() => {
		const ids = ws.doc?.recipe_ids;
		if (!ids) return;
		void loadRecipeSummaries([...ids]).then((r) => (recipes = r));
	});
	const recipeMap = $derived(new Map(recipes.map((r) => [r.url, r])));

	const dates = $derived(week ? weekToDates(week) : []);
	let selectedDay = $state(0);
	$effect(() => {
		if (!week) return;
		const t = new Date();
		const todayIso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
		const idx = weekToDates(week).indexOf(todayIso);
		selectedDay = idx >= 0 ? idx : 0;
	});

	function go(delta: number) {
		week = addWeeks(week, delta);
	}
	function goToday() {
		week = todayWeekKey();
	}

	async function removeEntry(date: string, slot: MealSlot, index: number) {
		if (planUrl) await removePlanEntry(planUrl, date, slot, index);
	}
	async function changeServings(date: string, slot: MealSlot, index: number, value: string) {
		if (planUrl)
			await setPlanEntryServings(planUrl, date, slot, index, value === '' ? null : Number(value));
	}

	// Recipe picker.
	let picker = $state<{ date: string; slot: MealSlot } | null>(null);
	let pickerQuery = $state('');
	const pickerResults = $derived(createRecipeSearcher(recipes)(pickerQuery));
	function openPicker(date: string, slot: MealSlot) {
		picker = { date, slot };
		pickerQuery = '';
	}
	async function pick(r: RecipeSummary) {
		if (picker) await addPlanEntry(week, picker.date, picker.slot, {
			recipe_id: r.url,
			servings: r.servings ?? 2,
			note: null
		});
		picker = null;
	}

	async function makeShoppingList() {
		await generateFromWeek(week);
		await goto(`${base}/list`);
	}
</script>

{#snippet slotContent(date: string, slot: MealSlot, editable: boolean)}
	{@const entries = plan.doc?.days?.[date]?.[slot] ?? []}
	<div class="space-y-1">
		{#each entries as entry, index (index)}
			<div class="flex items-center gap-1 rounded-md bg-chip/60 px-1.5 py-1">
				<span class="min-w-0 flex-1 truncate text-sm text-ink"
					>{recipeMap.get(entry.recipe_id)?.title ?? 'Recipe'}</span
				>
				{#if editable}
					<input
						type="number"
						min="1"
						value={entry.servings ?? ''}
						onchange={(e) => changeServings(date, slot, index, e.currentTarget.value)}
						aria-label="Servings"
						class="w-11 rounded border border-line bg-surface px-1 py-0.5 text-center text-xs"
					/>
				{:else}
					<span class="font-mono text-[0.65rem] text-muted">×{entry.servings ?? '?'}</span>
				{/if}
				<button
					onclick={() => removeEntry(date, slot, index)}
					aria-label="Remove"
					class="leading-none text-muted hover:text-danger">×</button
				>
			</div>
		{/each}
		<button
			onclick={() => openPicker(date, slot)}
			class="w-full rounded-md border border-dashed border-line py-1 font-mono text-[0.7rem] text-muted hover:border-herb hover:text-herb"
			>+</button
		>
	</div>
{/snippet}

<header class="px-4 pt-6 pb-3">
	<div class="flex items-baseline justify-between">
		<h1 class="font-serif text-3xl text-ink">Plan</h1>
		<button
			onclick={makeShoppingList}
			class="font-mono text-xs tracking-wide text-herb uppercase hover:underline">Shopping list →</button
		>
	</div>
	<div class="mt-3 flex items-center justify-between">
		<button
			onclick={() => go(-1)}
			aria-label="Previous week"
			class="rounded-full border border-line px-3 py-1 text-ink hover:border-herb">←</button
		>
		<div class="text-center">
			<div class="font-mono text-sm text-ink">{week ? formatWeekRange(week) : ''}</div>
			<button onclick={goToday} class="font-mono text-[0.7rem] tracking-wide text-herb uppercase"
				>Today</button
			>
		</div>
		<button
			onclick={() => go(1)}
			aria-label="Next week"
			class="rounded-full border border-line px-3 py-1 text-ink hover:border-herb">→</button
		>
	</div>
</header>

{#if recipes.length === 0}
	<p class="px-4 py-10 text-center text-sm text-muted">
		Add some recipes first, then plan them across the week.
	</p>
{:else}
	<!-- Mobile: one day at a time -->
	<div class="px-4 md:hidden">
		<div class="mb-3 flex gap-1 overflow-x-auto">
			{#each dates as date, i (date)}
				<button
					onclick={() => (selectedDay = i)}
					class="shrink-0 rounded-full px-3 py-1 font-mono text-xs transition {selectedDay === i
						? 'bg-btn text-on-btn'
						: 'bg-chip text-chip-ink'}">{formatDayLabel(date)}</button
				>
			{/each}
		</div>
		<div class="space-y-3">
			{#each SLOTS as slot (slot.key)}
				<div class="rounded-xl border border-line bg-surface p-3">
					<h2 class="mb-2 font-mono text-xs tracking-widest text-muted uppercase">{slot.label}</h2>
					{@render slotContent(dates[selectedDay], slot.key, true)}
				</div>
			{/each}
		</div>
	</div>

	<!-- Desktop: full 7×4 grid -->
	<div
		class="hidden px-4 md:grid"
		style="grid-template-columns: 4.5rem repeat(7, minmax(0, 1fr)); gap: 1px;"
	>
		<div></div>
		{#each dates as date (date)}
			<div class="py-1 text-center font-mono text-[0.7rem] text-muted">{formatDayLabel(date)}</div>
		{/each}
		{#each SLOTS as slot (slot.key)}
			<div class="flex items-start py-2 font-mono text-[0.7rem] tracking-wide text-muted uppercase">
				{slot.label}
			</div>
			{#each dates as date (date)}
				<div class="min-h-16 rounded-md border border-line bg-surface p-1">
					{@render slotContent(date, slot.key, false)}
				</div>
			{/each}
		{/each}
	</div>
{/if}

<svelte:window onkeydown={(e) => picker && e.key === 'Escape' && (picker = null)} />

{#if picker}
	<div class="fixed inset-0 z-30 flex items-end justify-center p-4 sm:items-center">
		<button
			class="absolute inset-0 bg-black/40"
			aria-label="Close recipe picker"
			onclick={() => (picker = null)}
		></button>
		<div class="relative max-h-[70vh] w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-xl">
			<div class="flex items-center gap-2 border-b border-line p-3">
				<input
					bind:value={pickerQuery}
					placeholder="Pick a recipe…"
					aria-label="Search recipes"
					class="flex-1 rounded-full border border-line bg-bg px-4 py-2 text-sm outline-none focus:border-herb"
				/>
				<button
					onclick={() => (picker = null)}
					aria-label="Close"
					class="px-2 text-xl leading-none text-muted hover:text-ink">×</button
				>
			</div>
			<ul class="max-h-[52vh] overflow-y-auto p-2">
				{#each pickerResults as r (r.url)}
					<li>
						<button
							onclick={() => pick(r)}
							class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-chip"
						>
							<span class="font-serif text-ink">{r.title || 'Untitled'}</span>
							{#if r.servings}<span class="font-mono text-xs text-muted">{r.servings} servings</span>{/if}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	</div>
{/if}
