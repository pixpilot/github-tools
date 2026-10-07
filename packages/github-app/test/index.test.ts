import { describe, expect, it } from 'vitest';

import { generateManifest } from '../src';

describe('generateManifest', () => {
  it('should expose the manifest generator through the package entry', () => {
    expect(
      generateManifest({ owner: 'pixpilot' }, 'http://127.0.0.1/callback').name,
    ).toBe('My Releaser');
  });
});
