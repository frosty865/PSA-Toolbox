/**
 * Browser-compatible revision package encrypt/decrypt matching packages/security (Node).
 * Format: magic "PCII1" | salt(32) | iv(12) | authTag(16) | ciphertext
 * AES-256-GCM; key via scrypt (N=16384, r=8, p=1) — same as security/src/index.ts
 */

import { scrypt } from '@noble/hashes/scrypt.js';

const MAGIC_STR = 'PCII1';
const SALT_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

function magicBytes(): Uint8Array {
  return new TextEncoder().encode(MAGIC_STR);
}

function deriveKey(passphrase: string, salt: Uint8Array): Uint8Array {
  const password = new TextEncoder().encode(passphrase);
  return scrypt(password, salt, { N: 16384, r: 8, p: 1, dkLen: KEY_LEN });
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** Encrypt UTF-8 JSON or binary payload; same wire format as encryptRevisionSync (Node). */
export async function encryptRevisionPackageAsync(plaintextUtf8: Uint8Array, passphrase: string): Promise<Uint8Array> {
  const magic = magicBytes();
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, ['encrypt']);
  const combined = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, tagLength: TAG_LEN * 8 },
      cryptoKey,
      plaintextUtf8 as BufferSource
    )
  );
  // Web Crypto returns ciphertext with auth tag appended
  const tag = combined.slice(combined.length - TAG_LEN);
  const ciphertext = combined.slice(0, combined.length - TAG_LEN);
  const out = new Uint8Array(magic.length + SALT_LEN + IV_LEN + TAG_LEN + ciphertext.length);
  let o = 0;
  out.set(magic, o);
  o += magic.length;
  out.set(salt, o);
  o += SALT_LEN;
  out.set(iv, o);
  o += IV_LEN;
  out.set(tag, o);
  o += TAG_LEN;
  out.set(ciphertext, o);
  return out;
}

export function encryptRevisionPackageFromString(json: string, passphrase: string): Promise<Uint8Array> {
  return encryptRevisionPackageAsync(new TextEncoder().encode(json), passphrase);
}

/** Decrypt to UTF-8 bytes; throws on bad passphrase or corrupt package. */
export async function decryptRevisionPackageAsync(packageBuf: Uint8Array, passphrase: string): Promise<Uint8Array> {
  const magic = magicBytes();
  if (packageBuf.length < magic.length + SALT_LEN + IV_LEN + TAG_LEN) {
    throw new Error('Revision package too short');
  }
  if (!packageBuf.subarray(0, magic.length).every((b, i) => b === magic[i])) {
    throw new Error('Invalid revision package (bad magic)');
  }
  const salt = packageBuf.subarray(magic.length, magic.length + SALT_LEN);
  const iv = packageBuf.subarray(magic.length + SALT_LEN, magic.length + SALT_LEN + IV_LEN);
  const tag = packageBuf.subarray(
    magic.length + SALT_LEN + IV_LEN,
    magic.length + SALT_LEN + IV_LEN + TAG_LEN
  );
  const ciphertext = packageBuf.subarray(magic.length + SALT_LEN + IV_LEN + TAG_LEN);
  const key = deriveKey(passphrase, salt);
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, ['decrypt']);
  const combined = new Uint8Array(ciphertext.length + TAG_LEN);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, tagLength: TAG_LEN * 8 },
    cryptoKey,
    combined as BufferSource
  );
  return new Uint8Array(plain);
}

export async function decryptRevisionPackageToString(packageBuf: Uint8Array, passphrase: string): Promise<string> {
  const bytes = await decryptRevisionPackageAsync(packageBuf, passphrase);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
