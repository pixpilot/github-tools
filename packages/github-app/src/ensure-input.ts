import { CliError } from './cli-error';

// Validates account names, slugs, repositories, and secret names before side effects.
export function ensureInput(
  value: string,
  kind: 'account' | 'slug' | 'repository' | 'prefix',
): string {
  const patterns = {
    account: /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/iu,
    slug: /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/iu,
    repository: /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\/[\w.-]+$/iu,
    prefix: /^[a-z_]\w*$/iu,
  };
  if (!patterns[kind].test(value) || (kind === 'prefix' && /^github_/iu.test(value))) {
    throw new CliError(
      `Invalid ${kind}. Repositories must use OWNER/REPO; secret prefixes cannot start with GITHUB_.`,
    );
  }
  return value;
}
