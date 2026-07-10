// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// Vite `?url` import of the Automerge WASM binary resolves to a fingerprinted, base-path-aware URL string.
declare module '*.wasm?url' {
	const url: string;
	export default url;
}

export {};
