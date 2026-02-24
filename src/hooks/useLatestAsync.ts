import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Runs an async action so that only the latest invocation's result is applied.
 *
 * - If a new call arrives while the previous one is in flight, the previous
 *   result is silently discarded (no stale state updates).
 * - Automatically cancels the outstanding call on unmount.
 * - Manages `loading` state internally.
 *
 * @returns `{ run, loading }` — call `run(fn)` with an async producer;
 *          it resolves with the result or `undefined` if superseded.
 */
export function useLatestAsync<T>() {
    const [loading, setLoading] = useState(false);
    const controllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => { controllerRef.current?.abort(); }, []);

    const run = useCallback(async (fn: () => Promise<T>): Promise<T | undefined> => {
        controllerRef.current?.abort();
        const controller = new AbortController();
        controllerRef.current = controller;

        setLoading(true);
        try {
            const result = await fn();
            if (controller.signal.aborted) return undefined;
            return result;
        } catch (error) {
            if (controller.signal.aborted) return undefined;
            throw error;
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, []);

    return { run, loading };
}
