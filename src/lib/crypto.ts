/**
 * Rune Crypto Library
 * Client-side encryption using Web Crypto API (AES-256-GCM) + Argon2id key derivation.
 * The server NEVER sees plaintext — only encrypted blobs.
 */

// We'll use a PBKDF2-based approach for broad browser compatibility
// and fall back gracefully. Argon2 WASM can be added as an enhancement.

const PBKDF2_ITERATIONS = 600000; // OWASP recommended for SHA-256
const KEY_LENGTH = 256;
const SALT_LENGTH = 16;
const IV_LENGTH = 12; // 96-bit IV for AES-GCM

/**
 * Generate a cryptographically secure random salt
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

/**
 * Generate a cryptographically secure random IV
 */
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Derive an AES-256 key from a password using PBKDF2
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: KEY_LENGTH,
    },
    true, // extractable for hashing
    ["encrypt", "decrypt"]
  );
}

/**
 * Hash the derived key using SHA-256 for server-side password matching.
 * The actual password never leaves the client.
 */
export async function hashDerivedKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", exported);
  return bufferToBase64(hashBuffer);
}

/**
 * Encrypt plaintext using AES-256-GCM
 * Returns { ciphertext, iv } both as base64 strings.
 * If an explicit IV is provided it will be used (for cases where the same IV
 * must be stored separately); otherwise a fresh random IV is generated.
 */
export async function encrypt(
  plaintext: string,
  key: CryptoKey,
  explicitIv?: Uint8Array
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const iv = explicitIv ?? generateIV();

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as any },
    key,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: bufferToBase64(cipherBuffer),
    iv: bufferToBase64(iv.buffer as ArrayBuffer),
  };
}

/**
 * Encrypt plaintext and return a single base64 blob that embeds the IV
 * (first 12 bytes) followed by the ciphertext. Useful when there is no
 * separate column to store the IV (e.g., encrypted titles).
 */
export async function encryptWithEmbeddedIv(
  plaintext: string,
  key: CryptoKey
): Promise<string> {
  const encoder = new TextEncoder();
  const iv = generateIV();

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as any },
    key,
    encoder.encode(plaintext)
  );

  // Concatenate IV + ciphertext into a single buffer
  const combined = new Uint8Array(iv.length + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.length);
  return bufferToBase64(combined.buffer as ArrayBuffer);
}

/**
 * Decrypt a blob that was produced by encryptWithEmbeddedIv (IV is the first 12 bytes).
 */
export async function decryptWithEmbeddedIv(
  blob: string,
  key: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder();
  const combined = base64ToBuffer(blob);
  const iv = combined.slice(0, IV_LENGTH);
  const cipherBytes = combined.slice(IV_LENGTH);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as any },
    key,
    cipherBytes as any
  );

  return decoder.decode(plainBuffer);
}

/**
 * Decrypt ciphertext using AES-256-GCM
 */
export async function decrypt(
  ciphertext: string,
  key: CryptoKey,
  iv: string
): Promise<string> {
  const decoder = new TextDecoder();
  const cipherBuffer = base64ToBuffer(ciphertext);
  const ivBuffer = base64ToBuffer(iv);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuffer as any },
    key,
    cipherBuffer as any
  );

  return decoder.decode(plainBuffer);
}

/**
 * Verify a password by attempting to decrypt a known test string.
 * The test string is the rune slug itself (like ProtectedText approach).
 */
export async function verifyPassword(
  password: string,
  salt: Uint8Array,
  encryptedSlug: string,
  iv: string,
  expectedSlug: string
): Promise<{ valid: boolean; key: CryptoKey | null }> {
  try {
    const key = await deriveKey(password, salt);
    const decryptedSlug = await decrypt(encryptedSlug, key, iv);
    return { valid: decryptedSlug === expectedSlug, key };
  } catch {
    return { valid: false, key: null };
  }
}

/**
 * Create the encrypted slug verification blob for a new workspace
 */
export async function createVerificationBlob(
  slug: string,
  key: CryptoKey
): Promise<{ encryptedSlug: string; iv: string }> {
  const { ciphertext, iv } = await encrypt(slug, key);
  return { encryptedSlug: ciphertext, iv };
}

// ---- Encoding Utilities ----

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function uint8ArrayToBase64(arr: Uint8Array): string {
  return bufferToBase64(arr.buffer as ArrayBuffer);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  return base64ToBuffer(base64);
}
