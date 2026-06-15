import React from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Book, Users, MapPin, Clock, Headphones, Mic, FileText, Plus, Edit3, Trash2 } from 'lucide-react';

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
  const voices = [
    {
      id: 'V-AURELIUS-01',
      name: 'Aurelius (Elder)',
      style: 'Gravelly, slow, authoritative',
      emotionModifiers: ['calm (+20%)', 'anger (-50%)', 'sorrow (+10%)'],
      speechPattern: 'Formal syntax, frequent pauses, minimal contractions',
      timelineProgression: 'Age 60-80 (Current Epoch)'
    },
    {
      id: 'V-LYRA-03',
      name: 'Lyra (Rebel)',
      style: 'Sharp, energetic, breathless',
      emotionModifiers: ['anxiety (+30%)', 'joy (+15%)', 'fear (-10%)'],
      speechPattern: 'Rapid delivery, informal slang, interrupts often',
      timelineProgression: 'Age 22-25 (Rebellion Arc)'
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--accent-bright)' }}>Character Voice Registry</h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Schema configuration for AI narrative voice synthesis</p>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--accent-primary)', color: 'var(--shell-bg)', border: 'none', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-md)', fontWeight: 'bold', cursor: 'pointer' }}>
          <Plus size={18} /> Register Voice
        </button>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {voices.map(voice => (
          <div key={voice.id} style={{ 
            border: '1px solid var(--panel-border)', 
            borderRadius: 'var(--radius-md)', 
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--panel-border)', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-bright)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mic size={20} color="var(--accent-primary)" /> {voice.name}
                </h3>
                <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--text-muted)', background: 'var(--panel-bg)', padding: '0.2rem 0.5rem', borderRadius: '4px', marginTop: '0.5rem', display: 'inline-block', border: '1px solid var(--panel-border)' }}>
                  {voice.id}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={{ background: 'transparent', border: '1px solid var(--panel-border)', color: 'var(--text-muted)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.color = 'var(--accent-bright)'} onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                  <Edit3 size={16} />
                </button>
                <button style={{ background: 'transparent', border: '1px solid var(--panel-border)', color: '#ef4444', padding: '0.5rem', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.2s' }} onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <RegistryField label="Style Profile" value={voice.style} />
              <RegistryField label="Speech Pattern" value={voice.speechPattern} />
              <RegistryField label="Timeline Progression" value={voice.timelineProgression} />
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>Emotion Modifiers</span>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {voice.emotionModifiers.map((mod, i) => (
                    <span key={i} style={{ background: 'var(--accent-veil)', color: 'var(--accent-primary)', fontSize: '0.8rem', padding: '0.2rem 0.6rem', borderRadius: '999px', border: '1px solid var(--accent-faint)' }}>
                      {mod}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegistryField({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <span style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>{label}</span>
      <p style={{ color: '#e5e7eb', fontSize: '0.95rem', margin: 0, lineHeight: 1.4 }}>{value}</p>
    </div>
  );
}
