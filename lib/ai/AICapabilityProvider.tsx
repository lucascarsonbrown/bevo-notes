'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { detectCapability, explainCapability, type Capability } from './capability';
import {
  prewarm,
  whenIdle,
  preloadEnabled,
  setPreloadEnabled,
  type PreloadState,
} from './prewarm';

/**
 * Detects once per page load and shares the result.
 *
 * Detection is cheap and never downloads weights, but it is async, so consumers
 * get `null` until it resolves. Treat `null` as "still checking" — not as
 * readonly — so generation controls don't flicker.
 *
 * Once detection lands on a capable device, the model is warmed in the
 * background (see `prewarm.ts`) so the first generation doesn't open with a
 * ~880 MB download.
 */

interface AICapabilityValue {
  capability: Capability | null;
  /** True once detection has finished. */
  ready: boolean;
  /** Convenience: detection finished and this device cannot generate. */
  isReadOnly: boolean;
  explanation: string;
  /** Background model warm-up. */
  preload: PreloadState;
  /** Start the warm-up now, bypassing the bandwidth guards. */
  startPreload: () => void;
  /** Turn automatic warm-up on or off for this browser. */
  setAutoPreload: (enabled: boolean) => void;
  autoPreload: boolean;
}

const IDLE_PRELOAD: PreloadState = {
  status: 'idle',
  progress: 0,
  text: '',
  cached: false,
};

const AICapabilityContext = createContext<AICapabilityValue>({
  capability: null,
  ready: false,
  isReadOnly: false,
  explanation: '',
  preload: IDLE_PRELOAD,
  startPreload: () => {},
  setAutoPreload: () => {},
  autoPreload: true,
});

/**
 * Only warm on signed-in surfaces. A visitor who bounces off the landing page
 * should not have paid for a gigabyte of weights on the way out.
 */
const PREWARM_ROUTES = ['/dashboard', '/courses', '/notes', '/settings'];

/** Minimal store around the localStorage preference, for useSyncExternalStore. */
const preferenceListeners = new Set<() => void>();

function subscribeToPreference(listener: () => void): () => void {
  preferenceListeners.add(listener);
  return () => preferenceListeners.delete(listener);
}

function emitPreferenceChange(): void {
  preferenceListeners.forEach((l) => l());
}

function shouldPrewarmRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return PREWARM_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AICapabilityProvider({ children }: { children: ReactNode }) {
  const [capability, setCapability] = useState<Capability | null>(null);
  const [ready, setReady] = useState(false);
  const [preload, setPreload] = useState<PreloadState>(IDLE_PRELOAD);
  const pathname = usePathname();
  const started = useRef(false);

  // Read through to localStorage rather than mirroring it into state: the
  // server has no localStorage, so a plain initial value would hydrate wrong.
  const autoPreload = useSyncExternalStore(
    subscribeToPreference,
    preloadEnabled,
    () => true
  );

  useEffect(() => {
    let cancelled = false;
    detectCapability()
      .then((result) => {
        if (cancelled) return;
        setCapability(result);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setCapability({
          mode: 'readonly',
          reason: 'detection-failed',
          model: null,
          embeddingModel: null,
          availableMB: null,
        });
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Warm the model once, on the first app route this session.
  //
  // Deliberately not cancelled on cleanup: this effect re-runs on every
  // navigation, so cancelling the pending idle callback would let a quick
  // route change kill the warm-up that the `started` guard then refuses to
  // reschedule. `prewarm` is idempotent, so letting it fire is the safe side.
  useEffect(() => {
    if (!ready || !capability || capability.mode === 'readonly') return;
    if (started.current) return;
    if (!shouldPrewarmRoute(pathname)) return;

    started.current = true;
    whenIdle(() => {
      void prewarm(capability, setPreload);
    });
  }, [ready, capability, pathname]);

  const startPreload = useCallback(() => {
    if (!capability || capability.mode === 'readonly') return;
    started.current = true;
    void prewarm(capability, setPreload, { force: true });
  }, [capability]);

  const setAutoPreload = useCallback((enabled: boolean) => {
    setPreloadEnabled(enabled);
    emitPreferenceChange();
  }, []);

  return (
    <AICapabilityContext.Provider
      value={{
        capability,
        ready,
        isReadOnly: ready && capability?.mode === 'readonly',
        explanation: capability ? explainCapability(capability) : '',
        preload,
        startPreload,
        setAutoPreload,
        autoPreload,
      }}
    >
      {children}
    </AICapabilityContext.Provider>
  );
}

export function useAICapability(): AICapabilityValue {
  return useContext(AICapabilityContext);
}
