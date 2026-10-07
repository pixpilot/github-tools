import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ensureCredentialPath } from '../src/ensure-credential-path';
import { runCommand } from '../src/run-command';
import { saveCredentials } from '../src/save-credentials';
import { app } from './fixtures';

describe('saveCredentials', () => {
  let directory: string;
  let path: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'github-app-test-'));
    path = join(directory, 'releaser.pem');
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('should save the PEM securely and exclude secrets from metadata', async () => {
    await expect(saveCredentials(app, path)).resolves.toBe(path);
    expect(await readFile(path, 'utf8')).toBe(app.pem);
    const metadata: unknown = JSON.parse(await readFile(`${path}.json`, 'utf8'));
    expect(metadata).toEqual({
      id: app.id,
      slug: app.slug,
      client_id: app.client_id,
      html_url: app.html_url,
    });
    expect(await readdir(directory)).toEqual(['releaser.pem', 'releaser.pem.json']);
    if (process.platform === 'win32') {
      const permissions = await runCommand('icacls.exe', [path]);
      expect(permissions).not.toContain('(I)');
      expect(permissions).not.toContain('Everyone');
      expect(permissions).not.toContain('BUILTIN\\Users');
    } else expect((await stat(path)).mode % 0o1000).toBe(0o600);
  }, 15000);

  it('should preserve an existing key unless overwrite is explicit', async () => {
    await writeFile(path, 'existing-key');
    await expect(saveCredentials(app, path)).rejects.toThrow('--overwrite');
    expect(await readFile(path, 'utf8')).toBe('existing-key');
    expect(await readdir(directory)).toEqual(['releaser.pem']);
    await saveCredentials(app, path, true);
    expect(await readFile(path, 'utf8')).toBe(app.pem);
  }, 15000);

  it('should reject an existing metadata file before writing the key', async () => {
    await writeFile(`${path}.json`, 'existing');
    await expect(saveCredentials(app, path)).rejects.toThrow('--overwrite');
    expect(await readdir(directory)).toEqual(['releaser.pem.json']);
  });

  it('should reject relative paths and keys inside a Git repository', async () => {
    await expect(ensureCredentialPath('relative.pem')).rejects.toThrow('absolute');
    await mkdir(join(directory, '.git'));
    await expect(saveCredentials(app, path)).rejects.toThrow('outside Git repositories');
    expect(await readdir(directory)).toEqual(['.git']);
  });

  it('should reject directories even when overwrite is requested', async () => {
    await mkdir(path);
    await expect(saveCredentials(app, path, true)).rejects.toThrow('regular files');
  });
});
