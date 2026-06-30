import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AudioLines,
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  MessageSquare,
  Plus,
  Quote,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Upload,
  XCircle
} from 'lucide-react';
import { api } from '../../services/api';
import { restartSidecars, refreshSidecarsOnce } from '../../services/sidecars';
import { useStore } from '../../store/useStore';
import type { ManagedSidecarStatus } from '../../../../preload/index';
import { capabilityColor } from '../../components/CapabilityBadge';

type NotebookRecord = {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  notes?: unknown[];
  sources?: unknown[];
};

type SourceRecord = {
  id?: string;
  title?: string;
  name?: string;
  filename?: string;
  type?: string;
  status?: string | null;
};

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

function valueText(value: number | string | 'Unknown'): string {
  return value === 'Unknown' ? 'Unknown' : String(value);
}

function pickName(item: NotebookRecord | SourceRecord, fallback: string): string {
  return item.title || item.name || ('filename' in item ? item.filename : undefined) || fallback;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { backend, telemetry, sidecars, diagnostics } = useStore();
  const [notebooks, setNotebooks] = React.useState<NotebookRecord[]>([]);
  const [sources, setSources] = React.useState<SourceRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [workspaceError, setWorkspaceError] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState('');

  const selectedNotebook = notebooks[0] ?? null;
  const isOnline = backend.status === 'online';
  const port5055 = sidecars?.ports.find((p) => p.port === 5055);
  const selectedNotebookPath = selectedNotebook?.id ? `/chat/${encodeURIComponent(selectedNotebook.id)}` : null;
  const chatReady = diagnostics?.capabilities?.chat?.status === 'ready';
  const migrationsFact = diagnostics?.capabilities?.migrations;
  const credentialsFact = diagnostics?.capabilities?.credentials;

  React.useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      if (!isOnline) {
        setNotebooks([]);
        setSources([]);
        setWorkspaceError(null);
        return;
      }

      setLoading(true);
      try {
        const [notebookData, sourceData] = await Promise.all([
          api.notebooks.list(),
          api.sources.list()
        ]);
        if (cancelled) return;
        setNotebooks(Array.isArray(notebookData) ? notebookData : []);
        setSources(Array.isArray(sourceData) ? sourceData : []);
        setWorkspaceError(null);
      } catch (err: any) {
        if (cancelled) return;
        setWorkspaceError(err?.message || 'Failed to load notebook workspace');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadWorkspace();
    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  const sidecarItems = [
    {
      label: 'SurrealDB',
      value: sidecars?.surreal.message || 'Waiting for sidecar status',
      phase: sidecars?.surreal.phase || 'idle',
      icon: <Database size={15} />
    },
    {
      label: 'Python API',
      value: sidecars?.backend.message || 'Waiting for sidecar status',
      phase: sidecars?.backend.phase || 'idle',
      icon: <Server size={15} />
    },
    {
      label: 'Port 5055',
      value: port5055?.pid
        ? `${port5055.ownedByCodex ? 'Owned' : 'External'} ${port5055.processName || 'process'}:${port5055.pid}`
        : 'No listener',
      phase: port5055?.staleExternal ? 'error' : sidecars?.backend.phase || 'idle',
      icon: <Search size={15} />
    },
    {
      label: 'Migrations',
      value: migrationsFact?.evidence || (isOnline ? 'API reachable; schema not verified yet' : 'Not verified'),
      phase: 'idle',
      status: migrationsFact?.status || 'Not verified',
      color: capabilityColor(migrationsFact?.status),
      icon: <CheckCircle2 size={15} />
    },
    {
      label: 'Providers',
      value: credentialsFact?.blockingReason || credentialsFact?.evidence || 'Provider credential tests not loaded',
      phase: 'idle',
      status: credentialsFact?.status || 'Not verified',
      color: capabilityColor(credentialsFact?.status),
      icon: <ShieldCheck size={15} />
    }
  ] satisfies Array<{ label: string; value: string; phase: ManagedSidecarStatus['phase']; status?: string; color?: string; icon: React.ReactNode }>;

  return (
    <div className="notebook-workspace">
      <section className="workspace-hero">
        <div>
          <div className="workspace-kicker">Local NotebookLM workspace</div>
          <h1>Notebook workspace</h1>
          <p>
            Build a source-grounded notebook, ask against local context, and keep citations visible while CODEX brings the sidecars online underneath.
          </p>
        </div>
        <div className="workspace-actions">
          <button className="btn" onClick={() => navigate('/sources')}>
            <Upload size={15} /> Add sources
          </button>
          <button
            className="btn primary"
            disabled={!selectedNotebookPath || !chatReady}
            onClick={() => selectedNotebookPath && navigate(selectedNotebookPath)}
            title={selectedNotebookPath ? (chatReady ? 'Ask the first recent notebook' : diagnostics?.capabilities?.chat?.blockingReason || 'Chat is not ready yet') : 'Create or open a notebook before asking'}
          >
            <MessageSquare size={15} /> Ask notebook
          </button>
        </div>
      </section>

      <section className="sidecar-strip" aria-label="Sidecar readiness">
        {sidecarItems.map((item) => (
          <div key={item.label} className="sidecar-tile">
            <div className="sidecar-icon" style={{ color: item.color || statusColor[item.phase] }}>
              {item.icon}
            </div>
            <div>
              <span>{item.label}</span>
              <strong style={{ color: item.color || statusColor[item.phase] }}>{item.status || statusLabel[item.phase]}</strong>
              <small title={item.value}>{item.value}</small>
            </div>
          </div>
        ))}
        <button className="btn sidecar-refresh" onClick={() => void refreshSidecarsOnce()} title="Refresh sidecar status">
          <RefreshCw size={14} />
        </button>
      </section>

      <div className="notebook-grid">
        <section className="workspace-panel source-library">
          <div className="panel-heading">
            <div>
              <h2>Sources</h2>
              <p>{isOnline ? 'Live source library from the local backend.' : 'Backend offline - source library unavailable.'}</p>
            </div>
            <button className="btn" onClick={() => navigate('/sources')}>
              <Plus size={14} /> Source
            </button>
          </div>

          <div className="source-table">
            <div className="source-table-head">
              <span>Source</span>
              <span>Type</span>
              <span>Status</span>
            </div>
            {loading && <div className="empty-row">Loading live sources...</div>}
            {!loading && workspaceError && <div className="empty-row error-text">{workspaceError}</div>}
            {!loading && !workspaceError && sources.slice(0, 6).map((source, index) => (
              <button key={source.id || index} className="source-row" onClick={() => navigate('/sources')}>
                <span>
                  <FileText size={15} />
                  {pickName(source, `Source ${index + 1}`)}
                </span>
                <span>{source.type || 'Unknown'}</span>
                <span>{source.status || 'Unknown'}</span>
              </button>
            ))}
            {!loading && !workspaceError && sources.length === 0 && (
              <div className="empty-row">
                {isOnline ? 'No sources imported yet.' : 'Connect the backend to load sources.'}
              </div>
            )}
          </div>
        </section>

        <section className="workspace-panel briefing-panel">
          <div className="panel-heading">
            <div>
              <h2>Briefing</h2>
              <p>Generated summaries stay empty until source-backed context exists.</p>
            </div>
            <Sparkles size={18} color="var(--accent-primary)" />
          </div>
          <div className="briefing-body">
            <div>
              <span>Selected notebook</span>
              <strong>{selectedNotebook ? pickName(selectedNotebook, 'Untitled notebook') : 'No notebook selected'}</strong>
            </div>
            <div>
              <span>Citation coverage</span>
              <strong>{valueText(telemetry.knowledgeCoverage.citationCoverage)}</strong>
            </div>
            <div>
              <span>Retrieval latency</span>
              <strong>{valueText(telemetry.retrievalHealth.latency)}</strong>
            </div>
          </div>
          <div className="briefing-empty">
            <BookOpen size={18} />
            <span>{sources.length > 0 ? 'Briefing generation is waiting for a selected source.' : 'Import sources to generate a grounded briefing.'}</span>
          </div>
        </section>

        <section className="workspace-panel notebook-list-panel">
          <div className="panel-heading">
            <div>
              <h2>Notebooks</h2>
              <p>{isOnline ? 'Recent local notebooks.' : 'Notebook list unavailable while offline.'}</p>
            </div>
            <button className="btn" onClick={() => navigate('/notebooks')}>
              <BookOpen size={14} /> Library
            </button>
          </div>
          <div className="notebook-stack">
            {notebooks.slice(0, 4).map((notebook, index) => (
              <button
                key={notebook.id || index}
                className="notebook-row"
                onClick={() => notebook.id && navigate(`/notebook/${notebook.id}`)}
              >
                <BookOpen size={16} />
                <span>{pickName(notebook, `Notebook ${index + 1}`)}</span>
                <small>{notebook.sources?.length ?? 'Unknown'} sources</small>
              </button>
            ))}
            {notebooks.length === 0 && (
              <div className="empty-row">{isOnline ? 'No notebooks yet.' : 'Connect the backend to load notebooks.'}</div>
            )}
          </div>
        </section>

        <aside className="ask-rail">
          <section className="workspace-panel ask-panel">
            <div className="panel-heading">
              <div>
                <h2>Ask this notebook</h2>
                <p>{selectedNotebook ? pickName(selectedNotebook, 'Notebook') : 'Select or create a notebook first.'}</p>
              </div>
              {isOnline && selectedNotebook ? <CheckCircle2 size={17} color="var(--accent-primary)" /> : <XCircle size={17} color="var(--signal-error)" />}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask a source-grounded question..."
              disabled={!isOnline || !selectedNotebook}
            />
            <button className="btn primary" disabled={!isOnline || !selectedNotebookPath || !prompt.trim() || !chatReady} onClick={() => selectedNotebookPath && navigate(selectedNotebookPath)} title={chatReady ? 'Open grounded chat' : diagnostics?.capabilities?.chat?.blockingReason || 'Chat is blocked until provider setup is verified'}>
              <MessageSquare size={15} /> Open chat
            </button>

            <div className="suggested-prompts">
              <button disabled={!selectedNotebook} onClick={() => setPrompt('Summarize the source set')}>Summarize the source set</button>
              <button disabled={!selectedNotebook} onClick={() => setPrompt('Find contradictions')}>Find contradictions</button>
              <button disabled={!selectedNotebook} onClick={() => setPrompt('List cited claims')}>List cited claims</button>
            </div>
          </section>

          <section className="workspace-panel citation-panel">
            <div className="panel-heading">
              <div>
                <h2>Citations</h2>
                <p>Visible references for grounded answers.</p>
              </div>
              <Quote size={18} color="var(--accent-primary)" />
            </div>
            <div className="citation-empty">
              No cited passages yet. Ask a notebook question after importing sources.
            </div>
          </section>

          <section className="workspace-panel audio-panel">
            <div className="panel-heading">
              <div>
                <h2>Audio records</h2>
                <p>Audio generation stays hidden until a real worker is available.</p>
              </div>
              <AudioLines size={18} color="var(--accent-primary)" />
            </div>
            <div className="audio-status">
              <span>Studio queue</span>
              <strong>{valueText(telemetry.studioQueue.audiobookJobs)}</strong>
            </div>
          </section>

          <button className="btn restart-sidecars" onClick={() => void restartSidecars()}>
            <RefreshCw size={14} /> Restart sidecars
          </button>
        </aside>
      </div>
    </div>
  );
}
