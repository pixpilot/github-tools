import type { CreateDependencies } from '../src/create-releaser';
import { describe, expect, it, vi } from 'vitest';
import { createReleaser } from '../src/create-releaser';
import { app } from './fixtures';

function dependencies(): Required<CreateDependencies> {
  return {
    start: vi.fn(async () => ({
      url: 'http://127.0.0.1:1234/start/random',
      code: Promise.resolve('code'),
      close: vi.fn(async () => {}),
    })),
    exchange: vi.fn(async () => app),
    save: vi.fn(async () => {
      throw new Error('Unexpected disk write');
    }),
    open: vi.fn(async () => {}),
    secrets: vi.fn(async () => {}),
    log: vi.fn(),
  };
}

describe('createReleaser without a local backup', () => {
  it('should upload Actions secrets from memory without writing credentials or logging the PEM', async () => {
    const deps = dependencies();
    const target = { kind: 'repositories' as const, repositories: ['pixpilot/one'] };
    await createReleaser({ owner: 'pixpilot', secretTarget: target }, deps);
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.secrets).toHaveBeenCalledWith(app, target, expect.any(Object));
    expect(deps.log).toHaveBeenCalledWith('No local credential files were created.');
    expect(JSON.stringify(vi.mocked(deps.log).mock.calls)).not.toContain(app.pem);
  });

  it('should explain how to configure releases when no secrets or backup were selected', async () => {
    const deps = dependencies();
    await createReleaser({ owner: 'pixpilot' }, deps);
    expect(deps.save).not.toHaveBeenCalled();
    expect(deps.secrets).not.toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith(
      expect.stringContaining('Generate a new private key'),
    );
  });

  it('should report recovery without claiming a backup exists when uploading secrets fails', async () => {
    const deps = dependencies();
    vi.mocked(deps.secrets).mockRejectedValue(new Error(app.pem));
    const error = await createReleaser(
      {
        owner: 'pixpilot',
        secretTarget: { kind: 'repositories', repositories: ['pixpilot/one'] },
      },
      deps,
    ).catch((failure: unknown) => failure);
    expect(String(error)).toContain('No local backup was requested');
    expect(String(error)).toContain('Generate a new private key');
    expect(String(error)).not.toContain(app.pem);
    expect(deps.save).not.toHaveBeenCalled();
  });

  it('should reject overwrite without a backup path before app creation', async () => {
    const deps = dependencies();
    await expect(
      createReleaser({ owner: 'pixpilot', overwrite: true }, deps),
    ).rejects.toThrow('--overwrite requires --key-path');
    expect(deps.start).not.toHaveBeenCalled();
  });
});
