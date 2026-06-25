import React from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Database,
  EyeOff,
  FileQuestion,
  GitBranch,
  Layers3,
  LockKeyhole,
  MessageSquare,
  Network,
  Palette,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Tags
} from 'lucide-react';
import { refreshSidecarsOnce } from '../../services/sidecars';
import { useStore } from '../../store/useStore';
import type { ManagedSidecarStatus } from '../../../../preload/index';
import {
  conflictCleanupEntries as mockConflictCleanupEntries,
  notebookQueryTests as mockNotebookQueryTests,
  sourcePriorityStack as mockSourcePriorityStack,
  stylePackPrimitives as mockStylePackPrimitives,
  visualDoctrineCards as mockVisualDoctrineCards,
  type CanonStatusTag,
  type SpoilerBoundary
} from './nexusOntologyMock';
import {
  fetchOntologyData,
  type SourcePriorityItem,
  type ConflictCleanupEntry,
  type VisualDoctrineCard,
  type NotebookQueryTest,
  type StylePackPrimitive
} from '../../services/ontology';

const statusLabel: Record<ManagedSidecarStatus['phase'], string> = {
  idle: 'Idle',
  starting: 'Starting',
  online: 'Online',
  offline: 'Offline',
  error: 'Error',
  stopping: 'Stopping'
};

const statusColor: Record<ManagedSidecarStatus['phase'], string> = {
  idle: 'var(--text-muted)',
  starting: 'var(--signal-warning)',
  online: 'var(--accent-primary)',
  offline: 'var(--text-muted)',
  error: 'var(--signal-error)',
  stopping: 'var(--signal-warning)'
};

const doctrineTabs = [
  { id: 'ontology', label: 'Ontology', icon: <Network size={14} /> },
  { id: 'visual', label: 'Visual Locks', icon: <Palette size={14} /> },
  { id: 'queries', label: 'Queries', icon: <FileQuestion size={14} /> },
  { id: 'export', label: 'Export', icon: <ShieldAlert size={14} /> }
] as const;

type DoctrineTab = typeof doctrineTabs[number]['id'];

function tagTone(status: CanonStatusTag): string {
  if (status.includes('HARD')) return 'hard';
  if (status.includes('AUTHOR')) return 'author';
  if (status.includes('HIDDEN')) return 'hidden';
  if (status.includes('FUTURE')) return 'future';
  if (status.includes('DEPRECATED')) return 'deprecated';
  if (status.includes('EXPERIMENTAL')) return 'experimental';
  return 'working';
}

function boundaryTone(boundary: SpoilerBoundary): string {
  if (boundary === 'Hidden truth') return 'hidden';
  if (boundary === 'Future spoiler') return 'future';
  if (boundary === 'Deprecated') return 'deprecated';
  if (boundary === 'Validate later') return 'experimental';
  return 'working';
}

