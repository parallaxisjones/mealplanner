// A collection's id is an Automerge document URL known only at runtime, so this
// route is never prerendered — the SPA fallback serves it, loaded client-side.
export const prerender = false;
