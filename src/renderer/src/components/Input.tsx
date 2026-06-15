import React from 'react'

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input 
      {...props}
      style={{
        padding: '10px 14px',
        borderRadius: '6px',
        border: '1px solid var(--hair-strong)',
        background: 'rgba(4,8,26,0.58)',
        color: 'var(--ice)',
        fontFamily: 'var(--font-mono)',
        fontSize: '13px',
        outline: 'none',
        width: '100%',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.02)',
        transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
        ...props.style
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-dim)';
        e.currentTarget.style.boxShadow = '0 0 0 1px var(--accent-faint), inset 0 0 0 1px var(--accent-veil)';
        e.currentTarget.style.background = 'rgba(4,8,26,0.8)';
        if (props.onFocus) props.onFocus(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'var(--hair-strong)';
        e.currentTarget.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,0.02)';
        e.currentTarget.style.background = 'rgba(4,8,26,0.58)';
        if (props.onBlur) props.onBlur(e);
      }}
    />
  )
}
