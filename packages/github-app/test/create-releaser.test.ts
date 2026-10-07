import type { CreateDependencies } from '../src/create-releaser';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CliError } from '../src/cli-error';
import { createReleaser } from '../src/create-releaser';
import { app } from './fixtures';

describe('createReleaser', () => {
  let directory: string;
  let path: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'github-app-flow-test-'));
    path = join(directory, 'releaser.pem');
  });
  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  function dependencies(code: Promise<string> = Promise.resolve('code')) {
    const close = vi.fn(async () => {});
    const mocks: Required<CreateDependencies> = {
      start: vi.fn(async () => ({
        url: 'http://127.0.0.1:1234/start/random',
        code,
        close,
      })),
      exchange: vi.fn(async () => app),
      save: vi.fn(async () => path),
      open: vi.fn(async () => {}),
      secrets: vi.fn(async () => {}),
      log: vi.fn(),
    };
    return { ...mocks, close };
  }

  it('should save credentials, open installation, and configure secrets without logging the PEM', async () => {
    const deps = dependencies();
    const target = { kind: 'repositories' as const, repositories: ['pixpilot/one'] };
    await expect(
      createReleaser({ owner: 'pixpilot', keyPath: path, secretTarget: target }, deps),
    ).resolves.toEqual(app);
    expect(deps.save).toHaveBeenCalledWith(app, path, undefined);
    expect(deps.open).toHaveBeenCalledWith(`${app.html_url}/installations/new`);
    expect(deps.secrets).toHaveBeenCalledWith(app, target, expect.any(Object));
    expect(deps.close).toHaveBeenCalledOnce();
    expect(JSON.stringify(vi.mocked(deps.log).mock.calls)).not.toContain('PRIVATE KEY');
    expect(JSON.stringify(vi.mocked(deps.log).mock.calls)).not.toContain(app.pem);
  });

  it('should cancel cleanly without partial credentials', async () => {
    const code = Promise.reject(new CliError('GitHub authorization was cancelled.'));
    void code.catch(() => {});
    const deps = dependencies(code);
    await expect(
      createReleaser({ owner: 'pixpilot', keyPath: path, noOpen: true }, deps),
    ).rejects.toThrow('cancelled');
    expect(deps.exchange).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.close).toHaveBeenCalledOnce();
    expect(await readdir(directory)).toEqual([]);
  });

  it('should allow restarting an expired-code flow without writing files', async () => {
    const deps = dependencies();
    vi.mocked(deps.exchange).mockRejectedValueOnce(
      new CliError('Code expired. Restart the create command.'),
    );
    await expect(
      createReleaser({ owner: 'pixpilot', keyPath: path, noOpen: true }, deps),
    ).rejects.toThrow('expired');
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.close).toHaveBeenCalledOnce();
    expect(await readdir(directory)).toEqual([]);
    await expect(
      createReleaser({ owner: 'pixpilot', keyPath: path, noOpen: true }, deps),
    ).resolves.toEqual(app);
  });

  it('should reject existing files before opening GitHub', async () => {
    await writeFile(path, 'existing');
    const deps = dependencies();
    await expect(
      createReleaser({ owner: 'pixpilot', keyPath: path }, deps),
    ).rejects.toThrow('--overwrite');
    expect(deps.start).not.toHaveBeenCalled();
  });

  it('should leave saved credentials recoverable when optional secret setup fails', async () => {
    const deps = dependencies();
    vi.mocked(deps.secrets).mockRejectedValue(new CliError('Secrets failed'));
    await expect(
      createReleaser(
        {
          owner: 'pixpilot',
          keyPath: path,
          noOpen: true,
          secretTarget: { kind: 'repositories', repositories: ['pixpilot/one'] },
        },
        deps,
      ),
    ).rejects.toThrow('The private key backup remains at your --key-path');
    expect(deps.save).toHaveBeenCalledOnce();
    expect(deps.close).toHaveBeenCalledOnce();
  });
});
