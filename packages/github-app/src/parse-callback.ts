import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';
import { CliError } from './cli-error';

// Accepts a single manifest code only when the callback has the expected CSRF state.
export function parseCallback(url: URL, expectedState: string): string {
  const states = url.searchParams.getAll('state');
  const state = Buffer.from(states[0] ?? '');
  const expected = Buffer.from(expectedState);
  if (
    states.length !== 1 ||
    state.length !== expected.length ||
    !timingSafeEqual(state, expected)
  ) {
    throw new CliError('Invalid callback state.');
  }
  if (url.searchParams.has('error'))
    throw new CliError('GitHub authorization was cancelled.');
  const codes = url.searchParams.getAll('code');
  if (codes.length !== 1 || !/^[\w-]{1,256}$/u.test(codes[0] ?? '')) {
    throw new CliError(
      'GitHub did not return a valid manifest code. Restart the create command.',
    );
  }
  return codes[0]!;
}
