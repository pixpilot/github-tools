import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReleaser } from '../src/create-releaser';
import { getGhEnvironment } from '../src/get-gh-environment';
import { prompt } from '../src/prompt';
import { resolveSecretTarget } from '../src/resolve-secret-target';
import { runCreate } from '../src/run-create';
import { app } from './fixtures';

vi.mock('node:process', () => ({ default: { stdin: { isTTY: true } } }));
vi.mock('../src/create-releaser', () => ({ createReleaser: vi.fn() }));
vi.mock('../src/get-gh-environment', () => ({ getGhEnvironment: vi.fn() }));
vi.mock('../src/prompt', () => ({ prompt: vi.fn() }));
vi.mock('../src/resolve-secret-target', () => ({ resolveSecretTarget: vi.fn() }));

describe('runCreate', () => {
  let directory: string;
  let signal: AbortSignal;

  beforeEach(async () => {
    vi.resetAllMocks();
    directory = await mkdtemp(join(tmpdir(), 'github-app-create-options-'));
    signal = new AbortController().signal;
    vi.mocked(createReleaser).mockResolvedValue(app);
    vi.mocked(resolveSecretTarget).mockResolvedValue(undefined);
    vi.mocked(prompt).mockImplementation(async (_label, options) => {
      if (options?.fallback === undefined) throw new Error('Unexpected required prompt');
      return options.fallback;
    });
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('should create without a local backup or PEM prompt by default', async () => {
    await runCreate({ org: 'pixpilot', 'no-secrets': true }, signal);
    const options = vi.mocked(createReleaser).mock.calls[0]?.[0];
    expect(options).toBeDefined();
    expect(options!.keyPath).toBeUndefined();
    expect(vi.mocked(prompt).mock.calls.map((call) => call[0])).toEqual([
      'App name (--name)',
      'Install on owner or any account (--install-target)',
    ]);
    expect(getGhEnvironment).not.toHaveBeenCalled();
  });

  it('should reject overwrite without an explicit backup path', async () => {
    await expect(runCreate({ org: 'pixpilot', overwrite: true }, signal)).rejects.toThrow(
      '--overwrite requires --key-path',
    );
    expect(createReleaser).not.toHaveBeenCalled();
  });

  it('should preserve an explicit key path override', async () => {
    const path = join(directory, 'custom.pem');
    await runCreate({ org: 'pixpilot', 'key-path': path }, signal);
    expect(createReleaser).toHaveBeenCalledWith(
      expect.objectContaining({ keyPath: path }),
    );
  });

  it('should require explicit overwrite for an existing custom key', async () => {
    const path = join(directory, 'existing.pem');
    await writeFile(path, 'existing-key');
    await expect(
      runCreate({ org: 'pixpilot', 'key-path': path }, signal),
    ).rejects.toThrow('--overwrite');
    expect(createReleaser).not.toHaveBeenCalled();
    expect(await readFile(path, 'utf8')).toBe('existing-key');
    await runCreate({ org: 'pixpilot', 'key-path': path, overwrite: true }, signal);
    expect(createReleaser).toHaveBeenCalledWith(
      expect.objectContaining({ keyPath: path, overwrite: true }),
    );
  });

  it('should reject relative overrides before opening GitHub', async () => {
    await expect(
      runCreate({ org: 'pixpilot', 'key-path': 'relative.pem' }, signal),
    ).rejects.toThrow('absolute');
    expect(createReleaser).not.toHaveBeenCalled();
  });

  it('should still configure secrets using the key in memory', async () => {
    const secretTarget = {
      kind: 'repositories' as const,
      repositories: ['pixpilot/one'],
    };
    vi.mocked(resolveSecretTarget).mockResolvedValue(secretTarget);
    vi.mocked(getGhEnvironment).mockResolvedValue({ GH_TOKEN: 'synthetic-token' });
    await runCreate({ org: 'pixpilot', repo: ['pixpilot/one'] }, signal);
    expect(createReleaser).toHaveBeenCalledWith(
      expect.objectContaining({
        secretTarget,
        env: { GH_TOKEN: 'synthetic-token' },
        keyPath: undefined,
      }),
    );
  });
});
