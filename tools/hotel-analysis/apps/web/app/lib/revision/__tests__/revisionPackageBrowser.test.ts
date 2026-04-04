import { describe, it, expect } from 'vitest';
import { encryptRevisionSync, decryptRevisionSync } from 'security';
import {
  encryptRevisionPackageAsync,
  decryptRevisionPackageAsync,
  decryptRevisionPackageToString,
} from '../revisionPackageBrowser';

describe('revisionPackageBrowser parity with Node security package', () => {
  it('Node encrypt → browser decrypt', async () => {
    const plaintext = Buffer.from(JSON.stringify({ hello: 'world', n: 42 }), 'utf-8');
    const passphrase = 'test-passphrase-12chars-min';
    const pkg = encryptRevisionSync(plaintext, passphrase);
    const out = await decryptRevisionPackageAsync(new Uint8Array(pkg), passphrase);
    expect(new TextDecoder().decode(out)).toBe(plaintext.toString('utf-8'));
  });

  it('browser encrypt → Node decrypt', async () => {
    const json = JSON.stringify({ meta: { tool_version: '0.1.0' }, categories: {} });
    const passphrase = 'another-passphrase-12';
    const pkg = await encryptRevisionPackageAsync(new TextEncoder().encode(json), passphrase);
    const plain = decryptRevisionSync(Buffer.from(pkg), passphrase);
    expect(plain.toString('utf-8')).toBe(json);
  });

  it('decryptRevisionPackageToString round-trip', async () => {
    const passphrase = 'roundtrip-passphrase-12';
    const data = '{"test":true}';
    const enc = await encryptRevisionPackageAsync(new TextEncoder().encode(data), passphrase);
    const s = await decryptRevisionPackageToString(enc, passphrase);
    expect(s).toBe(data);
  });
});
