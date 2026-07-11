<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import type { AutomergeUrl } from '@automerge/automerge-repo/slim';
	import { useDocument } from '$lib/data/useDocument.svelte';
	import { segmentStep } from '$lib/domain/timers';
	import { scaleFactor, formatQuantity } from '$lib/domain/scaler';
	import { keepAwake } from '$lib/keepAwake';
	import type { Ingredient, RecipeDoc } from '$lib/domain/types';

	const id = $derived(page.params.id ?? '');
	const recipe = useDocument<RecipeDoc>(() => id as AutomergeUrl);
	const backHref = $derived(`${base}/recipes/${encodeURIComponent(id)}`);

	const steps = $derived(recipe.doc?.steps ?? []);
	let stepIndex = $state(0);
	const segments = $derived(segmentStep(steps[stepIndex] ?? ''));

	function next() {
		if (stepIndex < steps.length - 1) stepIndex++;
	}
	function prev() {
		if (stepIndex > 0) stepIndex--;
	}

	// Servings scaling (display-only).
	let servings = $state<number | null>(null);
	$effect(() => {
		if (servings === null && recipe.doc) servings = recipe.doc.servings ?? 2;
	});
	const factor = $derived(scaleFactor(recipe.doc?.servings ?? null, servings));
	function displayIngredient(ing: Ingredient): string {
		if (recipe.doc?.servings && ing.quantity != null) {
			const qty = formatQuantity(ing.quantity * factor);
			return `${qty}${ing.unit ? ' ' + ing.unit : ''} ${ing.name}`.trim();
		}
		return ing.original || ing.name;
	}
	let showIngredients = $state(false);

	// Wake lock while cooking.
	$effect(() => keepAwake());

	// Timers.
	interface ActiveTimer {
		id: number;
		label: string;
		total: number;
		remaining: number;
		done: boolean;
	}
	let activeTimers = $state<ActiveTimer[]>([]);
	let nextId = 0;
	let interval: ReturnType<typeof setInterval> | undefined;

	function tick() {
		for (const t of activeTimers) {
			if (!t.done && t.remaining > 0) {
				t.remaining -= 1;
				if (t.remaining === 0) fireDone(t);
			}
		}
		if (!activeTimers.some((t) => !t.done && t.remaining > 0)) {
			clearInterval(interval);
			interval = undefined;
		}
	}
	function startTimer(label: string, seconds: number) {
		if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
			void Notification.requestPermission();
		}
		activeTimers.push({ id: nextId++, label, total: seconds, remaining: seconds, done: false });
		if (!interval) interval = setInterval(tick, 1000);
	}
	function fireDone(t: ActiveTimer) {
		t.done = true;
		navigator.vibrate?.([200, 100, 200]);
		if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
			try {
				new Notification('Timer done', { body: t.label });
			} catch {
				/* ignore */
			}
		}
	}
	function dismissTimer(id: number) {
		activeTimers = activeTimers.filter((t) => t.id !== id);
	}
	$effect(() => () => clearInterval(interval));

	function mmss(s: number): string {
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${String(sec).padStart(2, '0')}`;
	}
</script>

{#if recipe.ready && recipe.doc}
	<div class="fixed inset-0 z-50 flex flex-col bg-bg">
		<!-- Timer banners (in normal flow at the top so they never cover the header) -->
		{#if activeTimers.length}
			<div class="space-y-1 p-2">
				{#each activeTimers as t (t.id)}
					<div
						class="mx-auto flex max-w-md items-center justify-between rounded-lg border border-line px-3 py-2 shadow-sm {t.done
							? 'bg-herb text-on-btn'
							: 'bg-surface'}"
					>
						<span class="truncate text-sm">{t.done ? '⏰ ' : ''}{t.label}</span>
						<span class="ml-3 font-mono text-sm">{t.done ? 'Done' : mmss(t.remaining)}</span>
						<button
							onclick={() => dismissTimer(t.id)}
							aria-label="Dismiss timer"
							class="ml-2 px-1 leading-none opacity-70 hover:opacity-100">×</button
						>
					</div>
				{/each}
			</div>
		{/if}

		<!-- Header -->
		<header class="flex items-center justify-between px-4 pt-5 pb-2">
			<a href={backHref} aria-label="Close cook mode" class="text-2xl leading-none text-muted hover:text-ink"
				>×</a
			>
			<span class="font-mono text-xs tracking-widest text-muted uppercase"
				>Step {Math.min(stepIndex + 1, steps.length || 1)} of {steps.length}</span
			>
			<div class="flex items-center gap-2 font-mono text-xs text-muted">
				<button
					onclick={() => (servings = Math.max(1, (servings ?? 1) - 1))}
					aria-label="Fewer servings"
					class="rounded-full border border-line px-2 leading-none hover:border-herb">−</button
				>
				<span>{servings ?? '—'}</span>
				<button
					onclick={() => (servings = (servings ?? 0) + 1)}
					aria-label="More servings"
					class="rounded-full border border-line px-2 leading-none hover:border-herb">+</button
				>
			</div>
		</header>

		<!-- Step body: a full-area button advances; the text overlay lets taps fall
		     through to it (pointer-events-none), while timer chips stay clickable. -->
		<main class="relative flex flex-1 items-center justify-center px-6">
			<button type="button" aria-label="Next step" class="absolute inset-0" onclick={next}></button>
			{#if steps.length === 0}
				<p class="relative text-center text-muted">This recipe has no steps.</p>
			{:else}
				<p class="pointer-events-none relative max-w-xl text-2xl leading-relaxed text-ink">
					{#each segments as seg, i (i)}{#if seg.kind === 'timer'}<button
								type="button"
								onclick={() => startTimer(seg.text, seg.seconds)}
								class="pointer-events-auto mx-0.5 rounded-md bg-herb px-1.5 py-0.5 text-on-btn"
								>{seg.text} ⏱</button
							>{:else}{seg.text}{/if}{/each}
				</p>
			{/if}
		</main>

		<!-- Footer -->
		<footer class="flex items-center justify-between gap-3 px-4 pb-6">
			<button
				onclick={prev}
				disabled={stepIndex === 0}
				class="rounded-full border border-line px-5 py-2 text-sm text-ink disabled:opacity-40">Previous</button
			>
			<button
				onclick={() => (showIngredients = !showIngredients)}
				class="font-mono text-xs tracking-wide text-herb uppercase">Ingredients</button
			>
			<button
				onclick={next}
				disabled={stepIndex >= steps.length - 1}
				class="rounded-full bg-btn px-5 py-2 text-sm font-semibold text-on-btn disabled:opacity-40">Next</button
			>
		</footer>

		<!-- Ingredient sheet -->
		{#if showIngredients}
			<div class="absolute inset-0 z-20 flex flex-col justify-end">
				<button
					type="button"
					aria-label="Close ingredients"
					class="flex-1 bg-black/30"
					onclick={() => (showIngredients = false)}
				></button>
				<div class="max-h-[60%] overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-4">
					<div class="mb-2 flex items-center justify-between">
						<h2 class="font-mono text-xs tracking-widest text-muted uppercase">
							Ingredients · {servings ?? recipe.doc.servings ?? '—'} servings
						</h2>
						<button onclick={() => (showIngredients = false)} class="text-lg leading-none text-muted">×</button>
					</div>
					<ul class="space-y-1.5">
						{#each recipe.doc.ingredients as ing (ing.original + ing.name)}
							<li class="flex gap-2 text-ink">
								<span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-herb"></span>
								<span>{displayIngredient(ing)}</span>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		{/if}
	</div>
{:else if recipe.ready}
	<p class="py-16 text-center text-muted">Recipe not found.</p>
{:else}
	<p class="py-16 text-center text-muted">Loading…</p>
{/if}
