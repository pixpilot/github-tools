import type { SecretTarget } from './types';
import { CliError } from './cli-error';
import { ensureInput } from './ensure-input';

// Constructs Actions secret commands without including secret values in process arguments.
export function secretArguments(target: SecretTarget, prefix = 'RELEASER'): string[][] {
  ensureInput(prefix, 'prefix');
  const names = [`${prefix}_ID`, `${prefix}_PRIVATE_KEY`];
  if (target.kind === 'repositories') {
    if (!target.repositories.length) throw new CliError('Select at least one --repo.');
    return [...new Set(target.repositories)].flatMap((repository) => {
      ensureInput(repository, 'repository');
      return names.map((name) => [
        'secret',
        'set',
        name,
        '--app',
        'actions',
        '--repo',
        repository,
      ]);
    });
  }
  const organization = ensureInput(target.organization, 'account');
  if (!['selected', 'private', 'all'].includes(target.visibility))
    throw new CliError('Invalid organization secret visibility.');
  if (target.visibility !== 'selected' && (target.repositories?.length ?? 0) > 0) {
    throw new CliError(
      '--repo only applies to organization secrets with --visibility selected.',
    );
  }
  const repositories = [...new Set(target.repositories ?? [])].map((repository) => {
    ensureInput(repository, 'repository');
    const [owner, name] = repository.split('/');
    if (owner?.toLowerCase() !== organization.toLowerCase())
      throw new CliError(
        'Selected repositories must belong to the secrets organization.',
      );
    return name!;
  });
  if (target.visibility === 'selected' && !repositories.length)
    throw new CliError('Selected visibility requires at least one --repo.');
  const scope = ['--org', organization, '--visibility', target.visibility];
  if (repositories.length) scope.push('--repos', repositories.join(','));
  return names.map((name) => ['secret', 'set', name, '--app', 'actions', ...scope]);
}
