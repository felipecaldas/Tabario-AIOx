import { access, constants, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { getFrameworkFiles, frameworkSummary, normalizeRuntime, runtimeTargets } from './framework.js';
import { buildManifest, hashText, readManifest, writeManifest } from './manifest.js';

function resolveTarget(workspaceRoot, relativePath) {
  return path.join(workspaceRoot, relativePath);
}

async function readExisting(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function ensureParent(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
}

async function writeIfMissing(targetPath, content) {
  const existing = await readExisting(targetPath);
  if (existing !== null) {
    return { action: 'adopted', content: existing, hash: hashText(existing) };
  }

  await ensureParent(targetPath);
  await writeFile(targetPath, content, 'utf8');
  return { action: 'created', content, hash: hashText(content) };
}

async function writeContent(targetPath, content) {
  await ensureParent(targetPath);
  await writeFile(targetPath, content, 'utf8');
  return { action: 'refreshed', content, hash: hashText(content) };
}

async function isDirectory(filePath) {
  try {
    const result = await stat(filePath);
    return result.isDirectory();
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function canExecute(filePath) {
  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch (error) {
    if (error && (error.code === 'ENOENT' || error.code === 'EACCES')) {
      return false;
    }
    throw error;
  }
}

async function findOnPath(binary, env) {
  const pathValue = env.PATH ?? env.Path ?? env.path ?? '';
  const directories = pathValue.split(path.delimiter).filter(Boolean);
  const extensions = process.platform === 'win32'
    ? (env.PATHEXT ?? '.EXE;.CMD;.BAT;.COM').split(';')
    : [''];

  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = path.join(directory, `${binary}${extension}`);
      if (await canExecute(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function resolveRuntime(runtime, manifest = null) {
  return normalizeRuntime(runtime ?? manifest?.runtime ?? 'both');
}

function prerequisiteDefinitions(runtime, { homeDir = os.homedir() } = {}) {
  const targets = runtimeTargets(runtime);
  const prerequisites = [];

  if (targets.includes('claude')) {
    prerequisites.push({
      id: 'gstack',
      runtime: 'claude',
      label: 'GStack skills',
      instruction: 'Install GStack so ~/.claude/skills/gstack/bin exists, then rerun aiox.',
      type: 'directory',
      path: path.join(homeDir, '.claude', 'skills', 'gstack', 'bin')
    });
  }

  if (targets.includes('codex')) {
    // gsd-core installs here. The old `get-shit-done` path this used to check
    // belonged to the archived repo and no longer exists after the migration,
    // so doctor failed on a healthy install (TAB-923).
    //
    // There is deliberately no PATH-binary check beside this one. gsd-core
    // ships no executable onto PATH — it is invoked through bin/gsd-tools.cjs
    // inside this directory. The `gsd-sdk` check that used to sit here passed
    // only because an npx cache still held get-shit-done-cc, which nothing in
    // AIOx calls; a check that green-lights a leftover is worse than no check.
    prerequisites.push({
      id: 'gsd-home',
      runtime: 'codex',
      label: 'GSD home',
      instruction:
        'Install gsd-core so $HOME/.codex/gsd-core exists, then rerun aiox: npx @opengsd/gsd-core@latest --codex --global --profile=full',
      type: 'directory',
      path: path.join(homeDir, '.codex', 'gsd-core')
    });
  }

  return prerequisites;
}

export async function checkPrerequisites({ runtime = 'both', homeDir = os.homedir(), env = process.env } = {}) {
  const checks = [];

  for (const prerequisite of prerequisiteDefinitions(runtime, { homeDir })) {
    if (prerequisite.type === 'directory') {
      const present = await isDirectory(prerequisite.path);
      checks.push({
        id: prerequisite.id,
        runtime: prerequisite.runtime,
        label: prerequisite.label,
        ok: present,
        expected: prerequisite.path,
        instruction: prerequisite.instruction
      });
      continue;
    }

    if (prerequisite.type === 'path-binary') {
      const resolved = await findOnPath(prerequisite.binary, env);
      checks.push({
        id: prerequisite.id,
        runtime: prerequisite.runtime,
        label: prerequisite.label,
        ok: Boolean(resolved),
        expected: `${prerequisite.binary} on PATH`,
        resolved,
        instruction: prerequisite.instruction
      });
    }
  }

  return checks;
}

function missingPrerequisitesMessage(runtime, missing) {
  return [
    `AIOx cannot manage runtime "${runtime}" because required external prerequisites are missing.`,
    ...missing.map((item) => `- ${item.label}: ${item.instruction}`)
  ].join('\n');
}

async function assertPrerequisites(options) {
  const checks = await checkPrerequisites(options);
  const missing = checks.filter((check) => !check.ok);
  if (missing.length > 0) {
    throw new Error(missingPrerequisitesMessage(options.runtime, missing));
  }
  return checks;
}

function buildFileState(relativePath, result, source) {
  return {
    path: relativePath,
    status: result.action,
    hash: result.hash,
    source: source === 'default' ? 'default' : 'existing',
    managed: true
  };
}

async function syncFiles(workspaceRoot, runtime, existingManifest = null, refreshGenerated = false) {
  const previous = new Map((existingManifest?.files ?? []).map((file) => [file.path, file]));
  const states = [];
  const lines = [];

  for (const file of getFrameworkFiles({ runtime })) {
    const targetPath = resolveTarget(workspaceRoot, file.path);
    const sourceExists = await readExisting(targetPath);
    let result = await writeIfMissing(targetPath, file.content);
    const previousState = previous.get(file.path);

    if (
      refreshGenerated &&
      sourceExists !== null &&
      previousState?.status === 'created' &&
      previousState.hash === hashText(sourceExists) &&
      previousState.hash !== hashText(file.content)
    ) {
      result = await writeContent(targetPath, file.content);
    }

    const source = sourceExists === null ? 'default' : 'existing';
    states.push(buildFileState(file.path, result, source));
    lines.push(`${result.action === 'created' ? 'created' : 'kept'} ${file.path}`);
  }

  return { states, lines };
}

async function refreshManifest(workspaceRoot, states, previousManifest, runtime) {
  const manifest = buildManifest(workspaceRoot, states, previousManifest, runtime);
  await writeManifest(workspaceRoot, manifest);
  return manifest;
}

export async function initWorkspace({ workspaceRoot, runtime = 'both', json = false, verbose = false, homeDir, env } = {}) {
  const selectedRuntime = resolveRuntime(runtime);
  await assertPrerequisites({ runtime: selectedRuntime, homeDir, env });
  const previous = await readManifest(workspaceRoot);
  const sync = await syncFiles(workspaceRoot, selectedRuntime, previous, false);
  const manifest = await refreshManifest(workspaceRoot, sync.states, previous, selectedRuntime);

  const result = {
    code: 0,
    json: json ? {
      command: 'init',
      workspaceRoot,
      runtime: selectedRuntime,
      summary: frameworkSummary({ runtime: selectedRuntime }),
      manifest
    } : null,
    lines: json ? [] : [
      `AIOx initialized at ${workspaceRoot} for runtime ${selectedRuntime}`,
      ...sync.lines
    ]
  };

  if (verbose && !json) {
    result.lines.push(`manifest: ${path.relative(workspaceRoot, path.join(workspaceRoot, '.aiox', 'manifest.json'))}`);
  }

  return result;
}

export async function syncWorkspace({ workspaceRoot, runtime, json = false, verbose = false, homeDir, env } = {}) {
  const existing = await readManifest(workspaceRoot);
  const selectedRuntime = resolveRuntime(runtime, existing);
  await assertPrerequisites({ runtime: selectedRuntime, homeDir, env });
  const sync = await syncFiles(workspaceRoot, selectedRuntime, existing, false);
  const manifest = await refreshManifest(workspaceRoot, sync.states, existing, selectedRuntime);

  const result = {
    code: 0,
    json: json ? {
      command: 'sync',
      workspaceRoot,
      runtime: selectedRuntime,
      manifest,
      previousManifest: existing,
      summary: frameworkSummary({ runtime: selectedRuntime })
    } : null,
    lines: json ? [] : [
      `AIOx synced at ${workspaceRoot} for runtime ${selectedRuntime}`,
      ...sync.lines
    ]
  };

  if (verbose && !json) {
    result.lines.push(`files: ${sync.states.length}`);
  }

  return result;
}

export async function upgradeWorkspace({ workspaceRoot, runtime, json = false, verbose = false, homeDir, env } = {}) {
  const previous = await readManifest(workspaceRoot);
  const selectedRuntime = resolveRuntime(runtime, previous);
  await assertPrerequisites({ runtime: selectedRuntime, homeDir, env });
  const sync = await syncFiles(workspaceRoot, selectedRuntime, previous, true);
  const manifest = await refreshManifest(workspaceRoot, sync.states, previous, selectedRuntime);
  const result = {
    code: 0,
    json: json ? {
      command: 'upgrade',
      workspaceRoot,
      runtime: selectedRuntime,
      manifest,
      previousManifest: previous,
      summary: frameworkSummary({ runtime: selectedRuntime })
    } : null,
    lines: json ? [] : [
      `AIOx upgraded at ${workspaceRoot} for runtime ${selectedRuntime}`,
      ...sync.lines
    ]
  };
  if (json && result.json) {
    result.json.command = 'upgrade';
  }
  if (verbose && !json) {
    result.lines.push(`files: ${sync.states.length}`);
  }
  return result;
}

export async function doctorWorkspace({ workspaceRoot, runtime, json = false, verbose = false, homeDir, env } = {}) {
  const manifest = await readManifest(workspaceRoot);
  const selectedRuntime = resolveRuntime(runtime, manifest);
  const prerequisites = await checkPrerequisites({
    runtime: selectedRuntime,
    homeDir,
    env
  });
  const missingPrerequisites = prerequisites.filter((check) => !check.ok);
  const missing = [];

  for (const file of getFrameworkFiles({ runtime: selectedRuntime })) {
    const targetPath = resolveTarget(workspaceRoot, file.path);
    try {
      await stat(targetPath);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        missing.push(file.path);
        continue;
      }
      throw error;
    }
  }

  const ok = Boolean(manifest) && missing.length === 0 && missingPrerequisites.length === 0;
  const result = {
    code: ok ? 0 : 1,
    json: json ? {
      command: 'doctor',
      workspaceRoot,
      runtime: selectedRuntime,
      ok,
      missing,
      prerequisites,
      missingPrerequisites,
      manifestPresent: Boolean(manifest)
    } : null,
    lines: json ? [] : [
      ok ? `AIOx looks healthy at ${workspaceRoot} for runtime ${selectedRuntime}` : `AIOx needs attention at ${workspaceRoot} for runtime ${selectedRuntime}`,
      ...(missing.length ? [`Missing files: ${missing.join(', ')}`] : ['All managed files exist.']),
      ...(missingPrerequisites.length
        ? ['Missing prerequisites:', ...missingPrerequisites.map((item) => `- ${item.label}: ${item.instruction}`)]
        : ['All prerequisites are present.']),
      ...(manifest ? ['Manifest present.'] : ['Manifest missing.'])
    ]
  };

  if (verbose && !json) {
    result.lines.push(`managed files: ${getFrameworkFiles({ runtime: selectedRuntime }).length}`);
  }

  return result;
}

export async function loadWorkspaceState(workspaceRoot, runtime = 'both') {
  const manifest = await readManifest(workspaceRoot);
  const files = [];

  for (const file of getFrameworkFiles({ runtime })) {
    const targetPath = resolveTarget(workspaceRoot, file.path);
    const content = await readExisting(targetPath);
    files.push({
      path: file.path,
      exists: content !== null,
      hash: content === null ? null : hashText(content)
    });
  }

  return { manifest, files };
}
