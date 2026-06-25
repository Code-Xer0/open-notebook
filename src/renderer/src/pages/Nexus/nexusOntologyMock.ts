export type CanonStatusTag =
  | 'HARD LOCK'
  | 'WORKING CANON'
  | 'AUTHOR CORRECTION'
  | 'HIDDEN TRUTH'
  | 'FUTURE SPOILER'
  | 'DEPRECATED / DO NOT USE'
  | 'EXPERIMENTAL / LINK-LATER';

export type SourcePriorityLevel =
  | 'Hard canon locks'
  | 'Author corrections'
  | 'Current written scenes'
  | 'Conversation memory locks'
  | 'Experimental branches';

export type SpoilerBoundary =
  | 'Public enough'
  | 'Hidden truth'
  | 'Future spoiler'
  | 'Deprecated'
  | 'Validate later';

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
  readiness: 'Prompt ready' | 'Needs source check';
  citation: string;
}

export interface StylePackPrimitive {
  id: string;
  title: string;
  role: string;
  status: CanonStatusTag;
}

export const sourcePriorityStack: SourcePriorityItem[] = [
  {
    id: 'v04-locks',
    level: 'Hard canon locks',
    status: 'HARD LOCK',
    citation: 'NEX-00',
    title: 'v0.4 correction pass',
    detail: 'Overrides older contradictory notes, rewrite fragments, image prompts, and blended drafts.'
  },
  {
    id: 'author-corrections',
    level: 'Author corrections',
    status: 'AUTHOR CORRECTION',
    citation: 'NEX-00.1',
    title: 'Direct author correction',
    detail: 'Human corrections outrank assistant assumptions and generated summaries.'
  },
  {
    id: 'scene-precision',
    level: 'Current written scenes',
    status: 'WORKING CANON',
    citation: 'NEX-02',
    title: 'Scene beats before summary language',
    detail: 'Current scenes win when they are more precise than recap wording.'
  },
  {
    id: 'memory-locks',
    level: 'Conversation memory locks',
    status: 'WORKING CANON',
    citation: 'NEX-17',
    title: 'Reveal timing memory',
    detail: 'Memory locks can override older exports when the package explicitly says so.'
  },
  {
    id: 'idea-banks',
    level: 'Experimental branches',
    status: 'EXPERIMENTAL / LINK-LATER',
    citation: 'NEX-21',
    title: 'Idea banks stay quarantined',
    detail: 'Experimental material can be evaluated later but cannot silently become plot truth.'
  }
];

export const conflictCleanupEntries: ConflictCleanupEntry[] = [
  {
    id: 'cain-oberon',
    drift: 'Cain described as Black, bald, and breach-coded.',
    lock: 'That visual lock belongs to Oberon. Cain is white/light-skinned, silver-haired, clean-cut, and gravity/stabilization coded.',
    status: 'HARD LOCK',
    boundary: 'Deprecated',
    citations: ['NEX-00.1', 'NEX-20']
  },
  {
    id: 'tet-khepra',
    drift: 'Tet fight, Raziel kidnapping, and ceremony breach moved into Khepra-9.',
    lock: 'Tet belongs to the Aegis ceremony breach aftermath. Khepra-9 is a later deniable black-ops relic-node probe.',
    status: 'HARD LOCK',
    boundary: 'Public enough',
    citations: ['NEX-00.1', 'NEX-23']
  },
  {
    id: 'regalia-inheritance',
    drift: 'Regalia treated as inherited objects passed down through bloodlines.',
    lock: 'Expression traits are heritable. Regalia are soul-bound manifestations shaped by identity, trauma, affinity, and awakening conditions.',
    status: 'HARD LOCK',
    boundary: 'Public enough',
    citations: ['NEX-00.1', 'NEX-04']
  },
  {
    id: 'rayne-parentage',
    drift: 'Rayne presented as unrelated to Lucius and Aurora.',
    lock: 'Rayne is the hidden daughter of Lucius and Aurora, held behind the Volume 1 reveal boundary.',
    status: 'HIDDEN TRUTH',
    boundary: 'Hidden truth',
    citations: ['NEX-17', 'NEX-20']
  },
  {
    id: 'holy-arms',
    drift: 'Holy Arms treated as safe weak-user weapons or as true Regalia.',
    lock: 'Holy Arms are weaker synthesized weapons carrying dead Nephilim residue and can devour insufficient-affinity users.',
    status: 'WORKING CANON',
    boundary: 'Hidden truth',
    citations: ['NEX-04', 'NEX-15']
  }
];

