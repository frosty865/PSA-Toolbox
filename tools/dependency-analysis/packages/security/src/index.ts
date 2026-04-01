/**
 * Revision package encryption: AES-256-GCM, key derivation via scrypt (Node crypto).
 * Package format: magic "PCII1" | salt(32) | iv(12) | authTag(16) | ciphertext
 * No password storage.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const MAGIC = Buffer.from('PCII1', 'ascii');
const SALT_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
}

/**
 * Encrypt plaintext with passphrase. Returns package buffer: magic + salt + iv + tag + ciphertext.
 */
export function encryptRevisionSync(plaintext: Buffer, passphrase: string): Buffer {
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LEN });
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, salt, iv, tag, encrypted]);
}

/**
 * Decrypt package buffer (magic + salt + iv + tag + ciphertext). Returns plaintext.
 */
export function decryptRevisionSync(packageBuf: Buffer, passphrase: string): Buffer {
  if (packageBuf.length < MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN) {
    throw new Error('Revision package too short');
  }
  const magic = packageBuf.subarray(0, MAGIC.length);
  if (!magic.equals(MAGIC)) {
    throw new Error('Invalid revision package (bad magic)');
  }
  const salt = packageBuf.subarray(MAGIC.length, MAGIC.length + SALT_LEN);
  const iv = packageBuf.subarray(MAGIC.length + SALT_LEN, MAGIC.length + SALT_LEN + IV_LEN);
  const tag = packageBuf.subarray(
    MAGIC.length + SALT_LEN + IV_LEN,
    MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN
  );
  const ciphertext = packageBuf.subarray(MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN);
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** Legacy interface: RevisionPackage shape for compatibility; use *Sync with Buffer instead. */
export interface RevisionPackage {
  version: number;
  payload: ArrayBuffer;
  iv: ArrayBuffer;
  tag: ArrayBuffer;
}

export async function encryptRevision(
  plaintext: ArrayBuffer,
  _key: CryptoKey
): Promise<RevisionPackage> {
  throw new Error('Use encryptRevisionSync(Buffer, passphrase) instead');
}

export async function decryptRevision(
  _pkg: RevisionPackage,
  _key: CryptoKey
): Promise<ArrayBuffer> {
  throw new Error('Use decryptRevisionSync(Buffer, passphrase) instead');
}
