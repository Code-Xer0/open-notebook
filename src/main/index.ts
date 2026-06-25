import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join, normalize } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, execFile, ChildProcess } from 'child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream, WriteStream } from 'fs'
import { randomBytes } from 'crypto'
import { connect } from 'net'
import { promisify } from 'util'

let surrealProcess: ChildProcess | null = null
let pythonProcess: ChildProcess | null = null
let logStream: WriteStream | null = null
let sidecarDataDir = ''
let sidecarLogPath = ''
let sidecarStatePath = ''
let sidecarMode: 'dev' | 'packaged' = 'dev'
let sidecarStarting = false
let isQuitting = false
let manualSidecarStop = false
let watchdogRestartPending = false
let lastWatchdogRestartReason: string | null = null
let lastSidecarError: string | null = null

const execFileAsync = promisify(execFile)

type SidecarPhase = 'idle' | 'starting' | 'online' | 'offline' | 'error' | 'stopping'

interface ManagedSidecarStatus {
  phase: SidecarPhase
  pid: number | null
  path: string
  port: number
  message: string
  startedAt: number | null
  readyAt: number | null
  exitCode: number | null
}

interface PortOwnerStatus {
  port: number
  pid: number | null
  processName: string | null
  path: string | null
  ownedByCodex: boolean
  staleExternal: boolean
  state: string | null
}

