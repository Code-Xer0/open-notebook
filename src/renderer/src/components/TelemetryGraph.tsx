import React from 'react';

interface TelemetryGraphProps {
  data: number[]; // Array of values (e.g. 0-100)
  color?: string;
  height?: number;
  width?: string;
  min?: number;
  max?: number;
}

export function TelemetryGraph({ data, color = 'var(--accent-primary)', height = 40, width = '100%', min = 0, max = 100 }: TelemetryGraphProps) {
  if (!data || data.length === 0) return <div style={{ height, width, background: 'var(--panel-subtle)' }} />;

  const range = max - min;
  
  // Normalize data to fit within 0-100 height
  const points = data.map((val, i) => {
    const x = (i / (Math.max(data.length - 1, 1))) * 100;
    const y = 100 - (((val - min) / range) * 100);
    return `${x},${y}`;
  }).join(' ');

  // Create polygon string to fill the area under the line
  const polygonPoints = `0,100 ${points} 100,100`;

  return (
    <div style={{ width, height, position: 'relative' }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        
        {/* Fill */}
        <polygon points={polygonPoints} fill={`url(#grad-${color})`} />
        
        {/* Line */}
        <polyline 
          points={points} 
          fill="none" 
          stroke={color} 
          strokeWidth="2" 
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
