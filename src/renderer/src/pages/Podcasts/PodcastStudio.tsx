import React, { useState, useEffect } from 'react';
import { Mic, LayoutTemplate, RefreshCcw, Loader2, PlayCircle, Trash2, Edit3, Plus, Settings } from 'lucide-react';
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
            Generate, manage, and explore multi-speaker podcasts with Codex Intelligence.
          </p>
        </header>

        {/* TABS */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setActiveTab('episodes')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: activeTab === 'episodes' ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeTab === 'episodes' ? 'white' : 'var(--color-text-muted)',
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
              color: activeTab === 'templates' ? 'white' : 'var(--color-text-muted)',
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

  useEffect(() => {
    loadEpisodes();
  }, []);

  const loadEpisodes = async () => {
    try {
      setLoading(true);
      const data = await api.podcasts.listEpisodes();
      setEpisodes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      await api.podcasts.generate({
        topic: 'New Auto Generated Podcast',
        duration_minutes: 5
      });
      await loadEpisodes();
    } catch (err) {
      console.error(err);
      alert('Failed to generate podcast');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--color-text)' }}>Episodes Overview</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>Manage your generated podcast episodes</p>
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

      {generating && (
        <section>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-text)' }}>Processing</h3>
          <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.85rem', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 'var(--radius-md)' }}>
                <Loader2 size={24} color="var(--color-primary)" className="animate-spin" />
              </div>
              <div>
                <h4 style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem', color: 'var(--color-text)' }}>New Auto Generated Podcast</h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Generating multi-speaker audio streams...</p>
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
              <EpisodeCard key={i} title={ep.title || `Episode ${i+1}`} date={new Date().toLocaleDateString()} duration={ep.duration || 'Unknown'} />
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
          color: '#ef4444', cursor: 'pointer', padding: '0.65rem', 
          borderRadius: 'var(--radius-md)', transition: 'var(--transition)' 
        }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
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
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
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
          Manage your custom voices and podcast format configurations
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        <Card style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text)' }}>Speaker Profiles</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Manage AI voices and their characteristics</p>
            </div>
            <button style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', borderRadius: 'var(--radius-md)', padding: '0.5rem',
              cursor: 'pointer', transition: 'var(--transition)'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--color-surface)'}>
              <Plus size={18} />
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <TemplateItem title="Tech Host (Alex)" description="Enthusiastic and clear narrator" icon={<Mic size={18} color="var(--color-primary)" />} />
            <TemplateItem title="Guest Expert (Sarah)" description="Professional and insightful tone" icon={<Mic size={18} color="var(--color-primary)" />} />
          </div>
        </Card>

        <Card style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text)' }}>Episode Profiles</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>Manage structure and pacing formats</p>
            </div>
            <button style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              color: 'var(--color-text)', borderRadius: 'var(--radius-md)', padding: '0.5rem',
              cursor: 'pointer', transition: 'var(--transition)'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--color-surface-hover)'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--color-surface)'}>
              <Plus size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <TemplateItem title="Deep Dive" description="15-minute technical exploration" icon={<Settings size={18} color="var(--color-primary)" />} />
            <TemplateItem title="News Summary" description="5-minute quick daily updates" icon={<Settings size={18} color="var(--color-primary)" />} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function TemplateItem({ title, description, icon }: { title: string, description: string, icon: React.ReactNode }) {
  return (
    <div style={{ 
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '1rem', background: 'var(--color-surface)', 
      border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
      transition: 'var(--transition)'
    }}
    onMouseOver={e => { e.currentTarget.style.background = 'var(--color-surface-hover)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
    onMouseOut={e => { e.currentTarget.style.background = 'var(--color-surface)'; e.currentTarget.style.transform = 'translateY(0)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ padding: '0.5rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-sm)' }}>
          {icon}
        </div>
        <div>
          <h4 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-text)' }}>{title}</h4>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.15rem' }}>{description}</p>
        </div>
      </div>
      <button style={{ 
        background: 'transparent', border: 'none', color: 'var(--color-text-muted)', 
        cursor: 'pointer', padding: '0.5rem', transition: 'var(--transition)' 
      }}
      onMouseOver={e => e.currentTarget.style.color = 'var(--color-primary-hover)'}
      onMouseOut={e => e.currentTarget.style.color = 'var(--color-text-muted)'}>
        <Edit3 size={18} />
      </button>
    </div>
  )
}
