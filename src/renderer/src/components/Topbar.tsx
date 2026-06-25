import React, { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { BackendStatus } from './BackendStatus';
import { useStore } from '../store/useStore';

export function Topbar() {
  const [time, setTime] = useState(new Date());
  const [isHovered, setIsHovered] = useState(false);
  const { sidecars } = useStore();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleMinimize = () => window.api?.windowControls?.minimize();
  const handleMaximize = () => window.api?.windowControls?.maximize();
  const handleClose = () => window.api?.windowControls?.close();

  const sidecarOnline = sidecars?.surreal.phase === 'online' && sidecars?.backend.phase === 'online';

  return (
    <div className="topbar" style={{
      borderBottom: '1px solid var(--panel-border)',
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      background: 'var(--panel-bg)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      padding: '0 0 0 16px',
      height: '36px',
      WebkitAppRegion: 'drag'
    } as any}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', WebkitAppRegion: 'no-drag' } as any}>
        <div className="live-breathe" style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: 'var(--accent-primary)', boxShadow: '0 0 8px var(--accent-primary)'
        }} />
        <span style={{ color: 'var(--text-strong)', fontWeight: 600 }}>CODEX NOTEBOOK</span>
      </div>
      
      <div style={{ flex: 1 }} />

      {/* Status Strip — honest backend connectivity (see services/health.ts) */}
      <div style={{ display: 'flex', gap: '16px', WebkitAppRegion: 'no-drag', marginRight: '24px' } as any}>
        <BackendStatus />
        <span style={{ color: sidecarOnline ? 'var(--signal-healthy)' : 'var(--text-muted)' }}>
          SIDECARS: {sidecarOnline ? 'READY' : 'CHECKING'}
        </span>
      </div>
      
      {/* Theme Switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', WebkitAppRegion: 'no-drag', marginRight: '16px' } as any}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {/* Theme and Density controls have been moved to Settings */}
        </div>
        
        <div style={{ width: '1px', height: '16px', background: 'var(--panel-border)' }} />
        <span>{time.toLocaleTimeString([], { hour12: false })}</span>
      </div>

      <div 
        style={{ 
          display: 'flex', 
          height: '100%', 
          WebkitAppRegion: 'no-drag',
          opacity: isHovered ? 1 : 0.4,
          transition: 'opacity 0.2s ease',
          background: isHovered ? 'var(--panel-subtle-strong)' : 'transparent'
        } as any}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <button className="window-btn" onClick={handleMinimize} style={btnStyle}>
          <Minus size={14} />
        </button>
        <button className="window-btn" onClick={handleMaximize} style={btnStyle}>
          <Square size={12} />
        </button>
        <button className="window-btn close-btn" onClick={handleClose} style={{...btnStyle, ...closeBtnStyle}}>
          <X size={14} />
        </button>
      </div>

      <style>{`
        .window-btn {
          background: transparent;
          border: none;
          color: var(--text-main);
          width: 46px;
          height: 100%;
          display: flex;
          alignItems: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.1s;
        }
        .window-btn:hover {
          background: var(--window-control-hover);
        }
        .close-btn:hover {
          background: var(--signal-error) !important;
          color: var(--shell-bg);
        }
      `}</style>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  outline: 'none',
  padding: 0,
  margin: 0
};

const closeBtnStyle: React.CSSProperties = {};
