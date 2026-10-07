import type { CliValues } from './types';
import process from 'node:process';
import { CliError } from './cli-error';
import { createReleaser } from './create-releaser';
import { ensureCredentialPath } from './ensure-credential-path';
import { ensureInput } from './ensure-input';
import { getGhEnvironment } from './get-gh-environment';
import { prompt } from './prompt';
import { readManifest } from './read-manifest';
import { resolveSecretTarget } from './resolve-secret-target';

const DEFAULT_TIMEOUT_SECONDS = 600;
const MAX_CALLBACK_PORT = 65535;
const MAX_TIMEOUT_SECONDS = 3600;
const MILLISECONDS_PER_SECOND = 1000;

function inferOwner(homepage: string | undefined): string | undefined {
  if (homepage === undefined) return undefined;
  const url = new URL(homepage);
  const segments = url.pathname.split('/').filter(Boolean);
  return url.hostname === 'github.com' && segments.length === 1 ? segments[0] : undefined;
}

// Collects create options and validates all configuration before opening GitHub.
export async function runCreate(values: CliValues, signal: AbortSignal): Promise<void> {
  if (
    values.org !== undefined &&
    (values.personal === true || values.owner !== undefined)
  )
    throw new CliError('--org cannot be combined with --personal or --owner.');
  if (values.owner !== undefined && !values.personal)
    throw new CliError('--owner requires --personal.');
  const manifest =
    values.manifest === undefined ? undefined : await readManifest(values.manifest);
  const inferredOwner = inferOwner(manifest?.url);
  const owner = ensureInput(
    values.personal
      ? (values.owner ??
          inferredOwner ??
          (await prompt('Personal account login (--owner)', { signal })))
      : (values.org ??
          inferredOwner ??
          (await prompt('App organization (--org)', { signal }))),
    'account',
  );
  const interactive = process.stdin.isTTY;
  const name =
    values.name ??
    manifest?.name ??
    (interactive
      ? await prompt('App name (--name)', { fallback: 'My Releaser', signal })
      : 'My Releaser');
  let configuredTarget: 'owner' | 'any' | undefined;
  if (manifest?.public !== undefined)
    configuredTarget = manifest.public ? 'any' : 'owner';
  const installationTarget =
    values['install-target'] ??
    configuredTarget ??
    (interactive
      ? await prompt('Install on owner or any account (--install-target)', {
          fallback: 'owner',
          signal,
        })
      : 'owner');
  if (installationTarget !== 'owner' && installationTarget !== 'any')
    throw new CliError('--install-target must be owner or any.');
  if (values.overwrite && values['key-path'] === undefined)
    throw new CliError('--overwrite requires --key-path.');
  const keyPath =
    values['key-path'] === undefined
      ? undefined
      : await ensureCredentialPath(values['key-path'], values.overwrite);
  const port = Number(values.port ?? 0);
  const timeout = Number(values.timeout ?? DEFAULT_TIMEOUT_SECONDS);
  if (!Number.isInteger(port) || port < 0 || port > MAX_CALLBACK_PORT)
    throw new CliError('--port must be an integer between 0 and 65535.');
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > MAX_TIMEOUT_SECONDS)
    throw new CliError('--timeout must be between 1 and 3600 seconds.');
  const secretTarget = await resolveSecretTarget(values, signal);
  const env = secretTarget ? await getGhEnvironment(signal) : undefined;
  await createReleaser({
    owner,
    manifest,
    name,
    personal: values.personal,
    installationTarget,
    keyPath,
    overwrite: values.overwrite,
    includeSecrets: values['include-secrets'],
    port,
    timeoutMs: timeout * MILLISECONDS_PER_SECOND,
    noOpen: values['no-open'],
    noInstall: values['no-install'],
    secretTarget,
    secretPrefix: values['secret-prefix'],
    env,
    signal,
  });
}
