import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = params;
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db
      .from("audit_logs")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;
    return NextResponse.json({ data: data || [] });
  } catch {
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
  }
}
