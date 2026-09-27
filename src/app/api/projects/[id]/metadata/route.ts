import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteParams { params: { id: string } }

// GET — latest metadata for this project
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  try {
    const db = getSupabaseAdmin();
    const { data } = await db
      .from("store_metadata")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    return NextResponse.json({ data: data ?? null });
  } catch {
    return NextResponse.json({ data: null });
  }
}

// POST — generate metadata from analysis using AI
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  try {
    const db = getSupabaseAdmin();

    // Load latest analysis
    const { data: analysis, error: aErr } = await db
      .from("analyses")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (aErr || !analysis) {
      return NextResponse.json(
        { error: "No analysis found. Run analysis first." },
        { status: 422 }
      );
    }

    // Generate metadata — AI if key present, smart fallback otherwise
    const generated = await generateMetadata(analysis as Record<string, unknown>);

    // Upsert — replace any existing draft for this project
    const { data: existing } = await db
      .from("store_metadata")
      .select("id")
      .eq("project_id", id)
      .eq("store", "google_play")
      .limit(1)
      .single();

    let metadata;
    if (existing?.id) {
      const { data } = await db
        .from("store_metadata")
        .update({ ...generated, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      metadata = data;
    } else {
      const { data } = await db
        .from("store_metadata")
        .insert({
          project_id: id,
          analysis_id: (analysis as Record<string, unknown>).id,
          store: "google_play",
          language: "en-US",
          ...generated,
        })
        .select()
        .single();
      metadata = data;
    }

    await db.from("audit_logs").insert({
      project_id: id,
      action: "metadata_generated",
      actor: "system",
      payload: { title: generated.title, store: "google_play", ai_powered: !!process.env.OPENAI_API_KEY },
    });

    return NextResponse.json({ data: metadata }, { status: 201 });
  } catch (err) {
    console.error("[metadata POST]", err);
    return NextResponse.json({ error: "Failed to generate metadata" }, { status: 500 });
  }
}

// PATCH — save developer edits
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { id } = params;
  try {
    const body = await req.json();
    const db = getSupabaseAdmin();

    const { data: existing } = await db
      .from("store_metadata")
      .select("id")
      .eq("project_id", id)
      .limit(1)
      .single();

    if (!existing?.id) {
      return NextResponse.json({ error: "No metadata found to update" }, { status: 404 });
    }

    const { data, error } = await db
      .from("store_metadata")
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update metadata" }, { status: 500 });
  }
}

// ─── Main generator — AI if key available, smart heuristic fallback ───────────

async function generateMetadata(analysis: Record<string, unknown>) {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await generateWithAI(analysis);
    } catch (err) {
      console.warn("[metadata] AI generation failed, falling back to heuristic:", err);
    }
  }
  return generateHeuristic(analysis);
}

// ─── AI generation via OpenAI (or any compatible endpoint) ───────────────────

