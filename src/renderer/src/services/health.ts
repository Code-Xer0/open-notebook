import { api } from './api';
import { useStore } from '../store/useStore';
import type { TelemetryState } from '../store/useStore';

// Single source of truth for backend connectivity. Polls the auth-excluded
// root `/health` endpoint; when online, pulls the telemetry summary. When the
// backend is unreachable, the UI shows honest Offline / Unknown state instead
// of stale or fabricated values.

const OFFLINE_TELEMETRY: TelemetryState = {
  sourceHealth: { connected: 'Unknown', failed: 'Unknown', pending: 'Unknown' },
  knowledgeCoverage: { citationCoverage: 'Unknown', orphanContent: 'Unknown', unresolvedEntities: 'Unknown' },
  retrievalHealth: { latency: 'Unknown', failed: 'Unknown', contextDepth: 'Unknown' },
  ingestionHealth: { queued: 'Unknown', parsing: 'Unknown', failed: 'Unknown', completed: 'Unknown' },
  narrativeIndex: { characters: 'Unknown', locations: 'Unknown', factions: 'Unknown', timelines: 'Unknown' },
  studioQueue: { audiobookJobs: 'Unknown', reportJobs: 'Unknown', exportJobs: 'Unknown' },
};

let timer: ReturnType<typeof setInterval> | null = null;

export async function pingBackendOnce(): Promise<void> {
  const { backend, setBackend, setTelemetry, setDiagnostics } = useStore.getState();
  if (backend.status === 'unknown') setBackend({ status: 'connecting' });

  try {
    await api.system.health();

    let version: string | null = null;
    try {
      const diagnostics = await api.diagnostics.status();
      setDiagnostics(diagnostics);
      const v = diagnostics?.version;
      version = (v && typeof v.version === 'string') ? v.version : null;
    } catch {
      setDiagnostics(null);
      /* diagnostics are best-effort; absence does not mean offline */
    }
    setBackend({ status: 'online', version, lastChecked: Date.now() });

    try {
      const summary = await api.diagnostics.telemetrySummary();
      if (summary && typeof summary === 'object') {
        setTelemetry(summary as Partial<TelemetryState>);
      }
    } catch {
      // Online but telemetry unavailable (e.g. auth/locked): keep honest Unknown.
      setTelemetry(OFFLINE_TELEMETRY);
    }
  } catch {
    setBackend({ status: 'offline', version: null, lastChecked: Date.now() });
    setDiagnostics(null);
    setTelemetry(OFFLINE_TELEMETRY);
  }
}

export function startBackendMonitor(intervalMs = 8000): void {
  if (timer) return;
  void pingBackendOnce();
  timer = setInterval(() => void pingBackendOnce(), intervalMs);
}

export function stopBackendMonitor(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
