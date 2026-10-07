import type { RunCommand, SecretTarget } from '../src/types';
import { describe, expect, it, vi } from 'vitest';
import { configureSecrets } from '../src/configure-secrets';
import { secretArguments } from '../src/secret-arguments';
import { app } from './fixtures';

describe('configureSecrets', () => {
  it('should upload workflow secret names via stdin for multiple repositories', async () => {
    const run = vi.fn<RunCommand>().mockResolvedValue('');
    await configureSecrets(
      app,
      {
        kind: 'repositories',
        repositories: ['pixpilot/one', 'pixpilot/two', 'pixpilot/one'],
      },
      { run },
    );
    expect(run).toHaveBeenCalledTimes(4);
    expect(run.mock.calls[0]?.[1]).toEqual([
      'secret',
      'set',
      'RELEASER_ID',
      '--app',
      'actions',
      '--repo',
      'pixpilot/one',
    ]);
    expect(run.mock.calls[0]?.[2]?.input).toBe(String(app.id));
    expect(run.mock.calls[1]?.[2]?.input).toBe(app.pem);
    expect(JSON.stringify(run.mock.calls.map((call) => call[1]))).not.toContain(app.pem);
  });

  it('should use selected organization repositories and a configurable prefix', () => {
    expect(
      secretArguments(
        {
          kind: 'organization',
          organization: 'pixpilot',
          visibility: 'selected',
          repositories: ['pixpilot/one', 'pixpilot/two'],
        },
        'MY_RELEASER',
      ),
    ).toEqual([
      [
        'secret',
        'set',
        'MY_RELEASER_ID',
        '--app',
        'actions',
        '--org',
        'pixpilot',
        '--visibility',
        'selected',
        '--repos',
        'one,two',
      ],
      [
        'secret',
        'set',
        'MY_RELEASER_PRIVATE_KEY',
        '--app',
        'actions',
        '--org',
        'pixpilot',
        '--visibility',
        'selected',
        '--repos',
        'one,two',
      ],
    ]);
  });

  it.each(['private', 'all'] as const)(
    'should support explicit %s organization visibility',
    (visibility) => {
      expect(
        secretArguments({
          kind: 'organization',
          organization: 'pixpilot',
          visibility,
        })[0],
      ).toContain(visibility);
    },
  );

  it.each<SecretTarget>([
    { kind: 'repositories', repositories: [] },
    { kind: 'repositories', repositories: ['--malicious'] },
    {
      kind: 'organization',
      organization: 'pixpilot',
      visibility: 'selected',
      repositories: [],
    },
    {
      kind: 'organization',
      organization: 'pixpilot',
      visibility: 'selected',
      repositories: ['other/one'],
    },
    {
      kind: 'organization',
      organization: 'pixpilot',
      visibility: 'all',
      repositories: ['pixpilot/one'],
    },
  ])('should reject invalid secret targets before invoking gh', async (target) => {
    const run = vi.fn<RunCommand>();
    await expect(configureSecrets(app, target, { run })).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });

  it('should reject reserved secret prefixes and invalid private keys', async () => {
    expect(() =>
      secretArguments(
        { kind: 'repositories', repositories: ['pixpilot/one'] },
        'GITHUB_APP',
      ),
    ).toThrow('Invalid prefix');
    await expect(
      configureSecrets(
        { id: 1, pem: 'invalid' },
        { kind: 'repositories', repositories: ['pixpilot/one'] },
      ),
    ).rejects.toThrow('valid PEM');
  });

  it('should report partial secret setup without leaking process errors', async () => {
    const run = vi
      .fn<RunCommand>()
      .mockResolvedValueOnce('')
      .mockRejectedValueOnce(new Error(app.pem));
    const error = await configureSecrets(
      app,
      { kind: 'repositories', repositories: ['pixpilot/one'] },
      { run },
    ).catch((failure: unknown) => failure);
    expect(String(error)).toContain('earlier secrets may already be updated');
    expect(String(error)).not.toContain(app.pem);
  });
});