async function generateWithAI(analysis: Record<string, unknown>) {
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const appName  = (analysis.app_name  as string) || "App";
  const features = (analysis.features  as Array<{ name: string; description: string; evidence?: string }>) || [];
  const permissions = (analysis.permissions as Array<{ name: string; platform: string; is_dangerous: boolean }>) || [];
  const privacyFlags = (analysis.privacy_flags as string[]) || [];
  const navScreens   = (analysis.navigation_screens as Array<{ name: string }>) || [];
  const version      = (analysis.version_name as string) || "1.0";
  const framework    = (analysis.framework   as string) || "react_native";
  const apiDeps      = (analysis.api_deps    as string[]) || [];

  // Build a rich context block — translate technical findings into plain signals for the AI
  const featureLines = features.map(f =>
    `- ${f.name}: ${f.description}${f.evidence ? ` (found in ${f.evidence})` : ""}`
  ).join("\n");

  const permissionLines = permissions.map(p =>
    `- ${p.name}${p.is_dangerous ? " (sensitive — requires user consent)" : ""}`
  ).join("\n");

  const screenLines = navScreens.map(s => `- ${s.name}`).join("\n");

  // Classify the app category from signals
  const categoryHints: string[] = [];
  const featureNames = features.map(f => f.name.toLowerCase());
  if (featureNames.some(n => n.includes("auth") || n.includes("login"))) categoryHints.push("requires user accounts");
  if (featureNames.some(n => n.includes("payment") || n.includes("stripe") || n.includes("purchase"))) categoryHints.push("handles payments or purchases");
  if (featureNames.some(n => n.includes("map") || n.includes("location"))) categoryHints.push("uses location or maps");
  if (featureNames.some(n => n.includes("camera") || n.includes("photo") || n.includes("image"))) categoryHints.push("captures or manages photos");
  if (featureNames.some(n => n.includes("chat") || n.includes("message"))) categoryHints.push("has messaging or chat");
  if (featureNames.some(n => n.includes("notification"))) categoryHints.push("sends notifications");
  if (featureNames.some(n => n.includes("offline") || n.includes("storage"))) categoryHints.push("works offline");
  if (apiDeps.some(d => d.includes("supabase") || d.includes("firebase") || d.includes("api"))) categoryHints.push("syncs data with a server");

  const prompt = `You are a professional Google Play store copywriter. You have been given a technical analysis of a mobile app. Your job is to write compelling, accurate store listing copy that describes what the app ACTUALLY DOES from a user's perspective.

RULES:
- Write for the end user, not the developer. Never mention technical terms like "React Native", "Expo", "AsyncStorage", "Navigator", "stack", "tab", "bundle ID", etc.
- Only describe features that are actually present in the analysis — never invent features.
- Write like a professional product marketer who has used the app.
- Use active second-person voice: "Manage your tasks", "Track your workouts", etc.
- The full description must feel like a real store listing, not a list of technical capabilities.

APP ANALYSIS:
App name: ${appName}
Version: ${version}

Screens in the app:
${screenLines || "No named screens detected"}

What the app does (detected features):
${featureLines || "No specific features detected beyond basic navigation"}

App category signals:
${categoryHints.length > 0 ? categoryHints.join(", ") : "General mobile app"}

Permissions the app uses:
${permissionLines || "No special permissions"}

Privacy/data flags:
${privacyFlags.join(", ") || "None detected"}

OUTPUT: Return ONLY a valid JSON object with these exact keys. No markdown, no explanation:
{
  "title": "App title (max 50 chars — use the app name, maybe with a short tagline)",
  "short_description": "One punchy sentence that captures the core value (max 80 chars)",
  "full_description": "Full store description (max 4000 chars). Use paragraphs. Start with a hook. List real features as bullets using •. End with a download CTA. No HTML.",
  "whats_new": "What's new in this release (max 500 chars). If version is 1.0, use an initial release message.",
  "keywords": "10-15 relevant search keywords, comma-separated, no repetition"
}`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 1500,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Record<string, string>;

  // Enforce character limits strictly
  return {
    title:             truncate(parsed.title             || appName,      50),
    short_description: truncate(parsed.short_description || "",           80),
    full_description:           parsed.full_description  || "",
    whats_new:         truncate(parsed.whats_new         || `Version ${version} — Initial release.`, 500),
    keywords:                   parsed.keywords          || "",
  };
}

// ─── Smart heuristic fallback (no AI key) ────────────────────────────────────
// Translates technical features into plain-English user copy.