export function NexusManager() {
  const { backend, sidecars } = useStore();

  const [sourcePriorityStack, setSourcePriorityStack] = React.useState<SourcePriorityItem[]>(mockSourcePriorityStack);
  const [conflictCleanupEntries, setConflictCleanupEntries] = React.useState<ConflictCleanupEntry[]>(mockConflictCleanupEntries);
  const [visualDoctrineCards, setVisualDoctrineCards] = React.useState<VisualDoctrineCard[]>(mockVisualDoctrineCards);
  const [notebookQueryTests, setNotebookQueryTests] = React.useState<NotebookQueryTest[]>(mockNotebookQueryTests);
  const [stylePackPrimitives, setStylePackPrimitives] = React.useState<StylePackPrimitive[]>(mockStylePackPrimitives);
  const [ontologyProvenance, setOntologyProvenance] = React.useState({
    mode: 'mock' as 'mock' | 'database' | 'mixed',
    provenance: 'Curated Nexus ontology mock package',
    warnings: ['Using curated mock ontology data until backend rows are available.']
  });

  const [selectedPriorityId, setSelectedPriorityId] = React.useState(mockSourcePriorityStack[0].id);
  const [selectedConflictId, setSelectedConflictId] = React.useState(mockConflictCleanupEntries[0].id);
  const [selectedDoctrineId, setSelectedDoctrineId] = React.useState(mockVisualDoctrineCards[0].id);
  const [activeTab, setActiveTab] = React.useState<DoctrineTab>('visual');

  React.useEffect(() => {
    fetchOntologyData()
      .then((data) => {
        setOntologyProvenance({
          mode: data.mode || 'mock',
          provenance: data.provenance || 'Curated Nexus ontology mock package',
          warnings: data.warnings || []
        });
        if (data.sourcePriorityStack?.length > 0) {
          setSourcePriorityStack(data.sourcePriorityStack);
          setSelectedPriorityId(data.sourcePriorityStack[0].id);
        }
        if (data.conflictCleanupEntries?.length > 0) {
          setConflictCleanupEntries(data.conflictCleanupEntries);
          setSelectedConflictId(data.conflictCleanupEntries[0].id);
        }
        if (data.visualDoctrineCards?.length > 0) {
          setVisualDoctrineCards(data.visualDoctrineCards);
          setSelectedDoctrineId(data.visualDoctrineCards[0].id);
        }
        if (data.notebookQueryTests?.length > 0) {
          setNotebookQueryTests(data.notebookQueryTests);
        }
        if (data.stylePackPrimitives?.length > 0) {
          setStylePackPrimitives(data.stylePackPrimitives);
        }
      })
      .catch(console.error);
  }, []);

  const selectedPriority = sourcePriorityStack.find((item) => item.id === selectedPriorityId) ?? sourcePriorityStack[0];
  const selectedConflict = conflictCleanupEntries.find((entry) => entry.id === selectedConflictId) ?? conflictCleanupEntries[0];
  const selectedDoctrine = visualDoctrineCards.find((card) => card.id === selectedDoctrineId) ?? visualDoctrineCards[0];
  const port5055 = sidecars?.ports.find((port) => port.port === 5055);
  const idlePhase: ManagedSidecarStatus['phase'] = 'idle';

  const sidecarItems = [
    {
      label: 'SurrealDB',
      value: sidecars?.surreal.message || 'Waiting for sidecar status',
      phase: sidecars?.surreal.phase || idlePhase,
      icon: <Database size={15} />
    },
    {
      label: 'Python API',
      value: sidecars?.backend.message || 'Waiting for sidecar status',
      phase: sidecars?.backend.phase || idlePhase,
      icon: <Server size={15} />
    },
    {
      label: 'Port 5055',
      value: port5055?.pid ? `${port5055.ownedByCodex ? 'Owned' : 'External'} ${port5055.processName || 'process'}:${port5055.pid}` : 'No listener reported',
      phase: port5055?.staleExternal ? 'error' : port5055?.pid ? sidecars?.backend.phase || idlePhase : idlePhase,
      icon: <Search size={15} />
    },
    {
      label: 'Migrations',
      value: backend.status === 'online' ? 'API reachable; use Diagnostics for schema detail' : 'Not verified',
      phase: idlePhase,
      icon: <CheckCircle2 size={15} />
    },
    {
      label: 'Auth',
      value: 'Local mode; no remote auth claim',
      phase: idlePhase,
      icon: <ShieldCheck size={15} />
    }
  ] satisfies Array<{ label: string; value: string; phase: ManagedSidecarStatus['phase']; icon: React.ReactNode }>;

  return (
    <div className="nexus-studio notebook-workspace">
      <section className="workspace-hero nexus-hero">
        <div>
          <div className="workspace-kicker">Nexus v0.4 source-of-truth workspace</div>
          <h1>Nexus Ontology Studio</h1>
          <p>
            Govern canon priority, hard locks, conflict cleanup, spoiler boundaries, and visual doctrine before source-grounded
            briefings or export drafts leave the notebook.
          </p>
        </div>
        <div className="workspace-actions">
          <span className={`status-chip ${ontologyProvenance.mode === 'database' ? 'working' : 'experimental'}`} title={ontologyProvenance.warnings.join(' ') || ontologyProvenance.provenance}>
            {ontologyProvenance.mode === 'database' ? 'Database ontology' : 'Mock ontology'}
          </span>
          <button className="btn" onClick={() => setActiveTab('queries')}>
            <FileQuestion size={15} /> Review query prompts
          </button>
        </div>
      </section>

      <section className="sidecar-strip nexus-sidecar-strip" aria-label="Sidecar readiness">
        {sidecarItems.map((item) => (
          <div key={item.label} className="sidecar-tile">
            <div className="sidecar-icon" style={{ color: statusColor[item.phase] }}>
              {item.icon}
            </div>
            <div>
              <span>{item.label}</span>
              <strong style={{ color: statusColor[item.phase] }}>{statusLabel[item.phase]}</strong>
              <small title={item.value}>{item.value}</small>
            </div>
          </div>
        ))}
        <button className="btn sidecar-refresh" onClick={() => void refreshSidecarsOnce()} title="Refresh sidecar status">
          <RefreshCw size={14} />
        </button>
      </section>

      <div className="nexus-studio-grid">
        <section className="workspace-panel nexus-panel priority-stack-panel">
          <div className="panel-heading">
            <div>
              <h2>Canon Priority Stack</h2>
              <p>Highest-priority package rules guard every older draft and generated note.</p>
            </div>
            <LockKeyhole size={17} />
          </div>

          <div className="priority-stack" role="list">
            {sourcePriorityStack.map((item, index) => (
              <button
                key={item.id}
                className={`priority-row ${item.id === selectedPriority.id ? 'selected' : ''}`}
                onClick={() => setSelectedPriorityId(item.id)}
              >
                <span className="priority-index">{index + 1}</span>
                <span className="priority-copy">
                  <strong>{item.level}</strong>
                  <small>{item.title}</small>
                </span>
                <span className={`status-chip ${tagTone(item.status)}`}>{item.status}</span>
              </button>
            ))}
          </div>

          <div className="priority-caution">
            <AlertTriangle size={15} />
            <span>Deprecated or experimental notes cannot override selected hard locks.</span>
          </div>

          <div className="priority-detail">
            <span className="citation-chip">{selectedPriority.citation}</span>
            <p>{selectedPriority.detail}</p>
          </div>
        </section>

        <section className="workspace-panel nexus-panel cleanup-board-panel">
          <div className="panel-heading">
            <div>
              <h2>Conflict Cleanup Board</h2>
              <p>Risky drift is paired with the current lock before it can enter generated output.</p>
            </div>
            <GitBranch size={17} />
          </div>

          <div className="cleanup-table" role="table" aria-label="Nexus conflict cleanup">
            <div className="cleanup-head" role="row">
              <span>Risky drift</span>
              <span>Correct lock</span>
              <span>Boundary</span>
            </div>
            {conflictCleanupEntries.map((entry) => (
              <button
                key={entry.id}
                className={`cleanup-row ${entry.id === selectedConflict.id ? 'selected' : ''}`}
                onClick={() => setSelectedConflictId(entry.id)}
                role="row"
              >
                <span className="cleanup-drift">{entry.drift}</span>
                <span className="cleanup-lock">{entry.lock}</span>
                <span className="cleanup-tags">
                  <span className={`status-chip ${tagTone(entry.status)}`}>{entry.status}</span>
                  <span className={`boundary-chip ${boundaryTone(entry.boundary)}`}>{entry.boundary}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="workspace-panel nexus-panel visual-doctrine-panel">
          <div className="panel-heading">
            <div>
              <h2>Visual Doctrine Canvas</h2>
              <p>Production style remains grounded in canon, not prompt drift.</p>
            </div>
            <SlidersHorizontal size={17} />
          </div>

          <div className="doctrine-tabs" role="tablist" aria-label="Nexus ontology modes">
            {doctrineTabs.map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? 'selected' : ''}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'visual' && (
            <div className="visual-doctrine-body">
              <div className="doctrine-card-list">
                {visualDoctrineCards.map((card) => (
                  <button
                    key={card.id}
                    className={`doctrine-card ${card.id === selectedDoctrine.id ? 'selected' : ''}`}
                    onClick={() => setSelectedDoctrineId(card.id)}
                  >
                    <span className={`status-chip ${tagTone(card.status)}`}>{card.status}</span>
                    <strong>{card.title}</strong>
                    <small>{card.tokens.join(' / ')}</small>
                  </button>
                ))}
              </div>

              <div className="doctrine-preview">
                <div className="doctrine-preview-header">
                  <div>
                    <span className={`status-chip ${tagTone(selectedDoctrine.status)}`}>{selectedDoctrine.status}</span>
                    <h3>{selectedDoctrine.title}</h3>
                  </div>
                  <Palette size={18} />
                </div>
                <p>{selectedDoctrine.summary}</p>
                <div className="swatch-row" aria-label="Doctrine swatches">
                  {selectedDoctrine.swatches.map((swatch) => (
                    <span key={swatch} style={{ background: swatch }} title={swatch} />
                  ))}
                </div>
                <div className="token-grid">
                  {selectedDoctrine.tokens.map((token) => (
                    <span key={token}>
                      <Tags size={13} />
                      {token}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ontology' && (
            <div className="ontology-inspector">
              <span className={`status-chip ${tagTone(selectedConflict.status)}`}>{selectedConflict.status}</span>
              <h3>{selectedConflict.lock}</h3>
              <p>{selectedConflict.drift}</p>
              <div className="citation-row">
                {selectedConflict.citations.map((citation) => (
                  <span key={citation} className="citation-chip">{citation}</span>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'queries' && (
            <div className="query-test-list compact">
              {notebookQueryTests.map((test) => (
                <button key={test.id} onClick={() => setActiveTab('queries')}>
                  <FileQuestion size={14} />
                  <span>{test.query}</span>
                  <strong>{ontologyProvenance.mode === 'database' ? test.readiness : 'Mock prompt'}</strong>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'export' && (
            <div className="export-safety-list">
              <div><ShieldAlert size={15} /> Attribution required before public reuse.</div>
              <div><EyeOff size={15} /> Hidden truth and future spoiler blocks stay fenced.</div>
              <div><BookOpenCheck size={15} /> BBCode/CSS output remains a draft until source review.</div>
            </div>
          )}
        </section>

        <aside className="workspace-panel nexus-panel nexus-ask-rail">
          <div className="panel-heading">
            <div>
              <h2>Ask this notebook</h2>
              <p>{ontologyProvenance.mode === 'database' ? 'Database-backed answer preview.' : 'Curated mock preview; not a live query result.'}</p>
            </div>
            <MessageSquare size={17} />
          </div>

          <div className="ask-question">
            Preview question: What is the Cain/Oberon correction?
          </div>

          <div className="grounded-answer">
            <span className={`status-chip ${tagTone(selectedConflict.status)}`}>{selectedConflict.status}</span>
            <p>
              Cain and Oberon must stay visually firewalled in the curated Nexus package. The bald breach-coded hammer
              figure is Oberon; Cain is the silver-haired gravity/stabilization command figure.
            </p>
            <div className="citation-row">
              {selectedConflict.citations.map((citation) => (
                <span key={citation} className="citation-chip">{citation}</span>
              ))}
            </div>
          </div>

          <div className="unresolved-box">
            <BrainCircuit size={16} />
            <div>
              <strong>Unresolved questions</strong>
              <span>Confirm exact faction-archangel mapping for Insomnia and Ariel before export.</span>
            </div>
          </div>

          <div className="grounded-checklist">
            <div><LockKeyhole size={14} /> Hard-lock source review required</div>
            <div><EyeOff size={14} /> Hidden-truth boundary visible</div>
            <div><AlertTriangle size={14} /> Deprecated phrasing flagged</div>
          </div>

          <div className="ask-actions">
            <span className="status-chip experimental">
              <ShieldAlert size={14} /> Generation and export hidden until live source checks exist.
            </span>
          </div>
        </aside>

        <section className="workspace-panel nexus-panel query-tests-panel">
          <div className="panel-heading compact-heading">
            <div>
              <h2>NotebookLM Query Tests</h2>
              <p>Validation prompts are queued for source checks, not pre-marked as passing.</p>
            </div>
            <FileQuestion size={17} />
          </div>
          <div className="query-chip-row">
            {notebookQueryTests.map((test) => (
              <button key={test.id} onClick={() => setActiveTab('queries')}>
                <span>{test.query}</span>
                <strong>{ontologyProvenance.mode === 'database' ? test.readiness : 'Mock prompt'}</strong>
                <small>{test.citation}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="workspace-panel nexus-panel stylepack-tray-panel">
          <div className="panel-heading compact-heading">
            <div>
              <h2>StylePack / Prefab Tray</h2>
              <p>Visual primitives stay secondary to ontology truth.</p>
            </div>
            <Layers3 size={17} />
          </div>
          <div className="stylepack-tray">
            {stylePackPrimitives.map((primitive) => (
              <button key={primitive.id} onClick={() => setActiveTab('visual')}>
                <span className={`primitive-icon ${tagTone(primitive.status)}`}>
                  <ChevronRight size={13} />
                </span>
                <strong>{primitive.title}</strong>
                <small>{primitive.role}</small>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
