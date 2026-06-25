import React from 'react';
import { DownloadCloud, FileText, Scissors, Cpu, Network, Search, PenTool } from 'lucide-react';
import { Card } from './Card';

import { useStore } from '../store/useStore';

interface PipelineStage {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: 'idle' | 'processing' | 'observed' | 'warning' | 'error';
  value?: string | number;
}

export function SourcePipelineCard() {
  const { telemetry } = useStore();
  
  const hasTelemetry = telemetry.sourceHealth.connected !== 'Unknown';
  const hasCompleted = typeof telemetry.ingestionHealth.completed === 'number';
  const hasRetrievalLatency = telemetry.retrievalHealth.latency !== 'Unknown';

  const stages: PipelineStage[] = [
    {
      id: 'intake', label: 'Intake', icon: <DownloadCloud size={16} />,
      status: hasTelemetry ? 'idle' : 'warning',
      value: hasTelemetry ? (typeof telemetry.ingestionHealth.queued === 'number' && telemetry.ingestionHealth.queued > 0 ? telemetry.ingestionHealth.queued : 'Idle') : 'Unknown'
    },
    {
      id: 'parse', label: 'Parse', icon: <FileText size={16} />,
      status: hasTelemetry ? (typeof telemetry.ingestionHealth.parsing === 'number' && telemetry.ingestionHealth.parsing > 0 ? 'processing' : 'idle') : 'warning',
      value: hasTelemetry ? telemetry.ingestionHealth.parsing : 'Unknown'
    },
    { id: 'chunk', label: 'Chunk', icon: <Scissors size={16} />, status: hasTelemetry ? 'idle' : 'warning', value: hasTelemetry ? 'Idle' : 'Unknown' },
    { id: 'embed', label: 'Embed', icon: <Cpu size={16} />, status: hasTelemetry ? 'idle' : 'warning', value: hasTelemetry ? 'Idle' : 'Unknown' },
    { id: 'index', label: 'Index', icon: <Network size={16} />, status: hasCompleted ? 'observed' : 'warning', value: hasCompleted ? telemetry.ingestionHealth.completed : 'Unknown' },
    { id: 'retrieve', label: 'Retrieve', icon: <Search size={16} />, status: hasRetrievalLatency ? 'observed' : 'warning', value: hasRetrievalLatency ? telemetry.retrievalHealth.latency : 'Unknown' },
    { id: 'synthesize', label: 'Synthesize', icon: <PenTool size={16} />, status: hasTelemetry ? 'idle' : 'warning', value: hasTelemetry ? 'Idle' : 'Unknown' }
  ];

  return (
    <Card style={{ padding: 'var(--pad-md)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--pad-md)' }}>
        <h3 style={{ fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, color: 'var(--text-strong)' }}>
          Ingestion & Synthesis Pipeline
        </h3>
        <span style={{ fontSize: 'var(--font-size-xs)', color: hasTelemetry ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
          {hasTelemetry ? 'TELEMETRY MEASURED' : 'TELEMETRY UNKNOWN'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        {/* Connecting Line */}
        <div style={{ position: 'absolute', top: '50%', left: '0', right: '0', height: '2px', background: 'var(--panel-border-faint)', zIndex: 0, transform: 'translateY(-50%)' }} />

        {stages.map((stage) => {
          const color = 
            stage.status === 'observed' ? 'var(--accent-primary)' :
            stage.status === 'processing' ? 'var(--signal-processing)' :
            stage.status === 'warning' ? 'var(--signal-warning)' :
            stage.status === 'error' ? 'var(--signal-error)' :
            'var(--text-muted)';
            
          const glow = stage.status === 'processing' ? `0 0 12px ${color}` : 'none';

          return (
            <div key={stage.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'var(--panel-bg-solid)',
                border: `2px solid ${color}`,
                display: 'grid', placeItems: 'center',
                color: color,
                boxShadow: glow
              }}>
                {stage.icon}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>{stage.label}</div>
                <div style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>{stage.value}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
