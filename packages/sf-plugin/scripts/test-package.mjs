import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const temporaryRoot = await mkdtemp(join(tmpdir(), 'navigator-package-'));

/** Run npm using the same Node.js runtime as the packaging check. */
function npm(args, cwd) {
  return execFileSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

try {
  npm(['pack', '--pack-destination', temporaryRoot], packageRoot);
  const { name, version } = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  const archive = join(temporaryRoot, `${name}-${version}.tgz`);
  npm(['install', '--prefix', temporaryRoot, '--omit=dev', '--no-audit', '--no-fund', archive], temporaryRoot);
  const installedRoot = join(temporaryRoot, 'node_modules', name);
  const help = execFileSync(process.execPath, [join(installedRoot, 'bin/run.js'), 'navigator', 'open', '--help'], {
    cwd: temporaryRoot,
    encoding: 'utf8',
  });
  assert.match(help, /--target-org/);
  assert.match(help, /--exclude-source/);
  assert.match(help, /--debug/);
  console.log('Built npm package installs and loads navigator open outside the checkout.');
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
