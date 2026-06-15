import React, { useState, useEffect } from 'react';
import { Book, Plus, Search, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api, API_BASE_URL } from '../../services/api';

export function NotebookList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorDetails, setErrorDetails] = useState<{ isOffline: boolean; message: string; url?: string } | null>(null);

  useEffect(() => {
    loadNotebooks();
  }, []);

  const loadNotebooks = async () => {
    try {
      setLoading(true);
      const data = await api.notebooks.list();
      setNotebooks(data);
      setErrorDetails(null);
    } catch (err: any) {
      const isNetworkError = err.code === 'ERR_NETWORK' || err.message?.includes('Network Error');
      setErrorDetails({
        isOffline: isNetworkError,
        message: err.message || 'Failed to load notebooks',
        url: `${API_BASE_URL}/notebooks`
      });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNotebook = async () => {
    try {
      setLoading(true);
      await api.notebooks.create({ name: 'New Notebook' });
      await loadNotebooks();
    } catch (err: any) {
      const isNetworkError = err.code === 'ERR_NETWORK' || err.message?.includes('Network Error');
      setErrorDetails({
        isOffline: isNetworkError,
        message: err.message || 'Failed to create notebook',
        url: `${API_BASE_URL}/notebooks`
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="title" style={{ margin: 0 }}>Notebooks</h1>
        <button className="btn" onClick={handleCreateNotebook} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Plus size={18} /> New Notebook
        </button>
      </div>

      <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem' }}>
        <Search size={18} style={{ color: 'var(--color-text-muted)' }} />
        <input 
          type="text" 
          placeholder="Search notebooks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text)',
            outline: 'none',
            width: '100%',
            fontSize: '1rem'
          }}
        />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <Loader2 size={32} className="animate-spin" color="var(--color-primary)" />
        </div>
      ) : errorDetails ? (
        <div style={{ color: '#ef4444', padding: '1.5rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {errorDetails.isOffline ? 'Backend Offline' : 'Error'}
          </h3>
          {errorDetails.isOffline && <p style={{ margin: '0 0 0.5rem 0', fontFamily: 'monospace', fontSize: '0.9rem' }}>Attempted URL: {errorDetails.url}</p>}
          <p style={{ margin: '0 0 1.5rem 0' }}>Last error: {errorDetails.message}</p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn" onClick={loadNotebooks} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
              Retry Connection
            </button>
            <button className="btn" onClick={() => navigate('/diagnostics')} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
              Open Diagnostics
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {notebooks.filter(nb => nb.name?.toLowerCase().includes(searchTerm.toLowerCase())).map(notebook => (
            <div 
              key={notebook.id} 
              className="glass-card" 
              onClick={() => navigate(`/notebook/${notebook.id}`)}
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ 
                    background: 'var(--color-surface-hover)', 
                    padding: '0.75rem', 
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-primary)'
                  }}>
                    <Book size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>{notebook.name}</h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0, marginTop: '0.25rem' }}>Updated recently</p>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: 'auto' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                  {notebook.notes?.length || 0} Notes
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                  {notebook.sources?.length || 0} Sources
                </span>
              </div>
            </div>
          ))}
          {notebooks.length === 0 && !loading && (
             <div style={{ color: 'var(--color-text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '3rem' }}>
                No notebooks found. Create one to get started.
             </div>
          )}
        </div>
      )}
    </div>
  );
}
