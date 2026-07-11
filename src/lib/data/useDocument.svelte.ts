import type {
	AutomergeUrl,
	DocHandle,
	DocHandleChangePayload
} from '@automerge/automerge-repo/slim';
import { getRepo } from './repo';

export interface ReactiveDoc<T> {
	/** The current document snapshot; `undefined` until loaded. */
	readonly doc: T | undefined;
	/** True once the document has loaded and is safe to read/change. */
	readonly ready: boolean;
	/** Mutate the document; changes persist and re-render via the change event. */
	change(fn: (doc: T) => void): void;
}

/**
 * Bridge an Automerge document to Svelte 5 runes. Pass the URL as a getter so
 * the subscription follows a changing route param. Components use this instead
 * of touching the Repo/DocHandle directly, which keeps Automerge out of the UI
 * and preserves the future "plug in a sync adapter" upgrade.
 */
export function useDocument<T>(url: () => AutomergeUrl | undefined): ReactiveDoc<T> {
	let doc = $state<T | undefined>(undefined);
	let ready = $state(false);
	let handle: DocHandle<T> | undefined;

	$effect(() => {
		const u = url();
		doc = undefined;
		ready = false;
		handle = undefined;
		if (!u) return;

		let disposed = false;
		const onChange = (payload: DocHandleChangePayload<T>) => {
			doc = payload.doc;
		};

		void (async () => {
			try {
				const repo = await getRepo();
				const h = await repo.find<T>(u);
				if (disposed) return;
				handle = h;
				doc = h.doc();
				ready = true;
				h.on('change', onChange);
			} catch {
				// Unknown/deleted document — surface as "loaded but empty".
				if (!disposed) {
					doc = undefined;
					ready = true;
				}
			}
		})();

		return () => {
			disposed = true;
			handle?.off('change', onChange);
		};
	});

	return {
		get doc() {
			return doc;
		},
		get ready() {
			return ready;
		},
		change(fn: (doc: T) => void) {
			handle?.change(fn);
		}
	};
}
