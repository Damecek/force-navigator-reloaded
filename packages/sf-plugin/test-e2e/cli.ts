import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const executable = path.join(packageRoot, 'bin', 'run.js');

export type NavigationCommand = {
  id: string;
  label: string;
  path: string;
  host?: 'core' | 'lightning' | 'setup';
  source: string;
  url: string;
};

type JsonEnvelope<T> = { status: number; result: T };

async function runJson<T>(args: string[]): Promise<T> {
  const { stdout } = await execFileAsync(
    process.execPath,
    [executable, ...args],
    {
      cwd: packageRoot,
      env: { ...process.env, SF_DISABLE_TELEMETRY: 'true' },
      maxBuffer: 16 * 1024 * 1024,
    }
  );
  const envelope = JSON.parse(stdout) as JsonEnvelope<T>;
  if (envelope.status !== 0 || !envelope.result) {
    throw new Error(
      `CLI returned invalid JSON for ${args.slice(0, 2).join(' ')}`
    );
  }
  return envelope.result;
}

/** Load the real org-backed catalog through the public CLI command. */
export async function searchCommands(
  targetOrg: string
): Promise<NavigationCommand[]> {
  const result = await runJson<{ commands: NavigationCommand[] }>([
    'navigator',
    'search',
    '--target-org',
    targetOrg,
    '--refresh',
    '--json',
  ]);
  if (!Array.isArray(result.commands)) {
    throw new Error('navigator search JSON result has no commands array');
  }
  return result.commands;
}

/** Resolve one exact catalog entry through navigator open without launching a browser. */
export async function resolveOpen(
  targetOrg: string,
  commandId: string
): Promise<{ command: NavigationCommand; url: string; opened: boolean }> {
  return runJson([
    'navigator',
    'open',
    '--target-org',
    targetOrg,
    '--id',
    commandId,
    '--url-only',
    '--json',
  ]);
}
