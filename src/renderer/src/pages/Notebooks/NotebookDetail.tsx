import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, FileText, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Chat } from './Chat';
import { api } from '../../services/api';

export function NotebookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [notebook, setNotebook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadNotebook(id);
    }
  }, [id]);

  const loadNotebook = async (notebookId: string) => {
    try {
      setLoading(true);
      const data = await api.notebooks.get(notebookId);
      setNotebook(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load notebook');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><Loader2 size={32} className="animate-spin" color="var(--color-primary)" /></div>;
  }

  if (error || !notebook) {
    return <div style={{ color: 'var(--signal-error)', padding: '1rem' }}>{error || 'Notebook not found'}</div>;
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 4rem)', width: '100%', gap: '1.5rem', padding: '1rem', boxSizing: 'border-box' }}>
      {/* Left Column: Notebook Content (Notes & Sources) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => navigate('/')} className="glass-card" style={{ padding: '0.5rem', cursor: 'pointer', display: 'flex', border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)' }}>
              <ArrowLeft size={20} />
            </button>
            <h1 className="title" style={{ margin: 0, fontSize: '1.8rem' }}>{notebook.name}</h1>
          </div>
          <button title="Notebook settings are not wired yet" disabled className="glass-card" style={{ padding: '0.5rem', cursor: 'not-allowed', opacity: 0.5, display: 'flex', border: '1px solid var(--color-border)', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', color: 'var(--color-text)' }}>
            <Settings size={20} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flex: 1, minHeight: 0 }}>
          {/* Notes Section */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <FileText size={20} style={{ color: 'var(--color-primary)' }} /> Notes
              </h2>
              <button className="btn" disabled title="Note creation is not wired yet" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Add Note</button>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {notebook.notes?.length > 0 ? notebook.notes.map((note: any, i: number) => (
                <div key={i} className="glass-card" style={{ padding: '1.25rem', background: 'var(--color-surface-hover)' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem' }}>{note.title || `Note ${i+1}`}</h4>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{note.content}</p>
                </div>
              )) : (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>No notes yet.</div>
              )}
            </div>
          </div>

          {/* Sources Section */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <h2 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <LinkIcon size={20} style={{ color: 'var(--color-primary)' }} /> Sources
              </h2>
              <button className="btn" onClick={() => navigate('/sources')} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Add Source</button>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {notebook.sources?.length > 0 ? notebook.sources.map((source: any, i: number) => (
                <div key={i} className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--color-surface-hover)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontWeight: 500 }}>{source.filename || `Source ${i+1}`}</span>
                  </div>
                </div>
              )) : (
                <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>No sources linked.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Chat Interface */}
      <div style={{ width: '450px', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <Chat />
      </div>
    </div>
  );
}
