import type { ManifestConfig } from './types';
import { readFile } from 'node:fs/promises';
import { CliError } from './cli-error';
import { validateManifestConfig } from './validate-manifest-config';

// Reads strict JSON app settings before any browser or credential operations begin.
export async function readManifest(path: string): Promise<ManifestConfig> {
  let contents: string;
  try {
    contents = await readFile(path, 'utf8');
  } catch {
    throw new CliError('Cannot read --manifest. Check the file path and permissions.');
  }
  let data: unknown;
  try {
    data = JSON.parse(contents.replace(/^\uFEFF/u, ''));
  } catch {
    throw new CliError(
      'Invalid manifest JSON. Use double-quoted property names and strings, with no comments or trailing commas.',
    );
  }
  return validateManifestConfig(data);
}
