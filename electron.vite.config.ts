import { realpathSync } from 'fs'
import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const projectRoot = realpathSync(process.cwd())
const rendererRoot = resolve(projectRoot, 'src/renderer')
const rendererSrc = resolve(rendererRoot, 'src')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: rendererRoot,
    resolve: {
      alias: {
        '@renderer': rendererSrc
      }
    },
    plugins: [react()]
  }
})
