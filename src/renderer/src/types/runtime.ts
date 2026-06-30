export type CapabilityStatus =
  | 'reachable'
  | 'stored'
  | 'queued'
  | 'not verified'
  | 'provider missing'
  | 'worker unavailable'
  | 'mock'
  | 'blocked'
  | 'failed'
  | 'ready'
  | string;

export interface CapabilityFact {
  status: CapabilityStatus;
  evidence: string;
  lastProbeAt?: string | null;
  blockingReason?: string | null;
  lastError?: string | null;
}

export interface RuntimeDependencyFact {
  path?: string | null;
  exists?: boolean;
}

export interface RuntimeDiagnostics {
  health?: string;
  database?: Record<string, unknown>;
  runtimeDependencies?: {
    appVersion?: string;
    resourcesPath?: RuntimeDependencyFact;
    backend?: RuntimeDependencyFact;
    surreal?: RuntimeDependencyFact;
    dataDir?: RuntimeDependencyFact;
    logPath?: RuntimeDependencyFact;
    docker?: {
      required: boolean;
      status: string;
      evidence?: string;
    };
  };
  capabilities?: Record<string, CapabilityFact>;
  workers?: Record<string, CapabilityFact & Record<string, unknown>>;
  version?: Record<string, unknown>;
  evidence?: {
    status?: string;
    evidenceRoot?: string;
    writable?: boolean;
    assetCount?: number | string;
    derivativeCount?: number | string;
    eventCount?: number | string;
    snapshotCount?: number | string;
    latestSnapshot?: {
      id?: string;
      reason?: string;
      manifestSha256?: string;
      restoreSupported?: boolean;
      created?: string;
    } | null;
    lastError?: string | null;
  };
}

export interface CredentialStatus {
  configured?: Record<string, boolean>;
  source?: Record<string, string>;
  present?: Record<string, boolean>;
  tested?: Record<string, boolean>;
  usable?: Record<string, boolean>;
  lastTested?: Record<string, string | null>;
  lastTestSuccess?: Record<string, boolean | null>;
  lastTestMessage?: Record<string, string | null>;
  encryption_configured?: boolean;
}
