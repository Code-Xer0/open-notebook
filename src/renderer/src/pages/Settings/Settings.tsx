import React from 'react';
import {
  Activity,
  Cloud,
  Cpu,
  Database,
  DownloadCloud,
  Eye,
  HardDrive,
  Monitor,
  Moon,
  Network,
  Palette,
  RefreshCw,
  Route,
  Settings as SettingsIcon,
  ShieldAlert,
  Sun
} from 'lucide-react';
import { ModelSelect } from '../../components/ModelSelect';
import { Select } from '../../components/Select';
import { api } from '../../services/api';
import { openSidecarLog, refreshSidecarsOnce, restartSidecars } from '../../services/sidecars';
import { useStore } from '../../store/useStore';
import { codexDarkTheme, codexLightTheme, themePresets, themeSwatchKeys, type ThemeMode } from '../../theme';
import type { CredentialStatus } from '../../types/runtime';

const SECTIONS = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'themes', label: 'Themes', icon: Palette },
  { id: 'local-models', label: 'Local Models', icon: Cpu },
  { id: 'cloud-providers', label: 'Cloud Providers', icon: Cloud },
  { id: 'edge-nodes', label: 'Edge Nodes', icon: Network },
  { id: 'embeddings', label: 'Embeddings', icon: Database },
  { id: 'ocr-vision', label: 'OCR / Vision', icon: Eye },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'privacy', label: 'Privacy', icon: ShieldAlert },
  { id: 'routing', label: 'Routing', icon: Route },
  { id: 'export-import', label: 'Export / Import', icon: DownloadCloud },
  { id: 'diagnostics', label: 'Diagnostics', icon: Activity }
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];
type Tone = 'healthy' | 'warning' | 'error' | 'muted' | 'accent';

interface BackendModel {
  id: string;
  name: string;
  provider: string;
  type: string;
  credential?: string | null;
}

interface DefaultModels {
  default_chat_model?: string | null;
  default_transformation_model?: string | null;
  large_context_model?: string | null;
  default_text_to_speech_model?: string | null;
  default_speech_to_text_model?: string | null;
  default_embedding_model?: string | null;
  default_tools_model?: string | null;
}

const toneColor: Record<Tone, string> = {
  healthy: 'var(--signal-healthy)',
  warning: 'var(--signal-warning)',
  error: 'var(--signal-error)',
  muted: 'var(--text-muted)',
  accent: 'var(--accent-primary)'
};

