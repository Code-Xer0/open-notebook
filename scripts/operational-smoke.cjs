#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const backendMode = process.argv.find((arg) => arg.startsWith('--backend='))?.split('=')[1] || 'source';
const keepAlive = args.has('--keep-alive');
const apiPassword = 'open-notebook-change-me';
const apiBase = 'http://127.0.0.1:5055/api';
const healthUrl = 'http://127.0.0.1:5055/health';
const runId = crypto.randomBytes(8).toString('hex');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `codex-operational-smoke-${runId}-`));
const runtimeDir = path.join(tempRoot, 'runtime');
const surrealDir = path.join(tempRoot, 'surreal');

fs.mkdirSync(runtimeDir, { recursive: true });
fs.mkdirSync(surrealDir, { recursive: true });

const children = [];
const proof = {
  runId,
  tempRoot,
  backendMode,
  checks: [],
  startedAt: new Date().toISOString(),
};

function record(name, status, details = {}) {
  proof.checks.push({ name, status, ...details });
  const icon = status === 'passed' ? 'ok' : status === 'blocked' ? 'blocked' : 'failed';
  console.log(`[${icon}] ${name}${details.detail ? ` - ${details.detail}` : ''}`);
}

function fail(name, error) {
  record(name, 'failed', { detail: error.message || String(error) });
  throw error;
}

function responseItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.capsules)) return payload.capsules;
  return [];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function waitForPort(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortListening(port)) return true;
    await wait(500);
  }
  return false;
}

function spawnLogged(label, command, commandArgs, options = {}) {
  const outPath = path.join(tempRoot, `${label}.out.log`);
  const errPath = path.join(tempRoot, `${label}.err.log`);
  const out = fs.openSync(outPath, 'a');
  const err = fs.openSync(errPath, 'a');
  const child = spawn(command, commandArgs, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    windowsHide: true,
    stdio: ['ignore', out, err],
    shell: options.shell || false,
  });
  child.__label = label;
  child.__outPath = outPath;
  child.__errPath = errPath;
  children.push(child);
  return child;
}

function runTaskkill(pid) {
  return new Promise((resolve) => {
    if (!pid || process.platform !== 'win32') return resolve();
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    killer.once('exit', () => resolve());
    killer.once('error', () => resolve());
  });
}

async function cleanup() {
  proof.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(tempRoot, 'proof.json'), JSON.stringify(proof, null, 2));
  if (keepAlive) {
    console.log(`[info] keeping smoke sidecars alive; proof at ${path.join(tempRoot, 'proof.json')}`);
    return;
  }
  for (const child of [...children].reverse()) {
    if (child.exitCode === null && !child.killed) {
      await runTaskkill(child.pid);
      try {
        child.kill('SIGKILL');
      } catch {
        // best effort cleanup
      }
    }
  }
}

async function requestJson(route, options = {}, allowedStatuses = [200]) {
  const url = route.startsWith('http') ? route : `${apiBase}${route}`;
  const headers = {
    Authorization: `Bearer ${apiPassword}`,
    ...(options.headers || {}),
  };
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    body = JSON.stringify(body);
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  const response = await fetch(url, { ...options, headers, body });
  const text = await response.text();
  let parsed = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!allowedStatuses.includes(response.status)) {
    const message = typeof parsed === 'object' && parsed?.detail ? parsed.detail : text;
    throw new Error(`${options.method || 'GET'} ${route} returned ${response.status}: ${message}`);
  }
  return { status: response.status, body: parsed };
}

