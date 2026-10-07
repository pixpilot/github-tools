import type { CliValues, SecretTarget } from './types';
import process from 'node:process';
import { CliError } from './cli-error';
import { prompt } from './prompt';
import { secretArguments } from './secret-arguments';

// Resolves optional repository or organization secret setup before creating an app.
export async function resolveSecretTarget(
  values: CliValues,
  signal?: AbortSignal,
): Promise<SecretTarget | undefined> {
  if (values['no-secrets']) {
    if ((values.repo?.length ?? 0) > 0 || values['secrets-org'] !== undefined)
      throw new CliError('--no-secrets cannot be combined with secret targets.');
    return undefined;
  }
  let organization = values['secrets-org'];
  let repositories = values.repo ?? [];
  if (organization === undefined && !repositories.length) {
    if (!process.stdin.isTTY) return undefined;
    const mode = await prompt(
      'Actions secrets: none, repositories, or organization (recommended for shared credentials)',
      { fallback: 'none', signal },
    );
    if (mode === 'none') return undefined;
    if (mode === 'organization')
      organization = await prompt('Secrets organization', { signal });
    else if (mode !== 'repositories')
      throw new CliError('Choose none, repositories, or organization.');
    if (organization === undefined)
      repositories = (
        await prompt('Repositories (OWNER/REPO, comma-separated)', { signal })
      )
        .split(',')
        .map((value) => value.trim());
  }
  let target: SecretTarget;
  if (organization !== undefined) {
    const visibility = values.visibility ?? 'selected';
    if (!['selected', 'private', 'all'].includes(visibility))
      throw new CliError('--visibility must be selected, private, or all.');
    if (visibility === 'selected' && !repositories.length) {
      repositories = (
        await prompt('Selected repositories (OWNER/REPO, comma-separated)', { signal })
      )
        .split(',')
        .map((value) => value.trim());
    }
    target = {
      kind: 'organization',
      organization,
      visibility: visibility as 'selected' | 'private' | 'all',
      repositories,
    };
  } else {
    if (values.visibility !== undefined)
      throw new CliError('--visibility requires --secrets-org.');
    target = { kind: 'repositories', repositories };
  }
  secretArguments(target, values['secret-prefix']);
  return target;
}
