import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<SelectOption | string>;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

function normalize(options: Array<SelectOption | string>): SelectOption[] {
  return options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
}

// Custom, fully theme-styled dropdown. Replaces native <select> so the popup and
// its scrollbar are rendered by the app (not the OS / Windows stock control).
export function Select({ value, onChange, options, placeholder = 'Select…', disabled = false, ariaLabel }: SelectProps) {
  const opts = normalize(options);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = opts.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          padding: '0.6rem 0.75rem',
          background: 'var(--panel-bg-solid)',
          border: `1px solid ${open ? 'var(--accent-edge)' : 'var(--panel-border)'}`,
          borderRadius: 'var(--radius-sm)',
          color: current ? 'var(--text-main)' : 'var(--text-muted)',
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--font-size-base)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          textAlign: 'left',
          transition: 'border-color 0.2s ease',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current ? current.label : placeholder}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', flexShrink: 0 }} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 100,
            maxHeight: '240px',
            overflowY: 'auto',
            background: 'var(--panel-bg-solid)',
            border: '1px solid var(--accent-edge)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-glass)',
            backdropFilter: 'blur(16px)',
            padding: '4px',
          }}
        >
          {opts.length === 0 && (
            <div style={{ padding: '0.5rem 0.75rem', color: 'var(--text-faint)', fontSize: 'var(--font-size-sm)' }}>No options</div>
          )}
          {opts.map((o) => {
            const selected = o.value === value;
            return (
              <button
                type="button"
                key={o.value}
                role="option"
                aria-selected={selected}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '0.5rem 0.6rem',
                  background: selected ? 'var(--accent-veil)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: selected ? 'var(--accent-primary)' : 'var(--text-main)',
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--font-size-base)',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => { if (!selected) (e.currentTarget.style.background = 'var(--accent-veil)'); }}
                onMouseLeave={(e) => { if (!selected) (e.currentTarget.style.background = 'transparent'); }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
                {selected && <Check size={14} style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
