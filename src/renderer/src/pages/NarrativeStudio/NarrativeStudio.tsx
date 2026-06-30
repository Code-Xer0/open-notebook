import React from 'react';
import { Navigate, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { FileAudio } from 'lucide-react';
import { VoiceLayerStudio } from './VoiceLayerStudio';

export default function NarrativeStudio() {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract current sub-path
  const currentTab = location.pathname.split('/')[2] || 'voice-layer';

  const tabs = [
    { id: 'voice-layer', label: 'Voice Layer', icon: <FileAudio size={18} /> },
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 className="title" style={{ marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-bright)' }}>Narrative Studio</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          Build Voice Capsules, cast manuscripts, render bounded reading jobs, and publish narration context into notebooks.
        </p>
      </header>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--panel-border)', paddingBottom: '1rem' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => navigate(`/studio/${tab.id}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: currentTab === tab.id ? 'var(--accent-primary)' : 'var(--panel-bg)',
              color: currentTab === tab.id ? 'var(--shell-bg)' : 'var(--text-muted)',
              border: `1px solid ${currentTab === tab.id ? 'transparent' : 'var(--panel-border)'}`,
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--panel-bg)', borderRadius: 'var(--radius-lg)', padding: '2rem', border: '1px solid var(--panel-border)', minHeight: '400px' }}>
        <Routes>
          <Route path="/" element={<Navigate to="/studio/voice-layer" replace />} />
          <Route path="/voice-layer" element={<VoiceLayerStudio />} />
          <Route path="*" element={<Navigate to="/studio/voice-layer" replace />} />
        </Routes>
      </div>
    </div>
  );
}
