<script lang="ts">
	let { steps = $bindable([]) }: { steps: string[] } = $props();

	function setStep(i: number, value: string) {
		const next = [...steps];
		next[i] = value;
		steps = next;
	}

	function addStep() {
		steps = [...steps, ''];
	}

	function removeStep(i: number) {
		steps = steps.filter((_, j) => j !== i);
	}
</script>

<div class="space-y-2">
	{#each steps as step, i (i)}
		<div class="flex items-start gap-2">
			<span class="mt-2.5 w-6 shrink-0 text-right font-mono text-sm text-muted">{i + 1}.</span>
			<textarea
				value={step}
				oninput={(e) => setStep(i, e.currentTarget.value)}
				rows="2"
				placeholder="Describe this step…"
				class="flex-1 resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed outline-none focus:border-herb"
			></textarea>
			<button
				type="button"
				onclick={() => removeStep(i)}
				aria-label="Remove step"
				class="mt-2 px-1 text-lg leading-none text-muted hover:text-danger">×</button
			>
		</div>
	{/each}
	<button
		type="button"
		onclick={addStep}
		class="ml-8 font-mono text-xs tracking-wide text-herb hover:underline">+ add step</button
	>
</div>
