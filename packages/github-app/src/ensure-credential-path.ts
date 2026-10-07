import { lstat, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { CliError } from './cli-error';

// Validates an absolute key path outside Git repositories and checks overwrite consent.
export async function ensureCredentialPath(
  path: string,
  overwrite = false,
): Promise<string> {
  if (!isAbsolute(path))
    throw new CliError(
      'Choose an absolute --key-path in a secure local directory outside a Git repository.',
    );
  const target = resolve(path);
  let directory = dirname(target);
  while (true) {
    try {
      // Resolve the nearest existing parent so symlinked folders cannot hide a Git root.
      // eslint-disable-next-line no-await-in-loop
      directory = await realpath(directory);
      break;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
        throw error;
      const parent = dirname(directory);
      if (parent === directory)
        throw new CliError('Cannot resolve the credential directory.');
      directory = parent;
    }
  }
  while (true) {
    // Parent traversal is dependent: each check determines the next path to inspect.
    // eslint-disable-next-line no-await-in-loop
    const hasGitDirectory = await stat(resolve(directory, '.git')).then(
      () => true,
      () => false,
    );
    if (hasGitDirectory) {
      throw new CliError(
        'Private keys must be saved outside Git repositories. Choose another --key-path.',
      );
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  for (const file of [target, `${target}.json`]) {
    try {
      // Stop at the first conflicting destination before authorizing a write.
      // eslint-disable-next-line no-await-in-loop
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink())
        throw new CliError(
          'Credential paths must be regular files, not symlinks or directories.',
        );
      if (!overwrite)
        throw new CliError(
          'A credential file already exists. Choose another path or pass --overwrite explicitly.',
        );
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') continue;
      throw error;
    }
  }
  return target;
}
