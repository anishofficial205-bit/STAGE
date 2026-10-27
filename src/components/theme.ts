import { create } from 'zustand';

export type Theme = 'light' | 'dark';
const KEY = 'stage-builder:theme';

function initialTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* private mode: fall back to the system setting */
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
}

/** Light or dark look for the whole app; remembered between visits (index.html applies it before the first paint). */
export const useTheme = create<ThemeState>((set, get) => {
  const theme = initialTheme();
  apply(theme);
  return {
    theme,
    toggle: () => {
      const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* private mode: just don't remember */
      }
      apply(next);
      set({ theme: next });
    },
  };
});
