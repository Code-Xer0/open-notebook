import React from 'react';
import { AlertTriangle, BookOpen, Check, FileAudio, Lock, Mic, RefreshCcw, Shield, UserRound, Volume2, X } from 'lucide-react';
import { api } from '../../services/api';
import { voiceLayer, type Manuscript, type ManuscriptSegment, type PerformanceTake, type ReadingManifest, type RightsStatus, type VoiceAssignment, type VoiceCapsule, type VoiceCharacter } from '../../services/voiceLayer';

type TabId = 'library' | 'casting' | 'manuscript' | 'builder' | 'review';

const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'library', label: 'Voice Library', icon: <Mic size={16} /> },
  { id: 'casting', label: 'Character Casting', icon: <UserRound size={16} /> },
  { id: 'manuscript', label: 'Manuscript Casting', icon: <BookOpen size={16} /> },
  { id: 'builder', label: 'Reading Builder', icon: <FileAudio size={16} /> },
  { id: 'review', label: 'Audio Review', icon: <Volume2 size={16} /> },
];

const rightsBlocked: RightsStatus[] = ['unverified_source', 'do_not_publish', 'requires_consent', 'expired_license'];

export function VoiceLayerStudio() {
  const [activeTab, setActiveTab] = React.useState<TabId>('library');
  const [capsules, setCapsules] = React.useState<VoiceCapsule[]>([]);
  const [characters, setCharacters] = React.useState<VoiceCharacter[]>([]);
  const [assignments, setAssignments] = React.useState<VoiceAssignment[]>([]);
  const [manuscripts, setManuscripts] = React.useState<Manuscript[]>([]);
  const [segments, setSegments] = React.useState<ManuscriptSegment[]>([]);
  const [manifests, setManifests] = React.useState<ReadingManifest[]>([]);
  const [takes, setTakes] = React.useState<PerformanceTake[]>([]);
  const [selectedManuscript, setSelectedManuscript] = React.useState<string>('');
  const [selectedManifest, setSelectedManifest] = React.useState<string>('');
  const [message, setMessage] = React.useState<string>('Voice Layer uses heuristic/manual parsing until live providers return facts.');
  const [busy, setBusy] = React.useState(false);
  const [speechProviderStatus, setSpeechProviderStatus] = React.useState<'unknown' | 'configured' | 'missing'>('unknown');
  const [voiceName, setVoiceName] = React.useState('Primary Narrator');
  const [characterName, setCharacterName] = React.useState('Terra');
  const [manuscriptTitle, setManuscriptTitle] = React.useState('Nexus Voice Smoke Chapter');
  const [manuscriptText, setManuscriptText] = React.useState('Terra: Hold the line.\n\"You always say that,\" Shouri whispered.\nAegis bulletin: Cordon breach recorded at dawn.');

  const refresh = React.useCallback(async () => {
    setBusy(true);
    try {
      const [nextCapsules, nextCharacters, nextAssignments, nextManuscripts, nextManifests] = await Promise.all([
        voiceLayer.capsules.list(),
        voiceLayer.casting.listCharacters(),
        voiceLayer.casting.listAssignments(),
        voiceLayer.manuscripts.list(),
        voiceLayer.manifests.list(),
      ]);
      const credentialFacts = await api.credentials.status().catch(() => null);
      setSpeechProviderStatus(credentialFacts?.configured?.openai && credentialFacts?.source?.openai === 'environment' ? 'configured' : 'missing');
      setCapsules(nextCapsules);
      setCharacters(nextCharacters);
      setAssignments(nextAssignments);
      setManuscripts(nextManuscripts);
      setManifests(nextManifests);
      const manifestId = selectedManifest || nextManifests[0]?.id;
      if (manifestId) {
        setSelectedManifest(manifestId);
        setTakes(await voiceLayer.takes.list(manifestId));
      } else {
        setTakes([]);
      }
      const manuscriptId = selectedManuscript || nextManuscripts[0]?.id;
      if (manuscriptId) {
        setSelectedManuscript(manuscriptId);
        setSegments(await voiceLayer.manuscripts.segments(manuscriptId));
      } else {
        setSegments([]);
      }
      setMessage('Voice Layer facts refreshed from the local backend.');
    } catch (error) {
      console.error(error);
      setMessage('Could not load Voice Layer facts from the backend.');
    } finally {
      setBusy(false);
    }
  }, [selectedManuscript, selectedManifest]);

  React.useEffect(() => {
    refresh();
  }, []);

  const createVoice = async (kind: 'narrator' | 'character') => {
    setBusy(true);
    try {
      const capsule = await voiceLayer.capsules.create({
        displayName: voiceName || (kind === 'narrator' ? 'Primary Narrator' : 'Character Voice'),
        voiceType: kind === 'narrator' ? 'narrator' : 'generated_character',
        provider: 'openai_speech',
        model: 'gpt-4o-mini-tts',
        voiceId: kind === 'narrator' ? 'alloy' : 'verse',
        version: 'v1.0',
        status: 'draft',
        rightsStatus: 'synthetic_original',
        doctrineCard: kind === 'narrator'
          ? 'Calm, cinematic, literary, emotionally aware, restrained. Does not overact dialogue.'
          : 'Character truth over novelty. Keep identity stable across readings.',
        allowedUse: ['internal readings', 'notebook context', 'draft export'],
        forbiddenUse: ['unlicensed cloning', 'silent canon replacement'],
        calibrationTextRefs: ['restraint', 'command', 'grief', 'relief'],
        provenance: { confirmed: ['created manually in Voice Layer workspace'], inferred: [] },
      });
      setCapsules([capsule, ...capsules]);
      setMessage(`Draft voice capsule created: ${capsule.displayName}`);
    } catch (error) {
      console.error(error);
      setMessage('Failed to create voice capsule.');
    } finally {
      setBusy(false);
    }
  };

  const lockCapsule = async (capsule: VoiceCapsule) => {
    if (rightsBlocked.includes(capsule.rightsStatus)) {
      setMessage(`Cannot lock ${capsule.displayName}: rights status is ${capsule.rightsStatus}.`);
      return;
    }
    const locked = await voiceLayer.capsules.lock(capsule.id);
    setCapsules(capsules.map((item) => item.id === locked.id ? locked : item));
    setMessage(`Locked ${locked.displayName} ${locked.version}.`);
  };

  const createCharacter = async () => {
    const character = await voiceLayer.casting.createCharacter({
      displayName: characterName || 'Unnamed Character',
      aliases: [],
      doctrineCard: `${characterName || 'Character'} should keep a stable vocal identity. Do not infer canon from model output.`,
    });
    setCharacters([character, ...characters]);
    setMessage(`Character record created: ${character.displayName}`);
  };

  const assignFirstVoice = async (character: VoiceCharacter) => {
    const capsule = capsules.find((item) => item.status === 'locked') || capsules[0];
    if (!capsule) {
      setMessage('Create a voice capsule before assigning character casting.');
      return;
    }
    const assignment = await voiceLayer.casting.createAssignment({
      characterId: character.id,
      voiceCapsuleId: capsule.id,
      assignmentType: 'canonical_dialogue',
      canonStatus: capsule.status === 'locked' ? 'canon' : 'draft',
      notes: 'Manual casting from Voice Layer workspace.',
    });
    setAssignments([assignment, ...assignments]);
    setMessage(`Assigned ${capsule.displayName} to ${character.displayName}.`);
  };

  const intakeManuscript = async () => {
    const manuscript = await voiceLayer.manuscripts.intake({
      title: manuscriptTitle,
      text: manuscriptText,
      metadata: { parserMode: 'heuristic_manual', source: 'Voice Layer workspace' },
    });
    setManuscripts([manuscript, ...manuscripts]);
    setSelectedManuscript(manuscript.id);
    setSegments(await voiceLayer.manuscripts.segments(manuscript.id));
    setMessage(`Manuscript segmented with ${manuscript.reviewCount} review item(s).`);
  };

  const confirmSegment = async (segment: ManuscriptSegment, speakerLabel: string) => {
    const updated = await voiceLayer.manuscripts.updateAttribution(segment.id, {
      speakerLabel,
      speakerConfidence: 1,
      needsReview: false,
      resolverNotes: ['Human-confirmed attribution in Voice Layer workspace.'],
    });
    setSegments(segments.map((item) => item.id === updated.id ? updated : item));
    setMessage(`Confirmed segment ${updated.orderIndex + 1} as ${speakerLabel}.`);
  };

  const createManifest = async () => {
    const manuscript = manuscripts.find((item) => item.id === selectedManuscript) || manuscripts[0];
    if (!manuscript) {
      setMessage('Create or intake a manuscript before building a reading manifest.');
      return;
    }
    const narrator = capsules.find((item) => item.voiceType === 'narrator' && item.status === 'locked') || capsules.find((item) => item.voiceType === 'narrator');
    const map = Object.fromEntries(
      assignments
        .filter((assignment) => assignment.characterId)
        .map((assignment) => {
          const character = characters.find((item) => item.id === assignment.characterId);
          return [character?.displayName || assignment.characterId || 'Unknown', assignment.voiceCapsuleId];
        })
    );
    const manifest = await voiceLayer.manifests.create({
      title: `${manuscript.title} - Full Cast Canon Draft`,
      manuscriptId: manuscript.id,
      readingProfile: 'Full Cast Canon Draft',
      narratorVoiceId: narrator?.id,
      characterVoiceMap: map,
      performanceRules: {
        doctrine: 'cinematic restraint over cartoon performance',
        clarity: 'clear pacing, no fake alignment claims',
      },
      notebooks: manuscript.notebookId ? [manuscript.notebookId] : [],
    });
    setManifests([manifest, ...manifests]);
    setSelectedManifest(manifest.id);
    setMessage(`Reading manifest created: ${manifest.title}`);
  };

  const lockManifest = async (manifest: ReadingManifest) => {
    try {
      const locked = await voiceLayer.manifests.lock(manifest.id);
      setManifests(manifests.map((item) => item.id === locked.id ? locked : item));
      setMessage(`Locked reading manifest ${locked.title}.`);
    } catch (error) {
      console.error(error);
      setMessage('Manifest lock blocked: every mapped voice must be locked and have publishable rights.');
    }
  };

  const renderManifest = async (manifest: ReadingManifest) => {
    if (speechProviderStatus !== 'configured') {
      setMessage('Render blocked: OpenAI speech requires an OPENAI_API_KEY environment credential in this V1 adapter.');
      return;
    }
    if (manifest.status !== 'locked') {
      setMessage('Render blocked: lock the reading manifest before generating performance takes.');
      return;
    }
    const firstSegment = segments[0]?.id;
    const result = await voiceLayer.manifests.render(manifest.id, firstSegment ? [firstSegment] : undefined);
    setTakes(result.takes);
    setManifests(manifests.map((item) => item.id === result.manifest.id ? result.manifest : item));
    setMessage(result.warnings[0] || `Rendered ${result.takes.length} performance take(s).`);
  };

  const updateTake = async (take: PerformanceTake, status: PerformanceTake['status']) => {
    const updated = await voiceLayer.takes.updateStatus(take.id, status, `Marked ${status} from Audio Review.`);
    setTakes(takes.map((item) => item.id === updated.id ? updated : item));
    setMessage(`Take ${updated.id} marked ${status}.`);
  };

  return (
    <div className="voice-layer-shell">
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Nexus Voice Layer</h2>
          <p style={styles.muted}>Voice Capsules, Reading Manifests, manuscript casting, and traceable performance takes.</p>
        </div>
        <button onClick={refresh} disabled={busy} style={styles.iconButton} title="Refresh Voice Layer facts">
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      <div style={styles.statusStrip}>
        <Fact label="Provider" value={speechProviderStatus === 'configured' ? 'OpenAI speech configured' : speechProviderStatus === 'missing' ? 'provider missing' : 'unknown'} tone={speechProviderStatus === 'configured' ? 'neutral' : 'warn'} />
        <Fact label="Local engines" value="future adapters" tone="warn" />
        <Fact label="Parser" value="heuristic/manual" tone="warn" />
        <Fact label="Audio QA" value="not claimed until run" tone="neutral" />
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
            <input value={voiceName} onChange={(event) => setVoiceName(event.target.value)} style={styles.input} aria-label="Voice name" />
            <button style={styles.primaryButton} onClick={() => createVoice('narrator')}>Draft Narrator</button>
            <button style={styles.secondaryButton} onClick={() => createVoice('character')}>Draft Character Voice</button>
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
            {!capsules.length && <EmptyState text="No Voice Capsules yet. Create a draft narrator to begin." />}
          </div>
        </section>
      )}

      {activeTab === 'casting' && (
        <section style={styles.section}>
          <div style={styles.formRow}>
            <input value={characterName} onChange={(event) => setCharacterName(event.target.value)} style={styles.input} aria-label="Character name" />
            <button style={styles.primaryButton} onClick={createCharacter}>Create Character</button>
          </div>
          <div style={styles.grid}>
            {characters.map((character) => {
              const assignment = assignments.find((item) => item.characterId === character.id);
              return (
                <article key={character.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <strong>{character.displayName}</strong>
                    <StatusPill label={assignment?.canonStatus || 'unassigned'} blocked={!assignment} />
                  </div>
                  <p style={styles.doctrine}>{character.doctrineCard || 'No character voice doctrine card yet.'}</p>
                  <p style={styles.muted}>Voice: {capsules.find((item) => item.id === assignment?.voiceCapsuleId)?.displayName || 'Not assigned'}</p>
                  <button style={styles.secondaryButton} onClick={() => assignFirstVoice(character)}>Assign First Voice</button>
                </article>
              );
            })}
            {!characters.length && <EmptyState text="No character records yet. Create one before assigning canon voices." />}
          </div>
        </section>
      )}

      {activeTab === 'manuscript' && (
        <section style={styles.section}>
          <input value={manuscriptTitle} onChange={(event) => setManuscriptTitle(event.target.value)} style={styles.input} aria-label="Manuscript title" />
          <textarea value={manuscriptText} onChange={(event) => setManuscriptText(event.target.value)} style={styles.textarea} aria-label="Manuscript text" />
          <button style={styles.primaryButton} onClick={intakeManuscript}>Intake Manuscript</button>
          <div style={styles.list}>
            {segments.map((segment) => (
              <article key={segment.id} style={styles.rowCard}>
                <div>
                  <strong>Line {segment.orderIndex + 1}: {segment.segmentType}</strong>
                  <p style={styles.muted}>{segment.text}</p>
                  <p style={styles.muted}>Speaker: {segment.speakerLabel || 'Unresolved'} · confidence {Math.round(segment.speakerConfidence * 100)}%</p>
                </div>
                <div style={styles.rowActions}>
                  {segment.needsReview && <StatusPill label="review" blocked />}
                  <button style={styles.secondaryButton} onClick={() => confirmSegment(segment, characterName || 'Confirmed Speaker')}>Confirm</button>
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
            <Fact label="Manifests" value={String(manifests.length)} tone="neutral" />
            <Fact label="Locked voices" value={String(capsules.filter((item) => item.status === 'locked').length)} tone="neutral" />
          </div>
          <button style={styles.primaryButton} onClick={createManifest}>Create Full Cast Manifest</button>
          <div style={styles.grid}>
            {manifests.map((manifest) => (
              <article key={manifest.id} style={styles.card}>
                <div style={styles.cardTop}>
                  <strong>{manifest.title}</strong>
                  <StatusPill label={manifest.status} blocked={manifest.status !== 'locked'} />
                </div>
                <p style={styles.muted}>Profile: {manifest.readingProfile}</p>
                <p style={styles.muted}>Narrator: {capsules.find((item) => item.id === manifest.narratorVoiceId)?.displayName || 'Not assigned'}</p>
                <p style={styles.muted}>Source: {manifest.sourceId || 'Not published to notebook'}</p>
                <div style={styles.buttonRow}>
                  <button style={styles.secondaryButton} onClick={() => lockManifest(manifest)} disabled={manifest.status === 'locked'}>Lock</button>
                  <button style={styles.secondaryButton} disabled={speechProviderStatus !== 'configured' || manifest.status !== 'locked'} onClick={() => renderManifest(manifest)}>Render First Line</button>
                  <button style={styles.secondaryButton} disabled={manifest.status !== 'locked'} onClick={() => voiceLayer.manifests.publish(manifest.id).then(refresh).catch(() => setMessage('Publish blocked: manifest must be locked and rights must be publishable.'))}>Publish</button>
                </div>
              </article>
            ))}
            {!manifests.length && <EmptyState text="No Reading Manifests yet. Intake a manuscript and create a manifest." />}
          </div>
        </section>
      )}

      {activeTab === 'review' && (
        <section style={styles.section}>
          <div style={styles.list}>
            {takes.map((take) => (
              <article key={take.id} style={styles.rowCard}>
                <div>
                  <strong>{take.status} · {take.provider}</strong>
                  <p style={styles.muted}>Segment {take.segmentId} · voice {take.voiceCapsuleId || 'unresolved'} · QA {take.qaStatus}</p>
                  {take.errorMessage && <p style={styles.warning}><AlertTriangle size={14} /> {take.errorMessage}</p>}
                  {take.audioAssetId && <a href={voiceLayer.takes.audioUrl(take.id)} style={styles.link}>Open audio asset</a>}
                </div>
                <div style={styles.rowActions}>
                  <button style={styles.secondaryButton} onClick={() => updateTake(take, 'approved')}><Check size={14} /> Approve</button>
                  <button style={styles.secondaryButton} onClick={() => updateTake(take, 'canon')}><Shield size={14} /> Canon</button>
                  <button style={styles.secondaryButton} onClick={() => updateTake(take, 'rejected')}><X size={14} /> Reject</button>
                </div>
              </article>
            ))}
            {!takes.length && <EmptyState text="No performance takes yet. Render a manifest line to start review." />}
          </div>
        </section>
      )}
    </div>
  );
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

const styles: Record<string, React.CSSProperties> = {
  header: { display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  title: { margin: 0, color: 'var(--color-text)', fontSize: '1.55rem' },
  muted: { color: 'var(--color-text-muted)', margin: '0.35rem 0', lineHeight: 1.45 },
  warning: { color: 'var(--color-warning)', display: 'flex', gap: '0.35rem', alignItems: 'center', margin: '0.35rem 0' },
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
  textarea: { minHeight: 150, resize: 'vertical', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '0.85rem', fontFamily: 'inherit', lineHeight: 1.5 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' },
  list: { display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  card: { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  rowCard: { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', padding: '1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  cardTop: { display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' },
  rowActions: { display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' },
  buttonRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  primaryButton: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: 'var(--shell-bg)', borderRadius: 'var(--radius-md)', padding: '0.7rem 0.95rem', cursor: 'pointer', fontWeight: 700 },
  secondaryButton: { display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.85rem', cursor: 'pointer' },
  iconButton: { display: 'inline-flex', alignItems: 'center', gap: '0.45rem', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.85rem', cursor: 'pointer' },
  pillOk: { border: '1px solid var(--success-edge)', background: 'var(--success-veil)', color: 'var(--signal-success)', borderRadius: '999px', padding: '0.2rem 0.55rem', fontSize: '0.75rem', whiteSpace: 'nowrap' },
  pillWarn: { border: '1px solid var(--warning-edge)', background: 'var(--warning-veil)', color: 'var(--color-warning)', borderRadius: '999px', padding: '0.2rem 0.55rem', fontSize: '0.75rem', whiteSpace: 'nowrap' },
  empty: { border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1.2rem', color: 'var(--color-text-muted)', textAlign: 'center' },
  link: { color: 'var(--color-primary-hover)', textDecoration: 'none', fontWeight: 700 },
};
