import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const manifestDir = '.aiox';
const manifestFile = 'manifest.json';

export function manifestPath(workspaceRoot) {
  return path.join(workspaceRoot, manifestDir, manifestFile);
}

export function hashText(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

export async function readManifest(workspaceRoot) {
  const file = manifestPath(workspaceRoot);
  try {
    const raw = await readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeManifest(workspaceRoot, manifest) {
  const directory = path.join(workspaceRoot, manifestDir);
  await mkdir(directory, { recursive: true });
  await writeFile(manifestPath(workspaceRoot), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

export function buildManifest(workspaceRoot, fileStates, previousManifest = null, runtime = 'both') {
  const createdAt = previousManifest?.createdAt ?? new Date().toISOString();
  return {
    schemaVersion: 1,
    package: '@fcaldas1/aiox',
    packageVersion: '0.1.0',
    runtime,
    targets: runtime === 'both' ? ['core', 'claude', 'codex'] : ['core', runtime],
    workspaceRoot,
    createdAt,
    updatedAt: new Date().toISOString(),
    files: fileStates
  };
}
