import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface CollapsiblePaneProps {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function CollapsiblePane({ title, defaultExpanded = true, children, icon }: CollapsiblePaneProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(defaultExpanded ? undefined : 0);

  useEffect(() => {
    if (isExpanded) {
      setHeight(contentRef.current?.scrollHeight);
    } else {
      setHeight(0);
    }
  }, [isExpanded]);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <div className="glass-card" style={{ padding: '0', display: 'flex', flexDirection: 'column' }}>
      <button 
        onClick={toggleExpand}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '12px 16px',
          background: 'transparent',
          border: 'none',
          color: 'var(--ice)',
          cursor: 'pointer',
          fontFamily: 'var(--font-heading)',
          fontSize: '0.85rem',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          borderBottom: isExpanded ? '1px solid var(--hair-strong)' : 'none',
          transition: 'border-color 0.3s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon && <span style={{ color: 'var(--accent-primary)' }}>{icon}</span>}
          <h2 style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, color: 'var(--text-main)' }}>
            {title}
          </h2>
        </div>
        <div style={{ color: 'var(--accent-dim)' }}>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </button>
      
      <div 
        style={{ 
          height, 
          overflow: 'hidden', 
          transition: 'height 0.3s var(--ease-glass)',
          opacity: isExpanded ? 1 : 0
        }}
      >
        <div ref={contentRef} style={{ padding: '16px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
