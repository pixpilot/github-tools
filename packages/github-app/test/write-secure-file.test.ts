import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runCommand } from '../src/run-command';
import { writeSecureFile } from '../src/write-secure-file';

vi.mock('node:process', () => ({ default: { platform: 'win32' } }));
vi.mock('../src/run-command', () => ({ runCommand: vi.fn() }));

describe('writeSecureFile', () => {
  it('should write no private key if setting the Windows ACL fails', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'github-app-acl-test-'));
    const path = join(directory, 'releaser.pem');
    vi.mocked(runCommand)
      .mockResolvedValueOnce('S-1-5-21-123')
      .mockRejectedValueOnce(new Error('ACL failed'));
    try {
      await expect(writeSecureFile(path, 'synthetic-key', false)).rejects.toThrow(
        'ACL failed',
      );
      expect(await readdir(directory)).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
