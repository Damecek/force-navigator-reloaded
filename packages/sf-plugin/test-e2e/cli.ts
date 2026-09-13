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

type JsonError = { status?: number; name?: string; message?: string };

const redactUrls = (text: string): string =>
  text.replace(/https?:\/\/\S+/g, '[redacted-url]');

/** Build a credential-free error for a failed CLI invocation. */
function describeCliFailure(label: string, error: unknown): Error {
  const output = error as {
    stdout?: string;
    stderr?: string;
    message?: string;
  };
  try {
    const payload = JSON.parse(output.stdout ?? '') as JsonError;
    return new Error(
      `CLI ${label} failed with status ${payload.status ?? 'unknown'}: ${payload.name ?? 'Error'}: ${redactUrls(payload.message ?? '')}`
    );
  } catch {
    const fallback = (output.stderr || output.message || '').trim();
    return new Error(
      `CLI ${label} failed: ${redactUrls(fallback.split('\n')[0] ?? '')}`
    );
  }
}

async function runJson<T>(args: string[]): Promise<T> {
  const label = args.slice(0, 2).join(' ');
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(process.execPath, [executable, ...args], {
      cwd: packageRoot,
      env: { ...process.env, SF_DISABLE_TELEMETRY: 'true' },
      maxBuffer: 16 * 1024 * 1024,
    }));
  } catch (error) {
    throw describeCliFailure(label, error);
  }
  const envelope = JSON.parse(stdout) as JsonEnvelope<T>;
  if (envelope.status !== 0 || !envelope.result) {
    throw new Error(`CLI returned invalid JSON for ${label}`);
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
