import { describe, expect, it } from 'vitest';
import { parseCallback } from '../src/parse-callback';

describe('parseCallback', () => {
  it('should return the code for the expected state', () => {
    expect(
      parseCallback(new URL('http://127.0.0.1/callback?state=test&code=abc123'), 'test'),
    ).toBe('abc123');
  });

  it.each(['code=abc', 'state=wrong&code=abc', 'state=test&state=test&code=abc'])(
    'should reject absent, incorrect, or duplicate state: %s',
    (query) => {
      expect(() =>
        parseCallback(new URL(`http://127.0.0.1/callback?${query}`), 'test'),
      ).toThrow('Invalid callback state');
    },
  );

  it.each([
    'state=test',
    'state=test&code=',
    'state=test&code=a&code=b',
    'state=test&code=..%2Fbad',
  ])('should reject malformed codes: %s', (query) => {
    expect(() =>
      parseCallback(new URL(`http://127.0.0.1/callback?${query}`), 'test'),
    ).toThrow('valid manifest code');
  });

  it('should handle authorization denial without exposing its contents', () => {
    expect(() =>
      parseCallback(
        new URL(
          'http://127.0.0.1/callback?state=test&error=access_denied&error_description=sensitive',
        ),
        'test',
      ),
    ).toThrow('authorization was cancelled');
  });
});
