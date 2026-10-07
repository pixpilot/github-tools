import { createServer } from 'node:http';
import { describe, expect, it } from 'vitest';
import { startManifestServer } from '../src/start-manifest-server';

async function getState(url: string): Promise<string> {
  const response = await fetch(url);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const html = await response.text();
  const state = /state=(?<state>[a-f\d]+)/u.exec(html)?.groups?.['state'];
  if (!state) throw new Error('Missing state');
  return state;
}

describe('startManifestServer', () => {
  it('should POST an escaped manifest to the organization and receive a valid code', async () => {
    const server = await startManifestServer({ owner: 'pixpilot', name: '<test>' });
    try {
      const html = await (await fetch(server.url)).text();
      expect(html).toContain('method="post"');
      expect(html).toContain(
        'https://github.com/organizations/pixpilot/settings/apps/new',
      );
      expect(html).toContain('&lt;test&gt;');
      expect(html).not.toContain('<test>');
      const state = await getState(server.url);
      const callback = new URL(`/callback?state=${state}&code=abc123`, server.url);
      expect((await fetch(callback)).status).toBe(200);
      await expect(server.code).resolves.toBe('abc123');
    } finally {
      await server.close();
    }
  });

  it('should support personal app creation and ignore unauthorized callbacks', async () => {
    const server = await startManifestServer({ owner: 'octocat', personal: true });
    try {
      expect(await (await fetch(server.url)).text()).toContain(
        'https://github.com/settings/apps/new',
      );
      expect(
        (await fetch(new URL('/callback?state=bad&code=abc', server.url))).status,
      ).toBe(400);
      expect((await fetch(new URL('/unknown', server.url))).status).toBe(404);
      const state = await getState(server.url);
      await fetch(new URL(`/callback?state=${state}&code=good`, server.url));
      await expect(server.code).resolves.toBe('good');
    } finally {
      await server.close();
    }
  });

  it('should choose another port when the requested port is occupied', async () => {
    const blocker = createServer();
    await new Promise<void>((resolve) => {
      blocker.listen(0, '127.0.0.1', resolve);
    });
    const address = blocker.address();
    if (!address || typeof address === 'string') throw new Error('Missing port');
    const server = await startManifestServer({ owner: 'pixpilot', port: address.port });
    try {
      expect(Number(new URL(server.url).port)).not.toBe(address.port);
    } finally {
      await server.close();
      await new Promise<void>((resolve) => {
        blocker.close(() => resolve());
      });
    }
  });

  it('should reject when GitHub authorization is cancelled', async () => {
    const server = await startManifestServer({ owner: 'pixpilot' });
    try {
      const state = await getState(server.url);
      await fetch(new URL(`/callback?state=${state}&error=access_denied`, server.url));
      await expect(server.code).rejects.toThrow('cancelled');
    } finally {
      await server.close();
    }
  });

  it('should stop waiting on abort', async () => {
    const controller = new AbortController();
    const server = await startManifestServer({
      owner: 'pixpilot',
      signal: controller.signal,
    });
    try {
      controller.abort();
      await expect(server.code).rejects.toThrow('cancelled');
    } finally {
      await server.close();
    }
  });

  it('should report timeout so the flow can be restarted', async () => {
    const server = await startManifestServer({ owner: 'pixpilot', timeoutMs: 10 });
    try {
      await expect(server.code).rejects.toThrow('timed out');
    } finally {
      await server.close();
    }
  });
});
