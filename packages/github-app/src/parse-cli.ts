import type { CliValues } from './types';
import { parseArgs } from 'node:util';
import { CliError } from './cli-error';

// Parses command-specific options, rejecting flags that would otherwise be silently ignored.
export function parseCli(args: string[]): { command: string; values: CliValues } {
  const definitions = {
    manifest: { type: 'string' },
    org: { type: 'string' },
    owner: { type: 'string' },
    personal: { type: 'boolean' },
    name: { type: 'string' },
    'install-target': { type: 'string' },
    'key-path': { type: 'string' },
    overwrite: { type: 'boolean' },
    'include-secrets': { type: 'boolean' },
    repo: { type: 'string', multiple: true },
    'secrets-org': { type: 'string' },
    visibility: { type: 'string' },
    'secret-prefix': { type: 'string' },
    'no-secrets': { type: 'boolean' },
    'no-open': { type: 'boolean' },
    'no-install': { type: 'boolean' },
    port: { type: 'string' },
    timeout: { type: 'string' },
    'app-id': { type: 'string' },
    slug: { type: 'string' },
    branch: { type: 'string', multiple: true },
    help: { type: 'boolean', short: 'h' },
  } as const;
  let parsed;
  try {
    parsed = parseArgs({ args, options: definitions, allowPositionals: true });
  } catch {
    throw new CliError('Invalid arguments. Run github-app --help for supported flags.');
  }
  const [command = '', preset, ...extra] = parsed.positionals;
  const { values } = parsed;
  if (values.help || !args.length) return { command: 'help', values };
  if (
    extra.length ||
    (command === 'create' ? preset !== 'releaser' : preset !== undefined)
  ) {
    throw new CliError(
      'Use create releaser, install, configure-secrets, or configure-branch-protection.',
    );
  }
  const secrets = ['repo', 'secrets-org', 'visibility', 'secret-prefix'];
  const allowed: Record<string, string[]> = {
    create: [
      'manifest',
      'org',
      'owner',
      'personal',
      'name',
      'install-target',
      'key-path',
      'overwrite',
      'include-secrets',
      'no-secrets',
      'no-open',
      'no-install',
      'port',
      'timeout',
      ...secrets,
    ],
    install: ['slug', 'no-open'],
    'configure-secrets': ['app-id', 'key-path', ...secrets],
    'configure-branch-protection': ['slug', 'repo', 'branch'],
  };
  if (
    !allowed[command] ||
    Object.keys(values).some((key) => key !== 'help' && !allowed[command]?.includes(key))
  ) {
    throw new CliError(
      'Unknown command or unsupported flag for this command. Run github-app --help.',
    );
  }
  return { command, values };
}
