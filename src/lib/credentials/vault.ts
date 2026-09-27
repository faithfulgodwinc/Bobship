/**
 * BobShip Credential Vault
 *
 * AES-256-GCM symmetric encryption for storing user-provided secrets
 * (Google Play service accounts, keystores, GitHub tokens) in Supabase.
 *
 * The encryption key (CREDENTIAL_ENCRYPTION_KEY) lives ONLY in the server
 * environment. The encrypted blob is stored in the database. Plaintext
 * secrets never touch the browser.
 *
 * Key format: 32-byte hex string (64 hex chars)
 * Generate with: openssl rand -hex 32
 */

import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!key) {
    // In development without a key, use a deterministic fallback.
    // NEVER use this in production.
    console.warn(
      "[vault] CREDENTIAL_ENCRYPTION_KEY not set — using insecure dev fallback. Set this env var before deploying."
    );
    return Buffer.from("0".repeat(64), "hex");
  }
  if (key.length !== 64) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: openssl rand -hex 32"
    );
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypt a JSON-serialisable value.
 * Returns a base64-encoded string: iv:authTag:ciphertext
 */
export function encrypt(value: unknown): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const plaintext = JSON.stringify(value);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Pack as: base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypt a value encrypted by `encrypt()`.
 * Returns the original JS value (deserialized from JSON).
 */
export function decrypt<T = unknown>(encryptedString: string): T {
  const key = getEncryptionKey();
  const parts = encryptedString.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted credential format");
  }
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8")) as T;
}

// ─── Typed credential shapes ──────────────────────────────────────────────────
// These are the plaintext structures that get encrypted before storage.
// They are NEVER stored in plaintext in the database.

export interface GooglePlayCredential {
  type: "google_play";
  serviceAccountJson: string; // Full JSON content of the service account key file
}

export interface AndroidKeystoreCredential {
  type: "android_keystore";
  keystoreBase64: string; // Base64-encoded .jks / .keystore file
  keystorePassword: string;
  keyAlias: string;
  keyPassword: string;
}

export interface GitHubCredential {
  type: "github";
  personalAccessToken: string; // repo read scope
}

export interface AppStoreCredential {
  type: "app_store";
  keyId: string;
  issuerId: string;
  privateKeyBase64: string; // Base64-encoded .p8 file
}

export type AnyCredential =
  | GooglePlayCredential
  | AndroidKeystoreCredential
  | GitHubCredential
  | AppStoreCredential;

// ─── Credential record from the DB ───────────────────────────────────────────

export interface CredentialRecord {
  id: string;
  project_id: string | null;
  provider: "google_play" | "app_store" | "github" | "android_keystore";
  label: string;
  encrypted_value: string;
  metadata: Record<string, unknown>;
  is_valid: boolean | null;
  last_validated_at: string | null;
  created_at: string;
  updated_at: string;
}

// Safe public view — never includes the encrypted_value
export interface CredentialSummary {
  id: string;
  project_id: string | null;
  provider: CredentialRecord["provider"];
  label: string;
  metadata: Record<string, unknown>;
  is_valid: boolean | null;
  last_validated_at: string | null;
  created_at: string;
}
