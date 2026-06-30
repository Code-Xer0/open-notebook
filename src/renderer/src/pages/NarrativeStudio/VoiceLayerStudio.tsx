import React from 'react';
import { AlertTriangle, BookOpen, Check, FileAudio, Lock, Mic, RefreshCcw, Shield, UserRound, Volume2, X } from 'lucide-react';
import { api } from '../../services/api';
import type { CredentialStatus } from '../../types/runtime';
import {
  voiceLayer,
  type CommandJobStatus,
  type Manuscript,
  type ManuscriptSegment,
  type PerformanceTake,
  type ReadingManifest,
  type RightsStatus,
  type VoiceAssignment,
  type VoiceCapsule,
  type VoiceCharacter,
} from '../../services/voiceLayer';

type TabId = 'library' | 'casting' | 'manuscript' | 'builder' | 'review';

type SpeechSetup = {
  ready: boolean;
  providerSource: string;
  modelLabel: string;
  workerStatus: string;
  reason: string;
};

const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'library', label: 'Voice Library', icon: <Mic size={16} /> },
  { id: 'casting', label: 'Character Casting', icon: <UserRound size={16} /> },
  { id: 'manuscript', label: 'Manuscript Casting', icon: <BookOpen size={16} /> },
  { id: 'builder', label: 'Reading Builder', icon: <FileAudio size={16} /> },
  { id: 'review', label: 'Audio Review', icon: <Volume2 size={16} /> },
];

const rightsBlocked: RightsStatus[] = ['unverified_source', 'do_not_publish', 'requires_consent', 'expired_license'];

const initialSpeechSetup: SpeechSetup = {
  ready: false,
  providerSource: 'unknown',
  modelLabel: 'not verified',
  workerStatus: 'unknown',
  reason: 'Voice provider facts have not been loaded yet.',
};

