import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getGooglePlayCredential } from "@/lib/credentials/resolver";
import { createGooglePlayAdapter } from "@/lib/google-play/adapter";

export const dynamic = "force-dynamic";

interface RouteParams { params: { id: string } }

// POST — execute the store submission
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  try {
    const db = getSupabaseAdmin();

    // Load the approved release job
    const { data: release } = await db.from("release_jobs").select("*")
      .eq("project_id", id).eq("status", "approved")
      .order("created_at", { ascending: false }).limit(1).single();

    if (!release) {
      return NextResponse.json({ error: "No approved release found. Approve the release first." }, { status: 404 });
    }

    // Mark as submitting
    await db.from("release_jobs").update({ status: "submitting" }).eq("id", (release as Record<string, unknown>).id);
    await db.from("projects").update({ status: "submitting" }).eq("id", id);

    await db.from("audit_logs").insert({
      project_id: id, action: "submission_started", actor: "system",
      payload: { release_id: (release as Record<string, unknown>).id },
    });

    // Check if demo mode
    const isDemoMode = process.env.DEMO_MODE === "true";

    // Load Google Play credentials
    const credential = await getGooglePlayCredential(id);

    if (!credential && !isDemoMode) {
      // No credential — revert and tell user to connect their account
      await db.from("release_jobs").update({ status: "approved" }).eq("id", (release as Record<string, unknown>).id);
      await db.from("projects").update({ status: "ready" }).eq("id", id);
      return NextResponse.json({
        error: "No Google Play credentials found. Go to Settings and connect your Google Play account first.",
        code: "NO_CREDENTIALS",
      }, { status: 422 });
    }

    let submissionResult: Record<string, unknown>;

    if (isDemoMode || !credential) {
      // Demo mode — simulate a successful submission
      await new Promise((r) => setTimeout(r, 1500));
      submissionResult = {
        demo: true,
        message: "DEMO MODE — No real submission made. This simulates a successful Google Play submission.",
        track: (release as Record<string, unknown>).track,
        timestamp: new Date().toISOString(),
      };
    } else {
      // Real Google Play submission
      submissionResult = await submitToGooglePlay(credential.serviceAccountJson, release as Record<string, unknown>, id, db);
    }

    // Mark as submitted
    await db.from("release_jobs").update({
      status: "submitted",
      submission_result: submissionResult,
      updated_at: new Date().toISOString(),
    }).eq("id", (release as Record<string, unknown>).id);

    await db.from("projects").update({ status: "submitted" }).eq("id", id);

    await db.from("audit_logs").insert({
      project_id: id, action: "submission_completed", actor: "system",
      payload: submissionResult,
    });

    return NextResponse.json({ data: submissionResult });
  } catch (err) {
    console.error("[submit POST]", err);
    const db = getSupabaseAdmin();
    try {
      const { data: release } = await db.from("release_jobs").select("id")
        .eq("project_id", id).eq("status", "submitting").limit(1).single();
      if (release) {
        await db.from("release_jobs").update({ status: "failed" }).eq("id", (release as Record<string, unknown>).id);
      }
      await db.from("projects").update({ status: "ready" }).eq("id", id);
      await db.from("audit_logs").insert({
        project_id: id, action: "submission_failed", actor: "system",
        payload: { error: err instanceof Error ? err.message : "Unknown error" },
      });
    } catch { /* ignore secondary errors */ }

    return NextResponse.json({ error: err instanceof Error ? err.message : "Submission failed" }, { status: 500 });
  }
}

// ─── Real Google Play submission via GooglePlayAdapter ────────────────────────
async function submitToGooglePlay(
  serviceAccountJson: string,
  release: Record<string, unknown>,
  projectId: string,
  db: ReturnType<typeof getSupabaseAdmin>
) {
  // Load metadata and analysis
  const { data: analysis } = await db
    .from("analyses")
    .select("package_id, version_name, version_code")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const { data: metadata } = await db
    .from("store_metadata")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const packageName = (analysis as Record<string, unknown>)?.package_id as string;
  if (!packageName) {
    throw new Error("Package ID not found in analysis. Re-run analysis first.");
  }

  // Build listing payload
  const listing = metadata
    ? {
        language: "en-US" as const,
        title: (metadata as Record<string, unknown>).title as string | undefined,
        shortDescription: (metadata as Record<string, unknown>).short_description as string | undefined,
        fullDescription: (metadata as Record<string, unknown>).full_description as string | undefined,
      }
    : null;

  // Build release payload (only if AAB artifact exists)
  const buildArtifact = release.build_artifact as string | null;
  const versionCodeRaw = (analysis as Record<string, unknown>)?.version_code;
  const releasePayload = buildArtifact
    ? {
        track: ((release.track as string) || "internal") as "internal" | "alpha" | "beta" | "production",
        status: "draft" as const,
        ...(versionCodeRaw ? { versionCodes: [String(versionCodeRaw)] } : {}),
      }
    : null;

  // Delegate to adapter — it handles open edit → update → commit + rollback on error
  const adapter = createGooglePlayAdapter(serviceAccountJson);
  const result = await adapter.submitRelease(packageName, listing, releasePayload);

  return {
    ...result,
    track: release.track,
    listingUpdated: result.listingUpdated,
    buildUploaded: !!buildArtifact,
  };
}
