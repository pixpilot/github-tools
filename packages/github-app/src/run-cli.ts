import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { CliError } from './cli-error';
import { configureBranchProtection } from './configure-branch-protection';
import { configureSecrets } from './configure-secrets';
import { ensureInput } from './ensure-input';
import { getGhEnvironment } from './get-gh-environment';
import { help } from './help';
import { openBrowser } from './open-browser';
import { parseCli } from './parse-cli';
import { print } from './print';
import { prompt } from './prompt';
import { resolveSecretTarget } from './resolve-secret-target';
import { runCreate } from './run-create';

const CANCELLED_EXIT_CODE = 130;

// Dispatches CLI commands and reports only safe, actionable error messages.
export async function runCli(args: string[]): Promise<number> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const { command, values } = parseCli(args);
    if (command === 'help') print(help);
    else if (command === 'create') await runCreate(values, controller.signal);
    else if (command === 'install') {
      const slug = ensureInput(
        values.slug ?? (await prompt('App slug (--slug)', { signal: controller.signal })),
        'slug',
      );
      const url = `https://github.com/apps/${slug}/installations/new`;
      print(`Install app and select repositories: ${url}`);
      if (!values['no-open'])
        await openBrowser(url).catch(() =>
          print('Open the installation URL above to continue.'),
        );
    } else if (command === 'configure-secrets') {
      const id = Number(
        values['app-id'] ??
          (await prompt('App ID (--app-id)', { signal: controller.signal })),
      );
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new CliError('App ID must be a positive integer.');
      const keyPath =
        values['key-path'] ??
        (await prompt('PEM path (--key-path)', { signal: controller.signal }));
      let pem: string;
      try {
        pem = await readFile(keyPath, 'utf8');
      } catch {
        throw new CliError(
          'Cannot read the private key file. Check --key-path and its permissions.',
        );
      }
      const target = await resolveSecretTarget(values, controller.signal);
      if (!target)
        throw new CliError('Choose --repo or --secrets-org to configure secrets.');
      await configureSecrets({ id, pem }, target, {
        prefix: values['secret-prefix'],
        env: await getGhEnvironment(controller.signal),
      });
      print('Actions secrets configured.');
    } else {
      if (
        values.slug === undefined ||
        values.slug.length === 0 ||
        values.repo === undefined ||
        !values.repo.length ||
        values.branch === undefined ||
        !values.branch.length
      )
        throw new CliError(
          'Explicit --slug, --repo, and --branch values are required for a bypass.',
        );
      await configureBranchProtection({
        slug: values.slug,
        repositories: values.repo,
        branches: values.branch,
        env: await getGhEnvironment(controller.signal),
      });
      print('App bypass configured for the requested branches.');
    }
    return 0;
  } catch (error) {
    if (
      controller.signal.aborted ||
      (error instanceof CliError && /cancelled/iu.test(error.message))
    ) {
      console.error('Cancelled. Any credentials already saved remain on disk.');
      return CANCELLED_EXIT_CODE;
    }
    console.error(
      error instanceof CliError
        ? error.message
        : 'Operation failed. Check inputs and permissions, then retry.',
    );
    return 1;
  } finally {
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
  }
}
