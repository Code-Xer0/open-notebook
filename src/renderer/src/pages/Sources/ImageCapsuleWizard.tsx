import React from 'react';
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Database,
  FileImage,
  Image as ImageIcon,
  Layers3,
  LockKeyhole,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { UploadDropzone } from './UploadDropzone';
import { api } from '../../services/api';
import type { CanonStatus, ImageCapsule, ImageCapsuleRegion } from '../../services/imageCapsules';

interface NotebookSummary {
  id: string;
  name: string;
}

const contextFields = [
  { key: 'canonicalName', label: 'Canonical name', placeholder: 'Terra' },
  { key: 'displayTitle', label: 'Display title', placeholder: 'Terra, The Foundation' },
  { key: 'characterName', label: 'Character name', placeholder: 'Terra' },
  { key: 'aliases', label: 'Aliases / title', placeholder: 'The Foundation, Division VI Captain' },
  { key: 'faction', label: 'Faction', placeholder: 'Aegis' },
  { key: 'division', label: 'Division', placeholder: 'VI' },
  { key: 'role', label: 'Role', placeholder: 'Engineering and fortification captain' },
  { key: 'expression', label: 'Expression', placeholder: 'Load' },
  { key: 'regalia', label: 'Regalia', placeholder: 'Keystone' },
  { key: 'ascension', label: 'Ascension / progression', placeholder: 'Citadel' },
  { key: 'expressionDefinition', label: 'Expression definition', multiline: true, placeholder: 'What this power means, and what it is not.' },
  { key: 'regaliaDescription', label: 'Regalia description', multiline: true, placeholder: 'What the object is and how it should be interpreted.' },
  { key: 'visualCanon', label: 'Visual canon', multiline: true, placeholder: 'Body type, outfit, palette, silhouette, symbols, constraints.' },
  { key: 'outfitNotes', label: 'Outfit notes', multiline: true, placeholder: 'Coat, harness, armor panels, boots, materials.' },
  { key: 'poseNotes', label: 'Pose notes', multiline: true, placeholder: 'Stance, action panels, expression row, back view.' },
  { key: 'relationships', label: 'Important relationships', multiline: true, placeholder: 'Relevant links to factions, divisions, characters, objects.' },
  { key: 'userNotes', label: 'User notes', multiline: true, placeholder: 'Human correction notes that should travel with this image.' },
];

const regionPresets = [
  'main pose',
  'Regalia',
  'expression sheet',
  'back view',
  'insignia',
  'environment panel',
  'progression hint',
  'custom',
];

const canonStatuses: CanonStatus[] = ['draft', 'canon', 'alternate', 'deprecated'];

