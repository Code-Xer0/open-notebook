import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Book, MessageSquare, Mic, FileText, Settings, Activity, Database, Headphones } from 'lucide-react';
import { useStore } from '../store/useStore';

export function Sidebar() {
  const location = useLocation();
  const { backend, sidecars } = useStore();

  const getBtnClass = (path: string, exact: boolean = true) => {
    const isActive = exact ? location.pathname === path : location.pathname.startsWith(path);
    return `sc-link ${isActive ? 'active' : ''}`;
  };

  const getLinkStyle = (path: string, exact: boolean = true): React.CSSProperties => {
    const isActive = exact ? location.pathname === path : location.pathname.startsWith(path);
    return {
      textAlign: 'left',
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'center',
      padding: '12px 16px',
      background: isActive ? 'var(--accent-veil)' : 'transparent',
      boxShadow: isActive ? 'inset 3px 0 0 var(--accent-primary)' : 'none',
      color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
      textDecoration: 'none',
      transition: 'all 0.2s ease',
      borderRadius: 'var(--radius-sm)'
    };
  };

  const isOnline = backend.status === 'online';
  const sidecarsReady = sidecars?.surreal.phase === 'online' && sidecars?.backend.phase === 'online';

  return (
    <div className="sc-rail" style={{
      width: '260px',
      borderRight: '1px solid var(--panel-border)',
      background: 'var(--panel-bg-solid)',
      boxShadow: 'var(--shadow-glass)',
      padding: 'var(--pad-lg) 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      height: '100%',
      position: 'relative'
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '42px 1fr', gap: '12px', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-dim))',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 0 12px var(--accent-faint)'
        }}>
          <Book size={24} color="var(--shell-bg)" />
        </div>
        <div>
          <div style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1rem',
            fontWeight: 900,
            color: 'var(--accent-bright)'
          }}>CODEX</div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>Notebook workspace</div>
        </div>
      </div>
      
      <div style={{ display: 'grid', gap: '4px' }}>
        <Link to="/" className={getBtnClass('/')} style={getLinkStyle('/')}>
          <Activity size={18} /> Workspace
        </Link>
        <Link to="/chat" className={getBtnClass('/chat')} style={getLinkStyle('/chat')}>
          <MessageSquare size={18} /> Grounded Chat
        </Link>
        <Link to="/sources" className={getBtnClass('/sources')} style={getLinkStyle('/sources')}>
          <FileText size={18} /> Sources
        </Link>
        <Link to="/podcasts" className={getBtnClass('/podcasts')} style={getLinkStyle('/podcasts')}>
          <Headphones size={18} /> Audio Records
        </Link>
        <Link to="/studio" className={getBtnClass('/studio', false)} style={getLinkStyle('/studio', false)}>
          <Mic size={18} /> Narrative Studio
        </Link>
        <Link to="/nexus" className={getBtnClass('/nexus')} style={getLinkStyle('/nexus')}>
          <Database size={18} /> Nexus Corpus
        </Link>
      </div>
      
      <div style={{ flex: 1 }} />
      
      <div style={{
        border: '1px solid var(--panel-border-faint)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--panel-subtle)',
        padding: '12px',
        marginBottom: '12px'
      }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: 'var(--font-size-xs)', color: isOnline ? 'var(--accent-primary)' : 'var(--text-faint)' }}>
          {isOnline ? 'API REACHABLE' : 'WORKSPACE OFFLINE'}
        </span>
        <p style={{ margin: '5px 0 0', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', lineHeight: 1.3 }}>
          {isOnline
            ? sidecarsReady ? 'Notebook API and owned sidecar ports are reachable.' : 'API reachable. Sidecar ownership is still syncing.'
            : 'Waiting for the local backend before loading notebooks and sources.'}
        </p>
      </div>

      <Link to="/settings" className={getBtnClass('/settings')} style={getLinkStyle('/settings')}>
        <Settings size={18} /> Settings
      </Link>
    </div>
  );
}
