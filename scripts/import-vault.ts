// Walk an Obsidian vault, parse every recipe note, and write a recipes-only
// .mealplan zip the app can import. Run: pnpm import:vault [vaultPath] [--out file]
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { homedir } from 'node:os';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { analyzeMarkdownRecipe } from '../src/lib/domain/markdownRecipe';
import { parsedToRecipeDoc, buildRecipeManifest } from '../src/lib/domain/vaultImport';

function expandHome(p: string): string {
	return p.startsWith('~') ? homedir() + p.slice(1) : p;
}

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const name of readdirSync(dir)) {
		if (name.startsWith('.')) continue; // skip .git, .obsidian, etc.
		const p = join(dir, name);
		if (statSync(p).isDirectory()) out.push(...walk(p));
		else if (name.toLowerCase().endsWith('.md')) out.push(p);
	}
	return out;
}

function main(): void {
	const args = process.argv.slice(2);
	const outIdx = args.indexOf('--out');
	const out = outIdx >= 0 ? args[outIdx + 1] : 'vault-recipes.mealplan';
	const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
	const vault = resolve(expandHome(positional[0] ?? join(homedir(), 'Documents', 'notes')));

	const files = walk(vault);
	const recipes = [];
	const nearMisses: string[] = [];
	let skipped = 0;

	for (const f of files) {
		const res = analyzeMarkdownRecipe(readFileSync(f, 'utf8'));
		if (res.ok) {
			recipes.push(parsedToRecipeDoc(res.recipe));
		} else {
			skipped++;
			// Only surface skips that looked like a recipe (had a title + some ingredients).
			if (res.hadTitle && res.ingredientCount >= 1) nearMisses.push(`  ✗ ${basename(f)} — ${res.reason}`);
		}
	}

	recipes.sort((a, b) => a.title.localeCompare(b.title));
	const manifest = buildRecipeManifest(recipes);
	const zip = zipSync({ 'meal-plan.json': strToU8(JSON.stringify(manifest)) });
	writeFileSync(out, zip);

	// Self-check: the file we just wrote must round-trip.
	const back = JSON.parse(strFromU8(unzipSync(readFileSync(out))['meal-plan.json']));
	if (back.format !== 1 || back.recipes.length !== recipes.length) {
		console.error('✗ self-check failed: written file did not round-trip');
		process.exit(1);
	}

	console.log(`✓ parsed ${recipes.length} · skipped ${skipped} (of ${files.length} .md files)`);
	if (nearMisses.length) {
		console.log(`\nNear-misses worth a look (had a title + ingredients):`);
		for (const line of nearMisses) console.log(line);
	}
	console.log(`\n→ wrote ${resolve(out)}`);
}

main();