const panelStyle: React.CSSProperties = {
  border: '1px solid var(--color-border)',
  background: 'var(--panel-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: '1rem',
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function parseList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function contextFromCapsule(capsule: ImageCapsule | null): Record<string, string> {
  const context = capsule?.confirmedContext || {};
  return Object.fromEntries(contextFields.map((field) => [field.key, asText(context[field.key])]));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function chipTone(status: string): React.CSSProperties {
  const color =
    status === 'canon'
      ? 'var(--signal-success)'
      : status === 'alternate'
        ? 'var(--signal-warning)'
        : status === 'deprecated'
          ? 'var(--signal-error)'
          : 'var(--color-text-muted)';
  return { borderColor: color, color };
}

export function ImageCapsuleWizard() {
  const [step, setStep] = React.useState(0);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [projectNamespace, setProjectNamespace] = React.useState('Nexus');
  const [capsule, setCapsule] = React.useState<ImageCapsule | null>(null);
  const [context, setContext] = React.useState<Record<string, string>>({});
  const [negativeDraft, setNegativeDraft] = React.useState('');
  const [imageType, setImageType] = React.useState('reference sheet');
  const [sceneType, setSceneType] = React.useState('');
  const [canonStatus, setCanonStatus] = React.useState<CanonStatus>('draft');
  const [regions, setRegions] = React.useState<ImageCapsuleRegion[]>([]);
  const [notebooks, setNotebooks] = React.useState<NotebookSummary[]>([]);
  const [selectedNotebookIds, setSelectedNotebookIds] = React.useState<string[]>([]);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  React.useEffect(() => {
    void api.notebooks
      .list()
      .then((items: NotebookSummary[]) => setNotebooks(Array.isArray(items) ? items : []))
      .catch(() => setNotebooks([]));
  }, []);

  React.useEffect(() => {
    if (!capsule) return;
    setContext(contextFromCapsule(capsule));
    setNegativeDraft(capsule.negativeConstraints.join('\n'));
    setImageType(capsule.imageType || 'reference sheet');
    setSceneType(capsule.sceneType || '');
    setCanonStatus(capsule.canonStatus || 'draft');
    setRegions(capsule.regions || []);
    setSelectedNotebookIds(capsule.notebooks || selectedNotebookIds);
  }, [capsule]);

  const handleFiles = (files: File[]) => {
    const [file] = files;
    setSelectedFiles(file ? [file] : []);
    setError(null);
    setNote(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const intake = async () => {
    const file = selectedFiles[0];
    if (!file) {
      setError('Select one image before starting an Image Capsule.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Image Capsules only accept image files in this lane.');
      return;
    }
    setIsBusy(true);
    setError(null);
    setNote(null);
    try {
      const data = new FormData();
      data.append('file', file);
      data.append('project_namespace', projectNamespace.trim() || 'Nexus');
      data.append('notebooks', JSON.stringify(selectedNotebookIds));
      const next = await api.imageCapsules.intake(data);
      setCapsule(next);
      setStep(1);
      setNote('Draft capsule created. Confirm identity before publishing.');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Image capsule intake failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const saveConfirmation = async () => {
    if (!capsule) return;
    setIsBusy(true);
    setError(null);
    setNote(null);
    try {
      const confirmedContext = Object.fromEntries(
        Object.entries(context).filter(([, value]) => value.trim().length > 0),
      );
      const next = await api.imageCapsules.updateConfirmation(capsule.id, {
        projectNamespace: projectNamespace.trim() || 'Nexus',
        canonStatus,
        imageType: imageType.trim() || undefined,
        sceneType: sceneType.trim() || undefined,
        confirmedContext,
        provenance: {
          confirmed: confirmedContext,
          canon: { canonStatus, imageType, sceneType },
          uncertain: ['OCR and multimodal vision have not been verified for this capsule.'],
        },
        negativeConstraints: parseList(negativeDraft),
        warnings: capsule.warnings,
      });
      setCapsule(next);
      setStep(2);
      setNote('Identity and canon fields saved as human-confirmed metadata.');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to save confirmation.');
    } finally {
      setIsBusy(false);
    }
  };

  const saveRegions = async () => {
    if (!capsule) return;
    setIsBusy(true);
    setError(null);
    setNote(null);
    try {
      const normalized = regions.map((region, index) => ({ ...region, order: index, provenance: 'manual' as const }));
      const next = await api.imageCapsules.updateRegions(capsule.id, normalized);
      setCapsule(next);
      setStep(3);
      setNote('Manual region map saved.');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to save regions.');
    } finally {
      setIsBusy(false);
    }
  };

  const publish = async () => {
    if (!capsule) return;
    setIsBusy(true);
    setError(null);
    setNote(null);
    try {
      const next = await api.imageCapsules.publish(capsule.id, {
        canonStatus,
        notebooks: selectedNotebookIds,
        publishNote: 'Published from Sources Image Capsule wizard',
      });
      setCapsule(next);
      setNote('Image Capsule published into the source library context path.');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Failed to publish capsule.');
    } finally {
      setIsBusy(false);
    }
  };

  const addRegion = (label = 'custom') => {
    setRegions((items) => [
      ...items,
      {
        label,
        caption: '',
        manualText: '',
        tags: [],
        confidence: 1,
        bounds: { x: 0.1, y: 0.1, width: 0.35, height: 0.28 },
        order: items.length,
        provenance: 'manual',
      },
    ]);
  };

  const updateRegion = (index: number, patch: Partial<ImageCapsuleRegion>) => {
    setRegions((items) => items.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const updateRegionBounds = (index: number, key: keyof ImageCapsuleRegion['bounds'], value: number) => {
    setRegions((items) =>
      items.map((item, idx) =>
        idx === index ? { ...item, bounds: { ...item.bounds, [key]: Math.max(0, Math.min(1, value)) } } : item,
      ),
    );
  };

  const removeRegion = (index: number) => {
    setRegions((items) => items.filter((_, idx) => idx !== index).map((item, order) => ({ ...item, order })));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={panelStyle}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Boxes size={18} color="var(--color-primary)" /> Image Contextualization Pipeline
            </h3>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Upload an image, confirm the lore context, map regions, then publish a durable source-backed Image Capsule.
            </p>
          </div>
          <div className="status-chip" style={{ ...chipTone(capsule?.canonStatus || 'draft') }}>
            {capsule ? capsule.canonStatus : 'draft'}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.5rem', marginTop: '1rem' }}>
          {['Upload & Detect', 'Confirm Identity', 'Annotate Regions', 'Lock & Publish'].map((label, index) => (
            <button
              key={label}
              className="btn"
              disabled={!capsule && index > 0}
              onClick={() => (capsule || index === 0) && setStep(index)}
              style={{
                justifyContent: 'center',
                background: step === index ? 'var(--accent-veil)' : 'transparent',
                color: step === index ? 'var(--accent-primary)' : 'var(--color-text-muted)',
              }}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ ...panelStyle, borderColor: 'var(--signal-error)', color: 'var(--signal-error)' }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {note && (
        <div style={{ ...panelStyle, borderColor: 'var(--signal-success)', color: 'var(--signal-success)' }}>
          <CheckCircle2 size={16} /> {note}
        </div>
      )}

      {step === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(280px, 0.8fr)', gap: '1rem' }}>
          <div style={panelStyle}>
            <UploadDropzone
              onFilesSelected={handleFiles}
              maxFiles={1}
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
              helperText="PNG, JPEG, WebP, GIF, or BMP. The original file is preserved unchanged."
            />
          </div>
          <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Selected upload preview"
                style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
              />
            ) : (
              <div style={{ minHeight: 220, display: 'grid', placeItems: 'center', color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                <FileImage size={42} />
              </div>
            )}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Project namespace
              <input className="glass-input" value={projectNamespace} onChange={(e) => setProjectNamespace(e.target.value)} placeholder="Nexus / Aegis / Division VI" />
            </label>
            <NotebookPicker notebooks={notebooks} selected={selectedNotebookIds} onChange={setSelectedNotebookIds} />
            <div style={{ ...panelStyle, padding: '0.75rem', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              <strong style={{ color: 'var(--color-text)' }}>Truth status:</strong> OCR and multimodal vision are not run in v1. Intake records file facts, hashes, palette, and filename-only candidate hints.
            </div>
            <button className="btn btn-primary" disabled={isBusy || selectedFiles.length === 0} onClick={() => void intake()}>
              <Sparkles size={15} /> {isBusy ? 'Creating capsule...' : 'Create draft capsule'}
            </button>
          </div>
        </div>
      )}

      {step === 1 && capsule && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: '1rem' }}>
          <CapsuleFacts capsule={capsule} previewUrl={previewUrl} />
          <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Confirm Identity</h3>
              <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                These fields become the user-confirmed metadata lock. Empty fields are omitted from the context card.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {canonStatuses.map((status) => (
                <button
                  key={status}
                  className="btn"
                  onClick={() => setCanonStatus(status)}
                  style={canonStatus === status ? { ...chipTone(status), background: 'var(--accent-veil)' } : undefined}
                >
                  {status}
                </button>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
                Image type
                <input className="glass-input" value={imageType} onChange={(e) => setImageType(e.target.value)} placeholder="reference sheet" />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
                Scene type
                <input className="glass-input" value={sceneType} onChange={(e) => setSceneType(e.target.value)} placeholder="base form / action panel / map" />
              </label>
            </div>
            {contextFields.map((field) => (
              <label key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
                {field.label}
                {field.multiline ? (
                  <textarea
                    className="glass-input"
                    value={context[field.key] || ''}
                    onChange={(e) => setContext((current) => ({ ...current, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    style={{ minHeight: 82, resize: 'vertical' }}
                  />
                ) : (
                  <input
                    className="glass-input"
                    value={context[field.key] || ''}
                    onChange={(e) => setContext((current) => ({ ...current, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                  />
                )}
              </label>
            ))}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Negative constraints
              <textarea
                className="glass-input"
                value={negativeDraft}
                onChange={(e) => setNegativeDraft(e.target.value)}
                placeholder="not earthbender, not gravity user, no giant hammer"
                style={{ minHeight: 92, resize: 'vertical' }}
              />
            </label>
            <button className="btn btn-primary" disabled={isBusy} onClick={() => void saveConfirmation()}>
              <Save size={15} /> {isBusy ? 'Saving...' : 'Save confirmation'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && capsule && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: '1rem' }}>
          <div style={panelStyle}>
            <h3 style={{ marginTop: 0 }}>Region Preview</h3>
            <div style={{ position: 'relative', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--color-surface)' }}>
              {previewUrl ? (
                <img src={previewUrl} alt="Region annotation preview" style={{ width: '100%', display: 'block' }} />
              ) : (
                <div style={{ minHeight: 260, display: 'grid', placeItems: 'center', color: 'var(--color-text-muted)' }}>
                  <ImageIcon size={36} />
                </div>
              )}
              {regions.map((region, index) => (
                <div
                  key={`${region.label}-${index}`}
                  style={{
                    position: 'absolute',
                    left: `${region.bounds.x * 100}%`,
                    top: `${region.bounds.y * 100}%`,
                    width: `${region.bounds.width * 100}%`,
                    height: `${region.bounds.height * 100}%`,
                    border: '2px solid var(--accent-primary)',
                    background: 'color-mix(in srgb, var(--accent-primary) 18%, transparent)',
                    color: 'var(--color-text)',
                    fontSize: '0.75rem',
                    padding: '0.2rem',
                  }}
                >
                  {index + 1}. {region.label}
                </div>
              ))}
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              Region boxes are normalized coordinates. V1 stores manual labels and captions; OCR remains not verified.
            </p>
          </div>
          <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: 0 }}>Annotate Regions</h3>
                <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                  Add the logical panels the model should understand later.
                </p>
              </div>
              <button className="btn" onClick={() => addRegion()}>
                <Plus size={15} /> Region
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {regionPresets.map((preset) => (
                <button key={preset} className="btn" style={{ fontSize: '0.75rem' }} onClick={() => addRegion(preset)}>
                  {preset}
                </button>
              ))}
            </div>
            {regions.length === 0 && (
              <div style={{ ...panelStyle, padding: '0.75rem', color: 'var(--color-text-muted)' }}>
                No regions yet. Add presets like main pose, Regalia, expression sheet, or environment panel.
              </div>
            )}
            {regions.map((region, index) => (
              <div key={`${region.label}-${index}`} style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <strong>Region {index + 1}</strong>
                  <button className="btn" onClick={() => removeRegion(index)}>
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
                <input className="glass-input" value={region.label} onChange={(e) => updateRegion(index, { label: e.target.value })} placeholder="main pose" />
                <textarea
                  className="glass-input"
                  value={region.caption || ''}
                  onChange={(e) => updateRegion(index, { caption: e.target.value })}
                  placeholder="Human-confirmed caption for this region"
                  style={{ minHeight: 76, resize: 'vertical' }}
                />
                <input
                  className="glass-input"
                  value={region.tags.join(', ')}
                  onChange={(e) => updateRegion(index, { tags: parseList(e.target.value) })}
                  placeholder="tags, comma separated"
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.5rem' }}>
                  {(['x', 'y', 'width', 'height'] as const).map((key) => (
                    <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {key}
                      <input
                        className="glass-input"
                        type="number"
                        min={0}
                        max={1}
                        step={0.01}
                        value={region.bounds[key]}
                        onChange={(e) => updateRegionBounds(index, key, Number(e.target.value))}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button className="btn btn-primary" disabled={isBusy} onClick={() => void saveRegions()}>
              <Layers3 size={15} /> {isBusy ? 'Saving...' : 'Save region map'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && capsule && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: '1rem' }}>
          <CapsuleFacts capsule={capsule} previewUrl={previewUrl} />
          <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Lock and Publish</h3>
              <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                Publishing creates or updates a normal source with this capsule context card for notebook retrieval.
              </p>
            </div>
            <NotebookPicker notebooks={notebooks} selected={selectedNotebookIds} onChange={setSelectedNotebookIds} />
            <div style={panelStyle}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LockKeyhole size={15} /> Publish facts
              </strong>
              <div className="diagnostic-row"><span>Capsule ID</span><strong>{capsule.id}</strong></div>
              <div className="diagnostic-row"><span>Source ID</span><strong>{capsule.sourceId || 'Not published yet'}</strong></div>
              <div className="diagnostic-row"><span>Canonical alias</span><strong>{capsule.canonicalAlias || 'Generated on publish'}</strong></div>
              <div className="diagnostic-row"><span>Regions</span><strong>{capsule.regions.length}</strong></div>
            </div>
            {capsule.llmContextCard ? (
              <pre style={{ ...panelStyle, whiteSpace: 'pre-wrap', fontSize: '0.78rem', maxHeight: 320, overflow: 'auto' }}>{capsule.llmContextCard}</pre>
            ) : (
              <div style={{ ...panelStyle, color: 'var(--color-text-muted)' }}>
                Context card will be generated after publish from confirmed fields, negative constraints, and region summaries.
              </div>
            )}
            <button className="btn btn-primary" disabled={isBusy} onClick={() => void publish()}>
              <Database size={15} /> {isBusy ? 'Publishing...' : 'Lock and publish capsule'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NotebookPicker({
  notebooks,
  selected,
  onChange,
}: {
  notebooks: NotebookSummary[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <strong style={{ fontSize: '0.85rem' }}>Notebook availability</strong>
      {notebooks.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No notebooks loaded. Capsule can still publish as an unlinked source.</div>
      ) : (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {notebooks.map((notebook) => {
            const checked = selected.includes(notebook.id);
            return (
              <button
                key={notebook.id}
                className="btn"
                onClick={() =>
                  onChange(checked ? selected.filter((id) => id !== notebook.id) : [...selected, notebook.id])
                }
                style={checked ? { background: 'var(--accent-veil)', color: 'var(--accent-primary)' } : undefined}
              >
                {checked ? <CheckCircle2 size={14} /> : <Plus size={14} />} {notebook.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CapsuleFacts({ capsule, previewUrl }: { capsule: ImageCapsule; previewUrl: string | null }) {
  const inferred = capsule.provenance?.inferred && typeof capsule.provenance.inferred === 'object'
    ? (capsule.provenance.inferred as Record<string, unknown>)
    : {};

  return (
    <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {previewUrl && (
        <img
          src={previewUrl}
          alt="Image capsule preview"
          style={{ width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
        />
      )}
      <div>
        <h3 style={{ margin: 0 }}>Draft Capsule Facts</h3>
        <p style={{ margin: '0.35rem 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          File facts are observed. Identity hints are filename-only until confirmed.
        </p>
      </div>
      <div style={panelStyle}>
        <div className="diagnostic-row"><span>Asset ID</span><strong>{capsule.assetId}</strong></div>
        <div className="diagnostic-row"><span>Filename</span><strong>{capsule.originalFilename}</strong></div>
        <div className="diagnostic-row"><span>Dimensions</span><strong>{capsule.width} x {capsule.height}</strong></div>
        <div className="diagnostic-row"><span>File size</span><strong>{formatBytes(capsule.fileSize)}</strong></div>
        <div className="diagnostic-row"><span>SHA256</span><strong title={capsule.sha256}>{capsule.sha256.slice(0, 14)}...</strong></div>
        <div className="diagnostic-row"><span>pHash</span><strong>{capsule.perceptualHash || 'Unavailable'}</strong></div>
      </div>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {capsule.palette.map((color) => (
          <span key={color} title={color} style={{ width: 28, height: 28, borderRadius: 8, background: color, border: '1px solid var(--color-border)' }} />
        ))}
      </div>
      <div style={panelStyle}>
        <strong>Candidate inference</strong>
        {Object.keys(inferred).length > 0 ? (
          Object.entries(inferred).map(([key, value]) => (
            <div key={key} className="diagnostic-row"><span>{key}</span><strong>{String(value)}</strong></div>
          ))
        ) : (
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 0 }}>No identity candidates inferred from filename.</p>
        )}
      </div>
      {capsule.duplicateCapsules.length > 0 && (
        <div style={{ ...panelStyle, borderColor: 'var(--signal-warning)' }}>
          <AlertTriangle size={15} color="var(--signal-warning)" /> Duplicate hash candidates: {capsule.duplicateCapsules.join(', ')}
        </div>
      )}
      {capsule.similarCapsules.length > 0 && (
        <div style={{ ...panelStyle, borderColor: 'var(--signal-warning)' }}>
          Similar pHash candidates: {capsule.similarCapsules.map((item) => `${item.id} (${item.distance})`).join(', ')}
        </div>
      )}
      <div style={{ ...panelStyle, color: 'var(--color-text-muted)' }}>
        <strong style={{ color: 'var(--color-text)' }}>Warnings</strong>
        <ul style={{ marginBottom: 0 }}>
          {capsule.warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      </div>
    </div>
  );
}
