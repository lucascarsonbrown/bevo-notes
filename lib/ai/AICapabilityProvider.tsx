'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { detectCapability, explainCapability, type Capability } from './capability';

/**
 * Detects once per page load and shares the result.
 *
 * Detection is cheap and never downloads weights, but it is async, so consumers
 * get `null` until it resolves. Treat `null` as "still checking" — not as
 * readonly — so generation controls don't flicker.
 */

interface AICapabilityValue {
  capability: Capability | null;
  /** True once detection has finished. */
  ready: boolean;
  /** Convenience: detection finished and this device cannot generate. */
  isReadOnly: boolean;
  explanation: string;
}

const AICapabilityContext = createContext<AICapabilityValue>({
  capability: null,
  ready: false,
  isReadOnly: false,
  explanation: '',
});

export function AICapabilityProvider({ children }: { children: ReactNode }) {
  const [capability, setCapability] = useState<Capability | null>(null);
  const [ready, setReady] = useState(false);

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

  return (
    <AICapabilityContext.Provider
      value={{
        capability,
        ready,
        isReadOnly: ready && capability?.mode === 'readonly',
        explanation: capability ? explainCapability(capability) : '',
      }}
    >
      {children}
    </AICapabilityContext.Provider>
  );
}

export function useAICapability(): AICapabilityValue {
  return useContext(AICapabilityContext);
}
