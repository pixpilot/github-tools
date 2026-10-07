import type { ManifestConfig } from '../src/types';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readManifest } from '../src/read-manifest';

const config: ManifestConfig = {
  name: 'PixPilot Releaser',
  url: 'https://github.com/pixpilot',
  description: 'Internal bot to handle automatic releases of packages.',
  public: false,
  default_permissions: { contents: 'write', metadata: 'read' },
};

describe('readManifest', () => {
  let directory: string;
  let path: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'github-app-manifest-test-'));
    path = join(directory, 'app.json');
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('should read the supplied app settings from JSON', async () => {
    await writeFile(path, JSON.stringify(config));
    await expect(readManifest(path)).resolves.toEqual(config);
  });

  it('should support UTF-8 BOM files and partial manifests', async () => {
    await writeFile(path, '\uFEFF{"public": false}');
    await expect(readManifest(path)).resolves.toEqual({ public: false });
  });

  it('should report an unreadable file without printing its contents', async () => {
    await expect(readManifest(path)).rejects.toThrow('Cannot read --manifest');
  });

  it.each(['{ name: "PixPilot" }', '{"name":"PixPilot",}', '{"name":'])(
    'should reject malformed JSON: %s',
    async (contents) => {
      await writeFile(path, contents);
      await expect(readManifest(path)).rejects.toThrow('Invalid manifest JSON');
    },
  );

  it.each([
    { data: null, message: 'JSON object' },
    { data: [], message: 'JSON object' },
    { data: { name: '' }, message: 'non-empty string' },
    { data: { name: 123 }, message: 'non-empty string' },
    { data: { description: false }, message: 'description must be a string' },
    { data: { public: 'false' }, message: 'public must be true or false' },
    { data: { url: 'file:///tmp/app.json' }, message: 'HTTP or HTTPS' },
    { data: { url: 'https://user:pass@example.com' }, message: 'without credentials' },
    { data: { url: 'bad-url' }, message: 'HTTP or HTTPS' },
    { data: { url: 123 }, message: 'HTTP or HTTPS' },
    { data: { default_permissions: [] }, message: 'must be an object' },
    { data: { default_permissions: null }, message: 'must be an object' },
    { data: { default_permissions: { contents: 'admin' } }, message: 'read or write' },
    { data: { default_permissions: { contents: null } }, message: 'read or write' },
    { data: { default_permissions: { 'Pull requests': 'write' } }, message: 'lowercase' },
    {
      data: { default_permissions: { metadata: 'write' } },
      message: 'Metadata only supports read',
    },
    {
      data: { redirect_url: 'https://example.com' },
      message: 'CLI manages the temporary callback',
    },
  ])('should reject invalid manifest settings: $message', async ({ data, message }) => {
    await writeFile(path, JSON.stringify(data));
    await expect(readManifest(path)).rejects.toThrow(message);
  });

  it('should not include private values in validation errors', async () => {
    await writeFile(path, '{"pem":"synthetic-private-key"}');
    const error = await readManifest(path).catch((failure: unknown) => failure);
    expect(String(error)).toContain('Unsupported manifest field');
    expect(String(error)).not.toContain('synthetic-private-key');
  });
});
