import React, { useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Database, Upload, FileText, Map, Users, Network, Image as ImageIcon, Headphones } from 'lucide-react';
import { Select } from '../../components/Select';

export function NexusManager() {
  const [activeTab, setActiveTab] = useState<'chapters' | 'characters' | 'locations' | 'ontology' | 'images' | 'audiobook'>('chapters');
  const [narratorVoice, setNarratorVoice] = useState('default');

  const renderContent = () => {
    if (activeTab === 'audiobook') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Headphones /> Audiobook / Narrative Studio Prep</h3>
          <p style={{ color: 'var(--color-text-muted)', margin: 0 }}>Configure narration for the Nexus test corpus.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Narrator Voice Placeholder</h4>
              <Select
                ariaLabel="Narrator Voice"
                value={narratorVoice}
                onChange={setNarratorVoice}
                options={[
                  { value: 'default', label: 'Default Narrator (en-US-Standard-A)' },
                  { value: 'deep-male', label: 'Deep Male Voice (en-US-Journey-D)' },
                ]}
              />
            </div>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <h4 style={{ margin: '0 0 0.5rem 0' }}>Voice Map Placeholder</h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 0.5rem 0' }}>Map specific characters to distinct voices.</p>
              <Button style={{ fontSize: '0.875rem' }}>Edit Voice Map</Button>
            </div>
          </div>
          <div className="glass-card" style={{ padding: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0' }}>Chapter Reader Queue</h4>
            <ul style={{ paddingLeft: '1.5rem', margin: '0 0 1rem 0', color: 'var(--color-text-muted)' }}>
              <li>Chapter 1 - Pending</li>
              <li>Chapter 2 - Pending</li>
            </ul>
          </div>
          <Button style={{ alignSelf: 'flex-start', background: 'var(--cyan)', color: '#000' }}>Export Audio Job Proposal</Button>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1.5rem', color: 'var(--color-text-muted)' }}>
        <Upload size={48} style={{ opacity: 0.5 }} />
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ color: 'var(--color-text)', margin: '0 0 0.5rem 0' }}>Awaiting import</h3>
          <p style={{ margin: 0 }}>No Nexus data has been imported yet for this category.</p>
        </div>
        
        {activeTab === 'images' && (
          <div style={{ display: 'flex', gap: '0.75rem', flexDirection: 'column', alignItems: 'flex-start', background: 'var(--color-surface-hover)', padding: '1.25rem', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: '400px' }}>
             <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--color-text)' }}>
               <input type="checkbox" defaultChecked /> Run OCR (if configured)
             </label>
             <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--color-text)' }}>
               <input type="checkbox" defaultChecked /> Generate Index Preview
             </label>
             <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'var(--color-text)' }}>
               <input type="checkbox" defaultChecked /> Show Citations in Explorer
             </label>
          </div>
        )}

        <Button style={{ marginTop: '0.5rem' }}>Select Files to Import</Button>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 className="title" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database /> Nexus Corpus Test Mode
        </h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Import and manage testing profiles for the Nexus Corpus.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem', overflowX: 'auto' }}>
        <button onClick={() => setActiveTab('chapters')} style={getTabStyle(activeTab === 'chapters')}>
          <FileText size={18} /> Chapter Import
        </button>
        <button onClick={() => setActiveTab('characters')} style={getTabStyle(activeTab === 'characters')}>
          <Users size={18} /> Character Sheets
        </button>
        <button onClick={() => setActiveTab('locations')} style={getTabStyle(activeTab === 'locations')}>
          <Map size={18} /> Locations
        </button>
        <button onClick={() => setActiveTab('ontology')} style={getTabStyle(activeTab === 'ontology')}>
          <Network size={18} /> Ontology Packages
        </button>
        <button onClick={() => setActiveTab('images')} style={getTabStyle(activeTab === 'images')}>
          <ImageIcon size={18} /> Images
        </button>
        <button onClick={() => setActiveTab('audiobook')} style={getTabStyle(activeTab === 'audiobook')}>
          <Headphones size={18} /> Narrative Studio
        </button>
      </div>

      <Card>
        {renderContent()}
      </Card>
    </div>
  );
}

function getTabStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    border: isActive ? '1px solid var(--accent-faint)' : '1px solid transparent',
    background: isActive ? 'var(--accent-veil)' : 'transparent',
    color: isActive ? 'var(--accent-primary)' : 'var(--text-faint)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.85rem',
    fontWeight: 500,
    transition: 'var(--transition)'
  };
}
