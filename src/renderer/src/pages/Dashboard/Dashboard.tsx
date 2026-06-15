import React from 'react';
import { Database, BookOpen, Layers, Zap, Activity, Headphones } from 'lucide-react';
import { CollapsiblePane } from '../../components/CollapsiblePane';
import { NotebookList } from '../Notebooks/NotebookList';
import { Card } from '../../components/Card';
import { SourcePipelineCard } from '../../components/SourcePipelineCard';
import { KnowledgeHealthScore } from '../../components/KnowledgeHealthScore';
import { KnowledgeAlerts } from '../../components/KnowledgeAlerts';


import { useStore } from '../../store/useStore';

export function Dashboard() {
  // Telemetry + connectivity are populated by the global backend monitor
  // (services/health.ts, started in App). The Dashboard is presentational: it
  // renders whatever honest state the store holds (real values, 'Unknown', or
  // Offline) and never fabricates metrics.
  const { telemetry, backend } = useStore();

  const telemetryCards = [
    {
      title: 'Source Health',
      icon: <Database size={14} color="var(--accent-primary)" />,
      stats: [
        { label: 'Connected', value: telemetry.sourceHealth.connected, color: telemetry.sourceHealth.connected === 'Unknown' ? 'var(--text-muted)' : 'var(--signal-healthy)' },
        { label: 'Failed', value: telemetry.sourceHealth.failed, color: telemetry.sourceHealth.failed === 'Unknown' ? 'var(--text-muted)' : 'var(--signal-error)' },
        { label: 'Pending', value: telemetry.sourceHealth.pending, color: telemetry.sourceHealth.pending === 'Unknown' ? 'var(--text-muted)' : 'var(--signal-warning)' }
      ]
    },
    {
      title: 'Knowledge Coverage',
      icon: <BookOpen size={14} color="var(--accent-primary)" />,
      stats: [
        { label: 'Citation Coverage', value: telemetry.knowledgeCoverage.citationCoverage, color: telemetry.knowledgeCoverage.citationCoverage === 'Unknown' ? 'var(--text-muted)' : 'var(--text-main)' },
        { label: 'Orphan Content', value: telemetry.knowledgeCoverage.orphanContent, color: telemetry.knowledgeCoverage.orphanContent === 'Unknown' ? 'var(--text-muted)' : 'var(--signal-warning)' },
        { label: 'Unresolved Entities', value: telemetry.knowledgeCoverage.unresolvedEntities, color: telemetry.knowledgeCoverage.unresolvedEntities === 'Unknown' ? 'var(--text-muted)' : 'var(--signal-error)' }
      ]
    },
    {
      title: 'Retrieval Health',
      icon: <Zap size={14} color="var(--accent-primary)" />,
      stats: [
        { label: 'Retrieval Latency', value: telemetry.retrievalHealth.latency, color: telemetry.retrievalHealth.latency === 'Unknown' ? 'var(--text-muted)' : 'var(--signal-healthy)' },
        { label: 'Failed Retrievals', value: telemetry.retrievalHealth.failed, color: telemetry.retrievalHealth.failed === 'Unknown' ? 'var(--text-muted)' : 'var(--signal-healthy)' },
        { label: 'Context Depth', value: telemetry.retrievalHealth.contextDepth, color: telemetry.retrievalHealth.contextDepth === 'Unknown' ? 'var(--text-muted)' : 'var(--text-main)' }
      ]
    },
    {
      title: 'Ingestion Health',
      icon: <Layers size={14} color="var(--accent-primary)" />,
      stats: [
        { label: 'Queued', value: telemetry.ingestionHealth.queued, color: telemetry.ingestionHealth.queued === 'Unknown' ? 'var(--text-muted)' : 'var(--text-main)' },
        { label: 'Parsing', value: telemetry.ingestionHealth.parsing, color: telemetry.ingestionHealth.parsing === 'Unknown' ? 'var(--text-muted)' : 'var(--accent-primary)' },
        { label: 'Failed', value: telemetry.ingestionHealth.failed, color: telemetry.ingestionHealth.failed === 'Unknown' ? 'var(--text-muted)' : 'var(--signal-error)' },
        { label: 'Completed', value: telemetry.ingestionHealth.completed, color: telemetry.ingestionHealth.completed === 'Unknown' ? 'var(--text-muted)' : 'var(--signal-healthy)' }
      ]
    },
    {
      title: 'Narrative Index',
      icon: <Activity size={14} color="var(--accent-primary)" />,
      stats: [
        { label: 'Characters', value: telemetry.narrativeIndex.characters, color: telemetry.narrativeIndex.characters === 'Unknown' ? 'var(--text-muted)' : 'var(--text-main)' },
        { label: 'Locations', value: telemetry.narrativeIndex.locations, color: telemetry.narrativeIndex.locations === 'Unknown' ? 'var(--text-muted)' : 'var(--text-main)' },
        { label: 'Factions', value: telemetry.narrativeIndex.factions, color: telemetry.narrativeIndex.factions === 'Unknown' ? 'var(--text-muted)' : 'var(--text-main)' },
        { label: 'Timelines', value: telemetry.narrativeIndex.timelines, color: telemetry.narrativeIndex.timelines === 'Unknown' ? 'var(--text-muted)' : 'var(--text-main)' }
      ]
    },
    {
      title: 'Studio Queue',
      icon: <Headphones size={14} color="var(--accent-primary)" />,
      stats: [
        { label: 'Audiobook Jobs', value: telemetry.studioQueue.audiobookJobs, color: telemetry.studioQueue.audiobookJobs === 'Unknown' ? 'var(--text-muted)' : 'var(--accent-primary)' },
        { label: 'Report Jobs', value: telemetry.studioQueue.reportJobs, color: telemetry.studioQueue.reportJobs === 'Unknown' ? 'var(--text-muted)' : 'var(--text-main)' },
        { label: 'Export Jobs', value: telemetry.studioQueue.exportJobs, color: telemetry.studioQueue.exportJobs === 'Unknown' ? 'var(--text-muted)' : 'var(--text-muted)' }
      ]
    }
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 'var(--pad-lg)', height: '100%' }}>
      
      {/* Left Column: Telemetry & Notebooks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad-lg)', overflowY: 'auto', paddingRight: '4px' }}>
        
        {/* Source Pipeline Topology */}
        <SourcePipelineCard />

        {/* Telemetry Cards Grid */}
        <div className="tele-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--pad-md)' }}>
          {telemetryCards.map((card, idx) => (
            <Card key={idx} style={{ padding: 'var(--pad-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-faint)' }}>{card.title}</span>
                {card.icon}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {card.stats.map((stat, sIdx) => (
                  <div key={sIdx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stat.label}</span>
                    <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: stat.color }}>{stat.value}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Notebooks Section */}
        <CollapsiblePane title="Managed Notebooks" icon={<BookOpen size={16} />} defaultExpanded={true}>
          <div style={{ margin: '-16px' }}>
            <NotebookList />
          </div>
        </CollapsiblePane>
        
      </div>

      {/* Right Column: Alerts & Advisory */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad-md)', overflowY: 'auto' }}>
        
        <KnowledgeHealthScore />
        <KnowledgeAlerts />

        {/* Next Actions — derived from real state; no fabricated tasks */}
        <CollapsiblePane title="Next Actions" defaultExpanded={true}>
          <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', border: '1px dashed var(--border-color)', borderRadius: '4px' }}>
            {backend.status === 'online'
              ? 'No recommended actions.'
              : backend.status === 'offline'
                ? 'Backend offline — actions unavailable.'
                : 'Awaiting backend connection…'}
          </div>
        </CollapsiblePane>

      </div>
    </div>
  );
}
