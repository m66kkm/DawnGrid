import { useCallback, useLayoutEffect, useRef } from 'react'

/**
 * Returns a callback whose identity never changes but which always invokes the
 * latest version of `fn`.
 *
 * Useful for handlers passed to memoized children: wrapping each one in
 * `useCallback` instead would mean enumerating its dependencies, and a handler
 * that closes over a dozen values is easy to get wrong — a missed dependency
 * yields a stale closure, and an over-broad one defeats the memo anyway.
 *
 * The ref is assigned in a layout effect so the identity is stable across the
 * render pass while still being current before any effect or event fires.
 */
export function useStableCallback<Args extends unknown[], Return>(
  fn: (...args: Args) => Return,
): (...args: Args) => Return {
  const ref = useRef(fn)

  useLayoutEffect(() => {
    ref.current = fn
  })

  return useCallback((...args: Args) => ref.current(...args), [])
}
