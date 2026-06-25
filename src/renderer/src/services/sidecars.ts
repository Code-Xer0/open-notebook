import { useStore } from '../store/useStore';
import type { SidecarStatus } from '../../../preload/index';

let timer: ReturnType<typeof setInterval> | null = null;

function getSidecarApi() {
  return typeof window !== 'undefined' ? window.api?.sidecars : undefined;
}

export async function refreshSidecarsOnce(): Promise<SidecarStatus | null> {
  const api = getSidecarApi();
  if (!api) {
    useStore.getState().setSidecars(null);
    return null;
  }

  try {
    const status = await api.getStatus();
    useStore.getState().setSidecars(status);
    return status;
  } catch {
    useStore.getState().setSidecars(null);
    return null;
  }
}

export async function restartSidecars(): Promise<SidecarStatus | null> {
  const api = getSidecarApi();
  if (!api) return null;

  try {
    const status = await api.restart();
    useStore.getState().setSidecars(status);
    return status;
  } catch {
    return refreshSidecarsOnce();
  }
}

export async function openSidecarLog(): Promise<string | null> {
  const api = getSidecarApi();
  if (!api) return 'Sidecar logs are only available inside Electron.';
  return api.openLog();
}

export function startSidecarMonitor(intervalMs = 5000): void {
  if (timer) return;
  void refreshSidecarsOnce();
  timer = setInterval(() => void refreshSidecarsOnce(), intervalMs);
}

export function stopSidecarMonitor(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
