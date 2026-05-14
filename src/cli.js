#!/usr/bin/env node
import { createInterface } from 'node:readline/promises';
import { parseArgs } from './command-line.js';
import { doctorWorkspace, initWorkspace, syncWorkspace, upgradeWorkspace } from './install.js';
import { RUNTIMES, normalizeRuntime } from './framework.js';

async function main(argv = process.argv.slice(2)) {
  const parsed = parseArgs(argv);

  if (parsed.command === 'help' || !parsed.command) {
    printHelp();
    return 0;
  }

  const workspaceRoot = parsed.target ? parsed.target : process.cwd();
  let runtime;
  try {
    runtime = await runtimeForCommand(parsed);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  const options = {
    workspaceRoot,
    runtime,
    json: parsed.json,
    verbose: parsed.verbose
  };

  if (parsed.command === 'init') {
    return runCommand(() => initWorkspace(options));
  }

  if (parsed.command === 'sync') {
    return runCommand(() => syncWorkspace(options));
  }

  if (parsed.command === 'doctor') {
    return runCommand(() => doctorWorkspace(options));
  }

  if (parsed.command === 'upgrade') {
    return runCommand(() => upgradeWorkspace(options));
  }

  printHelp(`Unknown command: ${parsed.command}`);
  return 1;
}

async function runCommand(fn) {
  try {
    const result = await fn();
    if (result && typeof result.code === 'number') {
      if (result.json) {
        process.stdout.write(`${JSON.stringify(result.json, null, 2)}\n`);
      } else {
        for (const line of result.lines ?? []) {
          process.stdout.write(`${line}\n`);
        }
      }
      return result.code;
    }

    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

async function runtimeForCommand(parsed) {
  if (parsed.runtime) {
    return normalizeRuntime(parsed.runtime);
  }

  if (parsed.command !== 'init') {
    return undefined;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Missing required --runtime for non-interactive init. Use --runtime claude, --runtime codex, or --runtime both.');
  }

  const prompt = createInterface({
    input: process.stdin,
    output: process.stderr
  });

  try {
    for (;;) {
      const answer = (await prompt.question('Select runtime (claude, codex, both): ')).trim().toLowerCase();
      if (RUNTIMES.includes(answer)) {
        return answer;
      }
      process.stderr.write(`Invalid runtime. Expected one of: ${RUNTIMES.join(', ')}\n`);
    }
  } finally {
    prompt.close();
  }
}

function printHelp(prefix = '') {
  if (prefix) {
    process.stderr.write(`${prefix}\n\n`);
  }

  process.stdout.write(`
AIOx - repo-local bootstrapper

Usage:
  aiox init --runtime <claude|codex|both> [--target <path>] [--json]
  aiox sync [--runtime <claude|codex|both>] [--target <path>] [--json]
  aiox doctor [--runtime <claude|codex|both>] [--target <path>] [--json]
  aiox upgrade [--runtime <claude|codex|both>] [--target <path>] [--json]

Options:
  --target, -t   Workspace root to manage. Defaults to the current directory.
  --runtime, -r  Runtime target: claude, codex, or both. Required for non-interactive init.
  --json         Emit machine-readable output.
  --verbose, -v  Include extra progress output.
  --help, -h     Show this help.
`);
}

const exitCode = await main();
process.exitCode = exitCode;
