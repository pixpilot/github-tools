import type { AppCredentials } from './types';
import { CliError } from './cli-error';
import { ensureCredentialPath } from './ensure-credential-path';
import { writeSecureFile } from './write-secure-file';

const JSON_INDENT = 2;

// Saves the key and non-secret app metadata; unused OAuth and webhook secrets are discarded.
export async function saveCredentials(
  app: AppCredentials,
  path: string,
  overwrite = false,
): Promise<string> {
  const target = await ensureCredentialPath(path, overwrite);
  try {
    await writeSecureFile(target, app.pem, overwrite);
  } catch {
    throw new CliError(
      'Could not save the private key securely. The app exists: generate a new key in its GitHub settings before retrying.',
    );
  }
  const { pem: _pem, ...metadata } = app;
  try {
    await writeSecureFile(
      `${target}.json`,
      `${JSON.stringify(metadata, null, JSON_INDENT)}\n`,
      overwrite,
    );
  } catch {
    throw new CliError(
      'The private key was saved, but its metadata file could not be written. The App ID is available in GitHub app settings.',
    );
  }
  return target;
}
