import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface UserSettings {
  themeFamily: 'operator-crimson' | 'cerberus-red' | 'forge-amber' | 'continuity-gold' | 'argos-cyan' | 'field-blue' | 'obsidian';
  themeDensity: 'comfortable' | 'dense' | 'operator-dense';
  
  ollamaEndpoint: string;
  defaultLocalModel: string;
  
  openaiApiKey: string;
  anthropicApiKey: string;
  
  hyperionNestEnabled: boolean;
  edgeNodes: Array<{ id: string; name: string; latency: number; trustLevel: string }>;
  
  embeddingModel: string;
  defaultEmbeddingModel: string;
  visionModel: string;
  defaultVisionModel: string;
  defaultChatModel: string;
  
  storagePath: string;
  
  privacyMode: 'strict' | 'balanced' | 'none';
  redactionEnabled: boolean;
  
  routingRule: 'prefer-local' | 'prefer-cloud' | 'prefer-cheapest';
  
  launchOnStartup: boolean;
  googleApiKey: string;
  edgeNodeRegistry: string;
  edgeHealthChecks: boolean;
  edgeCapabilities: string;
  edgeFallback: string;
  embeddingDimension: number;
  embeddingChunkSize: number;
  visionProvider: string;
  customVisionModel: string;
  ocrEngine: string;
  ocrAutoDetect: boolean;
  ocrImageExtract: boolean;
  databaseType: string;
  telemetryEnabled: boolean;
  routingStrategy: string;
  routingPrivacyStrict: boolean;
  routingOcrCloud: boolean;
  routingLargeContextCloud: boolean;
  logLevel: string;
  debugMode: boolean;
}

interface PodcastJobStatus {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
}

export type BackendStatus = 'unknown' | 'connecting' | 'online' | 'offline';

export interface BackendState {
  status: BackendStatus;
  version: string | null;
  lastChecked: number | null;
}

export interface TelemetryState {
  sourceHealth: { connected: number | 'Unknown'; failed: number | 'Unknown'; pending: number | 'Unknown' };
  knowledgeCoverage: { citationCoverage: string | 'Unknown'; orphanContent: number | 'Unknown'; unresolvedEntities: number | 'Unknown' };
  retrievalHealth: { latency: string | 'Unknown'; failed: string | 'Unknown'; contextDepth: string | 'Unknown' };
  ingestionHealth: { queued: number | 'Unknown'; parsing: number | 'Unknown'; failed: number | 'Unknown'; completed: number | 'Unknown' };
  narrativeIndex: { characters: number | 'Unknown'; locations: number | 'Unknown'; factions: number | 'Unknown'; timelines: number | 'Unknown' };
  studioQueue: { audiobookJobs: number | 'Unknown'; reportJobs: number | 'Unknown'; exportJobs: number | 'Unknown' };
}

interface AppState {
  activeNotebookId: string | null;
  setActiveNotebookId: (id: string | null) => void;
  
  settings: UserSettings;
  updateSettings: (settings: Partial<UserSettings>) => void;
  
  podcastJob: PodcastJobStatus | null;
  setPodcastJob: (job: PodcastJobStatus | null) => void;

  telemetry: TelemetryState;
  setTelemetry: (t: Partial<TelemetryState>) => void;

  backend: BackendState;
  setBackend: (b: Partial<BackendState>) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
  activeNotebookId: null,
  setActiveNotebookId: (id) => set({ activeNotebookId: id }),

  backend: { status: 'unknown', version: null, lastChecked: null },
  setBackend: (b) => set((state) => ({ backend: { ...state.backend, ...b } })),
  
  settings: {
    themeFamily: 'argos-cyan',
    themeDensity: 'comfortable',
    ollamaEndpoint: 'http://localhost:11434',
    defaultLocalModel: '',
    openaiApiKey: '',
    anthropicApiKey: '',
    hyperionNestEnabled: false,
    edgeNodes: [],
    embeddingModel: 'nomic-embed-text',
    defaultEmbeddingModel: 'nomic-embed-text',
    visionModel: 'llava',
    defaultVisionModel: 'llava',
    defaultChatModel: 'llama3',
    storagePath: 'default',
    privacyMode: 'strict',
    redactionEnabled: true,
    routingRule: 'prefer-local',
    launchOnStartup: false,
    googleApiKey: '',
    edgeNodeRegistry: '',
    edgeHealthChecks: true,
    edgeCapabilities: '',
    edgeFallback: '',
    embeddingDimension: 1536,
    embeddingChunkSize: 500,
    visionProvider: 'disabled',
    customVisionModel: '',
    ocrEngine: 'tesseract',
    ocrAutoDetect: true,
    ocrImageExtract: false,
    databaseType: 'sqlite',
    telemetryEnabled: false,
    routingStrategy: 'local',
    routingPrivacyStrict: true,
    routingOcrCloud: false,
    routingLargeContextCloud: false,
    logLevel: 'info',
    debugMode: false,
  },
  updateSettings: (newSettings) => set((state) => ({ 
    settings: { ...state.settings, ...newSettings } 
  })),
  
  podcastJob: null,
  setPodcastJob: (job) => set({ podcastJob: job }),

  telemetry: {
    sourceHealth: { connected: 'Unknown', failed: 'Unknown', pending: 'Unknown' },
    knowledgeCoverage: { citationCoverage: 'Unknown', orphanContent: 'Unknown', unresolvedEntities: 'Unknown' },
    retrievalHealth: { latency: 'Unknown', failed: 'Unknown', contextDepth: 'Unknown' },
    ingestionHealth: { queued: 'Unknown', parsing: 'Unknown', failed: 'Unknown', completed: 'Unknown' },
    narrativeIndex: { characters: 'Unknown', locations: 'Unknown', factions: 'Unknown', timelines: 'Unknown' },
    studioQueue: { audiobookJobs: 'Unknown', reportJobs: 'Unknown', exportJobs: 'Unknown' }
  },
  setTelemetry: (t) => set((state) => ({ telemetry: { ...state.telemetry, ...t } })),
    }),
    {
      name: 'codex-settings',
      storage: createJSONStorage(() => localStorage),
      // Persist only operator settings; runtime state (telemetry/backend) stays ephemeral.
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