interface SidecarStatus {
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

const sidecarStatusBase = (port: number): ManagedSidecarStatus => ({
  phase: 'idle',
  pid: null,
  path: '',
  port,
  message: 'Not started',
  startedAt: null,
  readyAt: null,
  exitCode: null
})

let surrealStatus: ManagedSidecarStatus = sidecarStatusBase(8000)
let backendStatus: ManagedSidecarStatus = sidecarStatusBase(5055)

function logSidecar(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}\n`
  try {
    logStream?.write(line)
  } catch {
    /* ignore logging failures */
  }
}

function logStartup(message: string): void {
  try {
    const logPath = sidecarLogPath || join(app.getPath('userData'), 'backend.log')
    appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, 'utf-8')
  } catch {
    /* ignore startup logging failures */
  }
}

function waitForPort(port: number, host = '127.0.0.1', timeoutMs = 25000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    const attempt = (): void => {
      const sock = connect(port, host)
      sock.once('connect', () => { sock.destroy(); resolve(true) })
      sock.once('error', () => {
        sock.destroy()
        if (Date.now() > deadline) resolve(false)
        else setTimeout(attempt, 400)
      })
    }
    attempt()
  })
}

function getEncryptionKey(dataDir: string): string {
  const keyPath = join(dataDir, 'encryption.key')
  try {
    if (existsSync(keyPath)) return readFileSync(keyPath, 'utf-8').trim()
    const key = randomBytes(32).toString('hex')
    writeFileSync(keyPath, key, 'utf-8')
    return key
  } catch {
    return 'codex-local-fallback-encryption-key'
  }
}

function normalizeForCompare(value: string | null | undefined): string {
  return value ? normalize(value).toLowerCase() : ''
}

function pathEquals(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeForCompare(left)
  const b = normalizeForCompare(right)
  return Boolean(a && b && a === b)
}

function isPortOwnerKnown(port: PortOwnerStatus): boolean {
  if (!port.pid) return false
  if (port.pid === surrealProcess?.pid || port.pid === pythonProcess?.pid) return true
  if (port.port === 8000 && pathEquals(port.path, surrealStatus.path)) return true
  if (port.port === 5055 && pathEquals(port.path, backendStatus.path)) return true
  if (sidecarMode === 'dev' && port.port === 5055) {
    const ownerPath = normalizeForCompare(port.path)
    const backendRoot = normalizeForCompare(join(app.getAppPath(), 'backend'))
    return Boolean(ownerPath && backendRoot && ownerPath.startsWith(backendRoot))
  }
  return false
}

function markPortOwnership(port: PortOwnerStatus): PortOwnerStatus {
  const ownedByCodex = isPortOwnerKnown(port)
  return {
    ...port,
    ownedByCodex,
    staleExternal: Boolean(port.pid && !ownedByCodex)
  }
}

function readPreviousPids(): number[] {
  try {
    if (!sidecarStatePath || !existsSync(sidecarStatePath)) return []
    const raw = JSON.parse(readFileSync(sidecarStatePath, 'utf-8')) as { pids?: number[] }
    return Array.isArray(raw.pids) ? raw.pids.filter((pid) => Number.isInteger(pid)) : []
  } catch {
    return []
  }
}

function writeSidecarState(): void {
  try {
    if (!sidecarStatePath) return
    const pids = [surrealProcess?.pid, pythonProcess?.pid].filter((pid): pid is number => typeof pid === 'number')
    writeFileSync(sidecarStatePath, JSON.stringify({ pids, updatedAt: Date.now() }, null, 2), 'utf-8')
  } catch {
    /* ignore state persistence failures */
  }
}

function scheduleSidecarRestart(reason: string): void {
  if (isQuitting || manualSidecarStop || watchdogRestartPending) return
  watchdogRestartPending = true
  lastWatchdogRestartReason = reason
  lastSidecarError = reason
  logSidecar(`Watchdog restart scheduled: ${reason}`)
  const timer = setTimeout(async () => {
    try {
      await stopBackendProcesses()
      await startBackendProcesses()
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error)
      lastSidecarError = message
      logSidecar(`Watchdog restart failed: ${message}`)
    } finally {
      watchdogRestartPending = false
    }
  }, 1500)
  timer.unref?.()
}

async function killChildTree(child: ChildProcess | null): Promise<void> {
  if (!child?.pid) return
  if (process.platform === 'win32') {
    try {
      await execFileAsync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true })
    } catch (error) {
      logSidecar(`taskkill failed for ${child.pid}: ${error instanceof Error ? error.message : String(error)}`)
    }
    return
  }
  child.kill()
}

async function getPortOwner(port: number): Promise<PortOwnerStatus> {
  const fallback: PortOwnerStatus = {
    port,
    pid: null,
    processName: null,
    path: null,
    ownedByCodex: false,
    staleExternal: false,
    state: null
  }

  if (process.platform !== 'win32') return fallback

  try {
    const ps = [
      `$c = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1;`,
      'if ($c) {',
      '  $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue;',
      '  [pscustomobject]@{',
      '    pid = $c.OwningProcess;',
      '    processName = if ($p) { $p.ProcessName } else { $null };',
      '    path = if ($p) { $p.Path } else { $null };',
      '    state = $c.State',
      '  } | ConvertTo-Json -Compress',
      '}'
    ].join(' ')
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps], { windowsHide: true })
    const trimmed = stdout.trim()
    if (!trimmed) return fallback
    const parsed = JSON.parse(trimmed) as { pid?: number; processName?: string; path?: string; state?: string }
    const pid = typeof parsed.pid === 'number' ? parsed.pid : null
    return {
      port,
      pid,
      processName: parsed.processName || null,
      path: parsed.path || null,
      ownedByCodex: false,
      staleExternal: false,
      state: parsed.state || null
    }
  } catch {
    return fallback
  }
}

async function waitForOwnedPort(port: number, timeoutMs = 25000): Promise<{ ready: boolean; owner: PortOwnerStatus }> {
  if (process.platform !== 'win32') {
    const ready = await waitForPort(port, '127.0.0.1', timeoutMs)
    return { ready, owner: markPortOwnership(await getPortOwner(port)) }
  }

  const deadline = Date.now() + timeoutMs
  let owner = markPortOwnership(await getPortOwner(port))
  while (Date.now() <= deadline) {
    owner = markPortOwnership(await getPortOwner(port))
    if (owner.pid && owner.ownedByCodex) return { ready: true, owner }
    if (owner.pid && owner.staleExternal) return { ready: false, owner }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  owner = markPortOwnership(await getPortOwner(port))
  if (owner.pid && owner.ownedByCodex && (await waitForPort(port, '127.0.0.1', 1000))) {
    return { ready: true, owner }
  }
  return { ready: false, owner }
}

async function waitForPortFree(port: number, timeoutMs = 15000): Promise<boolean> {
  if (process.platform !== 'win32') {
    const busy = await waitForPort(port, '127.0.0.1', 500)
    return !busy
  }

  const deadline = Date.now() + timeoutMs
  while (Date.now() <= deadline) {
    const owner = markPortOwnership(await getPortOwner(port))
    if (!owner.pid) return true
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return false
}

async function getSidecarStatus(): Promise<SidecarStatus> {
  const ports = (await Promise.all([getPortOwner(8000), getPortOwner(5055)])).map(markPortOwnership)
  return {
    mode: sidecarMode,
    appVersion: app.getVersion(),
    dataDir: sidecarDataDir,
    logPath: sidecarLogPath,
    statePath: sidecarStatePath,
    auth: 'local-token',
    lastError: lastSidecarError,
    updatedAt: Date.now(),
    resources: {
      surrealExists: Boolean(surrealStatus.path && existsSync(surrealStatus.path)),
      backendExists: Boolean(backendStatus.path && existsSync(backendStatus.path)),
      surrealPath: surrealStatus.path,
      backendPath: backendStatus.path,
      previousPids: readPreviousPids()
    },
    watchdog: {
      restartPending: watchdogRestartPending,
      lastRestartReason: lastWatchdogRestartReason
    },
    surreal: surrealStatus,
    backend: backendStatus,
    ports
  }
}

async function startBackendProcesses(): Promise<void> {
  logStartup('Sidecar supervisor invoked')
  if (sidecarStarting) return
  if (surrealProcess || pythonProcess) return
  sidecarStarting = true
  lastSidecarError = null

  const isDev = !app.isPackaged
  sidecarMode = isDev ? 'dev' : 'packaged'
  const appPath = isDev ? app.getAppPath() : process.resourcesPath

  // Writable data dir: the install resourcesPath is read-only under Program Files,
  // and the backend's config.py does os.makedirs("./data") at import time.
  const dataDir = join(app.getPath('userData'), 'data')
  sidecarDataDir = dataDir
  mkdirSync(dataDir, { recursive: true })
  sidecarLogPath = join(app.getPath('userData'), 'backend.log')
  sidecarStatePath = join(app.getPath('userData'), 'sidecars.json')
  logStream?.end()
  logStream = createWriteStream(sidecarLogPath, { flags: 'a' })
  logSidecar(`Starting sidecars (${sidecarMode})`)

  // 1) SurrealDB (default bind 127.0.0.1:8000); DB file inside the writable dir.
  const surrealPath = isDev
    ? join(appPath, 'resources', 'bin', 'surreal.exe')
    : join(process.resourcesPath, 'bin', 'surreal.exe')
  surrealStatus = {
    ...sidecarStatusBase(8000),
    phase: 'starting',
    path: surrealPath,
    message: 'Launching SurrealDB',
    startedAt: Date.now()
  }
  if (!existsSync(surrealPath)) {
    surrealStatus = { ...surrealStatus, phase: 'error', message: `Missing SurrealDB binary: ${surrealPath}` }
    lastSidecarError = surrealStatus.message
    logSidecar(lastSidecarError)
    sidecarStarting = false
    return
  }

  const existingSurrealOwner = markPortOwnership(await getPortOwner(8000))
  if (existingSurrealOwner.pid) {
    surrealStatus = {
      ...surrealStatus,
      phase: 'error',
      message: `Port 8000 already owned by ${existingSurrealOwner.processName || 'process'}:${existingSurrealOwner.pid}`
    }
    lastSidecarError = `${surrealStatus.message}${existingSurrealOwner.path ? ` at ${existingSurrealOwner.path}` : ''}`
    logSidecar(lastSidecarError)
    sidecarStarting = false
    return
  }

  const surrealArgs = [
    'start',
    '--no-banner',
    '--bind',
    '127.0.0.1:8000',
    '--transaction-timeout',
    '300s',
    '--user',
    'root',
    '--pass',
    'root',
    'surrealkv://surreal.db'
  ]
  surrealProcess = spawn(surrealPath, surrealArgs, {
    cwd: dataDir,
    windowsHide: true
  })
  surrealStatus.pid = surrealProcess.pid ?? null
  writeSidecarState()
  surrealProcess.stdout?.on('data', (d) => logSidecar(`SurrealDB: ${d}`))
  surrealProcess.stderr?.on('data', (d) => logSidecar(`SurrealDB ERR: ${d}`))
  surrealProcess.on('exit', (code) => {
    surrealProcess = null
    surrealStatus = {
      ...surrealStatus,
      phase: isQuitting ? 'stopping' : 'offline',
      exitCode: code,
      message: `SurrealDB exited: ${code ?? 'unknown'}`
    }
    if (!isQuitting) logSidecar(`${surrealStatus.message}`)
    scheduleSidecarRestart(surrealStatus.message)
  })

  // 2) Wait for SurrealDB to accept connections before the API (race fix).
  const surrealReady = await waitForOwnedPort(8000, 90000)
  const ready = surrealReady.ready
  surrealStatus = {
    ...surrealStatus,
    phase: ready ? 'online' : 'error',
    readyAt: ready ? Date.now() : null,
    message: ready
      ? 'SurrealDB is listening on 127.0.0.1:8000'
      : surrealReady.owner.pid
        ? `Port 8000 is owned by ${surrealReady.owner.processName || 'external process'}:${surrealReady.owner.pid}`
        : 'SurrealDB did not open port 8000'
  }
  logSidecar(
    `SurrealDB ready on :8000 = ${ready}; owner=${surrealReady.owner.processName || 'none'}:${surrealReady.owner.pid || 'none'}; path=${surrealReady.owner.path || 'none'}`
  )
  if (!ready) {
    lastSidecarError = surrealStatus.message
    sidecarStarting = false
    return
  }

  // 3) Backend env: namespace/database are REQUIRED by repository.db.use(); reload

  //    must be off for the frozen exe; data dir must be writable.
  const backendEnv = {
    ...process.env,
    API_HOST: '127.0.0.1',
    API_PORT: '5055',
    API_RELOAD: 'false',
    SURREAL_URL: 'ws://127.0.0.1:8000/rpc',
    SURREAL_USER: 'root',
    SURREAL_PASS: 'root',
    SURREAL_NAMESPACE: 'open_notebook',
    SURREAL_DATABASE: 'production',
    CODEX_APP_VERSION: app.getVersion(),
    OPEN_NOTEBOOK_ENCRYPTION_KEY: getEncryptionKey(dataDir),
    OPEN_NOTEBOOK_PASSWORD: 'open-notebook-change-me',
  }

  if (isDev) {
    const backendPath = join(appPath, 'backend')
    const envPath = process.env.PATH ? `${process.env.PATH};C:\\Users\\Inf3r\\.local\\bin` : `C:\\Users\\Inf3r\\.local\\bin`
    backendStatus = {
      ...sidecarStatusBase(5055),
      phase: 'starting',
      path: join(backendPath, 'run_api.py'),
      message: 'Launching Python API through uv',
      startedAt: Date.now()
    }
    const existingBackendOwner = markPortOwnership(await getPortOwner(5055))
    if (existingBackendOwner.pid) {
      backendStatus = {
        ...backendStatus,
        phase: 'error',
        message: `Port 5055 already owned by ${existingBackendOwner.processName || 'process'}:${existingBackendOwner.pid}`
      }
      lastSidecarError = `${backendStatus.message}${existingBackendOwner.path ? ` at ${existingBackendOwner.path}` : ''}`
      logSidecar(lastSidecarError)
      sidecarStarting = false
      return
    }
    pythonProcess = spawn('uv', ['run', 'python', 'run_api.py'], {
      cwd: backendPath,
      env: { ...backendEnv, PATH: envPath },
      shell: true,
      windowsHide: true
    })
  } else {
    const backendExePath = join(process.resourcesPath, 'backend.exe')
    backendStatus = {
      ...sidecarStatusBase(5055),
      phase: 'starting',
      path: backendExePath,
      message: 'Launching packaged Python API',
      startedAt: Date.now()
    }
    if (!existsSync(backendExePath)) {
      backendStatus = { ...backendStatus, phase: 'error', message: `Missing backend binary: ${backendExePath}` }
      lastSidecarError = backendStatus.message
      logSidecar(lastSidecarError)
      sidecarStarting = false
      return
    }
    const existingBackendOwner = markPortOwnership(await getPortOwner(5055))
    if (existingBackendOwner.pid) {
      backendStatus = {
        ...backendStatus,
        phase: 'error',
        message: `Port 5055 already owned by ${existingBackendOwner.processName || 'process'}:${existingBackendOwner.pid}`
      }
      lastSidecarError = `${backendStatus.message}${existingBackendOwner.path ? ` at ${existingBackendOwner.path}` : ''}`
      logSidecar(lastSidecarError)
      sidecarStarting = false
      return
    }
    pythonProcess = spawn(backendExePath, [], { cwd: dataDir, env: backendEnv, windowsHide: true })
  }
  backendStatus.pid = pythonProcess.pid ?? null
  writeSidecarState()
  pythonProcess.stdout?.on('data', (d) => logSidecar(`Python: ${d}`))
  pythonProcess.stderr?.on('data', (d) => logSidecar(`Python ERR: ${d}`))
  pythonProcess.on('exit', (code) => {
    pythonProcess = null
    backendStatus = {
      ...backendStatus,
      phase: isQuitting ? 'stopping' : 'offline',
      exitCode: code,
      message: `Python API exited: ${code ?? 'unknown'}`
    }
    if (!isQuitting) logSidecar(`${backendStatus.message}`)
    scheduleSidecarRestart(backendStatus.message)
  })

  const backendPortReady = await waitForOwnedPort(5055, 360000)
  const backendReady = backendPortReady.ready
  backendStatus = {
    ...backendStatus,
    phase: backendReady ? 'online' : 'error',
    readyAt: backendReady ? Date.now() : null,
    message: backendReady
      ? 'Python API is listening on 127.0.0.1:5055'
      : backendPortReady.owner.pid
        ? `Port 5055 is owned by ${backendPortReady.owner.processName || 'external process'}:${backendPortReady.owner.pid}`
        : 'Python API did not open port 5055'
  }
  logSidecar(`Python API ready on :5055 = ${backendReady}`)
  if (!backendReady) lastSidecarError = backendStatus.message
  sidecarStarting = false
}

async function stopBackendProcesses() {
  manualSidecarStop = true
  const stoppedPorts: number[] = []
  if (pythonProcess) {
    backendStatus = { ...backendStatus, phase: 'stopping', message: 'Stopping Python API' }
    stoppedPorts.push(5055)
    await killChildTree(pythonProcess)
    pythonProcess = null
  }
  if (surrealProcess) {
    surrealStatus = { ...surrealStatus, phase: 'stopping', message: 'Stopping SurrealDB' }
    stoppedPorts.push(8000)
    await killChildTree(surrealProcess)
    surrealProcess = null
  }
  await Promise.all(stoppedPorts.map((port) => waitForPortFree(port)))
  manualSidecarStop = false
  writeSidecarState()
}

async function restartBackendProcesses(): Promise<SidecarStatus> {
  logSidecar('Restart requested')
  await stopBackendProcesses()
  await startBackendProcesses()
  return getSidecarStatus()
}

function registerSidecarIpc(): void {
  ipcMain.handle('sidecars:get-status', () => getSidecarStatus())
  ipcMain.handle('sidecars:restart', () => restartBackendProcesses())
  ipcMain.handle('sidecars:open-log', async () => {
    if (!sidecarLogPath) return 'No sidecar log has been created yet.'
    if (!existsSync(sidecarLogPath)) return `Sidecar log not found: ${sidecarLogPath}`
    return shell.openPath(sidecarLogPath)
  })
}

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const logStr = `CONSOLE [level ${level}]: ${message} (line ${line} in ${sourceId})\n`;
    appendFileSync(join(app.getPath('userData'), 'renderer.log'), logStr, 'utf-8');
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    const logStr = `PAGE LOAD FAILED: ${errorDescription} (${errorCode}) at ${validatedURL}\n`;
    appendFileSync(join(app.getPath('userData'), 'renderer.log'), logStr, 'utf-8');
  });

  mainWindow.webContents.on('crashed', (_event, killed) => {
    const logStr = `RENDERER CRASHED! Killed: ${killed}\n`;
    appendFileSync(join(app.getPath('userData'), 'renderer.log'), logStr, 'utf-8');
  });

  // Register window control handlers
  ipcMain.on('window-minimize', () => mainWindow.minimize())
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow.maximize()
    }
  })
  ipcMain.on('window-close', () => mainWindow.close())
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  logStartup('Electron main ready')
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  registerSidecarIpc()
  
  createWindow()

  startBackendProcesses().catch((e) => {
    const message = e instanceof Error ? e.stack || e.message : String(e)
    logStartup(`Backend start failed: ${message}`)
    console.error('Backend start failed', e)
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  isQuitting = true
  void stopBackendProcesses()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  isQuitting = true
  void stopBackendProcesses()
})
