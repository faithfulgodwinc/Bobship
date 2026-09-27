import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/releases — return all release jobs with project info, newest first
export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("release_jobs")
      .select("*, projects(name, package_id)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load releases" },
      { status: 500 }
    );
  }
}
