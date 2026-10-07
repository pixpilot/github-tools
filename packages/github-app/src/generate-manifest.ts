import type { Manifest, ManifestOptions } from './types';
import { CliError } from './cli-error';
import { ensureInput } from './ensure-input';
import { validateManifestConfig } from './validate-manifest-config';

// Builds the release bot manifest with only the requested repository permissions.
export function generateManifest(
  options: ManifestOptions,
  redirectUrl: string,
): Manifest {
  const owner = ensureInput(options.owner, 'account');
  const config = validateManifestConfig(options.manifest ?? {});
  const name = options.name?.trim() ?? config.name?.trim() ?? 'My Releaser';
  if (!name) throw new CliError('The app name cannot be empty.');
  const homepage = config.url ?? `https://github.com/${owner}`;
  return {
    name,
    description:
      config.description ?? 'Internal bot to handle automatic releases of packages.',
    url: homepage,
    redirect_url: redirectUrl,
    callback_urls: [homepage],
    public:
      options.installationTarget === undefined
        ? (config.public ?? false)
        : options.installationTarget === 'any',
    hook_attributes: { active: false, url: homepage },
    default_permissions: {
      ...(config.default_permissions ?? {
        checks: 'write',
        contents: 'write',
        issues: 'write',
        metadata: 'read',
        pull_requests: 'write',
      }),
      ...(options.includeSecrets ? { secrets: 'read' as const } : {}),
    },
    default_events: [],
  };
}