export function VoiceLayerStudio() {
  const [activeTab, setActiveTab] = React.useState<TabId>('library');
  const [capsules, setCapsules] = React.useState<VoiceCapsule[]>([]);
  const [characters, setCharacters] = React.useState<VoiceCharacter[]>([]);
  const [assignments, setAssignments] = React.useState<VoiceAssignment[]>([]);
  const [manuscripts, setManuscripts] = React.useState<Manuscript[]>([]);
  const [segments, setSegments] = React.useState<ManuscriptSegment[]>([]);
  const [manifests, setManifests] = React.useState<ReadingManifest[]>([]);
  const [takes, setTakes] = React.useState<PerformanceTake[]>([]);
  const [selectedManuscript, setSelectedManuscript] = React.useState('');
  const [selectedManifest, setSelectedManifest] = React.useState('');
  const [selectedSegments, setSelectedSegments] = React.useState<string[]>([]);
  const [speakerDrafts, setSpeakerDrafts] = React.useState<Record<string, string>>({});
  const [message, setMessage] = React.useState('Voice Layer uses heuristic/manual parsing until live providers return facts.');
  const [busy, setBusy] = React.useState(false);
  const [currentJob, setCurrentJob] = React.useState('');
  const [speechSetup, setSpeechSetup] = React.useState<SpeechSetup>(initialSpeechSetup);
  const [voiceName, setVoiceName] = React.useState('');
  const [characterName, setCharacterName] = React.useState('');
  const [manuscriptTitle, setManuscriptTitle] = React.useState('');
  const [manuscriptText, setManuscriptText] = React.useState('');

  const loadSpeechSetup = React.useCallback(async (): Promise<SpeechSetup> => {
    const [credentialFacts, defaults, models, diagnostics] = await Promise.all([
      api.credentials.status().catch(() => null),
      api.models.getDefaults().catch(() => null),
      api.models.list().catch(() => []),
      api.diagnostics.status().catch(() => null),
    ]) as [CredentialStatus | null, any, any[], any];
    const openaiPresent = Boolean(credentialFacts?.present?.openai || credentialFacts?.configured?.openai);
    const openaiUsable = Boolean(credentialFacts?.usable?.openai);
    const providerSource = credentialFacts?.source?.openai || 'none';
    const ttsModelId = defaults?.default_text_to_speech_model;
    const ttsModel = Array.isArray(models) ? models.find((model: any) => model.id === ttsModelId) : null;
    const voiceWorker = diagnostics?.workers?.voice;
    const providerFact = voiceWorker?.provider;
    const workerStatus = voiceWorker?.status || (openaiUsable ? 'blocked until first render probe' : 'provider missing');
    const workerAcceptsJobs = !['worker unavailable', 'failed', 'provider missing'].includes(workerStatus);
    const ready = openaiUsable && workerAcceptsJobs;
    const modelLabel = ttsModel
      ? `${ttsModel.provider}:${ttsModel.name}`
      : 'capsule model fallback: gpt-4o-mini-tts';
    return {
      ready,
      providerSource,
      modelLabel,
      workerStatus,
      reason: ready
        ? 'OpenAI speech can accept bounded render jobs with a tested backend credential.'
        : providerFact?.blockingReason || (openaiPresent ? 'OpenAI is present, but no backend credential test has passed.' : 'OpenAI speech needs a backend credential or environment fallback.'),
    };
  }, []);

  const refresh = React.useCallback(async () => {
    setBusy(true);
    try {
      const [nextCapsules, nextCharacters, nextAssignments, nextManuscripts, nextManifests, nextSetup] = await Promise.all([
        voiceLayer.capsules.list(),
        voiceLayer.casting.listCharacters(),
        voiceLayer.casting.listAssignments(),
        voiceLayer.manuscripts.list(),
        voiceLayer.manifests.list(),
        loadSpeechSetup(),
      ]);
      setCapsules(nextCapsules);
      setCharacters(nextCharacters);
      setAssignments(nextAssignments);
      setManuscripts(nextManuscripts);
      setManifests(nextManifests);
      setSpeechSetup(nextSetup);

      const manuscriptId = selectedManuscript || nextManuscripts[0]?.id || '';
      setSelectedManuscript(manuscriptId);
      setSegments(manuscriptId ? await voiceLayer.manuscripts.segments(manuscriptId) : []);

      const manifestId = selectedManifest || nextManifests[0]?.id || '';
      setSelectedManifest(manifestId);
      setTakes(manifestId ? await voiceLayer.takes.list(manifestId) : []);
      setMessage('Voice Layer facts refreshed from the local backend.');
    } catch (error) {
      console.error(error);
      setMessage(errorMessage(error, 'Could not load Voice Layer facts from the backend.'));
    } finally {
      setBusy(false);
    }
  }, [loadSpeechSetup, selectedManuscript, selectedManifest]);

  React.useEffect(() => {
    refresh();
  }, []);

  React.useEffect(() => {
    if (!currentJob) return;
    const timer = window.setInterval(async () => {
      try {
        const status = await voiceLayer.jobs.get(currentJob);
        handleJobStatus(status);
      } catch (error) {
        console.error(error);
        setMessage(errorMessage(error, 'Could not read narration job status.'));
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [currentJob, selectedManifest]);

  const handleJobStatus = async (status: CommandJobStatus) => {
    if (status.status === 'completed') {
      setCurrentJob('');
      if (status.result?.manifest) {
        setManifests((items) => upsertById(items, status.result?.manifest as ReadingManifest));
      }
      if (status.result?.takes) {
        setTakes(status.result.takes);
      } else if (selectedManifest) {
        setTakes(await voiceLayer.takes.list(selectedManifest));
      }
      setSpeechSetup(await loadSpeechSetup());
      setMessage(status.result?.warnings?.[0] || 'Narration job completed; review generated takes before canonizing.');
    } else if (status.status === 'failed') {
      setCurrentJob('');
      setSpeechSetup(await loadSpeechSetup());
      setMessage(status.error_message || 'Narration job failed.');
    } else {
      setMessage(`Narration job ${status.status}; waiting for backend result.`);
    }
  };

  const createVoice = async (kind: 'narrator' | 'character') => {
    if (!voiceName.trim()) {
      setMessage('Voice name is required before creating a capsule.');
      return;
    }
    setBusy(true);
    try {
      const capsule = await voiceLayer.capsules.create({
        displayName: voiceName.trim(),
        voiceType: kind === 'narrator' ? 'narrator' : 'generated_character',
        provider: 'openai_speech',
        model: 'gpt-4o-mini-tts',
        voiceId: kind === 'narrator' ? 'alloy' : 'verse',
        version: 'v1.0',
        status: 'draft',
        rightsStatus: 'synthetic_original',
        doctrineCard: kind === 'narrator'
          ? 'Calm literary narration. Keep emotion legible without overacting.'
          : 'Stable character continuity. Do not infer canon from generated audio.',
        allowedUse: ['internal readings', 'notebook context', 'draft export'],
        forbiddenUse: ['unlicensed cloning', 'silent canon replacement'],
        provenance: { confirmed: ['created manually in Voice Layer workspace'], inferred: [] },
      });
      setCapsules((items) => [capsule, ...items]);
      setVoiceName('');
      setMessage(`Draft voice capsule stored: ${capsule.displayName}`);
    } catch (error) {
      console.error(error);
      setMessage(errorMessage(error, 'Failed to create voice capsule.'));
    } finally {
      setBusy(false);
    }
  };

  const lockCapsule = async (capsule: VoiceCapsule) => {
    if (rightsBlocked.includes(capsule.rightsStatus)) {
      setMessage(`Cannot lock ${capsule.displayName}: rights status is ${capsule.rightsStatus}.`);
      return;
    }
    try {
      const locked = await voiceLayer.capsules.lock(capsule.id);
      setCapsules((items) => upsertById(items, locked));
      setMessage(`Locked ${locked.displayName} ${locked.version}.`);
    } catch (error) {
      console.error(error);
      setMessage(errorMessage(error, 'Voice lock blocked by backend truth gates.'));
    }
  };

  const createCharacter = async () => {
    if (!characterName.trim()) {
      setMessage('Character name is required before creating a casting record.');
      return;
    }
    try {
      const character = await voiceLayer.casting.createCharacter({
        displayName: characterName.trim(),
        aliases: [],
        doctrineCard: `${characterName.trim()} should keep a stable vocal identity. Human notes remain source of truth.`,
      });
      setCharacters((items) => [character, ...items]);
      setCharacterName('');
      setMessage(`Character record stored: ${character.displayName}`);
    } catch (error) {
      console.error(error);
      setMessage(errorMessage(error, 'Failed to create character record.'));
    }
  };

  const assignVoice = async (character: VoiceCharacter, capsule: VoiceCapsule) => {
    try {
      const assignment = await voiceLayer.casting.createAssignment({
        characterId: character.id,
        voiceCapsuleId: capsule.id,
        assignmentType: 'canonical_dialogue',
        canonStatus: capsule.status === 'locked' ? 'canon' : 'draft',
        notes: 'Manual casting from Voice Layer workspace.',
      });
      setAssignments((items) => [assignment, ...items.filter((item) => item.characterId !== character.id)]);
      setMessage(`Assigned ${capsule.displayName} to ${character.displayName}.`);
    } catch (error) {
      console.error(error);
      setMessage(errorMessage(error, 'Failed to assign character voice.'));
    }
  };

  const intakeManuscript = async () => {
    if (!manuscriptTitle.trim() || !manuscriptText.trim()) {
      setMessage('Manuscript title and text are required before intake.');
      return;
    }
    try {
      const manuscript = await voiceLayer.manuscripts.intake({
        title: manuscriptTitle.trim(),
        text: manuscriptText,
        metadata: { parserMode: 'heuristic_manual', source: 'Voice Layer workspace' },
      });
      setManuscripts((items) => [manuscript, ...items]);
      setSelectedManuscript(manuscript.id);
      setSegments(await voiceLayer.manuscripts.segments(manuscript.id));
      setSelectedSegments([]);
      setManuscriptTitle('');
      setManuscriptText('');
      setMessage(`Manuscript stored and segmented with ${manuscript.reviewCount} review item(s).`);
    } catch (error) {
      console.error(error);
      setMessage(errorMessage(error, 'Failed to intake manuscript.'));
    }
  };

  const loadSegments = async (manuscriptId: string) => {
    setSelectedManuscript(manuscriptId);
    setSegments(manuscriptId ? await voiceLayer.manuscripts.segments(manuscriptId) : []);
    setSelectedSegments([]);
  };

  const confirmSegment = async (segment: ManuscriptSegment) => {
    const speakerLabel = speakerDrafts[segment.id]?.trim() || segment.speakerLabel || 'Narrator';
    try {
      const updated = await voiceLayer.manuscripts.updateAttribution(segment.id, {
        speakerLabel,
        speakerConfidence: 1,
        needsReview: false,
        resolverNotes: ['Human-confirmed attribution in Voice Layer workspace.'],
      });
      setSegments((items) => upsertById(items, updated));
      setMessage(`Confirmed segment ${updated.orderIndex + 1} as ${speakerLabel}.`);
    } catch (error) {
      console.error(error);
      setMessage(errorMessage(error, 'Failed to update speaker attribution.'));
    }
  };

  const createManifest = async () => {
    const manuscript = manuscripts.find((item) => item.id === selectedManuscript);
    if (!manuscript) {
      setMessage('Select or intake a manuscript before building a reading manifest.');
      return;
    }
    const narrator = capsules.find((item) => item.voiceType === 'narrator' && item.status === 'locked');
    if (!narrator) {
      setMessage('Create and lock a narrator capsule before building a renderable manifest.');
      return;
    }
    const characterVoiceMap = Object.fromEntries(
      assignments
        .map((assignment) => {
          const character = characters.find((item) => item.id === assignment.characterId);
          const capsule = capsules.find((item) => item.id === assignment.voiceCapsuleId);
          if (!character || !capsule || capsule.status !== 'locked') return null;
          return [character.displayName, capsule.id] as const;
        })
        .filter(Boolean) as Array<readonly [string, string]>
    );
    try {
      const manifest = await voiceLayer.manifests.create({
        title: `${manuscript.title} - Reading Manifest`,
        manuscriptId: manuscript.id,
        readingProfile: 'Full Cast Canon Draft',
        narratorVoiceId: narrator.id,
        characterVoiceMap,
        performanceRules: {
          doctrine: 'cinematic restraint over cartoon performance',
          parserMode: 'heuristic_manual',
        },
        notebooks: manuscript.notebookId ? [manuscript.notebookId] : [],
      });
      setManifests((items) => [manifest, ...items]);
      setSelectedManifest(manifest.id);
      setTakes([]);
      setMessage(`Reading manifest stored: ${manifest.title}`);
    } catch (error) {
      console.error(error);
      setMessage(errorMessage(error, 'Failed to create reading manifest.'));
    }
  };

  const lockManifest = async (manifest: ReadingManifest) => {
    try {
      const locked = await voiceLayer.manifests.lock(manifest.id);
      setManifests((items) => upsertById(items, locked));
      setMessage(`Locked reading manifest ${locked.title}.`);
    } catch (error) {
      console.error(error);
      setMessage(errorMessage(error, 'Manifest lock blocked: every mapped voice must be locked and publishable.'));
    }
  };

  const submitRender = async (manifest: ReadingManifest, mode: 'selected' | 'chapter') => {
    const blocker = renderBlocker(manifest, mode);
    if (blocker) {
      setMessage(blocker);
      return;
    }
    try {
      const job = await voiceLayer.manifests.renderJob(manifest.id, {
        segmentIds: mode === 'selected' ? selectedSegments : undefined,
        renderMode: mode,
        maxSegments: 8,
      });
      setCurrentJob(job.commandId);
      setSelectedManifest(manifest.id);
      setMessage(`Narration job accepted for ${job.acceptedSegmentIds.length} segment(s).`);
    } catch (error) {
      console.error(error);
      setMessage(errorMessage(error, 'Render job was blocked by backend truth gates.'));
    }
  };

  const renderBlocker = (manifest: ReadingManifest, mode: 'selected' | 'chapter') => {
    if (!speechSetup.ready) return `Render blocked: ${speechSetup.reason}`;
    if (manifest.status !== 'locked') return 'Render blocked: lock the reading manifest before generating takes.';
    if (mode === 'selected' && selectedSegments.length === 0) return 'Render blocked: select at least one manuscript segment.';
    if (currentJob) return 'Render blocked: another narration job is still running.';
    return '';
  };

  const updateTake = async (take: PerformanceTake, status: PerformanceTake['status']) => {
    try {
      const updated = await voiceLayer.takes.updateStatus(take.id, status, `Marked ${status} from Audio Review.`);
      setTakes((items) => upsertById(items, updated));
      setMessage(`Take ${shortId(updated.id)} marked ${status}.`);
    } catch (error) {
      console.error(error);
      setMessage(errorMessage(error, 'Failed to update take status.'));
    }
  };

  const regenerateTake = async (take: PerformanceTake) => {
    if (!speechSetup.ready) {
      setMessage(`Regenerate blocked: ${speechSetup.reason}`);
      return;
    }
    try {
      const job = await voiceLayer.takes.regenerate(take.id);
      setCurrentJob(job.commandId);
      setMessage(`Regenerate job accepted for segment ${shortId(job.segmentId)}.`);
    } catch (error) {
      console.error(error);
      setMessage(errorMessage(error, 'Regenerate job was blocked by backend truth gates.'));
    }
  };

  const publishManifest = async (manifest: ReadingManifest) => {
    try {
      const published = await voiceLayer.manifests.publish(manifest.id);
      setManifests((items) => upsertById(items, published));
      setMessage(published.sourceId ? `Reading Manifest context published to source ${published.sourceId}.` : 'Publish completed without a source ID.');
    } catch (error) {
      console.error(error);
      setMessage(errorMessage(error, 'Publish blocked: manifest must be locked and rights must be publishable.'));
    }
  };

  const lockedCapsules = capsules.filter((item) => item.status === 'locked');
  const selectedManifestRecord = manifests.find((item) => item.id === selectedManifest);

  return (
    <div className="voice-layer-shell">
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Nexus Voice Layer</h2>
          <p style={styles.muted}>Voice Capsules, manuscript casting, bounded reading jobs, and notebook-published narration context.</p>
        </div>
        <button onClick={refresh} disabled={busy} style={styles.iconButton} title="Refresh Voice Layer facts">
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      <div style={styles.statusStrip}>
        <Fact label="OpenAI speech" value={speechSetup.ready ? `usable via ${speechSetup.providerSource}` : 'provider missing'} tone={speechSetup.ready ? 'neutral' : 'warn'} />
        <Fact label="TTS model" value={speechSetup.modelLabel} tone="neutral" />
        <Fact label="Voice worker" value={speechSetup.workerStatus} tone={speechSetup.workerStatus === 'ready' ? 'neutral' : 'warn'} />
        <Fact label="Parser" value="heuristic/manual" tone="warn" />
      </div>

      <div style={styles.tabs}>
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={activeTab === tab.id ? styles.activeTab : styles.tab}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.message}>{message}</div>

      {activeTab === 'library' && (
        <section style={styles.section}>
          <div style={styles.formRow}>
            <input value={voiceName} onChange={(event) => setVoiceName(event.target.value)} placeholder="Voice capsule name" style={styles.input} aria-label="Voice name" />
            <button style={styles.primaryButton} onClick={() => createVoice('narrator')} disabled={busy}>Draft Narrator</button>
            <button style={styles.secondaryButton} onClick={() => createVoice('character')} disabled={busy}>Draft Character Voice</button>
          </div>
          <div style={styles.grid}>
            {capsules.map((capsule) => (
              <article key={capsule.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <strong>{capsule.displayName}</strong>
                  <StatusPill label={capsule.status} blocked={capsule.status !== 'locked'} />
                </div>
                <p style={styles.muted}>{capsule.voiceType} · {capsule.provider} · {capsule.model || 'model not set'} · {capsule.voiceId || 'voice not set'}</p>
                <p style={styles.muted}>Rights: {capsule.rightsStatus}</p>
                <p style={styles.doctrine}>{capsule.doctrineCard || 'No voice doctrine card yet.'}</p>
                <button style={styles.secondaryButton} onClick={() => lockCapsule(capsule)} disabled={capsule.status === 'locked'}>
                  <Lock size={14} /> Lock Voice
                </button>
              </article>
            ))}
            {!capsules.length && <EmptyState text="No Voice Capsules yet. Create a narrator or character voice to begin." />}
          </div>
        </section>
      )}

      {activeTab === 'casting' && (
        <section style={styles.section}>
          <div style={styles.formRow}>
            <input value={characterName} onChange={(event) => setCharacterName(event.target.value)} placeholder="Character name" style={styles.input} aria-label="Character name" />
            <button style={styles.primaryButton} onClick={createCharacter}>Create Character</button>
          </div>
          <div style={styles.grid}>
            {characters.map((character) => {
              const assignment = assignments.find((item) => item.characterId === character.id);
              const assignedVoice = capsules.find((item) => item.id === assignment?.voiceCapsuleId);
              return (
                <article key={character.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <strong>{character.displayName}</strong>
                    <StatusPill label={assignment?.canonStatus || 'unassigned'} blocked={!assignment} />
                  </div>
                  <p style={styles.doctrine}>{character.doctrineCard || 'No character voice doctrine card yet.'}</p>
                  <p style={styles.muted}>Voice: {assignedVoice?.displayName || 'Not assigned'}</p>
                  <div style={styles.buttonRow}>
                    {lockedCapsules.map((capsule) => (
                      <button key={capsule.id} style={styles.secondaryButton} onClick={() => assignVoice(character, capsule)}>
                        Assign {capsule.displayName}
                      </button>
                    ))}
                    {!lockedCapsules.length && <span style={styles.warning}><AlertTriangle size={14} /> Lock a voice before canon casting.</span>}
                  </div>
                </article>
              );
            })}
            {!characters.length && <EmptyState text="No character records yet. Create one before assigning voices." />}
          </div>
        </section>
      )}

      {activeTab === 'manuscript' && (
        <section style={styles.section}>
          <div style={styles.formRow}>
            <input value={manuscriptTitle} onChange={(event) => setManuscriptTitle(event.target.value)} placeholder="Manuscript title" style={styles.input} aria-label="Manuscript title" />
            <button style={styles.primaryButton} onClick={intakeManuscript}>Intake Manuscript</button>
          </div>
          <textarea value={manuscriptText} onChange={(event) => setManuscriptText(event.target.value)} placeholder="Paste a manuscript chapter or scene." style={styles.textarea} aria-label="Manuscript text" />
          <div style={styles.buttonRow}>
            {manuscripts.map((manuscript) => (
              <button key={manuscript.id} style={manuscript.id === selectedManuscript ? styles.activeTab : styles.tab} onClick={() => loadSegments(manuscript.id)}>
                {manuscript.title}
              </button>
            ))}
          </div>
          <div style={styles.list}>
            {segments.map((segment) => (
              <article key={segment.id} style={styles.rowCard}>
                <div style={styles.flexOne}>
                  <label style={styles.checkLine}>
                    <input
                      type="checkbox"
                      checked={selectedSegments.includes(segment.id)}
                      onChange={(event) => setSelectedSegments((items) => event.target.checked ? [...items, segment.id] : items.filter((id) => id !== segment.id))}
                    />
                    <strong>Line {segment.orderIndex + 1}: {segment.segmentType}</strong>
                  </label>
                  <p style={styles.muted}>{segment.text}</p>
                  <p style={styles.muted}>Speaker: {segment.speakerLabel || 'Unresolved'} · confidence {Math.round(segment.speakerConfidence * 100)}%</p>
                  <input
                    value={speakerDrafts[segment.id] ?? segment.speakerLabel ?? ''}
                    onChange={(event) => setSpeakerDrafts((drafts) => ({ ...drafts, [segment.id]: event.target.value }))}
                    placeholder="Confirmed speaker"
                    style={styles.input}
                    aria-label={`Speaker for segment ${segment.orderIndex + 1}`}
                  />
                </div>
                <div style={styles.rowActions}>
                  {segment.needsReview && <StatusPill label="review" blocked />}
                  <button style={styles.secondaryButton} onClick={() => confirmSegment(segment)}>Confirm</button>
                </div>
              </article>
            ))}
            {!segments.length && <EmptyState text="No manuscript segments loaded." />}
          </div>
        </section>
      )}

      {activeTab === 'builder' && (
        <section style={styles.section}>
          <div style={styles.statusStrip}>
            <Fact label="Manuscripts" value={String(manuscripts.length)} tone="neutral" />
            <Fact label="Selected segments" value={String(selectedSegments.length)} tone="neutral" />
            <Fact label="Locked voices" value={String(lockedCapsules.length)} tone="neutral" />
          </div>
          <button style={styles.primaryButton} onClick={createManifest}>Create Reading Manifest</button>
          <div style={styles.grid}>
            {manifests.map((manifest) => {
              const blocker = renderBlocker(manifest, 'chapter');
              return (
                <article key={manifest.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <strong>{manifest.title}</strong>
                    <StatusPill label={manifest.status} blocked={manifest.status !== 'locked'} />
                  </div>
                  <p style={styles.muted}>Profile: {manifest.readingProfile}</p>
                  <p style={styles.muted}>Narrator: {capsules.find((item) => item.id === manifest.narratorVoiceId)?.displayName || 'Not assigned'}</p>
                  <p style={styles.muted}>Source: {manifest.sourceId || 'Not published to notebook'}</p>
                  {blocker && <p style={styles.warning}><AlertTriangle size={14} /> {blocker}</p>}
                  <div style={styles.buttonRow}>
                    <button style={styles.secondaryButton} onClick={() => lockManifest(manifest)} disabled={manifest.status === 'locked'}>Lock</button>
                    <button style={styles.secondaryButton} disabled={Boolean(renderBlocker(manifest, 'selected'))} onClick={() => submitRender(manifest, 'selected')}>Render Selected</button>
                    <button style={styles.secondaryButton} disabled={Boolean(renderBlocker(manifest, 'chapter'))} onClick={() => submitRender(manifest, 'chapter')}>Render Chapter Preview</button>
                    <button style={styles.secondaryButton} disabled={manifest.status !== 'locked'} onClick={() => publishManifest(manifest)}>Publish Context Card</button>
                  </div>
                </article>
              );
            })}
            {!manifests.length && <EmptyState text="No Reading Manifests yet. Intake a manuscript, lock a narrator, then create one." />}
          </div>
        </section>
      )}

      {activeTab === 'review' && (
        <section style={styles.section}>
          <div style={styles.buttonRow}>
            {manifests.map((manifest) => (
              <button key={manifest.id} style={manifest.id === selectedManifest ? styles.activeTab : styles.tab} onClick={async () => {
                setSelectedManifest(manifest.id);
                setTakes(await voiceLayer.takes.list(manifest.id));
              }}>
                {manifest.title}
              </button>
            ))}
          </div>
          {selectedManifestRecord && <p style={styles.muted}>Reviewing takes for {selectedManifestRecord.title}</p>}
          <div style={styles.list}>
            {takes.map((take) => (
              <article key={take.id} style={styles.rowCard}>
                <div style={styles.flexOne}>
                  <strong>{take.status} · {take.provider}</strong>
                  <p style={styles.muted}>Segment {shortId(take.segmentId)} · voice {shortId(take.voiceCapsuleId || 'unresolved')} · QA {take.qaStatus}</p>
                  {take.errorMessage && <p style={styles.warning}><AlertTriangle size={14} /> {take.errorMessage}</p>}
                  {take.audioAssetId ? <AudioPreview takeId={take.id} /> : <p style={styles.muted}>No audio asset for this take.</p>}
                </div>
                <div style={styles.rowActions}>
                  <button style={styles.secondaryButton} onClick={() => updateTake(take, 'approved')}><Check size={14} /> Approve</button>
                  <button style={styles.secondaryButton} onClick={() => updateTake(take, 'canon')}><Shield size={14} /> Canon</button>
                  <button style={styles.secondaryButton} onClick={() => updateTake(take, 'rejected')}><X size={14} /> Reject</button>
                  <button style={styles.secondaryButton} disabled={take.status === 'canon' || Boolean(currentJob)} onClick={() => regenerateTake(take)}>Regenerate</button>
                </div>
              </article>
            ))}
            {!takes.length && <EmptyState text="No performance takes yet. Submit a render job from Reading Builder." />}
          </div>
        </section>
      )}
    </div>
  );
}

function AudioPreview({ takeId }: { takeId: string }) {
  const [url, setUrl] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let active = true;
    let objectUrl = '';
    voiceLayer.takes.audioBlob(takeId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        console.error(err);
        if (active) setError('Audio asset could not be loaded with the local auth token.');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [takeId]);

  if (error) return <p style={styles.warning}><AlertTriangle size={14} /> {error}</p>;
  if (!url) return <p style={styles.muted}>Loading audio asset...</p>;
  return <audio controls src={url} style={{ width: '100%', maxWidth: 420 }} />;
}

function Fact({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'warn' }) {
  return (
    <div style={styles.fact}>
      <span style={styles.factLabel}>{label}</span>
      <strong style={{ color: tone === 'warn' ? 'var(--color-warning)' : 'var(--color-text)' }}>{value}</strong>
    </div>
  );
}

function StatusPill({ label, blocked }: { label: string; blocked?: boolean }) {
  return <span style={blocked ? styles.pillWarn : styles.pillOk}>{label}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div style={styles.empty}>{text}</div>;
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((existing) => existing.id === item.id)
    ? items.map((existing) => existing.id === item.id ? item : existing)
    : [item, ...items];
}

function shortId(value: string) {
  return value.includes(':') ? value.split(':').pop() || value : value;
}

function errorMessage(error: unknown, fallback: string) {
  const anyError = error as { response?: { data?: { detail?: unknown } }; message?: string };
  const detail = anyError?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('; ');
  return anyError?.message || fallback;
}

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  title: { margin: 0, color: 'var(--color-text)', fontSize: '1.55rem' },
  muted: { color: 'var(--color-text-muted)', margin: '0.35rem 0', lineHeight: 1.45 },
  warning: { color: 'var(--color-warning)', display: 'flex', gap: '0.35rem', alignItems: 'center', margin: '0.35rem 0', flexWrap: 'wrap' },
  doctrine: { color: 'var(--color-text)', background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', lineHeight: 1.45 },
  tabs: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.85rem' },
  tab: { display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-muted)', cursor: 'pointer' },
  activeTab: { display: 'inline-flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-edge)', background: 'var(--accent-veil)', color: 'var(--color-text)', cursor: 'pointer' },
  statusStrip: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' },
  fact: { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.7rem 0.85rem', background: 'var(--color-surface)' },
  factLabel: { color: 'var(--color-text-muted)', display: 'block', fontSize: '0.78rem', marginBottom: '0.25rem' },
  message: { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.85rem 1rem', color: 'var(--color-text-muted)', background: 'var(--color-surface)' },
  section: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  formRow: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' },
  input: { minWidth: 220, flex: 1, background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.72rem 0.85rem' },
  textarea: { minHeight: 170, resize: 'vertical', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.85rem', fontFamily: 'inherit', lineHeight: 1.5 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' },
  list: { display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  card: { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  rowCard: { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', padding: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  cardTop: { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' },
  rowActions: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' },
  buttonRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  flexOne: { flex: '1 1 320px' },
  checkLine: { display: 'flex', gap: '0.6rem', alignItems: 'center', color: 'var(--color-text)' },
  primaryButton: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: 'var(--shell-bg)', borderRadius: 'var(--radius-md)', padding: '0.7rem 0.95rem', cursor: 'pointer', fontWeight: 700 },
  secondaryButton: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.85rem', cursor: 'pointer' },
  iconButton: { display: 'inline-flex', alignItems: 'center', gap: '0.45rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.85rem', cursor: 'pointer' },
  pillOk: { border: '1px solid color-mix(in srgb, var(--signal-healthy) 30%, transparent)', background: 'color-mix(in srgb, var(--signal-healthy) 10%, transparent)', color: 'var(--signal-healthy)', borderRadius: '999px', padding: '0.2rem 0.55rem', fontSize: '0.75rem', whiteSpace: 'nowrap' },
  pillWarn: { border: '1px solid color-mix(in srgb, var(--signal-warning) 30%, transparent)', background: 'var(--warning-veil)', color: 'var(--color-warning)', borderRadius: '999px', padding: '0.2rem 0.55rem', fontSize: '0.75rem', whiteSpace: 'nowrap' },
  empty: { border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1.2rem', color: 'var(--color-text-muted)', textAlign: 'center' },
};
