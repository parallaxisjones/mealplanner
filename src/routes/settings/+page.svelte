<script lang="ts">
	import { exportWorkspace, importWorkspace, importRecipesOnly } from '$lib/data/backup';

	let busy = $state(false);
	let message = $state('');
	let storage = $state('');

	$effect(() => {
		if (navigator.storage?.estimate) {
			void navigator.storage.estimate().then((est) => {
				if (est.usage != null) storage = `${(est.usage / 1024 / 1024).toFixed(1)} MB used in this browser`;
			});
		}
	});

	async function doExport() {
		busy = true;
		message = '';
		try {
			const blob = await exportWorkspace();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `mealplan-backup-${new Date().toISOString().slice(0, 10)}.mealplan`;
			a.click();
			URL.revokeObjectURL(url);
			message = 'Backup downloaded.';
		} catch (e) {
			message = `Export failed: ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			busy = false;
		}
	}

	async function onImportFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (!confirm('Importing replaces all current data in this browser. Continue?')) return;
		busy = true;
		message = '';
		try {
			const data = new Uint8Array(await file.arrayBuffer());
			const s = await importWorkspace(data);
			message = `Imported ${s.recipes} recipes, ${s.collections} collections, ${s.plans} weeks. Reloading…`;
			setTimeout(() => location.reload(), 900);
		} catch (e) {
			message = `Import failed: ${e instanceof Error ? e.message : String(e)}`;
			busy = false;
		}
	}

	async function onAddRecipesFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		busy = true;
		message = '';
		try {
			const data = new Uint8Array(await file.arrayBuffer());
			const s = await importRecipesOnly(data);
			message = `Added ${s.recipes} recipes. Reloading…`;
			setTimeout(() => location.reload(), 900);
		} catch (e) {
			message = `Add failed: ${e instanceof Error ? e.message : String(e)}`;
			busy = false;
		}
	}
</script>

<header class="px-4 pt-6 pb-3">
	<h1 class="font-serif text-3xl text-ink">Settings</h1>
</header>

<div class="space-y-8 px-4">
	<section>
		<h2 class="mb-2 border-b border-line pb-1 font-mono text-xs tracking-widest text-muted uppercase">
			Backup
		</h2>
		<p class="mb-3 text-sm text-muted">
			Your recipes live only in this browser. Export a backup file to keep it safe or to move
			everything to another device or browser.
		</p>
		<div class="flex flex-wrap items-center gap-3">
			<button
				onclick={doExport}
				disabled={busy}
				class="rounded-full bg-btn px-5 py-2 text-sm font-semibold text-on-btn disabled:opacity-50"
				>Export backup</button
			>
			<label
				class="cursor-pointer rounded-full border border-line px-5 py-2 text-sm text-ink transition hover:border-herb"
			>
				Import backup
				<input
					type="file"
					accept=".mealplan,.zip,application/zip"
					class="hidden"
					onchange={onImportFile}
				/>
			</label>
			<label
				class="cursor-pointer rounded-full border border-line px-5 py-2 text-sm text-ink transition hover:border-herb"
			>
				Add recipes from a file
				<input
					type="file"
					accept=".mealplan,.zip,application/zip"
					class="hidden"
					data-testid="add-recipes-input"
					onchange={onAddRecipesFile}
				/>
			</label>
		</div>
		{#if message}
			<p class="mt-3 text-sm text-herb">{message}</p>
		{/if}
	</section>

	<section>
		<h2 class="mb-2 border-b border-line pb-1 font-mono text-xs tracking-widest text-muted uppercase">
			Storage
		</h2>
		<p class="text-sm text-muted">{storage || 'Stored locally in your browser (IndexedDB).'}</p>
	</section>

	<section>
		<h2 class="mb-2 border-b border-line pb-1 font-mono text-xs tracking-widest text-muted uppercase">
			Nutrition
		</h2>
		<p class="text-sm text-muted">
			Macro estimates use Open Food Facts (free, no setup) and are approximate — override any
			ingredient from its recipe. USDA FoodData Central can be enabled for more coverage by setting a
			<code class="font-mono text-xs">USDA_API_KEY</code> secret on the Worker.
		</p>
	</section>

	<section>
		<h2 class="mb-2 border-b border-line pb-1 font-mono text-xs tracking-widest text-muted uppercase">
			About
		</h2>
		<p class="text-sm text-muted">
			Meal Planner · local-first and offline-capable. Your recipes live in this browser; a small
			Cloudflare Worker powers link import and nutrition lookups.
		</p>
	</section>
</div>
