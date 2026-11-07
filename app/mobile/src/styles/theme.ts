import { createContext, createElement, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import * as SecureStore from 'expo-secure-store';

export type ThemeMode = 'light' | 'dark';
export type ThemeColors = typeof lightColors;

const lightColors = {
  ink: '#18352b',
  muted: '#70877a',
  green: '#3f7a4b',
  deepGreen: '#1f5b3a',
  leaf: '#83b96f',
  mint: '#e5f3df',
  water: '#dceff0',
  white: '#ffffff',
  surface: '#ffffff',
  surfaceMuted: '#e8f1e5',
  surfaceRaised: '#ffffff',
  background: '#f5f8f1',
  border: '#c4d8c0',
  warning: '#b87925',
  danger: '#a95656',
  dangerBackground: '#fff1ed',
};

const darkColors: ThemeColors = {
  ink: '#e8f1e9',
  muted: '#aab9ad',
  green: '#83c48b',
  deepGreen: '#b7e0b7',
  leaf: '#83b96f',
  mint: '#263d2d',
  water: '#234047',
  white: '#1b2b21',
  surface: '#1b2b21',
  surfaceMuted: '#263d2d',
  surfaceRaised: '#2d4835',
  background: '#0b120e',
  border: '#4a6651',
  warning: '#e5b35e',
  danger: '#e58d80',
  dangerBackground: '#452725',
};

export const colors = {
  ink: '#18352b',
  muted: '#70877a',
  green: '#3f7a4b',
  deepGreen: '#1f5b3a',
  leaf: '#83b96f',
  mint: '#e5f3df',
  water: '#dceff0',
  white: '#ffffff',
  surface: '#ffffff',
  surfaceMuted: '#e8f1e5',
  surfaceRaised: '#ffffff',
  background: '#f5f8f1',
  border: '#c4d8c0',
  warning: '#b87925',
  danger: '#a95656',
  dangerBackground: '#fff1ed',
};

const ThemeContext = createContext<{
  mode: ThemeMode;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}>({ mode: 'light', colors: lightColors, setMode: () => undefined });

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  useEffect(() => {
    void SecureStore.getItemAsync('horta-theme').then((stored) => {
      if (stored === 'dark' || stored === 'light') setModeState(stored);
    });
  }, []);
  function setMode(nextMode: ThemeMode) {
    setModeState(nextMode);
    void SecureStore.setItemAsync('horta-theme', nextMode);
  }
  const value = useMemo(() => ({
    mode,
    colors: mode === 'dark' ? darkColors : lightColors,
    setMode,
  }), [mode]);
  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme() {
  return useContext(ThemeContext);
}

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};