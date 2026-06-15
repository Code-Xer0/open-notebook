import React, { useState } from 'react';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { UploadDropzone } from './UploadDropzone';
import { Link as LinkIcon, FileText, Settings, Database, BrainCircuit, Loader2, Image as ImageIcon, Video, Camera, ScanText } from 'lucide-react';

type SourceType = 'upload' | 'image' | 'video' | 'scanned-pdf' | 'link' | 'text';

import { api } from '../../services/api';

export function SourcesManager() {
  const [sourceType, setSourceType] = useState<SourceType>('upload');
  const [urls, setUrls] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textTitle, setTextTitle] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  // Processing options
  const [shouldParse, setShouldParse] = useState(true);
  const [shouldEmbed, setShouldEmbed] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      if (['upload', 'image', 'video', 'scanned-pdf'].includes(sourceType)) {
        for (const file of selectedFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('parse', shouldParse.toString());
          formData.append('embed', shouldEmbed.toString());
          // Ideally append lane specific flags here based on sourceType
          if (sourceType === 'image') formData.append('vision', 'true');
          if (sourceType === 'video') formData.append('extract_frames', 'true');
          if (sourceType === 'scanned-pdf') formData.append('ocr', 'true');
          await api.sources.create(formData);
        }
      } else if (sourceType === 'text') {
        await api.sources.createJson({
          title: textTitle,
          content: textContent,
          type: 'text',
          parse: shouldParse,
          embed: shouldEmbed
        });
      } else if (sourceType === 'link') {
        // Assume backend handles list of urls
        const urlList = urls.split('\n').filter(u => u.trim() !== '');
        for (const url of urlList) {
          await api.sources.createJson({
            url: url.trim(),
            type: 'link',
            parse: shouldParse,
            embed: shouldEmbed
          });
        }
      }
      alert('Sources added successfully!');
      // Reset form
      setUrls('');
      setTextContent('');
      setTextTitle('');
      setSelectedFiles([]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to add source');
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
            onClick={() => setSourceType('video')}
            style={getTabStyle(sourceType === 'video')}
          >
            <Video size={18} />
            Video Intake
          </button>
          <button 
            onClick={() => setSourceType('scanned-pdf')}
            style={getTabStyle(sourceType === 'scanned-pdf')}
          >
            <ScanText size={18} />
            Scanned PDFs
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
            <UploadDropzone onFilesSelected={setSelectedFiles} />
          )}

          {sourceType === 'image' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <UploadDropzone onFilesSelected={setSelectedFiles} />
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
                <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BrainCircuit size={16} color="var(--color-primary)" /> OCR / Vision Analysis
                </h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  Image content will be processed using available Vision models.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontSize: '0.875rem', fontWeight: 500 }}>
                  <span>Status:</span> <span>Not configured (Vision backend unavailable)</span>
                </div>
              </div>
            </div>
          )}

          {sourceType === 'video' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <UploadDropzone onFilesSelected={setSelectedFiles} />
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
                <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Camera size={16} color="var(--color-primary)" /> Video Frame Extraction & Metadata
                </h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  Extract keyframes and audio transcripts from video files for multimodal embeddings.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontSize: '0.875rem', fontWeight: 500 }}>
                  <span>Status:</span> <span>Not configured (Frame extraction pipeline offline)</span>
                </div>
              </div>
            </div>
          )}

          {sourceType === 'scanned-pdf' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <UploadDropzone onFilesSelected={setSelectedFiles} />
              <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)' }}>
                <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ScanText size={16} color="var(--color-primary)" /> Optical Character Recognition (OCR)
                </h4>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
                  Auto-detect scanned PDFs or manually run OCR on dense image-based documents.
                </p>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input type="checkbox" defaultChecked /> Auto-detect scanned pages
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input type="checkbox" /> Force manual OCR run
                  </label>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#eab308', fontSize: '0.875rem', fontWeight: 500 }}>
                  <span>Status:</span> <span>OCR unavailable (Waiting for Tesseract/Vision plugin)</span>
                </div>
              </div>
            </div>
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
                    background: 'rgba(0,0,0,0.2)',
                    color: 'white',
                    resize: 'vertical',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Processing Options */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={18} color="var(--color-text-muted)" />
            Processing Options
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={shouldParse} 
                onChange={(e) => setShouldParse(e.target.checked)}
                style={{ marginTop: '0.25rem', accentColor: 'var(--color-primary)', width: '1rem', height: '1rem' }}
              />
              <div>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                  <Database size={16} color="var(--color-primary)" />
                  Parse Document Structure
                </span>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Extract headings, paragraphs, and metadata automatically.
                </p>
              </div>
            </label>
            
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={shouldEmbed} 
                onChange={(e) => setShouldEmbed(e.target.checked)}
                style={{ marginTop: '0.25rem', accentColor: 'var(--color-primary)', width: '1rem', height: '1rem' }}
              />
              <div>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500, marginBottom: '0.25rem' }}>
                  <BrainCircuit size={16} color="var(--color-primary)" />
                  Generate Embeddings (Vectorize)
                </span>
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Create vector embeddings for semantic search and AI comprehension.
                </p>
              </div>
            </label>
          </div>
        </div>

        {error && (
          <div style={{ color: '#ef4444', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <Button disabled={isProcessing} className="bg-transparent" style={{ background: 'transparent', border: '1px solid var(--color-border)' }}>
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
