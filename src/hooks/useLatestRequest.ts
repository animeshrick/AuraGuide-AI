import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * Keeps only the newest request alive. `start()` cancels the previous request
 * and returns a fresh AbortController; `isLatest()` tells a finishing request
 * whether it may still update the screen. Everything is cancelled on unmount.
 */
export function useLatestRequest() {
  const current = useRef<AbortController | null>(null);

  useEffect(() => () => current.current?.abort(), []);

  const start = useCallback((): AbortController => {
    current.current?.abort();
    const controller = new AbortController();
    current.current = controller;
    return controller;
  }, []);

  const isLatest = useCallback(
    (controller: AbortController): boolean => current.current === controller,
    []
  );

  const cancel = useCallback(() => current.current?.abort(), []);

  return useMemo(() => ({ start, isLatest, cancel }), [start, isLatest, cancel]);
}

/** True for the error a fetch throws when its request is cancelled. */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}
