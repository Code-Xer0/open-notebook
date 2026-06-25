import React, { useState, useEffect } from 'react';
import { Mic, LayoutTemplate, RefreshCcw, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { Card } from '../../components/Card';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';

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
            Review audio overview records from the local backend. Generation controls stay hidden until a real podcast worker is available.
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
  const { telemetry } = useStore();
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const podcastWorkerStatus = telemetry.studioQueue.podcastWorker?.status || 'unknown';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text)' }}>Episode Records</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>Only backend records and existing audio assets are shown here.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
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

      <Card style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', color: 'var(--color-text-muted)' }}>
        <AlertTriangle size={18} color="var(--signal-warning)" style={{ flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--color-text)' }}>Generation unavailable</strong>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem' }}>
            Podcast worker status is {podcastWorkerStatus}. CODEX will not submit audio overview jobs until diagnostics report a real worker.
          </p>
        </div>
      </Card>

      {error && (
        <div style={{ color: 'var(--signal-error)', padding: '1rem', background: 'var(--danger-veil)', borderRadius: 'var(--radius-md)' }}>
          {error}
        </div>
      )}

      <section>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text)' }}>Backend Records</h3>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 size={32} className="animate-spin" color="var(--color-primary)" />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {episodes.length > 0 ? episodes.map((ep: any, i: number) => (
              <EpisodeCard
                key={ep.id || i}
                title={ep.title || ep.name || `Episode ${i+1}`}
                date={ep.created || ep.updated || 'Unknown'}
                duration={ep.duration || 'Unknown'}
                jobStatus={ep.job_status || 'unknown'}
                audioUrl={ep.audio_url ? api.podcasts.getAudioUrl(ep.id) : null}
              />
            )) : (
              <div style={{ color: 'var(--color-text-muted)' }}>No episodes found.</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function EpisodeCard({ title, date, duration, jobStatus, audioUrl }: { title: string, date: string, duration: string, jobStatus: string, audioUrl: string | null }) {
  return (
    <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ padding: '0.85rem', background: 'var(--color-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <Mic size={24} color="var(--color-primary-hover)" />
        </div>
        <div>
          <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem', color: 'var(--color-text)' }}>{title}</h4>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>{date} • {duration} • {jobStatus}</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {audioUrl ? (
          <a href={audioUrl} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            color: 'var(--color-text)', padding: '0.65rem', textDecoration: 'none',
            borderRadius: 'var(--radius-md)'
          }}>
            <ExternalLink size={18} /> Audio
          </a>
        ) : (
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No audio asset</span>
        )}
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
