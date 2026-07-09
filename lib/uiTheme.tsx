'use client';

import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';

export type UITheme = 'hodkonem' | 'chesscom';

interface UIThemeContextType {
  uiTheme: UITheme;
  setUITheme: (theme: UITheme) => void;
}

const UIThemeContext = createContext<UIThemeContextType>({
  uiTheme: 'hodkonem',
  setUITheme: () => {},
});

const STORAGE_KEY = 'hodkonem-ui-theme';

export function UIThemeProvider({ children }: { children: ReactNode }) {
  const [uiTheme, setUIThemeState] = useState<UITheme>('hodkonem');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as UITheme;
    if (saved === 'chesscom') setUIThemeState('chesscom');
  }, []);

  const setUITheme = (theme: UITheme) => {
    setUIThemeState(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  };

  return (
    <UIThemeContext.Provider value={{ uiTheme, setUITheme }}>
      {children}
    </UIThemeContext.Provider>
  );
}

export function useUITheme() {
  return useContext(UIThemeContext);
}
