import process from 'node:process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prompt } from '../src/prompt';

vi.mock('node:process', async () => {
  const { PassThrough } = await import('node:stream');
  const stdin = new PassThrough();
  Object.defineProperty(stdin, 'isTTY', { value: true, writable: true });
  return { default: { stdin, stdout: { write: vi.fn(() => true) } } };
});

describe('prompt', () => {
  beforeEach(() => {
    vi.mocked(process.stdout.write).mockClear();
    process.stdin.isTTY = true;
  });

  it('should read an answer without echoing a token', async () => {
    const answer = prompt('Operator token', { secret: true });
    process.stdin.push('synthetic-private-token\n');
    await expect(answer).resolves.toBe('synthetic-private-token');
    const output = vi
      .mocked(process.stdout.write)
      .mock.calls.map((call) => String(call[0]))
      .join('');
    expect(output).toContain('Operator token');
    expect(output).not.toContain('synthetic-private-token');
  });

  it('should accept a default value', async () => {
    const answer = prompt('App name', { fallback: 'My Releaser' });
    process.stdin.push('\n');
    await expect(answer).resolves.toBe('My Releaser');
  });

  it('should cancel on Ctrl+C and release terminal listeners', async () => {
    const answer = prompt('App name');
    process.stdin.push(String.fromCharCode(3));
    await expect(answer).rejects.toThrow('Cancelled');
    expect(process.stdin.listenerCount('keypress')).toBe(0);
  });

  it('should cancel when the command signal aborts', async () => {
    const controller = new AbortController();
    const answer = prompt('App name', { signal: controller.signal });
    controller.abort();
    await expect(answer).rejects.toThrow('Cancelled');
  });

  it('should explain missing flags in non-interactive mode', async () => {
    process.stdin.isTTY = false;
    await expect(prompt('App organization (--org)')).rejects.toThrow(
      'non-interactive mode',
    );
  });
});
