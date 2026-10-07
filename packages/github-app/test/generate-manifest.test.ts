import { describe, expect, it } from 'vitest';
import { generateManifest } from '../src/generate-manifest';

describe('generateManifest', () => {
  it('should request only the release permissions and disable unused webhook events', () => {
    const manifest = generateManifest(
      { owner: 'pixpilot' },
      'http://127.0.0.1:1234/callback',
    );
    expect(manifest).toEqual({
      name: 'My Releaser',
      description: 'Internal bot to handle automatic releases of packages.',
      url: 'https://github.com/pixpilot',
      redirect_url: 'http://127.0.0.1:1234/callback',
      callback_urls: ['https://github.com/pixpilot'],
      public: false,
      hook_attributes: { active: false, url: 'https://github.com/pixpilot' },
      default_permissions: {
        checks: 'write',
        contents: 'write',
        issues: 'write',
        metadata: 'read',
        pull_requests: 'write',
      },
      default_events: [],
    });
  });

  it('should allow a configurable name, cross-organization installation, and optional Secrets metadata read', () => {
    const manifest = generateManifest(
      {
        owner: 'pixpilot',
        name: 'Pixpilot Releaser',
        installationTarget: 'any',
        includeSecrets: true,
      },
      'http://127.0.0.1/callback',
    );
    expect(manifest.name).toBe('Pixpilot Releaser');
    expect(manifest.public).toBe(true);
    expect(manifest.default_permissions['secrets']).toBe('read');
    expect(manifest.default_permissions).not.toHaveProperty('administration');
  });

  it.each(['', '-bad', 'org/name', 'https://github.com/pixpilot'])(
    'should reject invalid owners: %s',
    (owner) => {
      expect(() => generateManifest({ owner }, 'http://127.0.0.1/callback')).toThrow(
        'Invalid account',
      );
    },
  );

  it('should reject an empty app name', () => {
    expect(() =>
      generateManifest({ owner: 'pixpilot', name: ' ' }, 'http://127.0.0.1/callback'),
    ).toThrow('cannot be empty');
  });

  it('should preserve file settings and replace permissions without adding release defaults', () => {
    const manifest = generateManifest(
      {
        owner: 'pixpilot',
        manifest: {
          name: 'PixPilot Releaser',
          url: 'https://example.com/app',
          description: 'Configured bot',
          public: true,
          default_permissions: { contents: 'read' },
        },
      },
      'http://127.0.0.1:4567/callback',
    );
    expect(manifest.name).toBe('PixPilot Releaser');
    expect(manifest.url).toBe('https://example.com/app');
    expect(manifest.description).toBe('Configured bot');
    expect(manifest.public).toBe(true);
    expect(manifest.default_permissions).toEqual({ contents: 'read' });
    expect(manifest.redirect_url).toBe('http://127.0.0.1:4567/callback');
    expect(manifest.hook_attributes.active).toBe(false);
  });

  it('should apply explicit name, scope, and Secrets flags over file settings', () => {
    const manifest = generateManifest(
      {
        owner: 'pixpilot',
        name: 'Override',
        installationTarget: 'owner',
        includeSecrets: true,
        manifest: {
          name: 'From file',
          public: true,
          default_permissions: { contents: 'read' },
        },
      },
      'http://127.0.0.1/callback',
    );
    expect(manifest.name).toBe('Override');
    expect(manifest.public).toBe(false);
    expect(manifest.default_permissions).toEqual({ contents: 'read', secrets: 'read' });
  });
});
