import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteParams { params: { id: string } }

// Step shape shared with the UI
interface CaptureStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
}

const CAPTURE_STEPS: CaptureStep[] = [
  { id: "boot",    label: "Boot Android emulator",       status: "pending" },
  { id: "install", label: "Install app on emulator",     status: "pending" },
  { id: "launch",  label: "Launch app",                  status: "pending" },
  { id: "capture", label: "Navigate & capture screens",  status: "pending" },
  { id: "save",    label: "Save screenshots",            status: "pending" },
];

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  try {
    const db = getSupabaseAdmin();
    const { data } = await db
      .from("screenshots")
      .select("*")
      .eq("project_id", id)
      .order("order_index", { ascending: true });
    return NextResponse.json({ data: data ?? [] });
  } catch {
    return NextResponse.json({ data: [] });
  }
}

// POST — upload a screenshot OR trigger auto-capture
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  try {
    const body = await req.json();
    const db = getSupabaseAdmin();

    // ── Auto-capture flow ───────────────────────────────────────────────────
    // action:"capture" is sent by the UI's "Auto-capture Screenshots" button.
    // Real automation is driven by the bobship-screenshot Bob skill running in
    // a local Bob session. This endpoint handles two modes:
    //
    //  DEMO_MODE=true  → generate placeholder screenshots from detected screens
    //  otherwise        → return a clear "requires Bob session" error with step state
    if (body.action === "capture") {
      const isDemoMode = process.env.DEMO_MODE === "true";

      if (isDemoMode) {
        return await handleDemoCapture(id, db);
      }

      // Not demo mode — auto-capture requires the bobship-screenshot Bob skill
      // running in a local Bob agent session with Argent device access.
      // Return a structured error with step context so the UI can render it properly.
      const steps: CaptureStep[] = CAPTURE_STEPS.map((s, i) =>
        i === 0 ? { ...s, status: "error" } : s
      );
      return NextResponse.json(
        {
          error:
            "Auto-capture requires a local Bob session with Argent. " +
            "Open this project in Bob and run the bobship-screenshot skill, " +
            "or upload screenshots manually.",
          code: "REQUIRES_BOB_SESSION",
          steps,
          hint: "To enable demo screenshots, set DEMO_MODE=true in your environment.",
        },
        { status: 422 }
      );
    }

    // ── Manual upload / save ────────────────────────────────────────────────
    const { data, error } = await db
      .from("screenshots")
      .insert({
        project_id: id,
        store: body.store || "google_play",
        device_type: body.device_type || "phone",
        screen_name: body.screen_name || "Screen",
        file_path: body.file_path || null,
        file_url: body.file_url || null,
        order_index: body.order_index ?? 0,
        source: body.source || "manual",
      })
      .select()
      .single();

    if (error) throw error;

    await db.from("audit_logs").insert({
      project_id: id, action: "screenshot_uploaded", actor: "user",
      payload: { screen_name: body.screen_name, source: body.source || "manual" },
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save screenshot" }, { status: 500 });
  }
}

// ── Demo capture: generates placeholder screenshots from detected screens ──────
async function handleDemoCapture(
  projectId: string,
  db: ReturnType<typeof getSupabaseAdmin>
) {
  const steps: CaptureStep[] = CAPTURE_STEPS.map(s => ({ ...s }));

  // Load analysis to get detected screen names
  const { data: analysis } = await db
    .from("analyses")
    .select("navigation_screens, app_name, package_id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  steps[0].status = "done"; // boot
  steps[1].status = "done"; // install

  const appName = (analysis as Record<string, unknown>)?.app_name as string || "App";
  const detectedScreens = ((analysis as Record<string, unknown>)?.navigation_screens as Array<{ name: string }>) || [];

  // Fallback screens if none detected
  const screenList =
    detectedScreens.length > 0
      ? detectedScreens.slice(0, 6).map(s => s.name)
      : ["Home", "Dashboard", "Profile", "Settings", "Detail", "Onboarding"];

  steps[2].status = "done"; // launch

  // Generate demo screenshots as SVG data URLs with screen name labels
  const savedScreenshots = [];
  for (let i = 0; i < screenList.length; i++) {
    const screenName = screenList[i];
    const hue = (i * 47 + 210) % 360; // varied but consistent hues
    const svgContent = generateDemoScreenshot(appName, screenName, hue);
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString("base64")}`;

    const { data: ss } = await db
      .from("screenshots")
      .insert({
        project_id: projectId,
        store: "google_play",
        device_type: "phone",
        screen_name: screenName,
        file_url: dataUrl,
        order_index: i,
        source: "demo",
      })
      .select()
      .single();

    if (ss) savedScreenshots.push(ss);
  }

  steps[3].status = "done"; // capture
  steps[4].status = "done"; // save

  await db.from("audit_logs").insert({
    project_id: projectId,
    action: "screenshots_auto_captured",
    actor: "system",
    payload: { count: savedScreenshots.length, mode: "demo" },
  });

  return NextResponse.json({
    data: savedScreenshots,
    steps,
    demo: true,
    message: `Generated ${savedScreenshots.length} demo screenshots. These are labelled "demo" and show your app's screen names.`,
  });
}

