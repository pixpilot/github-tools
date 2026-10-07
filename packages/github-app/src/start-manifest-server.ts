import type { ManifestOptions } from './types';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { CliError } from './cli-error';
import { generateManifest } from './generate-manifest';
import { manifestPage } from './manifest-page';
import { parseCallback } from './parse-callback';

const STATE_BYTES = 32;
const START_PATH_BYTES = 24;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const DEFAULT_TIMEOUT_MS = 600000;

export interface ServerOptions extends ManifestOptions {
  personal?: boolean | undefined;
  port?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

// Starts a temporary loopback server, falling back to an available port if necessary.
export async function startManifestServer(
  options: ServerOptions,
): Promise<{ url: string; code: Promise<string>; close: () => Promise<void> }> {
  generateManifest(options, 'http://127.0.0.1/callback');
  const state = randomBytes(STATE_BYTES).toString('hex');
  const path = `/start/${randomBytes(START_PATH_BYTES).toString('hex')}`;
  let resolveCode: (code: string) => void;
  let rejectCode: (error: Error) => void;
  const code = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });
  // Attach a handler immediately: cancellation can happen before callers await the code.
  void code.catch(() => {});
  let baseUrl = '';
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (request.method !== 'GET' || request.headers.host !== new URL(baseUrl).host) {
      response.writeHead(BAD_REQUEST).end('Invalid request.');
      return;
    }
    let url: URL;
    try {
      url = new URL(request.url ?? '/', baseUrl);
    } catch {
      response.writeHead(BAD_REQUEST).end('Invalid request.');
      return;
    }
    if (url.pathname === path) {
      const manifest = generateManifest(options, `${baseUrl}/callback`);
      const account = options.personal ? '' : `/organizations/${options.owner}`;
      const action = `https://github.com${account}/settings/apps/new?state=${state}`;
      response.end(manifestPage(manifest, action));
      return;
    }
    if (url.pathname !== '/callback') {
      response.writeHead(NOT_FOUND).end('Not found.');
      return;
    }
    try {
      const result = parseCallback(url, state);
      response.end('Authorization received. Return to your terminal to finish setup.');
      resolveCode(result);
    } catch (error) {
      response
        .writeHead(BAD_REQUEST)
        .end('Authorization failed. Return to your terminal.');
      if (error instanceof CliError && error.message !== 'Invalid callback state.')
        rejectCode(error);
    }
  });
  async function listen(port: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', reject);
        resolve();
      });
    });
  }
  try {
    await listen(options.port ?? 0);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EADDRINUSE')
      await listen(0);
    else throw new CliError('Cannot start the local callback server.');
  }
  const address = server.address();
  if (address === null || typeof address === 'string')
    throw new CliError('Cannot determine callback port.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  const timer = setTimeout(
    () =>
      rejectCode(new CliError('Authorization timed out. Restart the create command.')),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  const cancel = () => rejectCode(new CliError('GitHub authorization was cancelled.'));
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const close = async () => {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
    server.closeAllConnections();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  };
  return { url: `${baseUrl}${path}`, code, close };
}
