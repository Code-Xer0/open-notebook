import React from 'react';
import { useStore } from '../store/useStore';

const LABELS: Record<string, string> = {
  unknown: 'UNKNOWN',
  connecting: 'CONNECTING',
  online: 'REACHABLE',
  offline: 'OFFLINE',
};

const COLORS: Record<string, string> = {
  unknown: 'var(--text-muted)',
  connecting: 'var(--signal-warning)',
  online: 'var(--accent-primary)',
  offline: 'var(--signal-error)',
};

export function BackendStatus({ compact = false }: { compact?: boolean }) {
  const { backend } = useStore();
  const color = COLORS[backend.status] ?? 'var(--text-muted)';
  const label = LABELS[backend.status] ?? 'UNKNOWN';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title={
      backend.lastChecked ? `Last checked ${new Date(backend.lastChecked).toLocaleTimeString([], { hour12: false })}` : 'Not yet checked'
    }>
      <span
        className={backend.status === 'connecting' ? 'live-pulse' : undefined}
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: color,
          boxShadow: backend.status === 'connecting' ? `0 0 8px ${color}` : 'none',
          ['--ring' as string]: 'rgba(245, 194, 107, 0.6)',
        } as React.CSSProperties}
      />
      {!compact && <span>API: <strong style={{ color }}>{label}</strong></span>}
      {!compact && backend.status === 'online' && backend.version && (
        <span style={{ color: 'var(--text-faint)' }}>v{backend.version}</span>
      )}
    </div>
  );
}