// ── SVG demo screenshot generator ─────────────────────────────────────────────
function generateDemoScreenshot(appName: string, screenName: string, hue: number): string {
  const bg = `hsl(${hue}, 20%, 12%)`;
  const accent = `hsl(${hue}, 70%, 55%)`;
  const statusBarBg = `hsl(${hue}, 20%, 8%)`;
  // Escape XML special chars
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="${bg}"/>
  <!-- Status bar -->
  <rect width="1080" height="100" fill="${statusBarBg}"/>
  <text x="80" y="68" font-family="system-ui,sans-serif" font-size="42" fill="white" opacity="0.8">9:41</text>
  <text x="980" y="68" font-family="system-ui,sans-serif" font-size="38" fill="white" opacity="0.8" text-anchor="end">●●●</text>
  <!-- App bar -->
  <rect y="100" width="1080" height="120" fill="${accent}" opacity="0.15"/>
  <text x="540" y="178" font-family="system-ui,sans-serif" font-size="52" font-weight="600" fill="${accent}" text-anchor="middle">${esc(appName)}</text>
  <!-- Screen content placeholder -->
  <rect x="80" y="300" width="920" height="8" rx="4" fill="white" opacity="0.08"/>
  <rect x="80" y="380" width="600" height="200" rx="24" fill="${accent}" opacity="0.1"/>
  <text x="540" y="500" font-family="system-ui,sans-serif" font-size="64" font-weight="700" fill="${accent}" text-anchor="middle" opacity="0.6">${esc(screenName)}</text>
  <rect x="80" y="620" width="920" height="120" rx="20" fill="white" opacity="0.04"/>
  <rect x="80" y="760" width="920" height="120" rx="20" fill="white" opacity="0.04"/>
  <rect x="80" y="900" width="920" height="120" rx="20" fill="white" opacity="0.04"/>
  <rect x="80" y="1040" width="920" height="120" rx="20" fill="white" opacity="0.04"/>
  <!-- Demo label -->
  <rect x="0" y="1830" width="1080" height="90" fill="${accent}" opacity="0.2"/>
  <text x="540" y="1885" font-family="system-ui,sans-serif" font-size="36" fill="${accent}" text-anchor="middle" opacity="0.8">DEMO SCREENSHOT · BobShip</text>
  <!-- Bottom nav bar -->
  <rect y="1720" width="1080" height="110" fill="${statusBarBg}" opacity="0.9"/>
  <rect x="440" y="1750" width="200" height="6" rx="3" fill="white" opacity="0.3"/>
</svg>`;
}

// PATCH — approve / reorder screenshots
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  try {
    const body = await req.json(); // { screenshotId, approved, order_index }
    const db = getSupabaseAdmin();

    const update: Record<string, unknown> = {};
    if (body.approved === true) update.approved_at = new Date().toISOString();
    if (body.approved === false) update.approved_at = null;
    if (typeof body.order_index === "number") update.order_index = body.order_index;

    const { data, error } = await db
      .from("screenshots")
      .update(update)
      .eq("id", body.screenshotId)
      .eq("project_id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update screenshot" }, { status: 500 });
  }
}

// DELETE — remove a screenshot
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  try {
    const url = new URL(req.url);
    const screenshotId = url.searchParams.get("screenshotId");
    if (!screenshotId) return NextResponse.json({ error: "screenshotId required" }, { status: 400 });

    const db = getSupabaseAdmin();
    await db.from("screenshots").delete().eq("id", screenshotId).eq("project_id", id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete screenshot" }, { status: 500 });
  }
}
