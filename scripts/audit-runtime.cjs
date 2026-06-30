const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const forbiddenPackageNames = new Set([
  'docker',
  'docker-compose',
  'dockerode',
  'podman',
]);

const forbiddenFilePatterns = [
  /^Dockerfile$/i,
  /^docker-compose\.(ya?ml)$/i,
  /^compose\.(ya?ml)$/i,
];

const ignoredDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'build',
  '.venv',
  '__pycache__',
]);

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function walk(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, found);
    } else if (forbiddenFilePatterns.some((pattern) => pattern.test(entry.name))) {
      found.push(path.relative(root, full));
    }
  }
  return found;
}

function collectPackageNames(pkg) {
  const deps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.optionalDependencies || {}),
    ...(pkg.peerDependencies || {}),
  };
  return Object.keys(deps).filter((name) => forbiddenPackageNames.has(name.toLowerCase()));
}

function scanPackageLock() {
  const lockPath = path.join(root, 'package-lock.json');
  if (!fs.existsSync(lockPath)) return [];
  const lock = readJson('package-lock.json');
  const names = new Set();
  for (const packagePath of Object.keys(lock.packages || {})) {
    const name = packagePath.split('node_modules/').pop();
    if (name && forbiddenPackageNames.has(name.toLowerCase())) {
      names.add(name);
    }
  }
  for (const name of Object.keys(lock.dependencies || {})) {
    if (forbiddenPackageNames.has(name.toLowerCase())) names.add(name);
  }
  return [...names].sort();
}

function scanBackendDependencyFiles() {
  const hits = [];
  for (const relativePath of ['backend/pyproject.toml', 'backend/uv.lock']) {
    const full = path.join(root, relativePath);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, 'utf8');
    for (const forbidden of forbiddenPackageNames) {
      const pattern = new RegExp(`(^|["'\\s])${forbidden.replace('-', '[-_]')}($|["'\\s<>=,])`, 'im');
      if (pattern.test(text)) hits.push(`${relativePath}:${forbidden}`);
    }
  }
  return hits;
}

function scanRuntimeScripts(pkg) {
  const hits = [];
  for (const [name, script] of Object.entries(pkg.scripts || {})) {
    if (name === 'audit:runtime') continue;
    if (/\b(docker|docker-compose|podman|dockerode)\b/i.test(script)) {
      hits.push(`${name}: ${script}`);
    }
  }
  return hits;
}

const pkg = readJson('package.json');
const failures = [
  ...walk(root).map((file) => `Forbidden container config file: ${file}`),
  ...collectPackageNames(pkg).map((name) => `Forbidden Node dependency: ${name}`),
  ...scanPackageLock().map((name) => `Forbidden package-lock dependency: ${name}`),
  ...scanBackendDependencyFiles().map((hit) => `Forbidden backend dependency: ${hit}`),
  ...scanRuntimeScripts(pkg).map((hit) => `Forbidden runtime script command: ${hit}`),
];

if (failures.length) {
  console.error('Runtime dependency audit failed: Docker/Podman must not be required.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  status: 'passed',
  docker: { required: false, status: 'not required' },
  checked: {
    scripts: true,
    nodeDependencies: true,
    backendDependencyFiles: true,
    containerConfigFiles: true,
  },
}, null, 2));
