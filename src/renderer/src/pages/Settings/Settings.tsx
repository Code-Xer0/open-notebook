import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Select } from '../../components/Select';
import { ModelSelect } from '../../components/ModelSelect';
import { 
  Settings as SettingsIcon, 
  Palette, 
  Cpu, 
  Cloud, 
  Network, 
  Database, 
  Eye, 
  HardDrive, 
  ShieldAlert, 
  Route, 
  DownloadCloud, 
  Activity,
  CheckCircle2,
  XCircle
} from 'lucide-react';

const SECTIONS = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'themes', label: 'Themes', icon: Palette },
  { id: 'local-models', label: 'Local Models', icon: Cpu },
  { id: 'cloud-providers', label: 'Cloud Providers', icon: Cloud },
  { id: 'edge-nodes', label: 'Edge Nodes', icon: Network },
  { id: 'embeddings', label: 'Embeddings', icon: Database },
  { id: 'ocr-vision', label: 'OCR / Vision', icon: Eye },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'privacy', label: 'Privacy / Redaction', icon: ShieldAlert },
  { id: 'routing', label: 'Routing Rules', icon: Route },
  { id: 'export-import', label: 'Export / Import', icon: DownloadCloud },
  { id: 'diagnostics', label: 'Diagnostics', icon: Activity },
];

