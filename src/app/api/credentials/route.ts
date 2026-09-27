import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { encrypt, CredentialSummary } from "@/lib/credentials/vault";
import { z } from "zod";

export const dynamic = "force-dynamic";

// ─── Validation schemas ───────────────────────────────────────────────────────

const GooglePlaySchema = z.object({
  provider: z.literal("google_play"),
  label: z.string().min(1, "Label is required"),
  project_id: z.string().uuid().nullable().optional(),
  serviceAccountJson: z.string().min(10, "Service account JSON is required"),
  // metadata (non-secret)
  accountEmail: z.string().email().optional(),
});

const AndroidKeystoreSchema = z.object({
  provider: z.literal("android_keystore"),
  label: z.string().min(1),
  project_id: z.string().uuid().nullable().optional(),
  keystoreBase64: z.string().min(10, "Keystore file is required (base64 encoded)"),
  keystorePassword: z.string().min(1, "Keystore password is required"),
  keyAlias: z.string().min(1, "Key alias is required"),
  keyPassword: z.string().optional(),
});

const GitHubSchema = z.object({
  provider: z.literal("github"),
  label: z.string().min(1),
  project_id: z.string().uuid().nullable().optional(),
  personalAccessToken: z.string().min(20, "GitHub PAT is required"),
  // metadata
  username: z.string().optional(),
});

const AppStoreSchema = z.object({
  provider: z.literal("app_store"),
  label: z.string().min(1),
  project_id: z.string().uuid().nullable().optional(),
  keyId: z.string().min(1, "Key ID is required"),
  issuerId: z.string().min(1, "Issuer ID is required"),
  privateKeyBase64: z.string().min(10, "Private key is required"),
});

const CredentialSchema = z.discriminatedUnion("provider", [
  GooglePlaySchema,
  AndroidKeystoreSchema,
  GitHubSchema,
  AppStoreSchema,
]);

// ─── GET /api/credentials — list all credentials (summaries, no secrets) ─────

export async function GET(request: NextRequest) {
  try {
    const db = getSupabaseAdmin();
    const url = new URL(request.url);
    const projectId = url.searchParams.get("project_id");

    let query = db
      .from("credentials")
      .select("id, project_id, provider, label, metadata, is_valid, last_validated_at, created_at")
      .order("created_at", { ascending: false });

    if (projectId) {
      // Return project-specific AND global credentials
      query = query.or(`project_id.eq.${projectId},project_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data: (data || []) as CredentialSummary[] });
  } catch (err) {
    console.error("[GET /api/credentials]", err);
    return NextResponse.json({ error: "Failed to load credentials" }, { status: 500 });
  }
}

// ─── POST /api/credentials — store a new credential ─────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CredentialSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const db = getSupabaseAdmin();

    // Build the secret payload and metadata based on provider
    let secretPayload: Record<string, unknown>;
    let metadata: Record<string, unknown> = {};

    switch (data.provider) {
      case "google_play": {
        // Validate the JSON is parseable
        try {
          const parsed = JSON.parse(data.serviceAccountJson);
          metadata = {
            project_id_gcp: parsed.project_id,
            client_email: parsed.client_email,
          };
        } catch {
          return NextResponse.json(
            { error: "Service account JSON is not valid JSON" },
            { status: 400 }
          );
        }
        secretPayload = {
          type: "google_play",
          serviceAccountJson: data.serviceAccountJson,
        };
        if (data.accountEmail) metadata.accountEmail = data.accountEmail;
        break;
      }

      case "android_keystore": {
        secretPayload = {
          type: "android_keystore",
          keystoreBase64: data.keystoreBase64,
          keystorePassword: data.keystorePassword,
          keyAlias: data.keyAlias,
          keyPassword: data.keyPassword || data.keystorePassword,
        };
        metadata = { keyAlias: data.keyAlias };
        break;
      }

      case "github": {
        secretPayload = {
          type: "github",
          personalAccessToken: data.personalAccessToken,
        };
        if (data.username) metadata = { username: data.username };
        break;
      }

      case "app_store": {
        secretPayload = {
          type: "app_store",
          keyId: data.keyId,
          issuerId: data.issuerId,
          privateKeyBase64: data.privateKeyBase64,
        };
        metadata = { keyId: data.keyId, issuerId: data.issuerId };
        break;
      }
    }

    // Encrypt the secret payload
    const encryptedValue = encrypt(secretPayload);

    const { data: credential, error } = await db
      .from("credentials")
      .insert({
        project_id: data.project_id ?? null,
        provider: data.provider,
        label: data.label,
        encrypted_value: encryptedValue,
        metadata,
        is_valid: null,
      })
      .select("id, project_id, provider, label, metadata, is_valid, last_validated_at, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ data: credential }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/credentials]", err);
    return NextResponse.json({ error: "Failed to save credential" }, { status: 500 });
  }
}
