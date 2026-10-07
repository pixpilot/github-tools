import type { RunCommand, SecretTarget } from './types';
import { createPrivateKey } from 'node:crypto';
import process from 'node:process';
import { CliError } from './cli-error';
import { runCommand } from './run-command';
import { secretArguments } from './secret-arguments';

// Uploads the app ID and key via gh stdin, using the operator's authentication.
export async function configureSecrets(
  app: { id: number; pem: string },
  target: SecretTarget,
  options: {
    prefix?: string | undefined;
    env?: NodeJS.ProcessEnv | undefined;
    run?: RunCommand;
  } = {},
): Promise<void> {
  const commands = secretArguments(target, options.prefix);
  if (!Number.isSafeInteger(app.id) || app.id <= 0)
    throw new CliError('App ID must be a positive integer.');
  try {
    createPrivateKey(app.pem);
  } catch {
    throw new CliError('The private key is not a valid PEM.');
  }
  const run = options.run ?? runCommand;
  const env = { ...process.env, ...options.env, GH_HOST: 'github.com' };
  for (const args of commands) {
    try {
      // Stop on the first failure so additional repositories are not partially configured.
      // eslint-disable-next-line no-await-in-loop
      await run('gh', args, {
        env,
        input: args[2]?.endsWith('_ID') ? String(app.id) : app.pem,
      });
    } catch {
      throw new CliError(
        'Secret configuration failed; earlier secrets may already be updated. Check gh authentication and Actions secret permissions. Retry configure-secrets with a saved private key, or generate a new key in GitHub app settings.',
      );
    }
  }
}
