import process from 'node:process';
import { CliError } from './cli-error';
import { runCommand } from './run-command';

// Opens a trusted GitHub or loopback URL using the platform's default browser.
export async function openBrowser(url: string): Promise<void> {
  const parsed = new URL(url);
  if (!(
    (parsed.protocol === 'https:' && parsed.hostname === 'github.com') ||
    (parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1')
  )) {
    throw new CliError('Refusing to open an untrusted URL.');
  }
  if (process.platform === 'win32')
    await runCommand('rundll32.exe', ['url.dll,FileProtocolHandler', url]);
  else if (process.platform === 'darwin') await runCommand('open', [url]);
  else await runCommand('xdg-open', [url]);
}
