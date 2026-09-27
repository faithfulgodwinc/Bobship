import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

// GET /api/projects/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const db = getSupabaseAdmin();

    const { data: project, error } = await db
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const [analysesRes, buildsRes, metadataRes, screenshotsRes, releasesRes] =
      await Promise.all([
        db.from("analyses").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(1),
        db.from("builds").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(1),
        db.from("store_metadata").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(1),
        db.from("screenshots").select("*").eq("project_id", id).order("order_index", { ascending: true }),
        db.from("release_jobs").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(1),
      ]);

    return NextResponse.json({
      data: {
        project,
        latestAnalysis: analysesRes.data?.[0] ?? null,
        latestBuild: buildsRes.data?.[0] ?? null,
        latestMetadata: metadataRes.data?.[0] ?? null,
        screenshots: screenshotsRes.data ?? [],
        latestRelease: releasesRes.data?.[0] ?? null,
      },
    });
  } catch (err) {
    console.error("[GET /api/projects/[id]]", err);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
}

// PATCH /api/projects/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();
    const db = getSupabaseAdmin();

    const { data, error } = await db
      .from("projects")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[PATCH /api/projects/[id]]", err);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}
