import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Book, Users, MapPin, Clock, Headphones, Mic, FileText, Plus, FileAudio } from 'lucide-react';
import { VoiceLayerStudio } from './VoiceLayerStudio';

export default function NarrativeStudio() {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract current sub-path
  const currentTab = location.pathname.split('/')[2] || 'stories';

  const tabs = [
    { id: 'stories', label: 'Stories', icon: <Book size={18} /> },
    { id: 'characters', label: 'Characters', icon: <Users size={18} /> },
    { id: 'locations', label: 'Locations', icon: <MapPin size={18} /> },
    { id: 'timelines', label: 'Timelines', icon: <Clock size={18} /> },
    { id: 'audiobooks', label: 'Audiobooks', icon: <Headphones size={18} /> },
    { id: 'voice-layer', label: 'Voice Layer', icon: <FileAudio size={18} /> },
    { id: 'voice-cast', label: 'Voice Cast', icon: <Mic size={18} /> },
    { id: 'lore-reports', label: 'Lore Reports', icon: <FileText size={18} /> }
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header>
        <h1 className="title" style={{ marginBottom: '0.5rem', fontFamily: 'var(--font-heading)', color: 'var(--accent-bright)' }}>Narrative Studio</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          Manage your interactive storytelling elements, voice cast, and lore integration.
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
          <Route path="/" element={<PlaceholderTab title="Stories" />} />
          <Route path="/stories" element={<PlaceholderTab title="Stories" />} />
          <Route path="/characters" element={<PlaceholderTab title="Characters" />} />
          <Route path="/locations" element={<PlaceholderTab title="Locations" />} />
          <Route path="/timelines" element={<PlaceholderTab title="Timelines" />} />
          <Route path="/audiobooks" element={<PlaceholderTab title="Audiobooks" />} />
          <Route path="/voice-layer" element={<VoiceLayerStudio />} />
          <Route path="/voice-cast" element={<VoiceCastTab />} />
          <Route path="/lore-reports" element={<PlaceholderTab title="Lore Reports" />} />
        </Routes>
      </div>
    </div>
  );
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
      <h2 style={{ color: 'var(--accent-bright)', marginBottom: '1rem' }}>{title} module is under construction</h2>
      <p>This section will be available in a future update.</p>
    </div>
  );
}

function VoiceCastTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--accent-bright)' }}>Character Voice Registry</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>No voice profiles have been loaded from the backend yet.</p>
        </div>
        <button disabled style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: 'var(--shell-bg)', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', cursor: 'not-allowed', opacity: 0.5 }}>
          <Plus size={18} /> Register Voice
        </button>
      </div>

      <div style={{ border: '1px dashed var(--panel-border)', borderRadius: 'var(--radius-md)', padding: '2rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        <Mic size={28} color="var(--accent-primary)" />
        <p style={{ margin: '1rem 0 0' }}>Voice registry is empty. Import narrative data or wire speaker profile APIs before editing voices.</p>
      </div>
    </div>
  );
}