export const visualDoctrineCards: VisualDoctrineCard[] = [
  {
    id: 'aegis-style',
    title: 'Aegis mythic-tech opera',
    status: 'HARD LOCK',
    summary: 'Clean anime cinematic rendering, readable faces, restrained tech detail, military fashion realism, luminous blue-white divine accents.',
    tokens: ['Black / white / blue', 'Sharp silhouette', 'Controlled FX'],
    swatches: ['#f8fbff', '#0d1c2e', '#1d64a7', '#8cc7ff']
  },
  {
    id: 'lumina-style',
    title: 'Lumina Hell-coded expression',
    status: 'WORKING CANON',
    summary: 'More demonic, less standardized, more personally expressive than Aegis while still governed by source boundaries.',
    tokens: ['Combustion', 'Gold pressure', 'Irregular forms'],
    swatches: ['#fff8ed', '#31150f', '#bd5745', '#d19a40']
  },
  {
    id: 'character-firewall',
    title: 'Cain / Oberon firewall',
    status: 'HARD LOCK',
    summary: 'Separate shared visual symbols before generation: Cain is silver-haired gravity command; Oberon is bald hammer breach.',
    tokens: ['Identity split', 'Silhouette guard', 'Casting lock'],
    swatches: ['#f4f7fb', '#27313c', '#7d8ba1', '#102c57']
  },
  {
    id: 'storyboard-first',
    title: 'Storyboard-first production',
    status: 'AUTHOR CORRECTION',
    summary: 'Reference archive output comes before online manga polish: one clear beat per page, 4-5 panels maximum, animation handoff ready.',
    tokens: ['Beat clarity', 'Continuity', 'Shot handoff'],
    swatches: ['#ffffff', '#1f2937', '#0f8b8d', '#a66a00']
  }
];

export const notebookQueryTests: NotebookQueryTest[] = [
  { id: 'mother-aurora', query: 'Explain the difference between Mother and Aurora.', readiness: 'Needs source check', citation: 'NEX-22' },
  { id: 'shouri-parents', query: "Who are Shouri's parents?", readiness: 'Needs source check', citation: 'NEX-22' },
  { id: 'rayne-parents', query: "Who are Rayne's parents?", readiness: 'Needs source check', citation: 'NEX-17' },
  { id: 'holy-arms', query: 'What are Holy Arms?', readiness: 'Needs source check', citation: 'NEX-22' },
  { id: 'tet-khepra', query: 'Is Tet part of Khepra-9?', readiness: 'Needs source check', citation: 'NEX-22' },
  { id: 'cain-oberon', query: 'What is the difference between Cain and Oberon?', readiness: 'Needs source check', citation: 'NEX-22' }
];

export const stylePackPrimitives: StylePackPrimitive[] = [
  { id: 'aegis-pack', title: 'Aegis Mythic-Tech', role: 'StylePack', status: 'WORKING CANON' },
  { id: 'lumina-pack', title: 'Lumina Hell-coded', role: 'StylePack', status: 'WORKING CANON' },
  { id: 'storyboard-page', title: 'Storyboard Page', role: 'ArticleTemplate', status: 'AUTHOR CORRECTION' },
  { id: 'character-asset', title: 'Character Asset', role: 'PrefabComponent', status: 'HARD LOCK' },
  { id: 'event-firewall', title: 'Event Firewall', role: 'PrefabComponent', status: 'HARD LOCK' },
  { id: 'spoiler-boundary', title: 'Spoiler Boundary', role: 'ExportSafetyRule', status: 'HIDDEN TRUTH' },
  { id: 'citation-chip', title: 'Citation Chip', role: 'GroundedOutput', status: 'WORKING CANON' }
];
