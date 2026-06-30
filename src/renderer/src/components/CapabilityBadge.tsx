import type { CapabilityFact, CapabilityStatus } from '../types/runtime';

export function capabilityTone(status: CapabilityStatus | undefined): 'ok' | 'warn' | 'error' | 'muted' {
  if (status === 'ready' || status === 'stored' || status === 'reachable') return 'ok';
  if (status === 'failed') return 'error';
  if (status === 'blocked' || status === 'provider missing' || status === 'worker unavailable') return 'warn';
  return 'muted';
}

export function capabilityColor(status: CapabilityStatus | undefined): string {
  const tone = capabilityTone(status);
  if (tone === 'ok') return 'var(--signal-healthy)';
  if (tone === 'warn') return 'var(--signal-warning)';
  if (tone === 'error') return 'var(--signal-error)';
  return 'var(--text-muted)';
}

export function CapabilityBadge({ fact, label }: { fact?: CapabilityFact | null; label?: string }) {
  const status = fact?.status || 'not verified';
  return (
    <span
      title={fact?.blockingReason || fact?.lastError || fact?.evidence || status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        border: `1px solid color-mix(in srgb, ${capabilityColor(status)} 45%, transparent)`,
        background: `color-mix(in srgb, ${capabilityColor(status)} 12%, transparent)`,
        color: capabilityColor(status),
        borderRadius: '999px',
        padding: '0.18rem 0.55rem',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {label ? `${label}: ` : ''}{status}
    </span>
  );
}
