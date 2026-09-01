import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../dist/command-line.js';
import {
  doctorWorkspace,
  getFrameworkFiles,
  initWorkspace,
  loadWorkspaceState,
  RUNTIMES,
  syncWorkspace
} from '../dist/index.js';

async function tempRoot(prefix) {
  return mkdtemp(path.join(os.tmpdir(), prefix));
}

// Every directory a prerequisite check looks for. Keep this in step with
// prerequisiteDefinitions in src/install.js: the old fixture created
// `.codex/get-shit-done`, so the suite kept passing against a layout that had
// stopped existing, and doctor's failure on a healthy box went uncaught
// (TAB-923).
async function fakePrerequisites() {
  const homeDir = await tempRoot('aiox-home-');
  const binDir = path.join(homeDir, 'bin');
  await mkdir(path.join(homeDir, '.claude', 'skills', 'gstack', 'bin'), { recursive: true });
  await mkdir(path.join(homeDir, '.codex', 'gsd-core'), { recursive: true });
  await mkdir(binDir, { recursive: true });

  return {
    homeDir,
    env: {
      ...process.env,
      PATH: binDir
    },
    cleanup: async () => rm(homeDir, { recursive: true, force: true })
  };
}

test('runtime parsing accepts supported values', () => {
  for (const runtime of RUNTIMES) {
    assert.equal(parseArgs(['init', '--runtime', runtime]).runtime, runtime);
  }
});

test('framework file selection is runtime-specific', () => {
  const claude = getFrameworkFiles({ runtime: 'claude' }).map((file) => file.path);
  const codex = getFrameworkFiles({ runtime: 'codex' }).map((file) => file.path);
  const both = getFrameworkFiles({ runtime: 'both' }).map((file) => file.path);

  assert.ok(claude.includes('CLAUDE.md'));
  assert.ok(claude.some((file) => file.startsWith('.claude/commands/')));
  assert.equal(claude.some((file) => file.startsWith('.agents/skills/tabario-')), false);

  assert.ok(codex.includes('.codex/AGENTS.md'));
  assert.ok(codex.some((file) => file.startsWith('.agents/skills/tabario-')));
  assert.equal(codex.some((file) => file.startsWith('.claude/commands/')), false);

  assert.ok(both.includes('CLAUDE.md'));
  assert.ok(both.includes('.codex/AGENTS.md'));
});

