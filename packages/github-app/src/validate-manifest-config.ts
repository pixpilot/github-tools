import type { ManifestConfig } from './types';
import { CliError } from './cli-error';

const FIELDS = ['name', 'url', 'description', 'public', 'default_permissions'];

// Validates supported JSON manifest fields without exposing file contents in errors.
export function validateManifestConfig(data: unknown): ManifestConfig {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new CliError('The manifest must be a JSON object.');
  }
  const config = data as Record<string, unknown>;
  if (Object.keys(config).some((key) => !FIELDS.includes(key))) {
    throw new CliError(
      'Unsupported manifest field. Supported fields: name, url, description, public, default_permissions. The CLI manages the temporary callback and disables webhooks.',
    );
  }
  const {
    name,
    url,
    description,
    public: visibility,
    default_permissions: permissions,
  } = config;
  if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
    throw new CliError('Manifest name must be a non-empty string.');
  }
  if (description !== undefined && typeof description !== 'string') {
    throw new CliError('Manifest description must be a string.');
  }
  if (visibility !== undefined && typeof visibility !== 'boolean') {
    throw new CliError('Manifest public must be true or false.');
  }
  if (url !== undefined) {
    if (typeof url !== 'string')
      throw new CliError('Manifest url must be an HTTP or HTTPS URL.');
    try {
      const parsed = new URL(url);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password
      )
        throw new Error('Invalid homepage');
    } catch {
      throw new CliError(
        'Manifest url must be an HTTP or HTTPS URL without credentials.',
      );
    }
  }
  const parsedPermissions: Record<string, 'read' | 'write'> = {};
  if (permissions !== undefined) {
    if (
      permissions === null ||
      typeof permissions !== 'object' ||
      Array.isArray(permissions)
    ) {
      throw new CliError('Manifest default_permissions must be an object.');
    }
    for (const [key, value] of Object.entries<unknown>(
      permissions as Record<string, unknown>,
    )) {
      if (
        !/^[a-z][a-z_]*$/u.test(key) ||
        (value !== 'read' && value !== 'write') ||
        (key === 'metadata' && value !== 'read')
      ) {
        throw new CliError(
          'Manifest permission names must use lowercase letters and underscores, and values must be read or write. Metadata only supports read.',
        );
      }
      parsedPermissions[key] = value;
    }
  }
  return {
    ...(name === undefined ? {} : { name }),
    ...(url === undefined ? {} : { url }),
    ...(description === undefined ? {} : { description }),
    ...(visibility === undefined ? {} : { public: visibility }),
    ...(permissions === undefined ? {} : { default_permissions: parsedPermissions }),
  };
}