async function startSidecars() {
  if (await isPortListening(8000)) throw new Error('Port 8000 is already listening; stop the existing sidecar first.');
  if (await isPortListening(5055)) throw new Error('Port 5055 is already listening; stop the existing backend first.');

  const surrealExe = path.join(root, 'resources', 'bin', 'surreal.exe');
  if (!fs.existsSync(surrealExe)) throw new Error(`Missing SurrealDB binary: ${surrealExe}`);
  const surreal = spawnLogged(
    'surreal',
    surrealExe,
    [
      'start',
      '--no-banner',
      '--bind',
      '127.0.0.1:8000',
      '--transaction-timeout',
      '300s',
      '--user',
      'root',
      '--pass',
      'root',
      'surrealkv://surreal.db',
    ],
    { cwd: surrealDir },
  );
  proof.surrealPid = surreal.pid;
  if (!(await waitForPort(8000, 45_000))) {
    fail('surreal sidecar startup', new Error(`SurrealDB did not open port 8000. See ${surreal.__errPath}`));
  }
  record('surreal sidecar startup', 'passed', { pid: surreal.pid });

  const backendEnv = {
    ...process.env,
    API_HOST: '127.0.0.1',
    API_PORT: '5055',
    API_RELOAD: 'false',
    SURREAL_URL: 'ws://127.0.0.1:8000/rpc',
    SURREAL_USER: 'root',
    SURREAL_PASS: 'root',
    SURREAL_NAMESPACE: 'open_notebook',
    SURREAL_DATABASE: 'production',
    CODEX_APP_VERSION: 'operational-smoke',
    CODEX_RESOURCES_PATH: root,
    CODEX_RUNTIME_DATA_DIR: runtimeDir,
    CODEX_BACKEND_LOG_PATH: path.join(tempRoot, 'backend-sidecar.log'),
    CODEX_SURREAL_PATH: surrealExe,
    CODEX_RUNTIME_DOCKER_REQUIRED: 'false',
    OPEN_NOTEBOOK_PASSWORD: apiPassword,
    OPEN_NOTEBOOK_ENCRYPTION_KEY: `operational-smoke-${runId}`,
    OPENAI_API_KEY: '',
    ELEVENLABS_API_KEY: '',
  };

  if (backendMode === 'exe') {
    const backendExe = path.join(root, 'backend', 'dist', 'backend.exe');
    if (!fs.existsSync(backendExe)) throw new Error(`Missing backend executable: ${backendExe}`);
    const backend = spawnLogged('backend', backendExe, [], { cwd: tempRoot, env: backendEnv });
    proof.backendPid = backend.pid;
  } else {
    const backend = spawnLogged('backend', 'uv', ['run', 'python', 'run_api.py'], {
      cwd: path.join(root, 'backend'),
      env: backendEnv,
    });
    proof.backendPid = backend.pid;
  }

  if (!(await waitForPort(5055, 180_000))) {
    fail('backend startup', new Error(`Backend did not open port 5055. See ${path.join(tempRoot, 'backend.err.log')}`));
  }
  record('backend startup', 'passed', { pid: proof.backendPid });
}

