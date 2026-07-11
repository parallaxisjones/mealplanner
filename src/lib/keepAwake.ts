/**
 * Hold a screen wake lock while cooking. Browsers auto-release the lock when the
 * tab is hidden, so we re-acquire on visibilitychange. Returns a cleanup that
 * releases the lock and removes the listener. No-op where unsupported.
 */
export function keepAwake(): () => void {
	let sentinel: WakeLockSentinel | null = null;
	let disposed = false;

	const request = async () => {
		try {
			if (!disposed && 'wakeLock' in navigator) {
				sentinel = await navigator.wakeLock.request('screen');
			}
		} catch {
			/* denied or not allowed while backgrounded — fine */
		}
	};

	const onVisibility = () => {
		if (document.visibilityState === 'visible') void request();
	};

	void request();
	document.addEventListener('visibilitychange', onVisibility);

	return () => {
		disposed = true;
		document.removeEventListener('visibilitychange', onVisibility);
		void sentinel?.release().catch(() => {});
		sentinel = null;
	};
}
