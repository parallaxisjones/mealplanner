import { initializeWasm } from '@automerge/automerge/slim';
import wasmUrl from '@automerge/automerge/automerge.wasm?url';

let ready: Promise<void> | undefined;

/**
 * Load and initialize the Automerge WASM module exactly once. Must be awaited
 * before any Automerge API is used (we import the `/slim` builds, which do not
 * self-initialize). Vite fingerprints and base-path-corrects `wasmUrl`, so this
 * also works under the GitHub Pages subpath.
 */
export function initAutomerge(): Promise<void> {
	return (ready ??= initializeWasm(wasmUrl).then(() => undefined));
}
