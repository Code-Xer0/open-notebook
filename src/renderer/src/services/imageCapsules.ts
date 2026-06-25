import { apiClient } from './api';

export type CanonStatus = 'draft' | 'canon' | 'alternate' | 'deprecated';

export interface ImageCapsuleRegion {
  id?: string;
  label: string;
  caption?: string;
  manualText?: string;
  tags: string[];
  confidence: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  order: number;
  provenance: 'manual' | 'heuristic';
}

export interface ImageCapsule {
  id: string;
  assetId: string;
  sourceId?: string | null;
  originalFilename: string;
  originalPath: string;
  canonicalAlias?: string | null;
  sha256: string;
  perceptualHash?: string | null;
  mimeType: string;
  width: number;
  height: number;
  fileSize: number;
  projectNamespace?: string | null;
  parserMode: 'heuristic_manual';
  canonStatus: CanonStatus;
  imageType?: string | null;
  sceneType?: string | null;
  confirmedContext: Record<string, unknown>;
  provenance: Record<string, unknown>;
  negativeConstraints: string[];
  warnings: string[];
  palette: string[];
  notebooks: string[];
  duplicateCapsules: string[];
  similarCapsules: Array<{ id: string; distance: number }>;
  llmContextCard?: string | null;
  regions: ImageCapsuleRegion[];
  created?: string | null;
  updated?: string | null;
}

export interface ImageCapsuleConfirmationUpdate {
  projectNamespace?: string;
  canonStatus: CanonStatus;
  imageType?: string;
  sceneType?: string;
  confirmedContext: Record<string, unknown>;
  provenance: Record<string, unknown>;
  negativeConstraints: string[];
  warnings: string[];
}

export const imageCapsules = {
  intake: (data: FormData) =>
    apiClient.post<ImageCapsule>('/image-capsules/intake', data).then((res) => res.data),
  list: () =>
    apiClient.get<{ capsules: ImageCapsule[] }>('/image-capsules').then((res) => res.data),
  get: (id: string) =>
    apiClient.get<ImageCapsule>(`/image-capsules/${encodeURIComponent(id)}`).then((res) => res.data),
  updateConfirmation: (id: string, data: ImageCapsuleConfirmationUpdate) =>
    apiClient.put<ImageCapsule>(`/image-capsules/${encodeURIComponent(id)}/confirmation`, data).then((res) => res.data),
  updateRegions: (id: string, regions: ImageCapsuleRegion[]) =>
    apiClient.put<ImageCapsule>(`/image-capsules/${encodeURIComponent(id)}/regions`, { regions }).then((res) => res.data),
  publish: (id: string, data: { canonStatus: CanonStatus; notebooks?: string[]; publishNote?: string }) =>
    apiClient.post<ImageCapsule>(`/image-capsules/${encodeURIComponent(id)}/publish`, data).then((res) => res.data),
};
