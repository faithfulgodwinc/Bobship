import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteParams { params: { id: string } }

// POST — assemble a release job (pending developer approval)
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  try {
    const body = await req.json().catch(() => ({}));
    const track = body.track || "internal";
    const db = getSupabaseAdmin();

    // Validate pre-conditions
    const { data: analysis } = await db.from("analyses").select("*").eq("project_id", id)
      .order("created_at", { ascending: false }).limit(1).single();
    const { data: metadata } = await db.from("store_metadata").select("*").eq("project_id", id)
      .order("created_at", { ascending: false }).limit(1).single();

    if (!analysis) return NextResponse.json({ error: "Run analysis before creating a release" }, { status: 422 });
    if (!metadata) return NextResponse.json({ error: "Generate metadata before creating a release" }, { status: 422 });

    // Check for existing pending release and cancel it
    await db.from("release_jobs")
      .update({ status: "failed" })
      .eq("project_id", id)
      .eq("status", "pending_approval");

    const { data: release, error } = await db
      .from("release_jobs")
      .insert({
        project_id: id,
        store: "google_play",
        track,
        status: "pending_approval",
        build_artifact: body.build_artifact || null,
      })
      .select()
      .single();

    if (error) throw error;

    await db.from("audit_logs").insert({
      project_id: id, action: "release_assembled", actor: "user",
      payload: { release_id: (release as Record<string, unknown>).id, track },
    });

    return NextResponse.json({ data: release }, { status: 201 });
  } catch (err) {
    console.error("[release POST]", err);
    return NextResponse.json({ error: "Failed to create release" }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  try {
    const db = getSupabaseAdmin();
    const { data } = await db.from("release_jobs").select("*").eq("project_id", id)
      .order("created_at", { ascending: false }).limit(1).single();
    return NextResponse.json({ data: data ?? null });
  } catch {
    return NextResponse.json({ data: null });
  }
}