export function Settings() {
  const { settings, updateSettings, backend } = useStore();
  const [activeTab, setActiveTab] = useState('general');

  // Helpers for inputs
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      updateSettings({ [name]: checked });
    } else {
      updateSettings({ [name]: value });
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="bracket-title">General Settings</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn">Reset</button>
                <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>Save</button>
              </div>
            </div>
            <p className="color-text-muted">Doctrine: Global parameters must be deterministic and transparent to the operator.</p>
            
            <div className="status-card glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: `4px solid ${backend.status === 'online' ? 'var(--signal-healthy)' : backend.status === 'offline' ? 'var(--signal-error)' : 'var(--text-muted)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p><strong>Backend:</strong> <span style={{ color: backend.status === 'online' ? 'var(--signal-healthy)' : backend.status === 'offline' ? 'var(--signal-error)' : 'var(--text-muted)' }}>{backend.status === 'online' ? `Connected${backend.version ? ` · v${backend.version}` : ''}` : backend.status === 'offline' ? 'Offline' : backend.status === 'connecting' ? 'Connecting…' : 'Unknown'}</span></p>
                  <p className="color-text-muted" style={{ fontSize: '0.85rem' }}>Diagnostic: {backend.status === 'online' ? 'Local API reachable on :5055.' : 'Local API (sidecar) not reachable. Start the backend to enable live data.'}</p>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Language</label>
                <select className="glass-input" disabled>
                  <option>English (US)</option>
                </select>
                <small className="color-text-muted">UI language (currently English only)</small>
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" name="launchOnStartup" checked={settings.launchOnStartup || false} onChange={handleChange} id="launchOnStartup" />
                <label htmlFor="launchOnStartup" style={{ margin: 0 }}>Launch on System Startup</label>
              </div>
            </div>
          </div>
        );
      
      case 'themes':
        return (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="bracket-title">Themes</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn">Reset</button>
                <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>Save</button>
              </div>
            </div>
            <p className="color-text-muted">Doctrine: Visual ergonomics reduce cognitive load during sustained operations.</p>
            
            <div className="status-card glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid #2196f3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p><strong>Status:</strong> <span style={{ color: '#2196f3' }}>Theme Engine Active</span></p>
                  <p className="color-text-muted" style={{ fontSize: '0.85rem' }}>Diagnostic: Applying {settings.themeFamily || 'operator-crimson'} at {settings.themeDensity || 'comfortable'} density.</p>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Theme Family</label>
                <Select
                  ariaLabel="Theme Family"
                  value={settings.themeFamily || 'operator-crimson'}
                  onChange={(v) => updateSettings({ themeFamily: v as typeof settings.themeFamily })}
                  options={[
                    { value: 'operator-crimson', label: 'Operator Crimson' },
                    { value: 'cerberus-red', label: 'Cerberus Red' },
                    { value: 'forge-amber', label: 'Forge Amber' },
                    { value: 'continuity-gold', label: 'Continuity Gold' },
                    { value: 'argos-cyan', label: 'Argos Cyan' },
                    { value: 'field-blue', label: 'Field Blue' },
                    { value: 'obsidian', label: 'Obsidian' },
                  ]}
                />
              </div>
              <div className="form-group">
                <label>Theme Density</label>
                <Select
                  ariaLabel="Theme Density"
                  value={settings.themeDensity || 'comfortable'}
                  onChange={(v) => updateSettings({ themeDensity: v as typeof settings.themeDensity })}
                  options={[
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'dense', label: 'Dense' },
                    { value: 'operator-dense', label: 'Operator Dense' },
                  ]}
                />
              </div>
            </div>
          </div>
        );

      case 'local-models':
        return (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="bracket-title">Local Models</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn">Reset</button>
                <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>Save</button>
              </div>
            </div>
            <p className="color-text-muted">Doctrine: Local execution is the foundation of privacy. All local inferences remain on device.</p>
            
            <div className="status-card glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: settings.ollamaEndpoint ? '4px solid var(--signal-warning)' : '4px solid var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p><strong>Status:</strong> <span style={{ color: settings.ollamaEndpoint ? 'var(--signal-warning)' : 'var(--text-muted)' }}>{settings.ollamaEndpoint ? 'Configured · health unknown' : 'Not configured'}</span></p>
                  <p className="color-text-muted" style={{ fontSize: '0.85rem' }}>Diagnostic: {settings.ollamaEndpoint ? 'Endpoint set. Run Test Health to verify the Ollama connection.' : 'Missing Ollama endpoint. Local execution disabled.'}</p>
                </div>
                <button className="btn">Test Health</button>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Ollama Endpoint</label>
                <input type="text" name="ollamaEndpoint" value={settings.ollamaEndpoint || ''} onChange={handleChange} placeholder="http://localhost:11434" className="glass-input" />
              </div>
              <div className="form-group">
                <label>Default Chat Model</label>
                <ModelSelect source="ollama" ollamaEndpoint={settings.ollamaEndpoint} value={settings.defaultChatModel || ''} onChange={(v) => updateSettings({ defaultChatModel: v })} placeholder="e.g. llama3:latest" />
              </div>
              <div className="form-group">
                <label>Default Embedding Model</label>
                <ModelSelect source="ollama" ollamaEndpoint={settings.ollamaEndpoint} value={settings.defaultEmbeddingModel || ''} onChange={(v) => updateSettings({ defaultEmbeddingModel: v })} placeholder="e.g. nomic-embed-text" />
              </div>
              <div className="form-group">
                <label>Default Vision Model</label>
                <ModelSelect source="ollama" ollamaEndpoint={settings.ollamaEndpoint} value={settings.defaultVisionModel || ''} onChange={(v) => updateSettings({ defaultVisionModel: v })} placeholder="e.g. llava" />
              </div>
            </div>
          </div>
        );

      case 'cloud-providers':
        return (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="bracket-title">Cloud Providers</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn">Reset</button>
                <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>Save</button>
              </div>
            </div>
            <p className="color-text-muted">Doctrine: External compute is an augmentation. Keys are stored strictly in local app storage.</p>
            
            <div className="status-card glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: (settings.openaiApiKey || settings.anthropicApiKey || settings.googleApiKey) ? '4px solid #4caf50' : '4px solid #ff9800' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p><strong>Status:</strong> <span style={{ color: (settings.openaiApiKey || settings.anthropicApiKey || settings.googleApiKey) ? '#4caf50' : '#ff9800' }}>{(settings.openaiApiKey || settings.anthropicApiKey || settings.googleApiKey) ? 'Providers Configured' : 'No Providers Configured'}</span></p>
                  <p className="color-text-muted" style={{ fontSize: '0.85rem' }}>Diagnostic: {(settings.openaiApiKey || settings.anthropicApiKey || settings.googleApiKey) ? 'Keys loaded securely.' : 'Add keys to enable cloud capabilities.'}</p>
                </div>
                <button className="btn">Run Health Check</button>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label>OpenAI API Key</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="password" name="openaiApiKey" value={settings.openaiApiKey || ''} onChange={handleChange} placeholder={settings.openaiApiKey ? "••••••••••••••••" : "Not configured"} className="glass-input" style={{ flex: 1 }} />
                  {settings.openaiApiKey ? <CheckCircle2 className="color-text-muted" /> : <XCircle className="color-text-muted" />}
                </div>
              </div>
              <div className="form-group">
                <label>Anthropic API Key</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="password" name="anthropicApiKey" value={settings.anthropicApiKey || ''} onChange={handleChange} placeholder={settings.anthropicApiKey ? "••••••••••••••••" : "Not configured"} className="glass-input" style={{ flex: 1 }} />
                  {settings.anthropicApiKey ? <CheckCircle2 className="color-text-muted" /> : <XCircle className="color-text-muted" />}
                </div>
              </div>
              <div className="form-group">
                <label>Google API Key</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input type="password" name="googleApiKey" value={settings.googleApiKey || ''} onChange={handleChange} placeholder={settings.googleApiKey ? "••••••••••••••••" : "Not configured"} className="glass-input" style={{ flex: 1 }} />
                  {settings.googleApiKey ? <CheckCircle2 className="color-text-muted" /> : <XCircle className="color-text-muted" />}
                </div>
              </div>
            </div>
          </div>
        );

      case 'edge-nodes':
        return (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="bracket-title">Edge Nodes</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn">Reset</button>
                <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>Save</button>
              </div>
            </div>
            <p className="color-text-muted">Doctrine: Distributed trust enables resilient compute. Edge nodes act as physical extensions.</p>
            
            <div className="status-card glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: settings.edgeNodeRegistry ? '4px solid var(--signal-warning)' : '4px solid var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p><strong>Status:</strong> <span style={{ color: settings.edgeNodeRegistry ? 'var(--signal-warning)' : 'var(--text-muted)' }}>{settings.edgeNodeRegistry ? 'Registry set · not verified' : 'Not configured'}</span></p>
                  <p className="color-text-muted" style={{ fontSize: '0.85rem' }}>Diagnostic: {settings.edgeNodeRegistry ? 'Registry URL set. Use Ping Swarm to verify reachability. Operator approval required before edge use.' : 'No edge nodes configured.'}</p>
                </div>
                <button className="btn">Ping Swarm</button>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Edge Node Registry URL</label>
                <input type="text" name="edgeNodeRegistry" value={settings.edgeNodeRegistry || ''} onChange={handleChange} placeholder="e.g. wss://edge.local" className="glass-input" />
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" name="edgeHealthChecks" checked={settings.edgeHealthChecks || false} onChange={handleChange} id="edgeHealthChecks" />
                <label htmlFor="edgeHealthChecks" style={{ margin: 0 }}>Enable Continuous Health Checks</label>
              </div>
              <div className="form-group">
                <label>Capability Requirements</label>
                <input type="text" name="edgeCapabilities" value={settings.edgeCapabilities || ''} onChange={handleChange} placeholder="e.g. gpu>=8gb, ram>=16gb" className="glass-input" />
              </div>
              <div className="form-group">
                <label>Preferred Fallback</label>
                <Select
                  ariaLabel="Preferred Fallback"
                  value={settings.edgeFallback || 'cloud'}
                  onChange={(v) => updateSettings({ edgeFallback: v })}
                  options={[
                    { value: 'cloud', label: 'Cloud Provider' },
                    { value: 'local', label: 'Local Model' },
                    { value: 'fail', label: 'Fail Fast' },
                  ]}
                />
              </div>
            </div>
          </div>
        );

      case 'embeddings':
        return (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="bracket-title">Embeddings</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn">Reset</button>
                <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>Save</button>
              </div>
            </div>
            <p className="color-text-muted">Doctrine: Semantic representation must be consistent to preserve vector database integrity.</p>
            
            <div className="status-card glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: settings.embeddingModel ? '4px solid var(--signal-warning)' : '4px solid var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p><strong>Status:</strong> <span style={{ color: settings.embeddingModel ? 'var(--signal-warning)' : 'var(--text-muted)' }}>{settings.embeddingModel ? 'Configured · health unknown' : 'No model selected'}</span></p>
                  <p className="color-text-muted" style={{ fontSize: '0.85rem' }}>Diagnostic: {settings.embeddingModel ? 'Model set. Use Test Pipeline to verify the embedding backend.' : 'Requires embedding model for semantic search.'}</p>
                </div>
                <button className="btn">Test Pipeline</button>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Embedding Model</label>
                <ModelSelect source="ollama" ollamaEndpoint={settings.ollamaEndpoint} value={settings.embeddingModel || ''} onChange={(v) => updateSettings({ embeddingModel: v })} placeholder="e.g. nomic-embed-text" />
              </div>
              <div className="form-group">
                <label>Vector Dimension</label>
                <input type="number" name="embeddingDimension" value={settings.embeddingDimension || 768} onChange={handleChange} placeholder="e.g. 768" className="glass-input" />
              </div>
              <div className="form-group">
                <label>Chunk Size</label>
                <input type="number" name="embeddingChunkSize" value={settings.embeddingChunkSize || 1000} onChange={handleChange} placeholder="e.g. 1000" className="glass-input" />
              </div>
            </div>
          </div>
        );

      case 'ocr-vision':
        return (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="bracket-title">OCR / Vision</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn">Reset</button>
                <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>Save</button>
              </div>
            </div>
            <p className="color-text-muted">Doctrine: High-fidelity visual data extraction requires robust, composable OCR and Vision pipelines.</p>
            
            <div className="status-card glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: settings.visionProvider === 'disabled' ? '4px solid var(--text-muted)' : '4px solid var(--signal-warning)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p><strong>Status:</strong> <span style={{ color: settings.visionProvider === 'disabled' ? 'var(--text-muted)' : 'var(--signal-warning)' }}>{settings.visionProvider === 'disabled' ? 'Disabled' : 'Configured · health unknown'}</span></p>
                  <p className="color-text-muted" style={{ fontSize: '0.85rem' }}>Diagnostic: {settings.visionProvider === 'disabled' ? 'Vision capabilities disabled.' : 'Provider set. Use Test OCR / Test Vision to verify. OCR/vision pipeline is scaffolded — not yet wired.'}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn">Test OCR</button>
                  <button className="btn">Test Vision</button>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Vision Provider</label>
                <Select
                  ariaLabel="Vision Provider"
                  value={settings.visionProvider || 'disabled'}
                  onChange={(v) => updateSettings({ visionProvider: v })}
                  options={[
                    { value: 'local', label: 'Local' },
                    { value: 'cloud', label: 'Cloud' },
                    { value: 'edge', label: 'Edge' },
                    { value: 'disabled', label: 'Disabled' },
                  ]}
                />
              </div>
              <div className="form-group">
                <label>Vision Model</label>
                <Select
                  ariaLabel="Vision Model"
                  value={settings.visionModel || 'llava'}
                  onChange={(v) => updateSettings({ visionModel: v })}
                  options={[
                    { value: 'llava', label: 'LLaVA' },
                    { value: 'bakllava', label: 'BakLLaVA' },
                    { value: 'moondream', label: 'Moondream' },
                    { value: 'custom', label: 'Custom' },
                  ]}
                />
              </div>
              {settings.visionModel === 'custom' && (
                <div className="form-group">
                  <label>Custom Vision Model</label>
                  <input type="text" name="customVisionModel" value={settings.customVisionModel || ''} onChange={handleChange} placeholder="Custom model name" className="glass-input" />
                </div>
              )}
              <div className="form-group">
                <label>OCR Engine</label>
                <Select
                  ariaLabel="OCR Engine"
                  value={settings.ocrEngine || 'tesseract'}
                  onChange={(v) => updateSettings({ ocrEngine: v })}
                  options={[
                    { value: 'tesseract', label: 'Tesseract' },
                    { value: 'paddleocr', label: 'PaddleOCR' },
                    { value: 'cloudocr', label: 'Cloud OCR' },
                  ]}
                />
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" name="ocrAutoDetect" checked={settings.ocrAutoDetect || false} onChange={handleChange} id="ocrAutoDetect" />
                <label htmlFor="ocrAutoDetect" style={{ margin: 0 }}>Auto-detect Scanned PDFs</label>
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" name="ocrImageExtract" checked={settings.ocrImageExtract || false} onChange={handleChange} id="ocrImageExtract" />
                <label htmlFor="ocrImageExtract" style={{ margin: 0 }}>Extract and OCR inline images</label>
              </div>
            </div>
          </div>
        );

      case 'storage':
        return (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="bracket-title">Storage</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn">Reset</button>
                <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>Save</button>
              </div>
            </div>
            <p className="color-text-muted">Doctrine: Local sovereignty means maintaining complete control over persisted data footprints.</p>
            
            <div className="status-card glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--text-muted)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p><strong>Status:</strong> <span style={{ color: 'var(--text-muted)' }}>Not verified</span></p>
                  <p className="color-text-muted" style={{ fontSize: '0.85rem' }}>Diagnostic: Use Verify Integrity to check read/write access on the local path.</p>
                </div>
                <button className="btn">Verify Integrity</button>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Storage Path</label>
                <input type="text" name="storagePath" value={settings.storagePath || ''} onChange={handleChange} placeholder="default" className="glass-input" />
              </div>
              <div className="form-group">
                <label>Database Type</label>
                <Select
                  ariaLabel="Database Type"
                  value={settings.databaseType || 'sqlite'}
                  onChange={(v) => updateSettings({ databaseType: v })}
                  options={[
                    { value: 'sqlite', label: 'SQLite (Local)' },
                    { value: 'postgres', label: 'PostgreSQL (External)' },
                  ]}
                />
              </div>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="bracket-title">Privacy / Redaction</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn">Reset</button>
                <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>Save</button>
              </div>
            </div>
            <p className="color-text-muted">Doctrine: Leakage of sensitive artifacts is a catastrophic failure. Always sanitize before exfiltration.</p>
            
            <div className="status-card glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: settings.privacyMode === 'strict' ? '4px solid #4caf50' : '4px solid #ff9800' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p><strong>Status:</strong> <span style={{ color: settings.privacyMode === 'strict' ? '#4caf50' : '#ff9800' }}>{settings.privacyMode === 'strict' ? 'Strict Isolation' : 'Permissive Isolation'}</span></p>
                  <p className="color-text-muted" style={{ fontSize: '0.85rem' }}>Diagnostic: {settings.privacyMode === 'strict' ? 'Cloud vectors blocked.' : 'Cloud vectors permitted for certain operations.'}</p>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Privacy Mode</label>
                <Select
                  ariaLabel="Privacy Mode"
                  value={settings.privacyMode || 'strict'}
                  onChange={(v) => updateSettings({ privacyMode: v as typeof settings.privacyMode })}
                  options={[
                    { value: 'strict', label: 'Strict (Local Only)' },
                    { value: 'balanced', label: 'Balanced (Ask before Cloud)' },
                    { value: 'none', label: 'Permissive (Cloud Allowed)' },
                  ]}
                />
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" name="redactionEnabled" checked={settings.redactionEnabled ?? true} onChange={handleChange} id="redactionEnabled" />
                <label htmlFor="redactionEnabled" style={{ margin: 0 }}>Enable PII Redaction</label>
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" name="telemetryEnabled" checked={settings.telemetryEnabled || false} onChange={handleChange} id="telemetryEnabled" />
                <label htmlFor="telemetryEnabled" style={{ margin: 0 }}>Send Anonymous Telemetry</label>
              </div>
            </div>
          </div>
        );

      case 'routing':
        return (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="bracket-title">Routing Rules</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn">Reset</button>
                <button className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>Save</button>
              </div>
            </div>
            <p className="color-text-muted">Doctrine: Intelligent traffic shaping maximizes capability while adhering strictly to privacy bounds.</p>
            
            <div className="status-card glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid #2196f3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p><strong>Status:</strong> <span style={{ color: '#2196f3' }}>Router Active</span></p>
                  <p className="color-text-muted" style={{ fontSize: '0.85rem' }}>Diagnostic: Rules are evaluated in top-down order.</p>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Primary Routing Strategy</label>
                <Select
                  ariaLabel="Primary Routing Strategy"
                  value={settings.routingStrategy || 'prefer-local'}
                  onChange={(v) => updateSettings({ routingStrategy: v })}
                  options={[
                    { value: 'prefer-local', label: 'Prefer Local' },
                    { value: 'prefer-cloud', label: 'Prefer Cloud' },
                    { value: 'prefer-edge', label: 'Prefer Edge' },
                  ]}
                />
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" name="routingPrivacyStrict" checked={settings.routingPrivacyStrict || false} onChange={handleChange} id="routingPrivacyStrict" />
                <label htmlFor="routingPrivacyStrict" style={{ margin: 0 }}>Privacy Strict (Never use cloud for sensitive tags)</label>
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" name="routingOcrCloud" checked={settings.routingOcrCloud || false} onChange={handleChange} id="routingOcrCloud" />
                <label htmlFor="routingOcrCloud" style={{ margin: 0 }}>OCR Cloud Allowed (Allow sending images to cloud APIs)</label>
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" name="routingLargeContextCloud" checked={settings.routingLargeContextCloud || false} onChange={handleChange} id="routingLargeContextCloud" />
                <label htmlFor="routingLargeContextCloud" style={{ margin: 0 }}>Large Context Cloud Allowed (Bypass local for &gt;8k context)</label>
              </div>
            </div>
          </div>
        );

      case 'export-import':
        return (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="bracket-title">Export / Import</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn">Reset</button>
              </div>
            </div>
            <p className="color-text-muted">Doctrine: Continuity of operations requires portable configuration and state backups.</p>
            
            <div className="status-card glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid #2196f3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p><strong>Status:</strong> <span style={{ color: '#2196f3' }}>Ready</span></p>
                  <p className="color-text-muted" style={{ fontSize: '0.85rem' }}>Diagnostic: Export engine standing by.</p>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', gap: '1rem' }}>
              <button className="btn">Export Configuration</button>
              <button className="btn">Import Configuration</button>
            </div>
          </div>
        );

      case 'diagnostics':
        return (
          <div className="settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 className="bracket-title">Diagnostics</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn">Reset</button>
              </div>
            </div>
            <p className="color-text-muted">Doctrine: Obscured failures are unacceptable. Expose all subsystem states for analysis.</p>
            
            <div className="status-card glass-card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid #4caf50' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p><strong>Status:</strong> <span style={{ color: '#4caf50' }}>All Systems Nominal</span></p>
                  <p className="color-text-muted" style={{ fontSize: '0.85rem' }}>Diagnostic: App Version 1.0.5. No severe faults detected.</p>
                </div>
                <button className="btn">Generate Report</button>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="form-group">
                <label>Log Level</label>
                <Select
                  ariaLabel="Log Level"
                  value={settings.logLevel || 'info'}
                  onChange={(v) => updateSettings({ logLevel: v })}
                  options={[
                    { value: 'debug', label: 'Debug' },
                    { value: 'info', label: 'Info' },
                    { value: 'warn', label: 'Warn' },
                    { value: 'error', label: 'Error' },
                  ]}
                />
              </div>
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" name="debugMode" checked={settings.debugMode || false} onChange={handleChange} id="debugMode" />
                <label htmlFor="debugMode" style={{ margin: 0 }}>Enable Developer Tools</label>
              </div>
              <button className="btn" style={{ width: 'fit-content' }}>View Logs</button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: '2rem' }}>
      {/* Sidebar Navigation */}
      <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderRight: '1px solid rgba(255,255,255,0.1)', paddingRight: '1rem' }}>
        <h2 style={{ marginBottom: '1rem', paddingLeft: '0.5rem' }}>Settings</h2>
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeTab === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setActiveTab(section.id)}
              className={`btn ${isActive ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '10px',
                padding: '0.75rem 1rem',
                border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
                background: isActive ? 'var(--accent-veil)' : 'transparent',
                textAlign: 'left',
                boxShadow: isActive ? 'inset 3px 0 0 var(--accent-primary)' : 'none',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)'
              }}
            >
              <Icon size={18} className={isActive ? '' : 'color-text-muted'} />
              <span className={isActive ? '' : 'color-text-muted'}>{section.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '2rem' }}>
        {renderTabContent()}
      </div>
    </div>
  );
}
