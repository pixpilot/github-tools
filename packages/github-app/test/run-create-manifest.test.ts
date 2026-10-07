import type { ManifestConfig } from '../src/types';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReleaser } from '../src/create-releaser';
import { prompt } from '../src/prompt';
import { runCreate } from '../src/run-create';
import { app } from './fixtures';

vi.mock('node:process', () => ({ default: { stdin: { isTTY: true } } }));
vi.mock('../src/create-releaser', () => ({ createReleaser: vi.fn() }));
vi.mock('../src/prompt', () => ({ prompt: vi.fn() }));
vi.mock('../src/resolve-secret-target', () => ({
  resolveSecretTarget: vi.fn(async () => undefined),
}));

const config: ManifestConfig = {
  name: 'PixPilot Releaser',
  url: 'https://github.com/pixpilot',
  description: 'Internal release bot.',
  public: false,
  default_permissions: { contents: 'write', metadata: 'read' },
};

describe('runCreate with a manifest file', () => {
  let directory: string;
  let path: string;
  let signal: AbortSignal;
  beforeEach(async () => {
    vi.clearAllMocks();
    directory = await mkdtemp(join(tmpdir(), 'github-app-manifest-create-'));
    path = join(directory, 'app.json');
    signal = new AbortController().signal;
    vi.mocked(createReleaser).mockResolvedValue(app);
    vi.mocked(prompt).mockRejectedValue(new Error('Unexpected prompt'));
    await writeFile(path, JSON.stringify(config));
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('should infer the organization and skip supplied-setting prompts without saving a key locally', async () => {
    await runCreate({ manifest: path, 'no-secrets': true }, signal);
    expect(prompt).not.toHaveBeenCalled();
    expect(createReleaser).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'pixpilot',
        name: config.name,
        installationTarget: 'owner',
        manifest: config,
      }),
    );
    const options = vi.mocked(createReleaser).mock.calls[0]?.[0];
    expect(options!.keyPath).toBeUndefined();
  });

  it('should give explicit CLI flags priority over JSON settings', async () => {
    await runCreate(
      { manifest: path, org: 'another-org', name: 'Override', 'install-target': 'any' },
      signal,
    );
    expect(createReleaser).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'another-org',
        name: 'Override',
        installationTarget: 'any',
        manifest: config,
      }),
    );
    expect(prompt).not.toHaveBeenCalled();
  });

  it('should support public and personally owned apps without repeated prompts', async () => {
    await writeFile(path, JSON.stringify({ ...config, public: true }));
    await runCreate({ manifest: path, personal: true }, signal);
    expect(createReleaser).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'pixpilot',
        personal: true,
        installationTarget: 'any',
      }),
    );
    expect(prompt).not.toHaveBeenCalled();
  });

  it('should accept an explicit owner with a non-GitHub homepage', async () => {
    await writeFile(path, JSON.stringify({ ...config, url: 'https://example.com/app' }));
    await runCreate({ manifest: path, org: 'pixpilot' }, signal);
    expect(createReleaser).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'pixpilot' }),
    );
    expect(prompt).not.toHaveBeenCalled();
  });

  it('should reject invalid JSON before prompts or app creation', async () => {
    await writeFile(path, '{ invalid }');
    await expect(runCreate({ manifest: path }, signal)).rejects.toThrow(
      'Invalid manifest JSON',
    );
    expect(prompt).not.toHaveBeenCalled();
    expect(createReleaser).not.toHaveBeenCalled();
  });
});
