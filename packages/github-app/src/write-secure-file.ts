import { randomBytes } from 'node:crypto';
import { link, mkdir, open, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';
import { CliError } from './cli-error';
import { runCommand } from './run-command';

const TEMPORARY_PATH_BYTES = 12;
const PRIVATE_FILE_MODE = 0o600;

// Locks down an empty temporary file before writing, then publishes it atomically.
export async function writeSecureFile(
  path: string,
  content: string,
  overwrite: boolean,
): Promise<void> {
  const temporary = `${path}.${randomBytes(TEMPORARY_PATH_BYTES).toString('hex')}.tmp`;
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const file = await open(temporary, 'wx', PRIVATE_FILE_MODE);
  try {
    if (process.platform === 'win32') {
      const sid = await runCommand('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value',
      ]);
      if (!/^S-1-[\d-]+$/u.test(sid))
        throw new CliError(
          'Cannot determine the current Windows user for private key permissions.',
        );
      await runCommand('icacls.exe', [
        temporary,
        '/inheritance:r',
        '/grant:r',
        `*${sid}:F`,
      ]);
    } else {
      await file.chmod(PRIVATE_FILE_MODE);
    }
    await file.writeFile(content, 'utf8');
    await file.sync();
    await file.close();
    if (overwrite) await rename(temporary, path);
    else await link(temporary, path);
  } finally {
    await file.close();
    await unlink(temporary).catch(() => {});
  }
}
