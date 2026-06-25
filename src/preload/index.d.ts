import { ElectronAPI } from '@electron-toolkit/preload'

export type SidecarPhase = 'idle' | 'starting' | 'online' | 'offline' | 'error' | 'stopping'

export interface ManagedSidecarStatus {
  phase: SidecarPhase
  pid: number | null
  path: string
  port: number
  message: string
  startedAt: number | null
  readyAt: number | null
  exitCode: number | null
}

export interface PortOwnerStatus {
  port: number
  pid: number | null
  processName: string | null
  path: string | null
  ownedByCodex: boolean
  staleExternal: boolean
  state: string | null
}

export interface SidecarStatus {
  mode: 'dev' | 'packaged'
  appVersion: string
  dataDir: string
  logPath: string
  statePath: string
  auth: 'local-token'
  lastError: string | null
  updatedAt: number
  resources: {
    surrealExists: boolean
    backendExists: boolean
    surrealPath: string
    backendPath: string
    previousPids: number[]
  }
  watchdog: {
    restartPending: boolean
    lastRestartReason: string | null
  }
  surreal: ManagedSidecarStatus
  backend: ManagedSidecarStatus
  ports: PortOwnerStatus[]
}

export interface CodexPreloadApi {
  windowControls: {
    minimize: () => void
    maximize: () => void
    close: () => void
  }
  sidecars: {
    getStatus: () => Promise<SidecarStatus>
    restart: () => Promise<SidecarStatus>
    openLog: () => Promise<string>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CodexPreloadApi
  }
}
