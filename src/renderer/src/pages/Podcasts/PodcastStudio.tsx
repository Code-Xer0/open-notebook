import React, { useState, useEffect } from 'react';
import { Mic, LayoutTemplate, RefreshCcw, Loader2, PlayCircle, Trash2, Plus } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { api } from '../../services/api';

export default function PodcastStudio() {
  const [activeTab, setActiveTab] = useState<'episodes' | 'templates'>('episodes');

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <header>
          <h1 className="title" style={{ marginBottom: '0.5rem' }}>Podcast Studio</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem' }}>
            Generate and manage NotebookLM-style audio overviews from local notebook context.
          </p>
        </header>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setActiveTab('episodes')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: activeTab === 'episodes' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeTab === 'episodes' ? 'var(--shell-bg)' : 'var(--color-text-muted)',
              border: `1px solid ${activeTab === 'episodes' ? 'transparent' : 'var(--color-border)'}`,
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'var(--transition)'
            }}
          >
            <Mic size={18} /> Episodes
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: activeTab === 'templates' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeTab === 'templates' ? 'var(--shell-bg)' : 'var(--color-text-muted)',
              border: `1px solid ${activeTab === 'templates' ? 'transparent' : 'var(--color-border)'}`,
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'var(--transition)'
            }}
          >
            <LayoutTemplate size={18} /> Templates
          </button>
        </div>

        {activeTab === 'episodes' && <EpisodesTab />}
        {activeTab === 'templates' && <TemplatesTab />}
      </div>
    </>
  );
}

function EpisodesTab() {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEpisodes();
  }, []);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const data = await api.podcasts.listEpisodes();
      setEpisodes(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Could not load audio overviews from the backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      await api.podcasts.generate({
        topic: 'Untitled audio overview',
        duration_minutes: 5
      });
      await loadEpisodes();
    } catch (err) {
      console.error(err);
      setError('Failed to submit an audio overview job.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text)' }}>Episodes Overview</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>Live episodes from the local backend.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button onClick={handleGenerate} disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {generating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Generate New
          </Button>
          <button onClick={loadEpisodes} style={{ 
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem 1rem', background: 'var(--color-surface)',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
            color: 'var(--color-text)', cursor: 'pointer', transition: 'var(--transition)'
          }}>
            <RefreshCcw size={16} /> Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <SummaryBadge label="Total" value={episodes.length} />
      </div>

      {error && (
        <div style={{ color: 'var(--signal-error)', padding: '1rem', background: 'var(--danger-veil)', borderRadius: 'var(--radius-md)' }}>
          {error}
        </div>
      )}

      {generating && (
        <section>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text)' }}>Processing</h3>
          <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.85rem', background: 'var(--accent-veil)', border: '1px solid var(--accent-edge)', borderRadius: 'var(--radius-md)' }}>
                <Loader2 size={24} color="var(--color-primary)" className="animate-spin" />
              </div>
              <div>
                <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem', color: 'var(--color-text)' }}>Untitled audio overview</h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Submitted to the backend. Live job status is not exposed here yet.</p>
              </div>
            </div>
          </Card>
        </section>
      )}

      <section>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text)' }}>Completed</h3>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 size={32} className="animate-spin" color="var(--color-primary)" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {episodes.length > 0 ? episodes.map((ep: any, i: number) => (
              <EpisodeCard key={i} title={ep.title || `Episode ${i+1}`} date={ep.created || ep.updated || 'Unknown'} duration={ep.duration || 'Unknown'} />
            )) : (
              <div style={{ color: 'var(--color-text-muted)' }}>No episodes found.</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function EpisodeCard({ title, date, duration }: { title: string, date: string, duration: string }) {
  return (
    <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ padding: '0.85rem', background: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <Mic size={24} color="var(--color-primary-hover)" />
        </div>
        <div>
          <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem', color: 'var(--color-text)' }}>{title}</h4>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{date} • {duration}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button style={{ 
          background: 'var(--color-surface)', border: '1px solid var(--color-border)', 
          color: 'var(--color-text)', cursor: 'pointer', padding: '0.65rem', 
          borderRadius: 'var(--radius-md)', transition: 'var(--transition)' 
        }} 
        onMouseOver={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
        onMouseOut={e => e.currentTarget.style.background = 'var(--color-surface)'}>
          <PlayCircle size={20} />
        </button>
        <button style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          color: 'var(--signal-error)', cursor: 'pointer', padding: '0.65rem',
          borderRadius: 'var(--radius-md)', transition: 'var(--transition)'
        }}
        onMouseOver={e => e.currentTarget.style.background = 'var(--danger-veil)'}
        onMouseOut={e => e.currentTarget.style.background = 'var(--color-surface)'}>
          <Trash2 size={20} />
        </button>
      </div>
    </Card>
  )
}

function SummaryBadge({ label, value }: { label: string, value: number }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.35rem 1rem', borderRadius: '999px',
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface)', fontSize: '0.9rem',
      boxShadow: 'var(--shadow-glass)'
    }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{value}</span>
    </div>
  )
}

function TemplatesTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--color-text)' }}>Templates Workspace</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
          Audio templates are not wired to backend persistence yet.
        </p>
      </div>

      <Card style={{ color: 'var(--color-text-muted)' }}>
        No audio templates have been loaded from the backend. Speaker and episode profile editing remains unavailable until that API is wired.
      </Card>
    </div>
  );
}
