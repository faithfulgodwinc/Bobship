import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteParams { params: { id: string } }

// POST — record developer approval of a release
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  try {
    const body = await req.json().catch(() => ({}));
    const db = getSupabaseAdmin();

    const { data: release } = await db.from("release_jobs").select("*")
      .eq("project_id", id).eq("status", "pending_approval")
      .order("created_at", { ascending: false }).limit(1).single();

    if (!release) {
      return NextResponse.json({ error: "No pending release found" }, { status: 404 });
    }

    const { data, error } = await db
      .from("release_jobs")
      .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: body.approved_by || "developer" })
      .eq("id", (release as Record<string, unknown>).id)
      .select().single();

    if (error) throw error;

    await db.from("audit_logs").insert({
      project_id: id, action: "submission_approved", actor: "user",
      payload: { release_id: (release as Record<string, unknown>).id, approved_by: body.approved_by || "developer" },
    });

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: "Failed to record approval" }, { status: 500 });
  }
}
