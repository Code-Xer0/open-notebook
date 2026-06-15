import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ChevronDown, RefreshCw, Check } from 'lucide-react';
import { api } from '../services/api';

type Source = 'ollama' | 'cloud';
type Phase = 'idle' | 'loading' | 'ok' | 'empty' | 'error';

interface ModelSelectProps {
  value: string;
  onChange: (value: string) => void;
  source: Source;
  ollamaEndpoint?: string;
  provider?: string;          // for cloud discovery (e.g. 'openai')
  apiKeyPresent?: boolean;    // cloud: whether a key is configured locally
  placeholder?: string;
}

// Editable model field with live discovery. For Ollama it queries the local
// daemon's /api/tags directly; for cloud it asks the backend's /api/models.
// Manual typing always works; discovery only *augments* with real options and
// reports honest states (never a fabricated list).
export function ModelSelect({ value, onChange, source, ollamaEndpoint, provider, apiKeyPresent, placeholder = 'model name' }: ModelSelectProps) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [models, setModels] = useState<string[]>([]);
  const [message, setMessage] = useState<string>('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  async function discover() {
    setPhase('loading');
    setMessage('');
    setOpen(true);
    try {
      let found: string[] = [];
      if (source === 'ollama') {
        const base = (ollamaEndpoint || 'http://localhost:11434').replace(/\/+$/, '');
        const res = await axios.get(`${base}/api/tags`, { timeout: 5000 });
        const list = Array.isArray(res.data?.models) ? res.data.models : [];
        found = list.map((m: { name?: string; model?: string }) => m.name || m.model || '').filter(Boolean);
      } else {
        if (!apiKeyPresent) {
          setPhase('error');
          setMessage('Enter and save an API key first, then discover models.');
          return;
        }
        const res = await api.models.list();
        const list = Array.isArray(res) ? res : (res?.models ?? []);
        found = list
          .filter((m: { provider?: string }) => !provider || !m.provider || m.provider === provider)
          .map((m: { name?: string; id?: string; model_id?: string }) => m.name || m.model_id || m.id || '')
          .filter(Boolean);
      }
      setModels(found);
      if (found.length === 0) {
        setPhase('empty');
        setMessage(source === 'ollama' ? `No models installed at ${ollamaEndpoint || 'http://localhost:11434'}.` : 'Backend returned no models for this provider.');
      } else {
        setPhase('ok');
        setMessage(`${found.length} model${found.length === 1 ? '' : 's'} found.`);
      }
    } catch {
      setPhase('error');
      setMessage(
        source === 'ollama'
          ? `Couldn't reach Ollama at ${ollamaEndpoint || 'http://localhost:11434'}. Is it running?`
          : 'Backend offline — cannot query models.'
      );
    }
  }

  const statusColor =
    phase === 'ok' ? 'var(--signal-healthy)' :
    phase === 'loading' ? 'var(--signal-warning)' :
    phase === 'error' ? 'var(--signal-error)' :
    phase === 'empty' ? 'var(--text-muted)' : 'var(--text-faint)';

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="glass-input"
          style={{ flex: 1 }}
          onFocus={() => models.length > 0 && setOpen(true)}
        />
        <button
          type="button"
          className="btn"
          onClick={discover}
          title={source === 'ollama' ? 'Search installed Ollama models' : 'Discover provider models'}
          style={{ flexShrink: 0, padding: '0 0.75rem' }}
        >
          {phase === 'loading'
            ? <RefreshCw size={14} className="spin" />
            : <><RefreshCw size={14} /> <ChevronDown size={12} /></>}
        </button>
      </div>

      {message && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: statusColor, marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
          {phase === 'loading' ? (source === 'ollama' ? 'Searching local models…' : 'Querying backend…') : message}
        </div>
      )}

      {open && models.length > 0 && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
            maxHeight: '220px', overflowY: 'auto',
            background: 'var(--panel-bg-solid)', border: '1px solid var(--accent-edge)',
            borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-glass)', backdropFilter: 'blur(16px)', padding: '4px',
          }}
        >
          {models.map((m) => {
            const selected = m === value;
            return (
              <button
                type="button" key={m} role="option" aria-selected={selected}
                onClick={() => { onChange(m); setOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                  padding: '0.45rem 0.6rem', background: selected ? 'var(--accent-veil)' : 'transparent',
                  border: 'none', borderRadius: 'var(--radius-sm)', color: selected ? 'var(--accent-primary)' : 'var(--text-main)',
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', textAlign: 'left', cursor: 'pointer',
                }}
                onMouseEnter={(e) => { if (!selected) (e.currentTarget.style.background = 'var(--accent-veil)'); }}
                onMouseLeave={(e) => { if (!selected) (e.currentTarget.style.background = 'transparent'); }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m}</span>
                {selected && <Check size={13} style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
