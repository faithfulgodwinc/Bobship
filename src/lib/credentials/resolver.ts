/**
 * Credential resolver
 *
 * Fetches and decrypts credentials from the database.
 * All credential reads go through this module — never directly from env vars
 * (except for the BobShip infrastructure's own Supabase connection).
 *
 * Precedence order for project-level credentials:
 * 1. Project-specific credential (project_id = project.id)
 * 2. Global credential (project_id = NULL)
 * 3. Environment variable fallback (dev convenience only, logged as warning)
 */

import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  decrypt,
  GooglePlayCredential,
  AndroidKeystoreCredential,
  GitHubCredential,
  AppStoreCredential,
  CredentialRecord,
} from "./vault";

export async function getGooglePlayCredential(
  projectId?: string
): Promise<GooglePlayCredential | null> {
  const cred = await findCredential("google_play", projectId);
  if (cred) return decrypt<GooglePlayCredential>(cred.encrypted_value);

  // Env var fallback (convenience for single-developer deployments / demos)
  const envJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (envJson) {
    console.warn(
      "[credentials] Using GOOGLE_PLAY_SERVICE_ACCOUNT_JSON env var fallback. " +
      "Connect your Google Play account through BobShip Settings for multi-user use."
    );
    return { type: "google_play", serviceAccountJson: envJson };
  }

  return null;
}

export async function getAndroidKeystoreCredential(
  projectId?: string
): Promise<AndroidKeystoreCredential | null> {
  const cred = await findCredential("android_keystore", projectId);
  if (cred) return decrypt<AndroidKeystoreCredential>(cred.encrypted_value);

  // Env var fallback
  const ksBase64 = process.env.ANDROID_KEYSTORE_BASE64;
  const ksPassword = process.env.ANDROID_KEYSTORE_PASSWORD;
  const keyAlias = process.env.ANDROID_KEY_ALIAS;
  const keyPassword = process.env.ANDROID_KEY_PASSWORD;

  if (ksBase64 && ksPassword && keyAlias) {
    console.warn(
      "[credentials] Using ANDROID_KEYSTORE env var fallback. " +
      "Connect your keystore through BobShip Settings for multi-user use."
    );
    return {
      type: "android_keystore",
      keystoreBase64: ksBase64,
      keystorePassword: ksPassword,
      keyAlias,
      keyPassword: keyPassword || ksPassword,
    };
  }

  return null;
}

export async function getGitHubCredential(
  projectId?: string
): Promise<GitHubCredential | null> {
  const cred = await findCredential("github", projectId);
  if (cred) return decrypt<GitHubCredential>(cred.encrypted_value);

  const pat = process.env.GITHUB_PAT;
  if (pat) return { type: "github", personalAccessToken: pat };

  return null;
}

export async function getAppStoreCredential(
  projectId?: string
): Promise<AppStoreCredential | null> {
  const cred = await findCredential("app_store", projectId);
  if (cred) return decrypt<AppStoreCredential>(cred.encrypted_value);

  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  const privateKey = process.env.APP_STORE_PRIVATE_KEY_BASE64;

  if (keyId && issuerId && privateKey) {
    return { type: "app_store", keyId, issuerId, privateKeyBase64: privateKey };
  }

  return null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function findCredential(
  provider: CredentialRecord["provider"],
  projectId?: string
): Promise<CredentialRecord | null> {
  try {
    const db = getSupabaseAdmin();

    if (projectId) {
      // Try project-specific first
      const { data: projectCred } = await db
        .from("credentials")
        .select("*")
        .eq("provider", provider)
        .eq("project_id", projectId)
        .limit(1)
        .single();

      if (projectCred) return projectCred as CredentialRecord;
    }

    // Fall back to global credential (project_id IS NULL)
    const { data: globalCred } = await db
      .from("credentials")
      .select("*")
      .eq("provider", provider)
      .is("project_id", null)
      .limit(1)
      .single();

    return (globalCred as CredentialRecord) ?? null;
  } catch {
    return null;
  }
}
