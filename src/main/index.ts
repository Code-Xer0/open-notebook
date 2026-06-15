import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { spawn, ChildProcess } from 'child_process'

let surrealProcess: ChildProcess | null = null
let pythonProcess: ChildProcess | null = null

function startBackendProcesses() {
  const isDev = !app.isPackaged
  const appPath = isDev ? app.getAppPath() : process.resourcesPath

  // Start SurrealDB
  const surrealPath = isDev 
    ? join(appPath, 'resources', 'bin', 'surreal.exe')
    : join(process.resourcesPath, 'bin', 'surreal.exe')
    
  surrealProcess = spawn(surrealPath, [
    'start', 
    '--log', 'debug', 
    '--user', 'root', 
    '--pass', 'root', 
    'file:data/surreal.db'
  ], {
    cwd: appPath
  })

  surrealProcess.stdout?.on('data', (data) => console.log(`SurrealDB: ${data}`))
  surrealProcess.stderr?.on('data', (data) => console.error(`SurrealDB Error: ${data}`))

  // Start Python Backend
  if (isDev) {
    const backendPath = join(appPath, 'backend')
    const envPath = process.env.PATH ? `${process.env.PATH};C:\\Users\\Inf3r\\.local\\bin` : `C:\\Users\\Inf3r\\.local\\bin`
    pythonProcess = spawn('uv', [
      'run', 'python', 'run_api.py'
    ], {
      cwd: backendPath,
      env: { ...process.env, PATH: envPath, SURREAL_URL: 'ws://localhost:8000/rpc', SURREAL_USER: 'root', SURREAL_PASS: 'root' },
      shell: true
    })
  } else {
    const backendExePath = join(process.resourcesPath, 'backend.exe')
    pythonProcess = spawn(backendExePath, [], {
      cwd: process.resourcesPath,
      env: { ...process.env, SURREAL_URL: 'ws://localhost:8000/rpc', SURREAL_USER: 'root', SURREAL_PASS: 'root' }
    })
  }

  pythonProcess.stdout?.on('data', (data) => console.log(`Python: ${data}`))
  pythonProcess.stderr?.on('data', (data) => console.error(`Python Error: ${data}`))
}

function stopBackendProcesses() {
  if (surrealProcess) {
    surrealProcess.kill()
    surrealProcess = null
  }
  if (pythonProcess) {
    pythonProcess.kill()
    pythonProcess = null
  }
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
  
  startBackendProcesses()

  createWindow()

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
  stopBackendProcesses()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopBackendProcesses()
})
