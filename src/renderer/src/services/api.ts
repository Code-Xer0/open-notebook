import axios from 'axios';
import { imageCapsules } from './imageCapsules';
import { voiceLayer } from './voiceLayer';

export const API_BASE_URL = 'http://localhost:5055';

// Backend mounts every router under `/api` (see backend/api/main.py). All
// authenticated calls go through `apiClient`, whose baseURL already includes
// `/api`, so individual paths must be written WITHOUT the `/api` prefix.
export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Local access token for the backend's PasswordAuthMiddleware. This is NOT a
// provider API key — it is the local app password (upstream default shown
// below). Override at runtime via localStorage `codex.accessToken`. We never
// display or log provider keys.
const DEFAULT_ACCESS_TOKEN = 'open-notebook-change-me';
export function getAccessToken(): string {
  try {
    return localStorage.getItem('codex.accessToken') || DEFAULT_ACCESS_TOKEN;
  } catch {
    return DEFAULT_ACCESS_TOKEN;
  }
}
export function setAccessToken(token: string): void {
  try {
    localStorage.setItem('codex.accessToken', token);
  } catch {
    /* ignore: storage unavailable */
  }
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // System health — hits the auth-EXCLUDED root `/health` so up/down is always
  // detectable without a token. Short timeout for fast offline detection.
  system: {
    health: () =>
      axios
        .get(`${API_BASE_URL}/health`, { timeout: 4000 })
        .then((res) => res.data),
  },

  // Notebooks
  notebooks: {
    list: () => apiClient.get('/notebooks').then(res => res.data),
    create: (data: { name: string; description?: string }) => apiClient.post('/notebooks', data).then(res => res.data),
    get: (id: string) => apiClient.get(`/notebooks/${id}`).then(res => res.data),
    update: (id: string, data: any) => apiClient.put(`/notebooks/${id}`, data).then(res => res.data),
    delete: (id: string) => apiClient.delete(`/notebooks/${id}`).then(res => res.data),
    addSource: (notebookId: string, sourceId: string) => apiClient.post(`/notebooks/${notebookId}/sources/${sourceId}`).then(res => res.data),
    removeSource: (notebookId: string, sourceId: string) => apiClient.delete(`/notebooks/${notebookId}/sources/${sourceId}`).then(res => res.data),
  },

  // Chat
  chat: {
    getSessions: () => apiClient.get('/chat/sessions').then(res => res.data),
    createSession: (data: any) => apiClient.post('/chat/sessions', data).then(res => res.data),
    getSession: (id: string) => apiClient.get(`/chat/sessions/${id}`).then(res => res.data),
    updateSession: (id: string, data: any) => apiClient.put(`/chat/sessions/${id}`, data).then(res => res.data),
    deleteSession: (id: string) => apiClient.delete(`/chat/sessions/${id}`).then(res => res.data),
    execute: (data: any) => apiClient.post('/chat/execute', data).then(res => res.data),
    buildContext: (data: any) => apiClient.post('/chat/context', data).then(res => res.data),
  },

  // Sources
  sources: {
    list: () => apiClient.get('/sources').then(res => res.data),
    create: (formData: FormData) => apiClient.post('/sources', formData).then(res => res.data),
    createJson: (data: any) => apiClient.post('/sources/json', data).then(res => res.data),
    get: (id: string) => apiClient.get(`/sources/${id}`).then(res => res.data),
    update: (id: string, data: any) => apiClient.put(`/sources/${id}`, data).then(res => res.data),
    delete: (id: string) => apiClient.delete(`/sources/${id}`).then(res => res.data),
    retry: (id: string) => apiClient.post(`/sources/${id}/retry`).then(res => res.data),
    getStatus: (id: string) => apiClient.get(`/sources/${id}/status`).then(res => res.data),
    getInsights: (id: string) => apiClient.get(`/sources/${id}/insights`).then(res => res.data),
    download: (id: string) => apiClient.get(`/sources/${id}/download`, { responseType: 'blob' }).then(res => res.data),
  },

  // Podcasts
  podcasts: {
    generate: (data: any) => apiClient.post('/podcasts/generate', data).then(res => res.data),
    getJob: (id: string) => apiClient.get(`/podcasts/jobs/${id}`).then(res => res.data),
    listEpisodes: () => apiClient.get('/podcasts/episodes').then(res => res.data),
    getEpisode: (id: string) => apiClient.get(`/podcasts/episodes/${id}`).then(res => res.data),
    getAudioUrl: (id: string) => `${API_BASE_URL}/api/podcasts/episodes/${id}/audio`,
    retryEpisode: (id: string) => apiClient.post(`/podcasts/episodes/${id}/retry`).then(res => res.data),
    deleteEpisode: (id: string) => apiClient.delete(`/podcasts/episodes/${id}`).then(res => res.data),
  },

  // Credentials (provider keys live encrypted in the backend; status is metadata only)
  credentials: {
    status: () => apiClient.get('/credentials/status').then(res => res.data),
    list: (provider?: string) => apiClient.get('/credentials', { params: provider ? { provider } : undefined }).then(res => res.data),
    test: (id: string) => apiClient.post(`/credentials/${id}/test`).then(res => res.data),
  },

  // Models
  models: {
    list: () => apiClient.get('/models').then(res => res.data),
  },

  // Settings
  settings: {
    get: () => apiClient.get('/settings').then(res => res.data),
    update: (data: any) => apiClient.put('/settings', data).then(res => res.data),
  },

  // Diagnostics (mounted under /api → paths here are relative to apiClient baseURL)
  diagnostics: {
    version: () => apiClient.get('/version').then(res => res.data),
    telemetrySummary: () => apiClient.get('/telemetry/summary').then(res => res.data),
  },

  imageCapsules
  ,
  voiceLayer
};
