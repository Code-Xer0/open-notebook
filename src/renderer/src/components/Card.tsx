import React from 'react'

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  level?: 'primary' | 'secondary' | 'tertiary';
}

export function Card({ children, className = '', style, level = 'secondary' }: CardProps) {
  return (
    <div className={`glass-card card-${level} ${className}`} style={style}>
      {children}
    </div>
  )
}
