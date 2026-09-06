// src/charts/useCssTransitionMount.ts
// Hook for Layer 2 Enter/Exit CSS animations using the Radix / tw-animate-css data-[state=open|closed] pattern.
// Zero JS animation overhead: browser C++ compositor handles fade & zoom keyframes, unmounting on animation end.

import { useEffect, useState } from 'react';

export function useCssTransitionMount(isOpen: boolean, exitDurationMs = 200) {
  const [mounted, setMounted] = useState(isOpen);
  const [state, setState] = useState<'open' | 'closed'>(isOpen ? 'open' : 'closed');

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const raf = requestAnimationFrame(() => {
        setState('open');
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setState('closed');
      const timer = setTimeout(() => {
        setMounted(false);
      }, exitDurationMs);
      return () => clearTimeout(timer);
    }
  }, [isOpen, exitDurationMs]);

  return { mounted, state };
}
