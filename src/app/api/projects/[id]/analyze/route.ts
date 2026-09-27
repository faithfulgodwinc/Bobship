import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { cloneRepository } from "@/lib/github/clone";
import { analyzeRepository } from "@/lib/analysis/analyzer";

export const dynamic = "force-dynamic";
// Allow up to 5 minutes — clone + analysis can take 30-120s on large repos
export const maxDuration = 300;

interface RouteParams {
  params: { id: string };
}

// POST /api/projects/[id]/analyze
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = params;

  try {
    const db = getSupabaseAdmin();

    const { data: project, error: projectError } = await db
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await db.from("projects").update({ status: "analyzing" }).eq("id", id);

    await db.from("audit_logs").insert({
      project_id: id,
      action: "analyze_started",
      actor: "system",
      payload: { repo_url: project.repo_url, branch: project.repo_branch },
    });

    console.log(`[analyze] Cloning ${project.repo_url}...`);
    const cloneResult = await cloneRepository(project.repo_url, project.repo_branch);

    if (!cloneResult.success) {
      await db.from("projects").update({ status: "idle" }).eq("id", id);
      await db.from("audit_logs").insert({
        project_id: id,
        action: "analyze_failed",
        actor: "system",
        payload: { error: cloneResult.error },
      });
      return NextResponse.json(
        { error: `Failed to clone repository: ${cloneResult.error}` },
        { status: 422 }
      );
    }

    let analysisResult;
    console.log(`[analyze] Analyzing ${cloneResult.repoPath}...`);
    try {
      analysisResult = await analyzeRepository({
        repoPath: cloneResult.repoPath,
        projectId: id,
        platform: project.platform as "android" | "ios" | "both",
      });
    } catch (analysisErr) {
      cloneResult.cleanup();
      throw analysisErr;
    }
    // Cleanup after analysis succeeds — not in finally, so error path above handles it
    cloneResult.cleanup();

    const { data: analysis, error: insertError } = await db
      .from("analyses")
      .insert({
        project_id: id,
        app_name: analysisResult.app_name,
        package_id: analysisResult.package_id,
        framework: analysisResult.framework,
        version_name: analysisResult.version_name,
        version_code: analysisResult.version_code,
        min_sdk: analysisResult.min_sdk,
        target_sdk: analysisResult.target_sdk,
        features: analysisResult.features,
        permissions: analysisResult.permissions,
        api_deps: analysisResult.api_deps,
        privacy_flags: analysisResult.privacy_flags,
        navigation_screens: analysisResult.navigation_screens,
        existing_assets: analysisResult.existing_assets,
        readiness_score: analysisResult.readiness_score,
        checks: analysisResult.checks,
        raw_report: analysisResult.raw_report,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await db.from("projects").update({
      status: "ready",
      name: analysisResult.app_name || project.name,
      framework: analysisResult.framework || project.framework,
    }).eq("id", id);

    await db.from("audit_logs").insert({
      project_id: id,
      action: "analyze_completed",
      actor: "system",
      payload: {
        readiness_score: analysisResult.readiness_score,
        blockers: analysisResult.checks.filter(
          (c: { severity: string }) => c.severity === "blocker"
        ).length,
        warnings: analysisResult.checks.filter(
          (c: { severity: string }) => c.severity === "warning"
        ).length,
        features_count: analysisResult.features.length,
      },
    });

    return NextResponse.json({ data: analysis }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects/[id]/analyze]", err);

    try {
      const db = getSupabaseAdmin();
      await db.from("projects").update({ status: "idle" }).eq("id", id);
      await db.from("audit_logs").insert({
        project_id: id,
        action: "analyze_failed",
        actor: "system",
        payload: { error: err instanceof Error ? err.message : "Unknown error" },
      });
    } catch { /* ignore secondary errors */ }

    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}

// GET /api/projects/[id]/analyze — get latest analysis
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = params;
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("analyses")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return NextResponse.json({ data: null });
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Failed to fetch analysis" }, { status: 500 });
  }
}
