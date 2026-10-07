import type { ServerOptions } from './start-manifest-server';
import type { AppCredentials, SecretTarget } from './types';
import { CliError } from './cli-error';
import { configureSecrets } from './configure-secrets';
import { ensureCredentialPath } from './ensure-credential-path';
import { exchangeManifestCode } from './exchange-manifest-code';
import { generateManifest } from './generate-manifest';
import { openBrowser } from './open-browser';
import { print } from './print';
import { saveCredentials } from './save-credentials';
import { secretArguments } from './secret-arguments';
import { startManifestServer } from './start-manifest-server';

export interface CreateOptions extends ServerOptions {
  keyPath?: string | undefined;
  overwrite?: boolean | undefined;
  noOpen?: boolean | undefined;
  noInstall?: boolean | undefined;
  secretTarget?: SecretTarget | undefined;
  secretPrefix?: string | undefined;
  env?: NodeJS.ProcessEnv | undefined;
}

export interface CreateDependencies {
  start?: typeof startManifestServer;
  exchange?: typeof exchangeManifestCode;
  save?: typeof saveCredentials;
  open?: typeof openBrowser;
  secrets?: typeof configureSecrets;
  log?: (message: string) => void;
}

// Coordinates manifest authorization, optional local backup, installation, and secret setup.
export async function createReleaser(
  options: CreateOptions,
  dependencies: CreateDependencies = {},
): Promise<AppCredentials> {
  const log = dependencies.log ?? print;
  const open = dependencies.open ?? openBrowser;
  generateManifest(options, 'http://127.0.0.1/callback');
  if (options.overwrite && options.keyPath === undefined)
    throw new CliError('--overwrite requires --key-path.');
  if (options.keyPath !== undefined)
    await ensureCredentialPath(options.keyPath, options.overwrite);
  if (options.secretTarget) secretArguments(options.secretTarget, options.secretPrefix);
  if (options.signal?.aborted) throw new CliError('Cancelled.');
  const server = await (dependencies.start ?? startManifestServer)(options);
  let app: AppCredentials;
  try {
    log(`Create app: ${server.url}`);
    log(
      'If GitHub reports a name conflict, choose a unique app name on that page. Ctrl+C cancels.',
    );
    if (!options.noOpen)
      await open(server.url).catch(() =>
        log('Open the URL above in your browser to continue.'),
      );
    const code = await server.code;
    if (options.signal?.aborted) throw new CliError('Cancelled.');
    app = await (dependencies.exchange ?? exchangeManifestCode)(
      code,
      undefined,
      options.signal,
    );
    if (options.keyPath !== undefined) {
      const path = await (dependencies.save ?? saveCredentials)(
        app,
        options.keyPath,
        options.overwrite,
      );
      log(`Private key saved: ${path}`);
    }
    log(`App ID: ${app.id}; client ID: ${app.client_id}; slug: ${app.slug}`);
  } finally {
    await server.close();
  }
  const installationUrl = `${app.html_url}/installations/new`;
  log(`Install app and select repositories: ${installationUrl}`);
  log(
    'Organization installation may require owner approval and must comply with the organization app policy.',
  );
  if (!options.noOpen && !options.noInstall)
    await open(installationUrl).catch(() =>
      log('Open the installation URL above to continue.'),
    );
  if (options.secretTarget) {
    try {
      await (dependencies.secrets ?? configureSecrets)(app, options.secretTarget, {
        prefix: options.secretPrefix,
        env: options.env,
      });
    } catch {
      const recovery =
        options.keyPath === undefined
          ? 'No local backup was requested. Generate a new private key in GitHub app settings and run configure-secrets to finish.'
          : 'The private key backup remains at your --key-path. Retry configure-secrets after checking gh authentication and permissions.';
      throw new CliError(
        `App created, but Actions secret configuration failed; earlier secrets may already be updated. ${recovery}`,
      );
    }
    log(
      `Actions secrets configured: ${options.secretPrefix ?? 'RELEASER'}_ID and ${options.secretPrefix ?? 'RELEASER'}_PRIVATE_KEY`,
    );
  }
  if (options.keyPath === undefined) {
    log('No local credential files were created.');
    if (!options.secretTarget)
      log(
        'No Actions secrets were configured. Generate a new private key in GitHub app settings when you are ready to configure releases.',
      );
  }
  return app;
}
