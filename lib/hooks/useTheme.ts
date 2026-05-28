'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'bevo-theme';

export function useTheme() {
  const [isDark, setIsDarkState] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark') setIsDarkState(true);
  }, []);

  const setIsDark = (value: boolean) => {
    setIsDarkState(value);
    localStorage.setItem(STORAGE_KEY, value ? 'dark' : 'light');
  };

  const toggle = () => setIsDark(!isDark);

  return { isDark, toggle };
}
