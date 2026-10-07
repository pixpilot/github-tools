import process from 'node:process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCli } from '../src/parse-cli';
import { runCli } from '../src/run-cli';
import { runCommand } from '../src/run-command';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('cLI', () => {
  it('should parse repeated repositories and branches', () => {
    const result = parseCli([
      'configure-branch-protection',
      '--slug',
      'my-releaser',
      '--repo',
      'pixpilot/one',
      '--repo',
      'pixpilot/two',
      '--branch',
      'main',
      '--branch',
      'beta',
    ]);
    expect(result.values.repo).toEqual(['pixpilot/one', 'pixpilot/two']);
    expect(result.values.branch).toEqual(['main', 'beta']);
  });

  it.each(
    [
      ['create', 'wrong'],
      ['create', 'releaser', '--branch', 'main'],
      ['install', '--repo', 'pixpilot/one'],
      ['install', '--manifest', 'app.json'],
      ['install', '--token', 'sensitive'],
      ['configure-secrets', '--overwrite'],
      ['unknown'],
    ].map((args) => ({ args })),
  )('should reject invalid commands or ignored options: %j', ({ args }) => {
    expect(() => parseCli(args)).toThrow();
  });

  it('should print help and installation URLs without opening a browser when requested', async () => {
    const log = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    expect(await runCli(['--help'])).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('create releaser'));
    expect(await runCli(['install', '--slug', 'my-releaser', '--no-open'])).toBe(0);
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('https://github.com/apps/my-releaser/installations/new'),
    );
  });

  it('should accept a manifest file for app creation', () => {
    expect(
      parseCli(['create', 'releaser', '--manifest', 'app.json']).values.manifest,
    ).toBe('app.json');
  });

  it('should require explicit flags before branch protection changes', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runCli(['configure-branch-protection'])).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Explicit --slug'));
  });

  it('should redact invalid arguments containing credentials', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await runCli(['install', '--token', 'private-token-value'])).toBe(1);
    expect(JSON.stringify(error.mock.calls)).not.toContain('private-token-value');
  });

  it('should suppress subprocess stderr containing secrets', async () => {
    await expect(
      runCommand(process.execPath, [
        '-e',
        'console.error("sensitive-key"); process.exit(1)',
      ]),
    ).rejects.toThrow('failed');
  });
});