const FEATURE_USER_COPY: Record<string, { verb: string; benefit: string }> = {
  "Authentication":        { verb: "Sign in securely",           benefit: "secure login and account management" },
  "Google Sign-In":        { verb: "Sign in with Google",        benefit: "one-tap Google login" },
  "Apple Sign-In":         { verb: "Sign in with Apple",         benefit: "private Sign in with Apple" },
  "Biometric Authentication": { verb: "Use Face ID or Touch ID", benefit: "biometric login for fast, secure access" },
  "Push Notifications":    { verb: "Stay informed",              benefit: "real-time push notifications" },
  "Local Notifications":   { verb: "Get timely reminders",       benefit: "smart local notifications" },
  "Location / Maps":       { verb: "See where you are",          benefit: "live maps and location tracking" },
  "Camera":                { verb: "Capture moments",            benefit: "in-app camera" },
  "Image Picker":          { verb: "Add photos from your library", benefit: "photo selection and upload" },
  "Payments / Stripe":     { verb: "Pay securely",               benefit: "secure in-app payments" },
  "In-App Purchases":      { verb: "Unlock premium features",    benefit: "in-app purchases" },
  "Offline Support":       { verb: "Work without Wi-Fi",         benefit: "full offline support" },
  "Local Storage":         { verb: "Your data stays on-device",  benefit: "local data storage" },
  "Chat / Messaging":      { verb: "Message in real time",       benefit: "real-time messaging" },
  "Social Feed":           { verb: "See what others are doing",  benefit: "social activity feed" },
  "In-App Browser":        { verb: "Browse without leaving the app", benefit: "built-in web browser" },
  "Audio / Speech":        { verb: "Speak or listen",            benefit: "audio recording and playback" },
  "Tab Navigation":        { verb: "Navigate easily",            benefit: "intuitive tab-based navigation" },
  "Drawer Navigation":     { verb: "Access everything from the menu", benefit: "side menu navigation" },
  "Network Status":        { verb: "Always stay connected",      benefit: "automatic connectivity detection" },
  "Date/Time Picker":      { verb: "Pick dates and times",       benefit: "easy date and time selection" },
  "Supabase Auth/Database":{ verb: "Sync across devices",        benefit: "real-time cloud sync" },
  "Firebase":              { verb: "Sync in real time",          benefit: "live cloud database" },
};

