// Local-first PWA: everything runs in the browser. IndexedDB and the Automerge
// WASM module have no server-side equivalent, so we disable SSR and prerender a
// static app shell (SPA) that boots on the client.
export const ssr = false;
export const csr = true;
export const prerender = true;
