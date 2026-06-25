import { API_BASE_URL, apiClient } from './api';

export type VoiceCapsuleStatus = 'draft' | 'locked' | 'alternate' | 'deprecated' | 'experimental';
export type RightsStatus =
  | 'synthetic_original'
  | 'user_owned'
  | 'licensed_actor'
  | 'public_domain_na'
  | 'temporary_internal_test'
  | 'unverified_source'
  | 'do_not_publish'
  | 'requires_consent'
  | 'expired_license';
export type VoiceType =
  | 'synthetic'
  | 'cloned_with_consent'
  | 'recorded_actor'
  | 'temporary_audition'
  | 'generated_character'
  | 'narrator'
  | 'non_canon_experimental';
export type SegmentType =
  | 'narration'
  | 'dialogue'
  | 'inner_monologue'
  | 'quoted_doctrine'
  | 'system_record'
  | 'battle_callout'
  | 'memory_fragment'
  | 'song_chant_prayer'
  | 'unknown_speaker'
  | 'ambiguous_speaker';
export type PerformanceTakeStatus = 'draft' | 'needs_review' | 'approved' | 'canon' | 'rejected' | 'superseded' | 'deprecated';
export type QaStatus = 'not_run' | 'provider_missing' | 'passed' | 'needs_review' | 'failed';

export interface VoiceCapsule {
  id: string;
  displayName: string;
  voiceType: VoiceType;
  provider: string;
  model?: string | null;
  voiceId?: string | null;
  version: string;
  status: VoiceCapsuleStatus;
  rightsStatus: RightsStatus;
  description?: string | null;
  doctrineCard?: string | null;
  toneProfile: Record<string, unknown>;
  providerSettings: Record<string, unknown>;
  allowedUse: string[];
  forbiddenUse: string[];
  sampleAudioRefs: string[];
  calibrationTextRefs: string[];
  provenance: Record<string, unknown>;
  lockedAt?: string | null;
  created?: string | null;
  updated?: string | null;
}

export interface VoiceCharacter {
  id: string;
  displayName: string;
  aliases: string[];
  description?: string | null;
  doctrineCard?: string | null;
}

export interface VoiceAssignment {
  id: string;
  characterId?: string | null;
  voiceCapsuleId: string;
  assignmentType: 'canonical_dialogue' | 'alternate' | 'pov_narration' | 'narrator';
  canonStatus: 'draft' | 'canon' | 'alternate' | 'deprecated';
  version: string;
  notes?: string | null;
}

export interface Manuscript {
  id: string;
  title: string;
  sourceId?: string | null;
  notebookId?: string | null;
  metadata: Record<string, unknown>;
  segmentCount: number;
  reviewCount: number;
}

export interface ManuscriptSegment {
  id: string;
  manuscriptId: string;
  segmentType: SegmentType;
  text: string;
  speakerId?: string | null;
  speakerLabel?: string | null;
  speakerConfidence: number;
  needsReview: boolean;
  resolverNotes: string[];
  orderIndex: number;
}

export interface ReadingManifest {
  id: string;
  title: string;
  manuscriptId: string;
  readingProfile: string;
  narratorVoiceId?: string | null;
  characterVoiceMap: Record<string, string>;
  pronunciationLexiconId?: string | null;
  performanceRules: Record<string, unknown>;
  notebooks: string[];
  status: 'draft' | 'locked' | 'deprecated';
  qaStatus: QaStatus;
  sourceId?: string | null;
  lockedAt?: string | null;
}

export interface PerformanceTake {
  id: string;
  readingManifestId: string;
  segmentId: string;
  voiceCapsuleId?: string | null;
  audioAssetId?: string | null;
  provider: string;
  model?: string | null;
  generationSettings: Record<string, unknown>;
  emotionDirection: Record<string, unknown>;
  status: PerformanceTakeStatus;
  qaStatus: QaStatus;
  errorMessage?: string | null;
  notes?: string | null;
}

