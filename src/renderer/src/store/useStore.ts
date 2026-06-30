import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SidecarStatus } from '../../../preload/index';
import { codexLightTheme, type ThemeCustomization, type ThemeCustomizations, type ThemeMode } from '../theme';
import type { RuntimeDiagnostics } from '../types/runtime';

interface UserSettings {
  themeFamily: 'notebook' | 'operator-crimson' | 'cerberus-red' | 'forge-amber' | 'continuity-gold' | 'argos-cyan' | 'field-blue' | 'obsidian';
  themeMode: ThemeMode;
  themeDensity: 'comfortable' | 'dense' | 'operator-dense';
  customThemeEnabled: boolean;
  themeCustomization: Partial<ThemeCustomization>;
  themeCustomizations: ThemeCustomizations;
  motionPreset: 'calm' | 'standard' | 'lively';
  
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

interface WorkerFact {
  status: string;
  reason?: string;
  commands?: string[];
  missing?: string[];
  lastProbeAt?: string | null;
  lastProbeStatus?: string | null;
  lastError?: string | null;
  blockingReason?: string | null;
}

export type BackendStatus = 'unknown' | 'connecting' | 'online' | 'offline';

export interface BackendState {
  status: BackendStatus;
  version: string | null;
  lastChecked: number | null;
}

export interface TelemetryState {
  sourceHealth: { connected: number | 'Unknown'; failed: number | 'Unknown'; pending: number | 'Unknown' };
  knowledgeCoverage: { citationCoverage: string | 'Unknown'; insightCount?: number | 'Unknown'; orphanContent: number | 'Unknown'; unresolvedEntities: number | 'Unknown' };
  retrievalHealth: { latency: string | 'Unknown'; failed: string | 'Unknown'; contextDepth: string | 'Unknown' };
  ingestionHealth: {
    queued: number | 'Unknown';
    parsing: number | 'Unknown';
    failed: number | 'Unknown';
    completed: number | 'Unknown';
    storedSources?: number | 'Unknown';
    sourceWorker?: WorkerFact;
    embeddingWorker?: WorkerFact;
  };
  narrativeIndex: { characters: number | 'Unknown'; locations: number | 'Unknown'; factions: number | 'Unknown'; timelines: number | 'Unknown' };
  studioQueue: { audiobookJobs: number | 'Unknown'; reportJobs: number | 'Unknown'; exportJobs: number | 'Unknown'; podcastWorker?: WorkerFact; voiceWorker?: WorkerFact };
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

  sidecars: SidecarStatus | null;
  setSidecars: (s: SidecarStatus | null) => void;

  diagnostics: RuntimeDiagnostics | null;
  setDiagnostics: (d: RuntimeDiagnostics | null) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
  activeNotebookId: null,
  setActiveNotebookId: (id) => set({ activeNotebookId: id }),

  backend: { status: 'unknown', version: null, lastChecked: null },
  setBackend: (b) => set((state) => ({ backend: { ...state.backend, ...b } })),

  sidecars: null,
  setSidecars: (s) => set({ sidecars: s }),

  diagnostics: null,
  setDiagnostics: (d) => set({ diagnostics: d }),
  
  settings: {
    themeFamily: 'notebook',
    themeMode: 'system',
    themeDensity: 'comfortable',
    customThemeEnabled: false,
    themeCustomization: codexLightTheme,
    themeCustomizations: { light: codexLightTheme },
    motionPreset: 'standard',
    ollamaEndpoint: 'http://localhost:11434',
    defaultLocalModel: '',
    openaiApiKey: '',
    anthropicApiKey: '',
    hyperionNestEnabled: false,
    edgeNodes: [],
    embeddingModel: '',
    defaultEmbeddingModel: '',
    visionModel: '',
    defaultVisionModel: '',
    defaultChatModel: '',
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
    databaseType: 'surrealdb',
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
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as { settings?: Partial<UserSettings> } | undefined;
        if (!state?.settings) return persistedState;
        const settings = state.settings;
        return {
          ...state,
          settings: {
            ...settings,
            themeMode: settings.themeMode || 'system',
            themeCustomizations: settings.themeCustomizations || {
              light: settings.themeCustomization || codexLightTheme
            }
          }
        };
      },
      // Persist only operator settings; runtime state (telemetry/backend) stays ephemeral.
      partialize: (state) => ({ settings: state.settings }),
    }
  )
);
