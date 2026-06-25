import { apiClient } from './api';
import type {
  CanonStatusTag,
  SourcePriorityLevel,
  SpoilerBoundary
} from '../pages/Nexus/nexusOntologyMock';

export interface SourcePriorityItem {
  id: string;
  level: SourcePriorityLevel;
  status: CanonStatusTag;
  citation: string;
  title: string;
  detail: string;
}

export interface ConflictCleanupEntry {
  id: string;
  drift: string;
  lock: string;
  status: CanonStatusTag;
  boundary: SpoilerBoundary;
  citations: string[];
}

export interface VisualDoctrineCard {
  id: string;
  title: string;
  status: CanonStatusTag;
  summary: string;
  tokens: string[];
  swatches: string[];
}

export interface NotebookQueryTest {
  id: string;
  query: string;
  readiness: string;
  citation: string;
}

export interface StylePackPrimitive {
  id: string;
  title: string;
  role: string;
  status: CanonStatusTag;
}

export interface OntologyData {
  mode?: 'mock' | 'database' | 'mixed';
  provenance?: string;
  warnings?: string[];
  sourcePriorityStack: SourcePriorityItem[];
  conflictCleanupEntries: ConflictCleanupEntry[];
  visualDoctrineCards: VisualDoctrineCard[];
  notebookQueryTests: NotebookQueryTest[];
  stylePackPrimitives: StylePackPrimitive[];
}

export async function fetchOntologyData(): Promise<OntologyData> {
  return apiClient.get<OntologyData>('/ontology').then((response) => response.data);
}
