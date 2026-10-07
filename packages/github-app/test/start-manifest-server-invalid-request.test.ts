import { request } from 'node:http';
import { describe, expect, it } from 'vitest';
import { startManifestServer } from '../src/start-manifest-server';

async function sendMalformedRequest(
  serverUrl: string,
  target: string,
): Promise<{ status: number | undefined; body: string }> {
  const url = new URL(serverUrl);
  return new Promise((resolve, reject) => {
    const client = request(
      { hostname: url.hostname, port: url.port, path: target },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => {
          body += chunk;
        });
        response.on('error', reject);
        response.on('end', () => resolve({ status: response.statusCode, body }));
      },
    );
    client.on('error', reject);
    client.end();
  });
}

describe('startManifestServer malformed requests', () => {
  it.each(['http://[', 'http://%', '//['])(
    'should return 400 for %s and still accept a valid authorization callback',
    async (target) => {
      const server = await startManifestServer({ owner: 'pixpilot' });
      try {
        const response = await sendMalformedRequest(server.url, target);
        expect(response).toEqual({ status: 400, body: 'Invalid request.' });

        const start = await fetch(server.url);
        expect(start.status).toBe(200);
        const html = await start.text();
        const state = /state=(?<state>[a-f\d]+)/u.exec(html)?.groups?.['state'];
        expect(state).toBeDefined();
        const callback = new URL(`/callback?state=${state}&code=valid-code`, server.url);
        expect((await fetch(callback)).status).toBe(200);
        await expect(server.code).resolves.toBe('valid-code');
      } finally {
        await server.close();
      }
    },
  );
});
