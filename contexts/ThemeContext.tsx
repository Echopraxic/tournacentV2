import { createContext, useContext, useState } from 'react';
import { tokens, ColorMode, ThemeColors } from '@/constants/tokens';

interface ThemeContextValue {
  theme: ThemeColors;
  mode: ColorMode;
  setMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: tokens.colors.light,
  mode: 'light',
  setMode: () => {},
});

export function ThemeProvider({ children, defaultMode = 'light' }: {
  children: React.ReactNode;
  defaultMode?: ColorMode;
}) {
  const [mode, setMode] = useState<ColorMode>(defaultMode);
  return (
    <ThemeContext.Provider value={{ theme: tokens.colors[mode], mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
