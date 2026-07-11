import { get, set } from 'idb-keyval';

// Photos live in their own IndexedDB store (idb-keyval's default db), content-
// addressed by SHA-256 so identical images are stored once. Never placed inside
// Automerge docs — the doc only holds the hash.

const urlCache = new Map<string, string>();

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', buffer);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Downscale a picked image to keep IndexedDB small; falls back to the original on any failure. */
export async function downscaleImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
		const w = Math.round(bitmap.width * scale);
		const h = Math.round(bitmap.height * scale);
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) return file;
		ctx.drawImage(bitmap, 0, 0, w, h);
		bitmap.close?.();
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
		);
		return blob ?? file;
	} catch {
		return file;
	}
}

/** Store a photo blob and return its content hash. */
export async function putPhoto(blob: Blob): Promise<string> {
	const hash = await sha256Hex(await blob.arrayBuffer());
	await set(`photo:${hash}`, blob);
	return hash;
}

/** Get a cached object URL for a stored photo, or null if it isn't present. */
export async function getPhotoObjectUrl(hash: string): Promise<string | null> {
	const cached = urlCache.get(hash);
	if (cached) return cached;
	const blob = await get<Blob>(`photo:${hash}`);
	if (!blob) return null;
	const url = URL.createObjectURL(blob);
	urlCache.set(hash, url);
	return url;
}
