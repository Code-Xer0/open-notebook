import React, { useRef, useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { UploadDropzone } from './UploadDropzone';
import { ImageCapsuleWizard } from './ImageCapsuleWizard';
import { Link as LinkIcon, FileText, Settings, Database, BrainCircuit, Loader2, Image as ImageIcon } from 'lucide-react';

type SourceType = 'upload' | 'image' | 'video' | 'scanned-pdf' | 'link' | 'text';

import { api } from '../../services/api';
import { useStore } from '../../store/useStore';

type UploadPhase = 'pending' | 'uploading' | 'stored' | 'queued' | 'failed';

interface UploadStatus {
  name: string;
  size: number;
  phase: UploadPhase;
  message?: string;
  sourceId?: string;
  evidenceAssetId?: string;
  sha256?: string;
  duplicateAssetIds?: string[];
}

const NEXUS_CORPUS_PATH = 'C:\\Users\\Inf3r\\Downloads\\Nexus Assets\\NEXUS_PROJECT_SPACE\\00_DOCTRINE\\MASTER_HTML';
const NEXUS_CORPUS_EXTENSIONS = /\.(md|markdown|txt)$/i;

function isPlainTextSourceFile(file: File): boolean {
  return NEXUS_CORPUS_EXTENSIONS.test(file.name);
}

function getApiErrorMessage(error: any): string {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const location = Array.isArray(item?.loc) ? item.loc.join('.') : '';
        return [location, item?.msg].filter(Boolean).join(': ') || JSON.stringify(item);
      })
      .join('; ');
  }
  if (typeof detail === 'string') return detail;
  if (detail) return JSON.stringify(detail);
  return error?.message || 'Failed to add source';
}