export const voiceLayer = {
  capsules: {
    list: () => apiClient.get<{ capsules: VoiceCapsule[] }>('/voice-capsules').then((res) => res.data.capsules),
    create: (data: Partial<VoiceCapsule> & { displayName: string }) => apiClient.post<VoiceCapsule>('/voice-capsules', data).then((res) => res.data),
    update: (id: string, data: Partial<VoiceCapsule>) => apiClient.put<VoiceCapsule>(`/voice-capsules/${encodeURIComponent(id)}`, data).then((res) => res.data),
    lock: (id: string) => apiClient.post<VoiceCapsule>(`/voice-capsules/${encodeURIComponent(id)}/lock`).then((res) => res.data),
    deprecate: (id: string) => apiClient.post<VoiceCapsule>(`/voice-capsules/${encodeURIComponent(id)}/deprecate`).then((res) => res.data),
  },
  casting: {
    listCharacters: () => apiClient.get<VoiceCharacter[]>('/voice-capsules/casting/characters').then((res) => res.data),
    createCharacter: (data: { displayName: string; aliases?: string[]; description?: string; doctrineCard?: string }) =>
      apiClient.post<VoiceCharacter>('/voice-capsules/casting/characters', data).then((res) => res.data),
    listAssignments: () => apiClient.get<VoiceAssignment[]>('/voice-capsules/casting/assignments').then((res) => res.data),
    createAssignment: (data: {
      characterId?: string | null;
      voiceCapsuleId: string;
      assignmentType: VoiceAssignment['assignmentType'];
      canonStatus: VoiceAssignment['canonStatus'];
      version?: string;
      notes?: string;
    }) => apiClient.post<VoiceAssignment>('/voice-capsules/casting/assignments', data).then((res) => res.data),
  },
  manuscripts: {
    list: () => apiClient.get<Manuscript[]>('/manuscripts').then((res) => res.data),
    intake: (data: { title: string; text?: string; sourceId?: string; notebookId?: string; metadata?: Record<string, unknown> }) =>
      apiClient.post<Manuscript>('/manuscripts/intake', data).then((res) => res.data),
    segments: (id: string, reviewOnly = false) =>
      apiClient.get<ManuscriptSegment[]>(`/manuscripts/${encodeURIComponent(id)}/segments`, { params: { review_only: reviewOnly } }).then((res) => res.data),
    updateAttribution: (id: string, data: { speakerLabel?: string; speakerId?: string; speakerConfidence: number; needsReview: boolean; resolverNotes?: string[] }) =>
      apiClient.put<ManuscriptSegment>(`/manuscripts/segments/${encodeURIComponent(id)}/attribution`, data).then((res) => res.data),
  },
  manifests: {
    list: () => apiClient.get<ReadingManifest[]>('/reading-manifests').then((res) => res.data),
    create: (data: {
      title: string;
      manuscriptId: string;
      readingProfile?: string;
      narratorVoiceId?: string;
      characterVoiceMap?: Record<string, string>;
      performanceRules?: Record<string, unknown>;
      notebooks?: string[];
    }) => apiClient.post<ReadingManifest>('/reading-manifests', data).then((res) => res.data),
    lock: (id: string) => apiClient.post<ReadingManifest>(`/reading-manifests/${encodeURIComponent(id)}/lock`).then((res) => res.data),
    render: (id: string, segmentIds?: string[]) =>
      apiClient.post<{ manifest: ReadingManifest; takes: PerformanceTake[]; warnings: string[] }>(`/reading-manifests/${encodeURIComponent(id)}/render`, {
        segmentIds,
      }).then((res) => res.data),
    publish: (id: string) => apiClient.post<ReadingManifest>(`/reading-manifests/${encodeURIComponent(id)}/publish`).then((res) => res.data),
  },
  takes: {
    list: (manifestId?: string) => apiClient.get<PerformanceTake[]>('/performance-takes', { params: manifestId ? { manifest_id: manifestId } : undefined }).then((res) => res.data),
    updateStatus: (id: string, status: PerformanceTakeStatus, notes?: string) =>
      apiClient.put<PerformanceTake>(`/performance-takes/${encodeURIComponent(id)}/status`, { status, notes }).then((res) => res.data),
    audioUrl: (id: string) => `${API_BASE_URL}/api/performance-takes/${encodeURIComponent(id)}/audio`,
  },
};
