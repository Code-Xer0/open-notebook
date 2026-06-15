import React from 'react'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import NarrativeStudio from './pages/NarrativeStudio/NarrativeStudio'
import { Dashboard } from './pages/Dashboard/Dashboard'
import { NotebookDetail } from './pages/Notebooks/NotebookDetail'
import { Chat } from './pages/Notebooks/Chat'
import { SourcesManager } from './pages/Sources'
import { NexusManager } from './pages/Nexus/NexusManager'
import { Settings } from './pages/Settings/Settings'
import { Topbar } from './components/Topbar'
import { Sidebar } from './components/Sidebar'

import { useStore } from './store/useStore'
import { startBackendMonitor, stopBackendMonitor } from './services/health'


export default function App() {
  const { settings } = useStore();

  React.useEffect(() => {
    startBackendMonitor();
    return () => stopBackendMonitor();
  }, []);
  const themeFamilyClass = settings.themeFamily ? `theme-${settings.themeFamily}` : 'theme-argos-cyan';
  const themeDensityClass = settings.themeDensity ? `density-${settings.themeDensity}` : 'density-comfortable';

  return (
    <Router>
      <div className={`theme-shell ${themeFamilyClass} ${themeDensityClass}`}>
        <div className="field" />
        <Topbar />
        
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar />
          
          <main style={{ flex: 1, overflowY: 'auto', padding: '24px', position: 'relative', zIndex: 2 }}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/notebook/:id" element={<NotebookDetail />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/sources" element={<SourcesManager />} />
              <Route path="/nexus" element={<NexusManager />} />
              <Route path="/studio/*" element={<NarrativeStudio />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  )
}
