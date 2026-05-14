import { spawnSync } from 'node:child_process';

const build = spawnSync(process.execPath, ['scripts/build.mjs'], {
  cwd: process.cwd(),
  stdio: 'inherit'
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const test = spawnSync(process.execPath, ['--test', 'test/framework.test.js'], {
  cwd: process.cwd(),
  stdio: 'inherit'
});

process.exit(test.status ?? 1);