function generateHeuristic(analysis: Record<string, unknown>) {
  const appName    = (analysis.app_name  as string) || "App";
  const features   = (analysis.features  as Array<{ name: string; description: string }>) || [];
  const permissions = (analysis.permissions as Array<{ name: string; is_dangerous: boolean }>) || [];
  const navScreens  = (analysis.navigation_screens as Array<{ name: string }>) || [];
  const version     = (analysis.version_name as string) || "1.0";
  const privacyFlags = (analysis.privacy_flags as string[]) || [];

  // Map features to user-facing copy
  const userFeatures = features
    .map(f => FEATURE_USER_COPY[f.name])
    .filter(Boolean);

  // Infer a primary use-case sentence from the strongest feature signals
  const featureNames = features.map(f => f.name);
  let primaryPurpose = "";
  if (featureNames.some(n => n.includes("Chat") || n.includes("Messaging")))
    primaryPurpose = `${appName} is a messaging app that lets you connect and communicate in real time.`;
  else if (featureNames.some(n => n.includes("Payment") || n.includes("Purchase")))
    primaryPurpose = `${appName} is a shopping app that makes buying simple, fast, and secure.`;
  else if (featureNames.some(n => n.includes("Location") || n.includes("Map")))
    primaryPurpose = `${appName} helps you navigate and discover places near you.`;
  else if (featureNames.some(n => n.includes("Camera") || n.includes("Photo") || n.includes("Image")))
    primaryPurpose = `${appName} lets you capture, manage, and share photos effortlessly.`;
  else if (featureNames.some(n => n.includes("Auth") || n.includes("Login")))
    primaryPurpose = `${appName} keeps your account and data secure with fast, easy sign-in.`;
  else if (featureNames.some(n => n.includes("Notification")))
    primaryPurpose = `${appName} keeps you up to date with smart, timely notifications.`;
  else if (navScreens.length >= 4)
    primaryPurpose = `${appName} is a full-featured mobile app with ${navScreens.length} screens and a smooth, intuitive experience.`;
  else
    primaryPurpose = `${appName} is a mobile app designed to make your everyday tasks simpler.`;

  // Build feature bullets — plain English only
  const featureBullets = userFeatures.length > 0
    ? userFeatures.slice(0, 7).map(f => `• ${f.benefit.charAt(0).toUpperCase() + f.benefit.slice(1)}`).join("\n")
    : features.slice(0, 5).map(f => {
        // Strip technical terms from raw descriptions as best we can
        return `• ${f.description
          .replace(/App uses |App has |App allows |App accesses |App monitors /gi, "")
          .replace(/react.?native|expo|firebase|supabase|asyncstorage|navigator/gi, "")
          .trim()}`;
      }).join("\n");

  // Screens paragraph
  const screenPara = navScreens.length > 0
    ? `\nWhat you'll find:\n${navScreens.slice(0, 6).map(s => `• ${s.name}`).join("\n")}`
    : "";

  // Privacy sentence — user-friendly
  const dangerousPerms = permissions.filter(p => p.is_dangerous);
  const privacySentence = dangerousPerms.length > 0
    ? `\n${appName} may request access to ${
        dangerousPerms
          .slice(0, 3)
          .map(p => permissionToHumanName(p.name))
          .join(", ")
      } to deliver its features. Your privacy is important to us.`
    : "";

  // Short description — punchy, 80 chars max
  const shortDescription = truncate(
    userFeatures[0]
      ? `${userFeatures[0].verb} — ${userFeatures[0].benefit}`
      : primaryPurpose.replace(`${appName} `, "").replace(/^is a /i, "").replace(/^lets you /, ""),
    80
  );

  // Full description
  const fullDescription = [
    primaryPurpose,
    "",
    featureBullets ? `${featureBullets}` : "",
    screenPara,
    privacySentence,
    "",
    `Download ${appName} today and see the difference.`,
  ].filter(s => s !== undefined).join("\n").trim();

  // What's new
  const isInitialRelease = !version || version === "1.0" || version === "1.0.0";
  const whatsNew = isInitialRelease
    ? `Welcome to ${appName}! This is our first release — we're excited to share it with you. More features and improvements are on the way.`
    : `Version ${version} is here with improvements and bug fixes. We're always working to make ${appName} better for you.`;

  // Keywords
  const keywordSet = new Set<string>();
  keywordSet.add(appName.toLowerCase());
  features.forEach(f => {
    const copy = FEATURE_USER_COPY[f.name];
    if (copy) copy.benefit.split(" ").filter(w => w.length > 4).forEach(w => keywordSet.add(w.toLowerCase()));
  });
  navScreens.slice(0, 5).forEach(s => keywordSet.add(s.name.toLowerCase()));
  const keywords = Array.from(keywordSet).slice(0, 15).join(", ");

  return {
    title:             truncate(appName, 50),
    short_description: shortDescription,
    full_description:  fullDescription,
    whats_new:         truncate(whatsNew, 500),
    keywords,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function truncate(s: string, max: number) {
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function permissionToHumanName(perm: string): string {
  const map: Record<string, string> = {
    CAMERA:                     "your camera",
    READ_CONTACTS:              "your contacts",
    WRITE_CONTACTS:             "your contacts",
    ACCESS_FINE_LOCATION:       "your location",
    ACCESS_COARSE_LOCATION:     "your approximate location",
    ACCESS_BACKGROUND_LOCATION: "your background location",
    RECORD_AUDIO:               "your microphone",
    READ_EXTERNAL_STORAGE:      "your photo library",
    WRITE_EXTERNAL_STORAGE:     "storage",
    READ_MEDIA_IMAGES:          "your photos",
    BLUETOOTH:                  "Bluetooth",
    POST_NOTIFICATIONS:         "notification permissions",
  };
  const key = perm.replace("android.permission.", "").replace("NSPhotoLibrary", "READ_MEDIA_IMAGES");
  return map[key] || key.toLowerCase().replace(/_/g, " ");
}
