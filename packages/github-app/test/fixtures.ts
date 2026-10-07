import type { AppCredentials } from '../src/types';
import { generateKeyPairSync } from 'node:crypto';

export const app: AppCredentials = {
  id: 12345,
  slug: 'test-releaser',
  client_id: 'Iv1.testclient',
  html_url: 'https://github.com/apps/test-releaser',
  pem: generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey,
};
