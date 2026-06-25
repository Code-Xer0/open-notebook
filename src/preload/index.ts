import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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

// Custom APIs for renderer
const api = {
  windowControls: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close')
  },
  sidecars: {
    getStatus: () => ipcRenderer.invoke('sidecars:get-status'),
    restart: () => ipcRenderer.invoke('sidecars:restart'),
    openLog: () => ipcRenderer.invoke('sidecars:open-log')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
