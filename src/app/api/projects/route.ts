import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { extractRepoName } from "@/lib/utils";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CreateProjectSchema = z.object({
  repoUrl: z.string().url("Must be a valid URL"),
  repoBranch: z.string().default("main"),
  platform: z.enum(["android", "ios", "both"]).default("android"),
  framework: z
    .enum(["react_native", "flutter", "native_android", "native_ios", "expo"])
    .default("react_native"),
});

// GET /api/projects — list all projects with latest analysis
export async function GET() {
  try {
    const db = getSupabaseAdmin();
    const { data: projects, error } = await db
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    // Fetch latest analysis for each project
    const projectsWithAnalysis = await Promise.all(
      (projects || []).map(async (project: Record<string, unknown>) => {
        const { data: analyses } = await db
          .from("analyses")
          .select("*")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false })
          .limit(1);

        return {
          ...project,
          latestAnalysis: analyses?.[0] ?? null,
        };
      })
    );

    return NextResponse.json({ data: projectsWithAnalysis });
  } catch (err) {
    console.error("[GET /api/projects]", err);
    return NextResponse.json(
      { error: "Failed to load projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects — create a new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { repoUrl, repoBranch, platform, framework } = parsed.data;
    const name = extractRepoName(repoUrl);
    const db = getSupabaseAdmin();

    const { data: project, error } = await db
      .from("projects")
      .insert({ name, repo_url: repoUrl, repo_branch: repoBranch, platform, framework, status: "idle" })
      .select()
      .single();

    if (error) throw error;

    await db.from("audit_logs").insert({
      project_id: project.id,
      action: "project_created",
      actor: "user",
      payload: { repo_url: repoUrl, platform, framework },
    });

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects]", err);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
