export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedThemeMode = 'light' | 'dark';

export interface ThemeCustomization {
  primary: string;
  secondary: string;
  tertiary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  warning: string;
  error: string;
  success: string;
}

export interface ThemeCustomizations {
  light?: Partial<ThemeCustomization>;
  dark?: Partial<ThemeCustomization>;
}

export const themeSwatchKeys: Array<keyof ThemeCustomization> = [
  'background',
  'surface',
  'text',
  'primary',
  'secondary',
  'accent',
  'warning',
  'error',
  'success'
];

export const codexLightTheme: ThemeCustomization = {
  primary: '#0f6f7a',
  secondary: '#4f7d67',
  tertiary: '#8da2ad',
  accent: '#bd5745',
  background: '#f7f9fc',
  surface: '#ffffff',
  text: '#25313d',
  warning: '#a66a00',
  error: '#c93755',
  success: '#128754'
};

export const codexDarkTheme: ThemeCustomization = {
  primary: '#6dc8d5',
  secondary: '#8cc7a4',
  tertiary: '#8b9bab',
  accent: '#ff9b7f',
  background: '#0f141a',
  surface: '#171f27',
  text: '#ecf3f6',
  warning: '#f2b84b',
  error: '#ff6b87',
  success: '#4fcf8f'
};

export const themePresets = [
  {
    id: 'codex-light',
    name: 'Codex Light',
    mode: 'light' as const,
    description: 'True white notebook shell with cool neutral depth and teal source accents.',
    colors: codexLightTheme
  },
  {
    id: 'codex-dark',
    name: 'Codex Dark',
    mode: 'dark' as const,
    description: 'Deep neutral workstation shell with high-contrast panels and preserved status colors.',
    colors: codexDarkTheme
  }
];

export function resolveThemeMode(mode: ThemeMode | undefined, prefersDark: boolean): ResolvedThemeMode {
  if (mode === 'light' || mode === 'dark') return mode;
  return prefersDark ? 'dark' : 'light';
}

export function getBaseTheme(mode: ResolvedThemeMode): ThemeCustomization {
  return mode === 'dark' ? codexDarkTheme : codexLightTheme;
}

export function mergeTheme(
  base: ThemeCustomization,
  overrides: Partial<ThemeCustomization> | undefined,
  enabled: boolean | undefined
): ThemeCustomization {
  return enabled ? { ...base, ...(overrides || {}) } : base;
}

export function getThemeOverrides(
  customizations: ThemeCustomizations | undefined,
  legacyCustomization: Partial<ThemeCustomization> | undefined,
  mode: ResolvedThemeMode
): Partial<ThemeCustomization> | undefined {
  const modeOverrides = customizations?.[mode];
  if (modeOverrides && Object.keys(modeOverrides).length > 0) return modeOverrides;
  return mode === 'light' ? legacyCustomization : undefined;
}
