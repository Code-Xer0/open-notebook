import React from 'react'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import NarrativeStudio from './pages/NarrativeStudio/NarrativeStudio'
import { Dashboard } from './pages/Dashboard/Dashboard'
import { NotebookList } from './pages/Notebooks/NotebookList'
import { NotebookDetail } from './pages/Notebooks/NotebookDetail'
import { Chat } from './pages/Notebooks/Chat'
import { SourcesManager } from './pages/Sources'
import { NexusManager } from './pages/Nexus/NexusManager'
import PodcastStudio from './pages/Podcasts/PodcastStudio'
import { Settings } from './pages/Settings/Settings'
import { Topbar } from './components/Topbar'
import { Sidebar } from './components/Sidebar'

import { useStore } from './store/useStore'
import { startBackendMonitor, stopBackendMonitor } from './services/health'
import { startSidecarMonitor, stopSidecarMonitor } from './services/sidecars'
import { getBaseTheme, getThemeOverrides, mergeTheme, resolveThemeMode } from './theme'


export default function App() {
  const { settings } = useStore();
  const [prefersDark, setPrefersDark] = React.useState(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
  ));

  React.useEffect(() => {
    startBackendMonitor();
    startSidecarMonitor();
    return () => {
      stopBackendMonitor();
      stopSidecarMonitor();
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    setPrefersDark(query.matches);
    if (query.addEventListener) {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);

  const themeFamilyClass = settings.themeFamily ? `theme-${settings.themeFamily}` : 'theme-notebook';
  const themeDensityClass = settings.themeDensity ? `density-${settings.themeDensity}` : 'density-comfortable';
  const motionScale = settings.motionPreset === 'calm' ? 0.45 : settings.motionPreset === 'lively' ? 1.25 : 0.9;
  const resolvedThemeMode = resolveThemeMode(settings.themeMode || 'system', prefersDark);
  const baseTheme = getBaseTheme(resolvedThemeMode);
  const activeTheme = mergeTheme(
    baseTheme,
    getThemeOverrides(settings.themeCustomizations, settings.themeCustomization, resolvedThemeMode),
    Boolean(settings.customThemeEnabled)
  );

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = resolvedThemeMode;
    document.documentElement.style.colorScheme = resolvedThemeMode;
  }, [resolvedThemeMode]);

  const themeVars = {
    '--color-primary': activeTheme.primary,
    '--color-secondary': activeTheme.secondary,
    '--color-tertiary': activeTheme.tertiary,
    '--color-accent': activeTheme.accent,
    '--color-bg': activeTheme.background,
    '--color-surface': activeTheme.surface,
    '--color-text': activeTheme.text,
    '--color-warning': activeTheme.warning,
    '--color-error': activeTheme.error,
    '--color-success': activeTheme.success,
    '--motion': motionScale
  } as React.CSSProperties;

  return (
    <Router>
      <div className={`theme-shell ${themeFamilyClass} ${themeDensityClass}`} data-theme={resolvedThemeMode} style={themeVars}>
        <div className="field" />
        <Topbar />
        
        <div className="app-body">
          <Sidebar />
          
          <main className="app-main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/notebooks" element={<NotebookList />} />
              <Route path="/notebook/:id" element={<NotebookDetail />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/chat/:id" element={<Chat />} />
              <Route path="/sources" element={<SourcesManager />} />
              <Route path="/nexus" element={<NexusManager />} />
              <Route path="/podcasts" element={<PodcastStudio />} />
              <Route path="/studio/*" element={<NarrativeStudio />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  )
}