async function smoke() {
  await startSidecars();

  const health = await requestJson(healthUrl, { headers: {} });
  if (health.body?.status !== 'reachable') throw new Error(`Unexpected health status: ${JSON.stringify(health.body)}`);
  record('health is shallow reachable', 'passed');

  const diagnostics = (await requestJson('/diagnostics')).body;
  if (diagnostics?.runtimeDependencies?.docker?.status !== 'not required') {
    throw new Error(`Docker dependency status is not factual: ${JSON.stringify(diagnostics?.runtimeDependencies?.docker)}`);
  }
  if (diagnostics?.capabilities?.evidenceVault?.status !== 'ready') {
    throw new Error(`Evidence vault is not ready: ${JSON.stringify(diagnostics?.capabilities?.evidenceVault)}`);
  }
  record('diagnostics runtime/evidence facts', 'passed', {
    docker: diagnostics.runtimeDependencies.docker.status,
    evidence: diagnostics.capabilities.evidenceVault.status,
    evidenceRoot: diagnostics.evidence?.evidenceRoot,
  });

  const notebook = (await requestJson('/notebooks', {
    method: 'POST',
    body: {
      name: `Operational Smoke ${runId}`,
      description: 'Throwaway notebook created by scripts/operational-smoke.cjs',
    },
  })).body;
  record('notebook create', 'passed', { id: notebook.id });

  const sourcePayload = {
    type: 'text',
    title: `Operational Smoke Source ${runId}`,
    content: 'CODEX operational smoke source. This text should become stored context and evidence.',
    notebooks: [notebook.id],
    embed: false,
    delete_source: false,
    async_processing: false,
  };
  const source = (await requestJson('/sources/json', { method: 'POST', body: sourcePayload })).body;
  if (source.evidenceStatus !== 'stored' || !source.sha256) {
    throw new Error(`Source evidence missing: ${JSON.stringify({ evidenceStatus: source.evidenceStatus, sha256: source.sha256 })}`);
  }
  record('text source stored with evidence', 'passed', { id: source.id, sha256: source.sha256 });

  const duplicate = (await requestJson('/sources/json', { method: 'POST', body: sourcePayload })).body;
  if (!Array.isArray(duplicate.duplicateAssetIds) || duplicate.duplicateAssetIds.length === 0) {
    throw new Error(`Duplicate source did not report duplicateAssetIds: ${JSON.stringify(duplicate)}`);
  }
  record('duplicate source hash hint', 'passed', { duplicateAssetIds: duplicate.duplicateAssetIds });

  const context = (await requestJson('/chat/context', {
    method: 'POST',
    body: { notebook_id: notebook.id, context_config: {} },
  })).body;
  if (!context.char_count || !context.context?.sources?.length) {
    throw new Error(`Notebook context did not include stored source: ${JSON.stringify(context)}`);
  }
  record('notebook chat context from stored source', 'passed', { chars: context.char_count });

  const session = (await requestJson('/chat/sessions', {
    method: 'POST',
    body: { notebook_id: notebook.id, title: 'Operational smoke chat' },
  })).body;
  const chatBlocked = await requestJson('/chat/execute', {
    method: 'POST',
    body: { session_id: session.id, message: 'Summarize this smoke source.', context: context.context },
  }, [503]);
  record('chat blocks without provider/model readiness', 'blocked', { detail: chatBlocked.body?.detail || 'provider/model not configured' });

  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64',
  );
  const form = new FormData();
  form.append('file', new Blob([pngBytes], { type: 'image/png' }), `operational-smoke-${runId}.png`);
  form.append('project_namespace', 'operational-smoke');
  form.append('notebooks', JSON.stringify([notebook.id]));
  const capsule = (await requestJson('/image-capsules/intake', { method: 'POST', body: form })).body;
  if (capsule.parserMode !== 'heuristic_manual' || !capsule.sha256) {
    throw new Error(`Image capsule intake did not return heuristic evidence: ${JSON.stringify(capsule)}`);
  }
  record('image capsule heuristic intake', 'passed', { id: capsule.id, sha256: capsule.sha256 });

  const confirmed = (await requestJson(`/image-capsules/${encodeURIComponent(capsule.id)}/confirmation`, {
    method: 'PUT',
    body: {
      projectNamespace: 'operational-smoke',
      canonStatus: 'draft',
      imageType: 'test_pattern',
      sceneType: 'smoke',
      confirmedContext: { title: 'Operational smoke image', identity: 'test pixel' },
      provenance: { confirmed: ['manual smoke metadata'], observed: ['1x1 PNG'] },
      negativeConstraints: ['No OCR or vision claim in smoke'],
      warnings: ['heuristic_manual only'],
    },
  })).body;
  if (confirmed.confirmedContext?.title !== 'Operational smoke image') {
    throw new Error(`Image confirmation did not persist: ${JSON.stringify(confirmed.confirmedContext)}`);
  }
  record('image capsule confirmation update', 'passed');

  const published = (await requestJson(`/image-capsules/${encodeURIComponent(capsule.id)}/publish`, {
    method: 'POST',
    body: { canonStatus: 'canon', notebooks: [notebook.id], publishNote: 'operational smoke publish' },
  })).body;
  if (!published.sourceId || !published.llmContextCard?.startsWith('Image Capsule:')) {
    throw new Error(`Image capsule publish did not create source context card: ${JSON.stringify(published)}`);
  }
  record('image capsule publish creates source card', 'passed', { sourceId: published.sourceId });

  const voice = (await requestJson('/voice-capsules', {
    method: 'POST',
    body: {
      displayName: `Smoke Narrator ${runId}`,
      voiceType: 'narrator',
      provider: 'openai_speech',
      model: 'gpt-4o-mini-tts',
      voiceId: 'alloy',
      rightsStatus: 'synthetic_original',
      allowedUse: ['internal_test'],
      provenance: { mode: 'operational_smoke' },
    },
  })).body;
  const lockedVoice = (await requestJson(`/voice-capsules/${encodeURIComponent(voice.id)}/lock`, { method: 'POST' })).body;
  if (lockedVoice.status !== 'locked') throw new Error(`Voice capsule did not lock: ${JSON.stringify(lockedVoice)}`);
  record('voice capsule create and lock', 'passed', { id: lockedVoice.id });

  const manuscript = (await requestJson('/manuscripts/intake', {
    method: 'POST',
    body: {
      title: `Smoke Manuscript ${runId}`,
      text: 'This is a short narration line for a blocked provider render smoke.',
      notebookId: notebook.id,
      metadata: { mode: 'operational_smoke' },
    },
  })).body;
  const segments = (await requestJson(`/manuscripts/${encodeURIComponent(manuscript.id)}/segments`)).body;
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error(`Manuscript segmentation produced no segments: ${JSON.stringify(manuscript)}`);
  }
  record('manuscript intake and segmentation', 'passed', { manuscriptId: manuscript.id, segments: segments.length });

  const manifest = (await requestJson('/reading-manifests', {
    method: 'POST',
    body: {
      title: `Smoke Reading ${runId}`,
      manuscriptId: manuscript.id,
      readingProfile: 'Operational Smoke',
      narratorVoiceId: lockedVoice.id,
      characterVoiceMap: {},
      notebooks: [notebook.id],
      status: 'draft',
    },
  })).body;
  const lockedManifest = (await requestJson(`/reading-manifests/${encodeURIComponent(manifest.id)}/lock`, { method: 'POST' })).body;
  if (lockedManifest.status !== 'locked') throw new Error(`Reading manifest did not lock: ${JSON.stringify(lockedManifest)}`);
  const renderBlocked = await requestJson(`/reading-manifests/${encodeURIComponent(lockedManifest.id)}/render`, {
    method: 'POST',
    body: { renderMode: 'chapter', maxSegments: 1, forceProvider: 'openai_speech' },
  }, [503]);
  record('reading render blocks without speech provider', 'blocked', { detail: renderBlocked.body?.detail || 'provider missing' });

  const snapshot = (await requestJson('/evidence/snapshots', {
    method: 'POST',
    body: { reason: `operational smoke ${runId}` },
  })).body;
  if (snapshot.restoreSupported !== false) {
    throw new Error(`Snapshot must explicitly report restoreSupported=false: ${JSON.stringify(snapshot)}`);
  }
  const assets = responseItems((await requestJson('/evidence/assets?limit=20')).body);
  const events = responseItems((await requestJson('/evidence/events?limit=20')).body);
  if (assets.length < 2) {
    throw new Error(`Evidence assets list looks wrong: ${JSON.stringify(assets)}`);
  }
  if (events.length === 0) {
    throw new Error(`Evidence events list looks wrong: ${JSON.stringify(events)}`);
  }
  record('evidence snapshot/assets/events', 'passed', {
    snapshotId: snapshot.id,
    assetRows: assets.length,
    eventRows: events.length,
  });
}

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(130);
});

smoke()
  .then(async () => {
    proof.status = 'passed';
    await cleanup();
    console.log(JSON.stringify(proof, null, 2));
  })
  .catch(async (error) => {
    proof.status = 'failed';
    proof.error = error.stack || error.message || String(error);
    await cleanup();
    console.error(error.stack || error.message || String(error));
    console.error(`[info] smoke logs at ${tempRoot}`);
    process.exit(1);
  });