test('every generated skill is a directory holding SKILL.md', () => {
  const paths = getFrameworkFiles({ runtime: 'both' }).map((file) => file.path);
  const skillPaths = paths.filter((file) => /^\.(claude|agents)\/skills\//.test(file));

  assert.ok(skillPaths.length > 0, 'expected the framework to generate at least one skill');

  const skillDirs = new Set();
  for (const file of skillPaths) {
    const rest = file.split('/').slice(2);
    assert.ok(
      rest.length > 1,
      `${file} sits directly under a skills root, so skill discovery skips it`
    );
    skillDirs.add(file.split('/').slice(0, 3).join('/'));
  }

  for (const dir of skillDirs) {
    assert.ok(
      paths.includes(`${dir}/SKILL.md`),
      `${dir} has no SKILL.md, so skill discovery skips the whole directory`
    );
  }
});

test('init creates claude files but not codex-only skills', async () => {
  const root = await tempRoot('aiox-claude-');
  const prereqs = await fakePrerequisites();
  try {
    const result = await initWorkspace({
      workspaceRoot: root,
      runtime: 'claude',
      homeDir: prereqs.homeDir,
      env: prereqs.env
    });
    assert.equal(result.code, 0);

    await readFile(path.join(root, '.claude', 'commands', 'story.md'), 'utf8');
    await assert.rejects(
      () => readFile(path.join(root, '.agents', 'skills', 'tabario-spec', 'SKILL.md'), 'utf8'),
      /ENOENT/
    );
  } finally {
    await prereqs.cleanup();
    await rm(root, { recursive: true, force: true });
  }
});

test('init creates codex files but not claude commands', async () => {
  const root = await tempRoot('aiox-codex-');
  const prereqs = await fakePrerequisites();
  try {
    const result = await initWorkspace({
      workspaceRoot: root,
      runtime: 'codex',
      homeDir: prereqs.homeDir,
      env: prereqs.env
    });
    assert.equal(result.code, 0);

    await readFile(path.join(root, '.codex', 'AGENTS.md'), 'utf8');
    await readFile(path.join(root, '.agents', 'skills', 'tabario-plan', 'SKILL.md'), 'utf8');
    await assert.rejects(
      () => readFile(path.join(root, '.claude', 'commands', 'story.md'), 'utf8'),
      /ENOENT/
    );
  } finally {
    await prereqs.cleanup();
    await rm(root, { recursive: true, force: true });
  }
});

test('init both creates claude and codex surfaces', async () => {
  const root = await tempRoot('aiox-both-');
  const prereqs = await fakePrerequisites();
  try {
    const result = await initWorkspace({
      workspaceRoot: root,
      runtime: 'both',
      homeDir: prereqs.homeDir,
      env: prereqs.env
    });
    assert.equal(result.code, 0);

    const manifest = await readFile(path.join(root, '.aiox', 'manifest.json'), 'utf8');
    assert.match(manifest, /"runtime": "both"/);
    await readFile(path.join(root, 'CLAUDE.md'), 'utf8');
    await readFile(path.join(root, '.codex', 'AGENTS.md'), 'utf8');
  } finally {
    await prereqs.cleanup();
    await rm(root, { recursive: true, force: true });
  }
});

test('sync preserves existing files', async () => {
  const root = await tempRoot('aiox-sync-');
  const prereqs = await fakePrerequisites();
  try {
    await mkdir(path.join(root, '.codex'), { recursive: true });
    await writeFile(path.join(root, '.codex', 'AGENTS.md'), 'custom codex rules\n', 'utf8');

    await initWorkspace({
      workspaceRoot: root,
      runtime: 'codex',
      homeDir: prereqs.homeDir,
      env: prereqs.env
    });
    const before = await loadWorkspaceState(root, 'codex');
    assert.ok(before.files.some((file) => file.exists));

    const result = await syncWorkspace({
      workspaceRoot: root,
      runtime: 'codex',
      homeDir: prereqs.homeDir,
      env: prereqs.env
    });
    assert.equal(result.code, 0);
    assert.equal(await readFile(path.join(root, '.codex', 'AGENTS.md'), 'utf8'), 'custom codex rules\n');
  } finally {
    await prereqs.cleanup();
    await rm(root, { recursive: true, force: true });
  }
});

test('missing prerequisites cause hard failures for affected targets', async () => {
  const root = await tempRoot('aiox-missing-prereq-');
  const homeDir = await tempRoot('aiox-empty-home-');
  try {
    await assert.rejects(
      () => initWorkspace({ workspaceRoot: root, runtime: 'codex', homeDir, env: { PATH: '' } }),
      /GSD home/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('doctor --json includes missing prerequisite details', async () => {
  const root = await tempRoot('aiox-doctor-');
  const homeDir = await tempRoot('aiox-doctor-home-');
  try {
    const result = await doctorWorkspace({
      workspaceRoot: root,
      runtime: 'codex',
      json: true,
      homeDir,
      env: { PATH: '' }
    });
    assert.equal(result.code, 1);
    assert.equal(result.json.ok, false);
    assert.deepEqual(result.json.missingPrerequisites.map((item) => item.id), ['gsd-home']);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  }
});

test('non-interactive init without runtime fails before install', async () => {
  const root = await tempRoot('aiox-cli-missing-runtime-');
  try {
    const result = spawnSync(process.execPath, ['dist/cli.js', 'init', '--target', root], {
      cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: ''
      }
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing required --runtime/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
