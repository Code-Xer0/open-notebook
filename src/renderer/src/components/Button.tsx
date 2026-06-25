import React from 'react'

export function Button({ children, onClick, className = '', disabled, type = 'button', style, title }: { children: React.ReactNode, onClick?: () => void, className?: string, disabled?: boolean, type?: "button" | "submit" | "reset", style?: React.CSSProperties, title?: string }) {
  return (
    <button 
      type={type}
      className={`btn ${className}`} 
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer', ...style }}
    >
      {children}
    </button>
  )
}
