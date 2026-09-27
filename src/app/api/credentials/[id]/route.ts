import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { id: string };
}

// DELETE /api/credentials/[id] — remove a credential
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const db = getSupabaseAdmin();
    const { error } = await db
      .from("credentials")
      .delete()
      .eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/credentials/[id]]", err);
    return NextResponse.json({ error: "Failed to delete credential" }, { status: 500 });
  }
}

// POST /api/credentials/[id]/validate — test if credential is working
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Validation is provider-specific; import the resolver to decrypt and test
  try {
    const db = getSupabaseAdmin();

    const { data: cred, error } = await db
      .from("credentials")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !cred) {
      return NextResponse.json({ error: "Credential not found" }, { status: 404 });
    }

    // For now: mark as valid and return (real validation done per-provider)
    // TODO: provider-specific ping (e.g. androidpublisher.edits.insert dry-run)
    await db
      .from("credentials")
      .update({ is_valid: true, last_validated_at: new Date().toISOString() })
      .eq("id", params.id);

    return NextResponse.json({ valid: true });
  } catch (err) {
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
