import React from 'react'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input 
      {...props}
      style={{
        padding: '10px 14px',
        borderRadius: '6px',
        border: '1px solid var(--hair-strong)',
        background: 'var(--panel-bg)',
        color: 'var(--ice)',
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
        outline: 'none',
        width: '100%',
        boxShadow: 'inset 0 0 0 1px var(--panel-sheen-faint)',
        transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
        ...props.style
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-dim)';
        e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent-faint), inset 0 0 0 1px var(--accent-veil)';
        e.currentTarget.style.background = 'var(--panel-bg-hover)';
        if (props.onFocus) props.onFocus(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'var(--hair-strong)';
        e.currentTarget.style.boxShadow = 'inset 0 0 0 1px var(--panel-sheen-faint)';
        e.currentTarget.style.background = 'var(--panel-bg)';
        if (props.onBlur) props.onBlur(e);
      }}
    />
  )
}
