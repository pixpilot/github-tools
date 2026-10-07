import process from 'node:process';
import { CliError } from './cli-error';
import { prompt } from './prompt';
import { runCommand } from './run-command';

// Reuses gh authentication or asks for a masked operator token without saving it.
export async function getGhEnvironment(signal?: AbortSignal): Promise<NodeJS.ProcessEnv> {
  const env: NodeJS.ProcessEnv = { ...process.env, GH_HOST: 'github.com' };
  try {
    await runCommand('gh', ['--version'], { env });
  } catch {
    throw new CliError(
      'Install GitHub CLI (gh) to configure secrets or branch protection. App creation does not require gh.',
    );
  }
  if ((env['GH_TOKEN']?.length ?? 0) > 0 || (env['GITHUB_TOKEN']?.length ?? 0) > 0)
    return env;
  try {
    await runCommand('gh', ['auth', 'status', '--hostname', 'github.com'], { env });
    return env;
  } catch {
    const token = await prompt('GitHub operator token (used only for configuration)', {
      secret: true,
      signal,
    });
    return { ...env, GH_TOKEN: token };
  }
}