export function SourcesManager() {
  const embeddingWorker = useStore((state) => state.telemetry.ingestionHealth.embeddingWorker);
  const diagnostics = useStore((state) => state.diagnostics);
  const embeddingReady = embeddingWorker?.status === 'ready';
  const evidenceFact = diagnostics?.capabilities?.evidenceVault;
  const evidenceProbe = diagnostics?.evidence;
  const [sourceType, setSourceType] = useState<SourceType>('upload');
  const [urls, setUrls] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
  const nexusCorpusInputRef = useRef<HTMLInputElement>(null);
  
  // Processing options
  const [shouldEmbed, setShouldEmbed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
    setUploadStatuses(files.map((file) => ({
      name: file.name,
      size: file.size,
      phase: 'pending'
    })));
    setError(null);
    setSuccess(null);
  };

  const handleNexusCorpusFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const corpusFiles = files.filter((file) => NEXUS_CORPUS_EXTENSIONS.test(file.name));
    if (!corpusFiles.length) {
      setError('No Markdown or text files were selected for Nexus Corpus import.');
      return;
    }
    try {
      await api.evidence.intakeSources.create({
        label: 'Nexus Corpus MASTER_HTML',
        path: NEXUS_CORPUS_PATH,
        sourceKind: 'nexus_corpus',
        enabled: true,
        provenance: {
          mode: 'user_selected_files',
          note: 'Registered for provenance only; renderer still passes selected files through normal upload flow.'
        }
      });
    } catch (registrationError) {
      console.warn('Could not register Nexus Corpus intake source', registrationError);
    }
    if (corpusFiles.length > 50) {
      setSuccess(`Selected the first 50 Markdown/Text files from Nexus Corpus. ${corpusFiles.length - 50} files were left out by the current upload limit.`);
    } else {
      setSuccess(`Selected ${corpusFiles.length} Nexus Corpus file${corpusFiles.length === 1 ? '' : 's'} for import.`);
    }
    setSourceType('upload');
    handleFilesSelected(corpusFiles.slice(0, 50));
    event.target.value = '';
  };

  const setFileStatus = (index: number, patch: Partial<UploadStatus>) => {
    setUploadStatuses((current) => current.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    )));
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    setError(null);
    setSuccess(null);
    try {
      if (['upload', 'video', 'scanned-pdf'].includes(sourceType)) {
        let submitted = 0;
        let failed = 0;
        const failures: string[] = [];

        setUploadStatuses(selectedFiles.map((file) => ({
          name: file.name,
          size: file.size,
          phase: 'pending'
        })));

        for (const [index, file] of selectedFiles.entries()) {
          setFileStatus(index, { phase: 'uploading', message: 'Uploading to local backend...' });

          try {
            if (isPlainTextSourceFile(file)) {
              setFileStatus(index, { phase: 'uploading', message: 'Reading text and storing as a grounded source...' });
              const content = await file.text();
              const source = await api.sources.createJson({
                title: file.name,
                content,
                type: 'text',
                embed: false
              });
              submitted += 1;
              const duplicateNote = source?.duplicateAssetIds?.length ? `; duplicate hash matches ${source.duplicateAssetIds.length} prior asset${source.duplicateAssetIds.length === 1 ? '' : 's'}` : '';
              setFileStatus(index, {
                phase: 'stored',
                message: `Stored as text source; evidence ${source?.evidenceStatus || 'not verified'}${source?.sha256 ? ` (${String(source.sha256).slice(0, 10)})` : ''}${duplicateNote}`,
                sourceId: source?.id,
                evidenceAssetId: source?.evidenceAssetId,
                sha256: source?.sha256,
                duplicateAssetIds: source?.duplicateAssetIds || []
              });
              continue;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', 'upload');
            formData.append('embed', (embeddingReady && shouldEmbed).toString());
            formData.append('delete_source', 'false');
            formData.append('async_processing', 'true');

            const source = await api.sources.create(formData);
            submitted += 1;
            const duplicateNote = source?.duplicateAssetIds?.length ? `; duplicate hash matches ${source.duplicateAssetIds.length} prior asset${source.duplicateAssetIds.length === 1 ? '' : 's'}` : '';
            setFileStatus(index, {
              phase: 'queued',
              message: `${source?.command_id ? 'Queued for backend processing; text extraction is not verified yet' : 'Submitted to source library'}; evidence ${source?.evidenceStatus || 'not verified'}${source?.sha256 ? ` (${String(source.sha256).slice(0, 10)})` : ''}${duplicateNote}`,
              sourceId: source?.id,
              evidenceAssetId: source?.evidenceAssetId,
              sha256: source?.sha256,
              duplicateAssetIds: source?.duplicateAssetIds || []
            });
          } catch (fileError: any) {
            failed += 1;
            const message = getApiErrorMessage(fileError);
            failures.push(`${file.name}: ${message}`);
            setFileStatus(index, { phase: 'failed', message });
          }
        }

        if (submitted > 0) {
          setSuccess(`Submitted ${submitted} of ${selectedFiles.length} source file${selectedFiles.length === 1 ? '' : 's'} to the local backend.`);
        }
        if (failed > 0) {
          setError(`Failed ${failed} file${failed === 1 ? '' : 's'}: ${failures.join(' | ')}`);
        }
      } else if (sourceType === 'text') {
        const source = await api.sources.createJson({
          title: textTitle,
          content: textContent,
          type: 'text',
          embed: embeddingReady && shouldEmbed
        });
        setSuccess(`Text source submitted to the local backend. Evidence ${source?.evidenceStatus || 'not verified'}${source?.sha256 ? ` (${String(source.sha256).slice(0, 10)})` : ''}.`);
      } else if (sourceType === 'link') {
        // Assume backend handles list of urls
        const urlList = urls.split('\n').filter(u => u.trim() !== '');
        for (const url of urlList) {
          await api.sources.createJson({
            url: url.trim(),
            type: 'link',
            embed: embeddingReady && shouldEmbed
          });
        }
        setSuccess(`Submitted ${urlList.length} link source${urlList.length === 1 ? '' : 's'} to the local backend.`);
      }
    } catch (err: any) {
      console.error(err);
      setError(getApiErrorMessage(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const isFormValid = () => {
    if (['upload', 'image', 'video', 'scanned-pdf'].includes(sourceType)) return selectedFiles.length > 0;
    if (sourceType === 'link') return urls.trim().length > 0;
    if (sourceType === 'text') return textContent.trim().length > 0 && textTitle.trim().length > 0;
    return false;
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 className="title" style={{ marginBottom: '0.5rem' }}>Sources Manager</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Upload documents, add web links, or paste text to add to your knowledge base.
        </p>
      </div>

      <Card>
        <input
          ref={nexusCorpusInputRef}
          type="file"
          multiple
          accept=".md,.markdown,.txt"
          style={{ display: 'none' }}
          onChange={handleNexusCorpusFiles}
          {...({ webkitdirectory: 'true', directory: 'true' } as Record<string, string>)}
        />
        {/* Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
          <button 
            onClick={() => setSourceType('upload')}
            style={getTabStyle(sourceType === 'upload')}
          >
            <UploadDropzoneIcon />
            Documents
          </button>
          <button 
            onClick={() => setSourceType('image')}
            style={getTabStyle(sourceType === 'image')}
          >
            <ImageIcon size={18} />
            Images / Vision
          </button>
          <button 
            onClick={() => setSourceType('link')}
            style={getTabStyle(sourceType === 'link')}
          >
            <LinkIcon size={18} />
            Web Links
          </button>
          <button 
            onClick={() => setSourceType('text')}
            style={getTabStyle(sourceType === 'text')}
          >
            <FileText size={18} />
            Raw Text
          </button>
        </div>

        {/* Content Area */}
        <div style={{ marginBottom: '2rem' }}>
          {sourceType === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <UploadDropzone
                onFilesSelected={handleFilesSelected}
                accept=".pdf,.docx,.txt,.csv,.md,.markdown"
              />
              <div style={{ padding: '1rem', background: 'var(--panel-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <h4 style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Database size={16} color="var(--color-primary)" /> Nexus Corpus Import
                  </h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
                    Select the MASTER_HTML folder or its Markdown/Text files. These are stored directly as text sources. Default target: {NEXUS_CORPUS_PATH}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => nexusCorpusInputRef.current?.click()}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Select Nexus Corpus
                </Button>
              </div>
              <div style={{ padding: '0.85rem 1rem', background: 'var(--panel-subtle)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>Evidence Vault</strong>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                    {evidenceFact?.blockingReason || evidenceFact?.lastError || evidenceFact?.evidence || 'Waiting for backend evidence diagnostics.'}
                  </span>
                </div>
                <span style={{ color: evidenceFact?.status === 'ready' ? 'var(--signal-healthy)' : evidenceFact?.status === 'failed' ? 'var(--signal-error)' : 'var(--signal-warning)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
                  {evidenceFact?.status || 'not verified'}
                </span>
                {evidenceProbe?.evidenceRoot && (
                  <small style={{ gridColumn: '1 / -1', color: 'var(--color-text-muted)', overflowWrap: 'anywhere' }}>
                    Root: {evidenceProbe.evidenceRoot} · Assets: {evidenceProbe.assetCount ?? 'Unknown'} · Snapshots: {evidenceProbe.snapshotCount ?? 'Unknown'} · Restore: not supported in V1
                  </small>
                )}
              </div>
            </div>
          )}

          {sourceType === 'image' && (
            <ImageCapsuleWizard />
          )}

          {sourceType === 'link' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Enter URLs (one per line)</label>
              <textarea 
                value={urls}
                onChange={(e) => setUrls(e.target.value)}
                placeholder="https://example.com/article&#10;https://example.com/another-article"
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid var(--accent-faint)',
                  background: 'var(--accent-veil)',
                  color: 'var(--accent-primary)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                  width: '100%',
                  minHeight: '150px',
                  resize: 'vertical',
                  outline: 'none'
                }}
              />
            </div>
          )}

          {sourceType === 'text' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Title *</label>
                <Input 
                  value={textTitle}
                  onChange={(e) => setTextTitle(e.target.value)}
                  placeholder="E.g., Meeting Notes - Q3" 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500 }}>Content *</label>
                <textarea 
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Paste your raw text here..."
                  style={{
                    width: '100%',
                    minHeight: '200px',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    background: 'var(--panel-subtle)',
                    color: 'var(--color-text)',
                    resize: 'vertical',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {sourceType !== 'image' && (
          <>
            {/* Processing Options */}
            <div style={{ background: 'var(--panel-subtle)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Settings size={18} color="var(--color-text-muted)" />
                Processing Options
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: 'default', opacity: 0.72 }}>
                  <input
                    type="checkbox"
                    checked={false}
                    disabled
                    readOnly
                    style={{ marginTop: '0.25rem', accentColor: 'var(--color-primary)', width: '1rem', height: '1rem' }}
                  />
                  <div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                      <Database size={16} color="var(--color-primary)" />
                      Parse Document Structure
                    </span>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      Worker-gated. Plain Markdown/Text can be stored now; richer document parsing waits for a verified source worker.
                    </p>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: embeddingReady ? 'pointer' : 'default', opacity: embeddingReady ? 1 : 0.72 }}>
                  <input
                    type="checkbox"
                    checked={embeddingReady && shouldEmbed}
                    disabled={!embeddingReady}
                    onChange={(e) => setShouldEmbed(e.target.checked)}
                    style={{ marginTop: '0.25rem', accentColor: 'var(--color-primary)', width: '1rem', height: '1rem' }}
                  />
                  <div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                      <BrainCircuit size={16} color="var(--color-primary)" />
                      Generate Embeddings (Vectorize)
                    </span>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                      {embeddingReady
                        ? 'Embedding worker probe passed. Vector output still reports only after the backend confirms it.'
                        : `Blocked until diagnostics prove the embedding worker. Current status: ${embeddingWorker?.lastProbeStatus || embeddingWorker?.status || 'unknown'}.`}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {error && (
              <div style={{ color: 'var(--signal-error)', padding: '1rem', background: 'var(--danger-veil)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{ color: 'var(--signal-healthy)', padding: '1rem', background: 'color-mix(in srgb, var(--signal-healthy) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--signal-healthy) 24%, transparent)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                {success}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {uploadStatuses.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {uploadStatuses.map((status, index) => (
                    <div key={`${status.name}-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '0.75rem', alignItems: 'center', padding: '0.65rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)', background: 'var(--panel-subtle)' }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{status.name}</strong>
                        <small style={{ color: 'var(--color-text-muted)' }}>{status.message || `${(status.size / 1024).toFixed(1)} KB`}</small>
                        {status.evidenceAssetId && (
                          <small style={{ display: 'block', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            Evidence: {status.evidenceAssetId}{status.sha256 ? ` · sha256 ${status.sha256.slice(0, 12)}` : ''}
                          </small>
                        )}
                      </div>
                      <span style={{
                        color: status.phase === 'failed' ? 'var(--signal-error)' : status.phase === 'stored' ? 'var(--signal-healthy)' : status.phase === 'queued' || status.phase === 'uploading' ? 'var(--signal-warning)' : 'var(--color-text-muted)',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}>
                        {status.phase}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <Button disabled={isProcessing} onClick={() => { setUrls(''); setTextContent(''); setTextTitle(''); setSelectedFiles([]); setUploadStatuses([]); setError(null); setSuccess(null); }} className="bg-transparent" style={{ background: 'transparent', border: '1px solid var(--color-border)' }}>
                  Cancel
                </Button>
                <Button disabled={!isFormValid() || isProcessing} onClick={handleSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                      Processing...
                    </>
                  ) : 'Add Sources'}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
      
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function UploadDropzoneIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" x2="12" y1="3" y2="15"/>
    </svg>
  );
}

function getTabStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1.25rem',
    background: isActive ? 'var(--accent-veil)' : 'transparent',
    color: isActive ? 'var(--accent-primary)' : 'var(--text-faint)',
    border: isActive ? '1px solid var(--accent-faint)' : '1px solid transparent',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'var(--transition)'
  };
}
