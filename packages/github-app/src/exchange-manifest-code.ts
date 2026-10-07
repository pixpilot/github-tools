import type { AppCredentials } from './types';
import { createPrivateKey } from 'node:crypto';
import { CliError } from './cli-error';

const EXCHANGE_TIMEOUT_MS = 30000;
const NOT_FOUND = 404;

// Exchanges a short-lived manifest code without logging response bodies or secret material.
export async function exchangeManifestCode(
  code: string,
  request: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<AppCredentials> {
  let response: Response;
  try {
    response = await request(
      `https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(EXCHANGE_TIMEOUT_MS)])
          : AbortSignal.timeout(EXCHANGE_TIMEOUT_MS),
        redirect: 'error',
      },
    );
  } catch {
    throw new CliError(
      'Manifest exchange could not finish. Restart the create command; if the app exists, recover a new key from its GitHub settings.',
    );
  }
  if (!response.ok) {
    const detail =
      response.status === NOT_FOUND
        ? 'The code may have expired or already been used.'
        : 'GitHub rejected the manifest exchange.';
    throw new CliError(
      `Manifest exchange failed (HTTP ${response.status}). ${detail} Restart the create command; if the app already exists, use its settings to generate a new key.`,
    );
  }
  try {
    const data: unknown = await response.json();
    if (data === null || typeof data !== 'object')
      throw new Error('Invalid credentials response');
    const { id, slug, client_id, html_url, pem } = data as Record<string, unknown>;
    if (
      typeof id !== 'number' ||
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      typeof slug !== 'string' ||
      !/^[a-z\d-]+$/iu.test(slug) ||
      typeof client_id !== 'string' ||
      !client_id ||
      typeof html_url !== 'string' ||
      html_url !== `https://github.com/apps/${slug}` ||
      typeof pem !== 'string'
    )
      throw new Error('Invalid credentials fields');
    createPrivateKey(pem);
    return { id, slug, client_id, html_url, pem };
  } catch {
    throw new CliError(
      'GitHub returned invalid app credentials. Recover a new private key from the app settings.',
    );
  }
}
