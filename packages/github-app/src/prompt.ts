import type { Buffer } from 'node:buffer';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { CliError } from './cli-error';

// Reads missing CLI values interactively, masking tokens and supporting Ctrl+C cancellation.
export async function prompt(
  label: string,
  options: { fallback?: string; secret?: boolean; signal?: AbortSignal | undefined } = {},
): Promise<string> {
  if (!process.stdin.isTTY)
    throw new CliError(
      `Missing ${label}. Supply the corresponding flag (or GH_TOKEN for authentication) in non-interactive mode.`,
    );
  let muted = false;
  const output = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const reader = createInterface({ input: process.stdin, output, terminal: true });
  const controller = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([controller.signal, options.signal])
    : controller.signal;
  const cancel = () => controller.abort();
  reader.on('SIGINT', cancel);
  reader.once('close', cancel);
  options.signal?.addEventListener('abort', cancel, { once: true });
  try {
    if (options.signal?.aborted) throw new CliError('Cancelled.');
    const suffix = options.fallback !== undefined ? ` [${options.fallback}]` : '';
    const answer = reader.question(`${label}${suffix}: `, { signal });
    muted = options.secret ?? false;
    const result = (await answer).trim() || (options.fallback ?? '');
    if (!result) throw new CliError(`${label} is required.`);
    return result;
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(
      signal.aborted ? 'Cancelled.' : 'Could not read an answer from the terminal.',
    );
  } finally {
    muted = false;
    if (options.secret) process.stdout.write('\n');
    reader.close();
    options.signal?.removeEventListener('abort', cancel);
  }
}