function StatusCard({ title, status, detail, tone = 'muted', action }: {
  title: string;
  status: string;
  detail: string;
  tone?: Tone;
  action?: React.ReactNode;
}) {
  return (
    <div className="settings-status" style={{ ['--status-color' as string]: toneColor[tone] } as React.CSSProperties}>
      <div>
        <span>{title}</span>
        <strong>{status}</strong>
        <p>{detail}</p>
      </div>
      {action}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="form-group">
      <label>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

function CheckboxField({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <label className="settings-check" style={{ opacity: disabled ? 0.65 : 1 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Settings() {
  const { settings, updateSettings, backend, sidecars, diagnostics } = useStore();
  const [activeTab, setActiveTab] = React.useState<SectionId>('general');
  const [logResult, setLogResult] = React.useState<string | null>(null);
  const [credentialStatus, setCredentialStatus] = React.useState<CredentialStatus | null>(null);
  const [credentialStatusError, setCredentialStatusError] = React.useState<string | null>(null);
  const [backendModels, setBackendModels] = React.useState<BackendModel[]>([]);
  const [defaultModels, setDefaultModels] = React.useState<DefaultModels | null>(null);
  const [bootstrapDraft, setBootstrapDraft] = React.useState({
    provider: 'openai',
    name: 'OpenAI default credential',
    apiKey: '',
    chatModel: 'gpt-4o-mini'
  });
  const [bootstrapStatus, setBootstrapStatus] = React.useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = React.useState(false);

  const hasStalePortOwner = Boolean(sidecars?.ports.some((port) => port.staleExternal));
  const sidecarsReady = sidecars?.surreal.phase === 'online' && sidecars?.backend.phase === 'online' && !hasStalePortOwner;
  const backendTone: Tone = backend.status === 'online' ? 'accent' : backend.status === 'offline' ? 'error' : 'warning';

  React.useEffect(() => {
    let cancelled = false;
    async function loadCredentialStatus() {
      if (backend.status !== 'online') {
        setCredentialStatus(null);
        setCredentialStatusError(null);
        setBackendModels([]);
        setDefaultModels(null);
        return;
      }
      try {
        const [status, defaults, models] = await Promise.all([
          api.credentials.status(),
          api.models.getDefaults(),
          api.models.list()
        ]);
        if (!cancelled) {
          setCredentialStatus(status);
          setDefaultModels(defaults);
          setBackendModels(Array.isArray(models) ? models : []);
          setCredentialStatusError(null);
        }
      } catch (error: any) {
        if (!cancelled) {
          setCredentialStatus(null);
          setDefaultModels(null);
          setBackendModels([]);
          setCredentialStatusError(error?.response?.data?.detail || error?.message || 'Credential status unavailable');
        }
      }
    }
    void loadCredentialStatus();
    return () => {
      cancelled = true;
    };
  }, [backend.status]);

  async function refreshProviderSetup() {
    if (backend.status !== 'online') return;
    const [status, defaults, models] = await Promise.all([
      api.credentials.status(),
      api.models.getDefaults(),
      api.models.list()
    ]);
    setCredentialStatus(status);
    setDefaultModels(defaults);
    setBackendModels(Array.isArray(models) ? models : []);
    setCredentialStatusError(null);
  }

  async function handleBootstrapChatProvider() {
    setIsBootstrapping(true);
    setBootstrapStatus(null);
    try {
      if (!bootstrapDraft.apiKey.trim()) {
        setBootstrapStatus('Enter a provider API key before creating a backend credential.');
        return;
      }
      if (!bootstrapDraft.chatModel.trim()) {
        setBootstrapStatus('Enter a chat model name before assigning a default model.');
        return;
      }

      const credential = await api.credentials.create({
        name: bootstrapDraft.name.trim() || `${bootstrapDraft.provider} credential`,
        provider: bootstrapDraft.provider,
        modalities: ['language'],
        api_key: bootstrapDraft.apiKey.trim()
      });
      const testResult = await api.credentials.test(credential.id);

      let model = backendModels.find((item) => (
        item.provider === bootstrapDraft.provider
        && item.type === 'language'
        && item.name.toLowerCase() === bootstrapDraft.chatModel.trim().toLowerCase()
      ));

      if (!model) {
        model = await api.models.create({
          name: bootstrapDraft.chatModel.trim(),
          provider: bootstrapDraft.provider,
          type: 'language',
          credential: credential.id
        });
      }
      if (!model) {
        throw new Error('Backend did not return a model record.');
      }

      await api.models.updateDefaults({
        ...(defaultModels || {}),
        default_chat_model: model.id
      });
      await refreshProviderSetup();
      setBootstrapDraft((current) => ({ ...current, apiKey: '' }));
      setBootstrapStatus(
        testResult?.success
          ? `Credential test passed. Default chat model set to ${bootstrapDraft.provider}/${model.name}.`
          : `Credential saved and default chat model set, but test did not pass: ${testResult?.message || 'provider did not confirm readiness'}`
      );
    } catch (error: any) {
      setBootstrapStatus(error?.response?.data?.detail || error?.message || 'Provider bootstrap failed.');
    } finally {
      setIsBootstrapping(false);
    }
  }

  async function handleOpenLog() {
    const result = await openSidecarLog();
    setLogResult(result || 'Opened sidecar log.');
  }

  const sectionTitle = SECTIONS.find((s) => s.id === activeTab)?.label ?? 'Settings';

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <>
            <StatusCard
              title="Backend"
              status={backend.status === 'online' ? `Reachable${backend.version ? ` - v${backend.version}` : ''}` : backend.status === 'offline' ? 'Offline' : backend.status === 'connecting' ? 'Connecting' : 'Unknown'}
              detail={backend.status === 'online' ? 'Local API is reachable on 127.0.0.1:5055.' : 'Notebook data, sources, and grounded chat require the local API.'}
              tone={backendTone}
            />
            <div className="settings-grid">
              <Field label="Language" hint="UI language is currently fixed while localization is not implemented.">
                <Select
                  ariaLabel="Language"
                  value="en-US"
                  disabled
                  onChange={() => undefined}
                  options={[{ value: 'en-US', label: 'English (US)' }]}
                />
              </Field>
              <CheckboxField label="Launch on System Startup" checked={Boolean(settings.launchOnStartup)} onChange={(launchOnStartup) => updateSettings({ launchOnStartup })} />
            </div>
          </>
        );

      case 'themes': {
        const activeMode = settings.themeMode || 'system';
        const editMode = activeMode === 'dark' ? 'dark' : 'light';
        const baseColors = editMode === 'dark' ? codexDarkTheme : codexLightTheme;
        const activeOverrides = settings.themeCustomizations?.[editMode] || (editMode === 'light' ? settings.themeCustomization : {});
        const customColors = { ...baseColors, ...(activeOverrides || {}) };
        const modeOptions: Array<{ value: ThemeMode; label: string; icon: React.ReactNode }> = [
          { value: 'light', label: 'Light', icon: <Sun size={15} /> },
          { value: 'dark', label: 'Dark', icon: <Moon size={15} /> },
          { value: 'system', label: 'System', icon: <Monitor size={15} /> }
        ];

        return (
          <>
            <StatusCard
              title="Theme Engine"
              status="Auto-saved"
              detail="Light, Dark, and System modes use first-class CODEX palettes. Custom swatches apply only when advanced overrides are enabled."
              tone="accent"
              action={<button className="btn" onClick={() => updateSettings({ themeMode: 'system', customThemeEnabled: false, themeCustomization: codexLightTheme, themeCustomizations: { light: codexLightTheme, dark: codexDarkTheme } })}>Reset</button>}
            />

            <div className="settings-header" style={{ marginBottom: '16px' }}>
              <div>
                <div className="workspace-kicker">Theme Mode</div>
                <h3 style={{ fontSize: '14px', color: 'var(--text-main)', marginTop: '4px' }}>Choose the primary light/dark behavior.</h3>
              </div>
            </div>

            <div className="theme-mode-control" role="group" aria-label="Theme mode">
              {modeOptions.map((mode) => (
                <button
                  key={mode.value}
                  className={activeMode === mode.value ? 'selected' : ''}
                  onClick={() => updateSettings({ themeMode: mode.value })}
                >
                  {mode.icon}
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>

            <div className="settings-header" style={{ marginTop: '24px', marginBottom: '16px' }}>
              <div>
                <div className="workspace-kicker">Primary Presets</div>
                <h3 style={{ fontSize: '14px', color: 'var(--text-main)', marginTop: '4px' }}>Apply the CODEX base palette for the chosen mode.</h3>
              </div>
            </div>

            <div className="theme-preset-grid">
              {themePresets.map((preset) => (
                <button
                  key={preset.id}
                  className="theme-preset-card"
                  onClick={() => updateSettings({
                    themeMode: preset.mode,
                    customThemeEnabled: false,
                    themeCustomization: preset.mode === 'light' ? preset.colors : settings.themeCustomization,
                    themeCustomizations: {
                      ...(settings.themeCustomizations || {}),
                      [preset.mode]: preset.colors
                    }
                  })}
                >
                  <span className="theme-preset-title">{preset.name}</span>
                  <span className="theme-preset-detail">{preset.description}</span>
                  <span className="theme-swatch-row">
                    {themeSwatchKeys.slice(0, 6).map((key) => (
                      <i key={key} style={{ background: preset.colors[key] }} />
                    ))}
                  </span>
                </button>
              ))}
            </div>

            <div className="settings-grid" style={{ marginBottom: '24px' }}>
              <Field label="Interface Skin" hint="Structural layout wrappers.">
                <Select
                  ariaLabel="Theme Family"
                  value={settings.themeFamily || 'notebook'}
                  onChange={(v) => updateSettings({ themeFamily: v as typeof settings.themeFamily })}
                  options={[
                    { value: 'notebook', label: 'Default' },
                    { value: 'operator-crimson', label: 'Operator' }
                  ]}
                />
              </Field>
              <Field label="Density">
                <Select
                  ariaLabel="Theme Density"
                  value={settings.themeDensity || 'comfortable'}
                  onChange={(v) => updateSettings({ themeDensity: v as typeof settings.themeDensity })}
                  options={[
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'dense', label: 'Dense' },
                    { value: 'operator-dense', label: 'Operator Dense' }
                  ]}
                />
              </Field>
            </div>

            <div className="settings-header" style={{ marginBottom: '16px' }}>
              <div>
                <div className="workspace-kicker">Advanced Overrides</div>
                <h3 style={{ fontSize: '14px', color: 'var(--text-main)', marginTop: '4px' }}>Granular swatches edit the {editMode} palette and are optional.</h3>
              </div>
            </div>

            <div className="settings-actions-row" style={{ marginBottom: '16px' }}>
              <CheckboxField
                label="Use custom swatches over the selected light/dark palette"
                checked={Boolean(settings.customThemeEnabled)}
                onChange={(customThemeEnabled) => updateSettings({ customThemeEnabled })}
              />
            </div>

            <div className="settings-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {themeSwatchKeys.map((key) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--panel-bg)', border: '1px solid var(--panel-border)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                  <input
                    type="color"
                    value={customColors[key]}
                    onChange={(e) => updateSettings({
                      customThemeEnabled: true,
                      themeCustomization: editMode === 'light'
                        ? { ...settings.themeCustomization, [key]: e.target.value }
                        : settings.themeCustomization,
                      themeCustomizations: {
                        ...(settings.themeCustomizations || {}),
                        [editMode]: {
                          ...(settings.themeCustomizations?.[editMode] || {}),
                          [key]: e.target.value
                        }
                      }
                    })}
                    style={{ width: '32px', height: '32px', padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: '4px', overflow: 'hidden' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', textTransform: 'capitalize' }}>{key}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{customColors[key]}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      }

      case 'local-models':
        return (
          <>
            <StatusCard
              title="Ollama"
              status={settings.ollamaEndpoint ? 'Configured - health unknown' : 'Not configured'}
              detail={settings.ollamaEndpoint ? 'Use model discovery to verify the local daemon.' : 'Set an endpoint before local model discovery.'}
              tone={settings.ollamaEndpoint ? 'warning' : 'muted'}
            />
            <div className="settings-grid">
              <Field label="Ollama Endpoint">
                <input className="glass-input" value={settings.ollamaEndpoint || ''} onChange={(e) => updateSettings({ ollamaEndpoint: e.target.value })} placeholder="http://localhost:11434" />
              </Field>
              <Field label="Default Chat Model">
                <ModelSelect source="ollama" ollamaEndpoint={settings.ollamaEndpoint} value={settings.defaultChatModel || ''} onChange={(defaultChatModel) => updateSettings({ defaultChatModel })} placeholder="e.g. llama3:latest" />
              </Field>
              <Field label="Default Embedding Model">
                <ModelSelect source="ollama" ollamaEndpoint={settings.ollamaEndpoint} value={settings.defaultEmbeddingModel || ''} onChange={(defaultEmbeddingModel) => updateSettings({ defaultEmbeddingModel })} placeholder="e.g. nomic-embed-text" />
              </Field>
              <Field label="Default Vision Model">
                <ModelSelect source="ollama" ollamaEndpoint={settings.ollamaEndpoint} value={settings.defaultVisionModel || ''} onChange={(defaultVisionModel) => updateSettings({ defaultVisionModel })} placeholder="e.g. llava" />
              </Field>
            </div>
          </>
        );

      case 'cloud-providers': {
        const providerRows = ['openai', 'anthropic', 'google', 'elevenlabs', 'openai_compatible'];
        const presentProviders = providerRows.filter((provider) => credentialStatus?.present?.[provider] || credentialStatus?.configured?.[provider]);
        const usableProviders = providerRows.filter((provider) => credentialStatus?.usable?.[provider]);
        const defaultChatModel = backendModels.find((model) => model.id === defaultModels?.default_chat_model);
        const defaultChatUsable = defaultChatModel ? Boolean(credentialStatus?.usable?.[defaultChatModel.provider]) : false;
        return (
          <>
            <StatusCard
              title="Cloud Providers"
              status={credentialStatusError ? 'Status unavailable' : usableProviders.length ? `Usable tested: ${usableProviders.join(', ')}` : presentProviders.length ? 'Provider material present - not verified' : 'No backend providers present'}
              detail={credentialStatusError || 'Provider truth comes from backend credential records plus persisted credential tests, not renderer localStorage fields.'}
              tone={credentialStatusError ? 'error' : usableProviders.length ? 'healthy' : presentProviders.length ? 'warning' : 'muted'}
            />
            <StatusCard
              title="Chat Bootstrap"
              status={defaultChatModel ? `Default: ${defaultChatModel.provider}/${defaultChatModel.name}` : 'No backend default chat model'}
              detail={defaultChatModel ? (defaultChatUsable ? 'Grounded chat can enable because the matching provider has a passing backend test.' : 'Default model exists, but chat stays blocked until the matching backend credential test passes.') : 'Create/test a backend credential, register a language model, and assign it as the default chat model.'}
              tone={defaultChatUsable ? 'healthy' : defaultChatModel ? 'warning' : 'warning'}
              action={<button className="btn" onClick={() => void refreshProviderSetup()} disabled={backend.status !== 'online'}><RefreshCw size={14} /> Refresh</button>}
            />
            <div className="settings-grid" style={{ marginBottom: '18px' }}>
              <Field label="Provider">
                <Select
                  ariaLabel="Bootstrap Provider"
                  value={bootstrapDraft.provider}
                  onChange={(provider) => setBootstrapDraft((current) => ({ ...current, provider }))}
                  options={[
                    { value: 'openai', label: 'OpenAI' },
                    { value: 'anthropic', label: 'Anthropic' },
                    { value: 'google', label: 'Google' },
                    { value: 'openai_compatible', label: 'OpenAI Compatible' }
                  ]}
                />
              </Field>
              <Field label="Credential Name">
                <input
                  className="glass-input"
                  value={bootstrapDraft.name}
                  onChange={(e) => setBootstrapDraft((current) => ({ ...current, name: e.target.value }))}
                  placeholder="Backend credential label"
                />
              </Field>
              <Field label="API Key" hint="Stored encrypted by the backend; this field is cleared after submit.">
                <input
                  className="glass-input"
                  type="password"
                  value={bootstrapDraft.apiKey}
                  onChange={(e) => setBootstrapDraft((current) => ({ ...current, apiKey: e.target.value }))}
                  placeholder="Provider API key"
                />
              </Field>
              <Field label="Default Chat Model">
                <input
                  className="glass-input"
                  value={bootstrapDraft.chatModel}
                  onChange={(e) => setBootstrapDraft((current) => ({ ...current, chatModel: e.target.value }))}
                  placeholder="e.g. gpt-4o-mini"
                />
              </Field>
            </div>
            <div className="settings-actions-row" style={{ marginBottom: '18px' }}>
              <button className="btn primary" disabled={isBootstrapping || backend.status !== 'online'} onClick={() => void handleBootstrapChatProvider()}>
                {isBootstrapping ? 'Testing...' : 'Create/Test And Set Chat Default'}
              </button>
              <button className="btn" disabled={backend.status !== 'online'} onClick={() => void api.models.autoAssign().then(refreshProviderSetup).catch((error) => setBootstrapStatus(error?.response?.data?.detail || error?.message || 'Auto-assign failed.'))}>
                Auto-Assign Existing Models
              </button>
            </div>
            {bootstrapStatus && <div className="settings-note" style={{ marginBottom: '18px' }}>{bootstrapStatus}</div>}
            <div className="settings-grid">
              {providerRows.map((provider) => {
                const present = Boolean(credentialStatus?.present?.[provider] || credentialStatus?.configured?.[provider]);
                const tested = Boolean(credentialStatus?.tested?.[provider]);
                const usable = Boolean(credentialStatus?.usable?.[provider]);
                const source = credentialStatus?.source?.[provider] || 'none';
                const lastMessage = credentialStatus?.lastTestMessage?.[provider];
                return (
                  <StatusCard
                    key={provider}
                    title={provider.replace('_', ' ')}
                    status={usable ? `Usable via ${source}` : present ? (tested ? 'Test failed or stale' : `Present via ${source} - not tested`) : 'Not configured'}
                    detail={usable ? (lastMessage || 'Latest backend credential test passed.') : present ? (lastMessage || 'Run a backend credential test before treating this provider as usable.') : 'No backend credential or environment key is reported for this provider.'}
                    tone={usable ? 'healthy' : present ? 'warning' : 'muted'}
                  />
                );
              })}
              <StatusCard
                title="Credential Encryption"
                status={credentialStatus?.encryption_configured ? 'Configured' : 'Not verified'}
                detail="Creating or updating backend credential records requires the backend encryption key."
                tone={credentialStatus?.encryption_configured ? 'accent' : 'muted'}
              />
            </div>
          </>
        );
      }

      case 'edge-nodes':
        return (
          <>
            <StatusCard
              title="Edge Nodes"
              status={settings.edgeNodeRegistry ? 'Registry set - not verified' : 'Not configured'}
              detail="Edge execution requires an explicit successful health check before use."
              tone={settings.edgeNodeRegistry ? 'warning' : 'muted'}
            />
            <div className="settings-grid">
              <Field label="Registry URL">
                <input className="glass-input" value={settings.edgeNodeRegistry || ''} onChange={(e) => updateSettings({ edgeNodeRegistry: e.target.value })} placeholder="wss://edge.local" />
              </Field>
              <Field label="Capability Requirements">
                <input className="glass-input" value={settings.edgeCapabilities || ''} onChange={(e) => updateSettings({ edgeCapabilities: e.target.value })} placeholder="gpu>=8gb, ram>=16gb" />
              </Field>
              <Field label="Preferred Fallback">
                <Select ariaLabel="Preferred Fallback" value={settings.edgeFallback || 'cloud'} onChange={(edgeFallback) => updateSettings({ edgeFallback })} options={[
                  { value: 'cloud', label: 'Cloud Provider' },
                  { value: 'local', label: 'Local Model' },
                  { value: 'fail', label: 'Fail Fast' }
                ]} />
              </Field>
              <CheckboxField label="Enable Continuous Health Checks" checked={Boolean(settings.edgeHealthChecks)} onChange={(edgeHealthChecks) => updateSettings({ edgeHealthChecks })} />
            </div>
          </>
        );

      case 'embeddings':
        return (
          <>
            <StatusCard
              title="Embedding Pipeline"
              status={settings.embeddingModel ? 'Configured - health unknown' : 'No model selected'}
              detail="Vector generation is not healthy until a real embedding request succeeds."
              tone={settings.embeddingModel ? 'warning' : 'muted'}
            />
            <div className="settings-grid">
              <Field label="Embedding Model">
                <ModelSelect source="ollama" ollamaEndpoint={settings.ollamaEndpoint} value={settings.embeddingModel || ''} onChange={(embeddingModel) => updateSettings({ embeddingModel })} placeholder="e.g. nomic-embed-text" />
              </Field>
              <Field label="Embedding Dimension">
                <input className="glass-input" type="number" value={settings.embeddingDimension || 1536} onChange={(e) => updateSettings({ embeddingDimension: Number(e.target.value) })} />
              </Field>
              <Field label="Chunk Size">
                <input className="glass-input" type="number" value={settings.embeddingChunkSize || 500} onChange={(e) => updateSettings({ embeddingChunkSize: Number(e.target.value) })} />
              </Field>
            </div>
          </>
        );

      case 'ocr-vision':
        return (
          <>
            <StatusCard
              title="OCR / Vision"
              status={settings.visionProvider === 'disabled' ? 'Disabled' : 'Configured - not wired'}
              detail="Image, OCR, and video lanes remain explicit scaffolds until backend verification exists."
              tone={settings.visionProvider === 'disabled' ? 'muted' : 'warning'}
            />
            <div className="settings-grid">
              <Field label="Vision Provider">
                <Select ariaLabel="Vision Provider" value="disabled" disabled onChange={() => undefined} options={[
                  { value: 'disabled', label: 'Disabled' },
                ]} />
              </Field>
              <Field label="Vision Model">
                <input className="glass-input" value="" disabled onChange={() => undefined} placeholder="Not wired" />
              </Field>
              <Field label="OCR Engine">
                <Select ariaLabel="OCR Engine" value="disabled" disabled onChange={() => undefined} options={[
                  { value: 'disabled', label: 'Not wired' }
                ]} />
              </Field>
              <CheckboxField label="Auto-detect scanned PDFs" checked={false} disabled onChange={() => undefined} />
              <CheckboxField label="Extract and OCR inline images" checked={false} disabled onChange={() => undefined} />
            </div>
          </>
        );

      case 'storage':
        return (
          <>
            <StatusCard title="Storage" status="Not verified" detail="Use backend diagnostics before claiming read/write health." tone="muted" />
            <div className="settings-grid">
              <Field label="Storage Path">
                <input className="glass-input" value={settings.storagePath || ''} onChange={(e) => updateSettings({ storagePath: e.target.value })} placeholder="default" />
              </Field>
              <Field label="Database Type">
                <Select ariaLabel="Database Type" value="surrealdb" disabled onChange={() => undefined} options={[
                  { value: 'surrealdb', label: 'SurrealDB sidecar' }
                ]} />
              </Field>
            </div>
          </>
        );

      case 'privacy':
        return (
          <>
            <StatusCard
              title="Privacy"
              status={settings.privacyMode === 'strict' ? 'Strict local preference' : 'Cloud use may be allowed'}
              detail="This is routing policy, not proof that every pipeline has enforced it yet."
              tone={settings.privacyMode === 'strict' ? 'accent' : 'warning'}
            />
            <div className="settings-grid">
              <Field label="Privacy Mode">
                <Select ariaLabel="Privacy Mode" value={settings.privacyMode || 'strict'} onChange={(privacyMode) => updateSettings({ privacyMode: privacyMode as typeof settings.privacyMode })} options={[
                  { value: 'strict', label: 'Strict (Local Only)' },
                  { value: 'balanced', label: 'Balanced (Ask before Cloud)' },
                  { value: 'none', label: 'Permissive (Cloud Allowed)' }
                ]} />
              </Field>
              <CheckboxField label="Enable PII Redaction" checked={settings.redactionEnabled ?? true} onChange={(redactionEnabled) => updateSettings({ redactionEnabled })} />
              <CheckboxField label="Send Anonymous Telemetry" checked={Boolean(settings.telemetryEnabled)} onChange={(telemetryEnabled) => updateSettings({ telemetryEnabled })} />
            </div>
          </>
        );

      case 'routing':
        return (
          <>
            <StatusCard title="Routing" status="Configured locally" detail="Rules are settings only until a real request exercises them." tone="accent" />
            <div className="settings-grid">
              <Field label="Primary Routing Strategy">
                <Select ariaLabel="Primary Routing Strategy" value={settings.routingStrategy || 'prefer-local'} onChange={(routingStrategy) => updateSettings({ routingStrategy })} options={[
                  { value: 'prefer-local', label: 'Prefer Local' },
                  { value: 'prefer-cloud', label: 'Prefer Cloud' },
                  { value: 'prefer-edge', label: 'Prefer Edge' }
                ]} />
              </Field>
              <CheckboxField label="Privacy Strict" checked={Boolean(settings.routingPrivacyStrict)} onChange={(routingPrivacyStrict) => updateSettings({ routingPrivacyStrict })} />
              <CheckboxField label="OCR Cloud Allowed" checked={Boolean(settings.routingOcrCloud)} onChange={(routingOcrCloud) => updateSettings({ routingOcrCloud })} />
              <CheckboxField label="Large Context Cloud Allowed" checked={Boolean(settings.routingLargeContextCloud)} onChange={(routingLargeContextCloud) => updateSettings({ routingLargeContextCloud })} />
            </div>
          </>
        );

      case 'export-import':
        return (
          <>
            <StatusCard title="Export / Import" status="Not wired" detail="Configuration export/import controls should stay disabled until implemented." tone="muted" />
            <div className="settings-actions-row">
              <button className="btn" disabled>Export Configuration</button>
              <button className="btn" disabled>Import Configuration</button>
            </div>
          </>
        );

      case 'diagnostics':
        return (
          <>
            <StatusCard
              title="Sidecars"
              status={sidecarsReady ? 'Owned ports reachable' : 'Not verified'}
              detail={hasStalePortOwner ? 'A required port is owned by an external process.' : sidecars?.lastError || sidecars?.backend.message || 'Waiting for Electron sidecar status.'}
              tone={sidecarsReady ? 'healthy' : sidecars?.lastError || hasStalePortOwner ? 'error' : 'warning'}
              action={<button className="btn" onClick={() => void refreshSidecarsOnce()}><RefreshCw size={14} /> Refresh</button>}
            />
            <div className="diagnostics-grid">
              <div className="diagnostic-row"><span>Docker</span><strong>{diagnostics?.runtimeDependencies?.docker?.status || 'not required'}</strong></div>
              <div className="diagnostic-row"><span>Mode</span><strong>{sidecars?.mode || 'Unknown'}</strong></div>
              <div className="diagnostic-row"><span>App version</span><strong>{sidecars?.appVersion || 'Unknown'}</strong></div>
              <div className="diagnostic-row"><span>Data dir</span><strong title={diagnostics?.runtimeDependencies?.dataDir?.path || sidecars?.dataDir}>{diagnostics?.runtimeDependencies?.dataDir?.path || sidecars?.dataDir || 'Unknown'}</strong></div>
              <div className="diagnostic-row"><span>Log path</span><strong title={diagnostics?.runtimeDependencies?.logPath?.path || sidecars?.logPath}>{diagnostics?.runtimeDependencies?.logPath?.path || sidecars?.logPath || 'Unknown'}</strong></div>
              <div className="diagnostic-row"><span>Backend resource</span><strong title={diagnostics?.runtimeDependencies?.backend?.path || sidecars?.resources.backendPath}>{diagnostics?.runtimeDependencies?.backend?.exists || sidecars?.resources.backendExists ? 'Present' : 'Missing'}</strong></div>
              <div className="diagnostic-row"><span>Surreal resource</span><strong title={diagnostics?.runtimeDependencies?.surreal?.path || sidecars?.resources.surrealPath}>{diagnostics?.runtimeDependencies?.surreal?.exists || sidecars?.resources.surrealExists ? 'Present' : 'Missing'}</strong></div>
              <div className="diagnostic-row"><span>Evidence vault</span><strong title={diagnostics?.evidence?.evidenceRoot}>{diagnostics?.evidence?.writable ? 'Writable' : diagnostics?.evidence?.status || 'Not verified'}</strong></div>
              <div className="diagnostic-row"><span>Evidence assets</span><strong>{diagnostics?.evidence?.assetCount ?? 'Unknown'}</strong></div>
              <div className="diagnostic-row"><span>Snapshot manifests</span><strong>{diagnostics?.evidence?.snapshotCount ?? 'Unknown'} · restore unsupported</strong></div>
              <div className="diagnostic-row"><span>Latest snapshot</span><strong title={diagnostics?.evidence?.latestSnapshot?.manifestSha256}>{diagnostics?.evidence?.latestSnapshot?.reason || 'None recorded'}</strong></div>
              <div className="diagnostic-row"><span>SurrealDB</span><strong>{sidecars?.surreal.phase || 'Unknown'} {sidecars?.surreal.pid ? `pid ${sidecars.surreal.pid}` : ''}</strong></div>
              <div className="diagnostic-row"><span>Python API</span><strong>{sidecars?.backend.phase || 'Unknown'} {sidecars?.backend.pid ? `pid ${sidecars.backend.pid}` : ''}</strong></div>
              <div className="diagnostic-row"><span>Port owners</span><strong>{sidecars?.ports.length ? sidecars.ports.map((port) => `${port.port}:${port.pid || 'none'}${port.staleExternal ? ' stale' : port.ownedByCodex ? ' owned' : ''}`).join(' / ') : 'Unknown'}</strong></div>
              <div className="diagnostic-row"><span>Watchdog</span><strong>{sidecars?.watchdog.restartPending ? 'Restart pending' : sidecars?.watchdog.lastRestartReason || 'Idle'}</strong></div>
              <div className="diagnostic-row"><span>Previous sidecar PIDs</span><strong>{sidecars?.resources.previousPids.length ? sidecars.resources.previousPids.join(', ') : 'None recorded'}</strong></div>
            </div>
            <div className="settings-grid" style={{ marginTop: '18px' }}>
              {Object.entries(diagnostics?.capabilities || {}).map(([name, fact]) => (
                <StatusCard
                  key={name}
                  title={name.replace(/([A-Z])/g, ' $1')}
                  status={fact.status}
                  detail={fact.blockingReason || fact.lastError || fact.evidence}
                  tone={fact.status === 'ready' || fact.status === 'stored' || fact.status === 'reachable' ? 'healthy' : fact.status === 'failed' ? 'error' : fact.status === 'not verified' || fact.status === 'mock' ? 'muted' : 'warning'}
                />
              ))}
            </div>
            <div className="settings-actions-row">
              <button className="btn" onClick={() => void restartSidecars()}><RefreshCw size={14} /> Restart Sidecars</button>
              <button className="btn" onClick={() => void handleOpenLog()}>Open Sidecar Log</button>
            </div>
            {logResult && <div className="settings-note">{logResult}</div>}
          </>
        );
    }
  };

  return (
    <div className="settings-layout">
      <aside className="settings-nav">
        <div>
          <h1>Settings</h1>
          <p>Auto-saved local preferences and diagnostics.</p>
        </div>
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeTab === section.id;
          return (
            <button key={section.id} onClick={() => setActiveTab(section.id)} className={active ? 'active' : ''}>
              <Icon size={17} />
              <span>{section.label}</span>
            </button>
          );
        })}
      </aside>

      <section className="settings-content">
        <div className="settings-header">
          <div>
            <div className="workspace-kicker">Auto-saved</div>
            <h2>{sectionTitle}</h2>
          </div>
        </div>
        {renderContent()}
      </section>
    </div>
  );
}
