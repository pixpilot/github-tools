import { describe, expect, it, vi } from 'vitest';
import { exchangeManifestCode } from '../src/exchange-manifest-code';
import { app } from './fixtures';

describe('exchangeManifestCode', () => {
  it('should exchange the code without a PAT and capture validated credentials', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ ...app, client_secret: 'unused-secret' }, { status: 201 }),
      );
    await expect(exchangeManifestCode('manifest-code', request)).resolves.toEqual(app);
    expect(request).toHaveBeenCalledWith(
      'https://api.github.com/app-manifests/manifest-code/conversions',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(request.mock.calls[0]?.[1]?.headers).not.toHaveProperty('Authorization');
  });

  it.each([404, 422, 500])(
    'should report HTTP %s without leaking the error response',
    async (status) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ message: app.pem }, { status }));
      const error = await exchangeManifestCode('expired', request).catch(
        (failure: unknown) => failure,
      );
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).toContain(`HTTP ${status}`);
      expect(String(error)).not.toContain(app.pem);
      expect(String(error)).toContain('Restart');
    },
  );

  it('should redact network errors', async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error(app.pem));
    await expect(exchangeManifestCode('code', request)).rejects.toThrow(
      'could not finish',
    );
  });

  it.each([
    { ...app, pem: 'invalid' },
    { ...app, id: 0 },
    { ...app, html_url: 'https://evil.example' },
    {},
    null,
  ])('should reject malformed credentials', async (data) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json(data));
    await expect(exchangeManifestCode('code', request)).rejects.toThrow(
      'invalid app credentials',
    );
  });
});
