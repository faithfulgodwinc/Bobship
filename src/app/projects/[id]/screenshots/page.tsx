"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Camera, Upload, Trash2, ChevronRight,
  CheckCircle2, Image as ImageIcon, AlertCircle, Loader2,
  Smartphone, Sparkles, MonitorSmartphone, Terminal,
  RefreshCw, ExternalLink, Play, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Screenshot {
  id: string;
  screen_name: string;
  file_url: string | null;
  device_type: string;
  order_index: number;
  approved_at: string | null;
  source?: string;
}

interface DetectedScreen {
  name: string;
  route?: string;
  navigator?: string;
}

interface CaptureStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
}

const CAPTURE_STEPS: CaptureStep[] = [
  { id: "boot",    label: "Boot Android emulator",      status: "pending" },
  { id: "install", label: "Install app on emulator",    status: "pending" },
  { id: "launch",  label: "Launch app",                 status: "pending" },
  { id: "capture", label: "Navigate & capture screens", status: "pending" },
  { id: "save",    label: "Save screenshots",           status: "pending" },
];

// ── Small copy-button for code snippets ────────────────────────────────────────
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = React.useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="relative group">
      <pre className="bg-zinc-950 text-zinc-200 text-xs rounded-xl px-4 py-3 pr-10 overflow-x-auto font-mono leading-relaxed">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 h-6 w-6 flex items-center justify-center rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors opacity-0 group-hover:opacity-100"
        title="Copy"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </button>
    </div>
  );
}

// ── Numbered setup step ────────────────────────────────────────────────────────
function SetupStep({
  n, title, children,
}: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-system-blue/15 text-system-blue text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold mb-1.5">{title}</p>
        {children}
      </div>
    </div>
  );
}

export default function ScreenshotsPage() {
  const params = useParams();
  const id = params.id as string;

  const [screenshots, setScreenshots]       = React.useState<Screenshot[]>([]);
  const [projectName, setProjectName]       = React.useState("");
  const [detectedScreens, setDetectedScreens] = React.useState<DetectedScreen[]>([]);
  const [packageId, setPackageId]           = React.useState<string | null>(null);
  const [loading, setLoading]               = React.useState(true);
  const [uploading, setUploading]           = React.useState(false);
  const [capturing, setCapturing]           = React.useState(false);
  const [captureSteps, setCaptureSteps]     = React.useState<CaptureStep[]>(CAPTURE_STEPS);
  const [captureError, setCaptureError]     = React.useState<string | null>(null);
  const [captureCode, setCaptureCode]       = React.useState<string | null>(null);
  const [captureDone, setCaptureDone]       = React.useState(false);
  const [showSetupGuide, setShowSetupGuide] = React.useState(false);
  const [error, setError]                   = React.useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { load(); }, [id]);

  async function load() {
    try {
      const [projRes, ssRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/screenshots`),
      ]);
      const proj = await projRes.json();
      const ss   = await ssRes.json();

      setProjectName(proj.data?.project?.name || "");
      setScreenshots(ss.data || []);

      const analysis = proj.data?.latestAnalysis;
      if (analysis) {
        setDetectedScreens((analysis.navigation_screens as DetectedScreen[]) || []);
        setPackageId(analysis.package_id || null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoCapture() {
    setCapturing(true);
    setCaptureError(null);
    setCaptureCode(null);
    setCaptureDone(false);
    setShowSetupGuide(false);
    setCaptureSteps(CAPTURE_STEPS.map(s => ({ ...s, status: "pending" })));

    try {
      const res  = await fetch(`/api/projects/${id}/screenshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "capture" }),
      });
      const data = await res.json();

      if (data.steps) setCaptureSteps(data.steps);

      if (!res.ok) {
        setCaptureCode(data.code ?? null);
        // If the server says "needs Bob session", open the setup guide
        if (data.code === "REQUIRES_BOB_SESSION") {
          setShowSetupGuide(true);
        }
        throw new Error(data.error || "Auto-capture failed");
      }

      setCaptureDone(true);
      await load();
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : "Auto-capture failed");
    } finally {
      setCapturing(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setError(null);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = async () => {
          try {
            const dataUrl    = reader.result as string;
            const screenName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
            await fetch(`/api/projects/${id}/screenshots`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                screen_name: screenName || `Screenshot ${i + 1}`,
                file_url:    dataUrl,
                device_type: "phone",
                order_index: screenshots.length + i,
                source:      "manual",
              }),
            });
          } finally { resolve(); }
        };
        reader.readAsDataURL(file);
      });
    }

    await load();
    setUploading(false);
    e.target.value = "";
  }

  async function handleDelete(ssId: string) {
    await fetch(`/api/projects/${id}/screenshots?screenshotId=${ssId}`, { method: "DELETE" });
    setScreenshots(prev => prev.filter(s => s.id !== ssId));
  }

  async function handleApprove(ssId: string, approved: boolean) {
    await fetch(`/api/projects/${id}/screenshots`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ screenshotId: ssId, approved }),
    });
    await load();
  }

  if (loading) return (
    <div className="container mx-auto max-w-4xl px-6 py-8 space-y-4">
      <div className="h-8 w-48 rounded-xl bg-muted/40 animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-64 rounded-2xl bg-muted/40 animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="container mx-auto max-w-4xl px-6 py-8 animate-fade-in">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link href={`/projects/${id}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />{projectName}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">Screenshots</span>
      </div>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Screenshots</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Google Play requires at least 2 screenshots per device type.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <label className="cursor-pointer">
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={handleFileUpload} disabled={uploading || capturing} />
            <Button variant="outline" size="sm" disabled={uploading || capturing}>
              {uploading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Upload className="h-3.5 w-3.5" />}
              Upload manually
            </Button>
          </label>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* ── Auto-capture panel ───────────────────────────────────────────────── */}
      <Card className="mb-6 border-system-blue/30 bg-gradient-to-br from-system-blue/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-system-blue/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-system-blue" />
            </div>
            <div>
              <CardTitle className="text-base">AI-Powered Auto-Capture</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bob boots an Android emulator, installs your app, navigates every detected
                screen, and saves real screenshots — no manual work required.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* Detected screens chips */}
          {detectedScreens.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Screens Bob will capture
              </p>
              <div className="flex flex-wrap gap-1.5">
                {detectedScreens.map((screen, i) => (
                  <div key={screen.name}
                    className="flex items-center gap-1 text-xs bg-muted/60 border border-border px-2 py-1 rounded-lg">
                    <span className="text-muted-foreground/60 font-mono">{i + 1}.</span>
                    <MonitorSmartphone className="h-3 w-3 text-muted-foreground" />
                    <span>{screen.name}</span>
                    {screen.navigator && (
                      <span className="text-muted-foreground/50">· {screen.navigator}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {packageId && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Smartphone className="h-3.5 w-3.5" />
              <span>Package: <code className="font-mono text-foreground">{packageId}</code></span>
            </div>
          )}

          {/* Step progress */}
          {(capturing || captureDone || captureError) && (
            <div className="border border-border rounded-xl bg-background p-3 space-y-2">
              {captureSteps.map(step => (
                <div key={step.id} className="flex items-center gap-2.5 text-sm">
                  {step.status === "done"    && <CheckCircle2 className="h-4 w-4 text-system-green shrink-0" />}
                  {step.status === "running" && <Loader2      className="h-4 w-4 text-system-blue animate-spin shrink-0" />}
                  {step.status === "error"   && <AlertCircle  className="h-4 w-4 text-destructive shrink-0" />}
                  {step.status === "pending" && <div className="h-4 w-4 rounded-full border-2 border-muted shrink-0" />}
                  <span className={cn(
                    step.status === "done"    && "text-foreground",
                    step.status === "running" && "text-system-blue font-medium",
                    step.status === "error"   && "text-destructive",
                    step.status === "pending" && "text-muted-foreground",
                  )}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* ── Emulator setup guide (shown when REQUIRES_BOB_SESSION) ────────── */}
          {showSetupGuide && (
            <div className="border border-amber-500/30 bg-amber-500/5 rounded-2xl overflow-hidden">
              {/* Guide header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20 bg-amber-500/10">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                    Set up your Android emulator
                  </span>
                </div>
                <button
                  onClick={() => setShowSetupGuide(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dismiss
                </button>
              </div>

              <div className="p-4 space-y-5">
                <p className="text-sm text-muted-foreground">
                  Auto-capture needs an Android emulator running on this machine.
                  Follow these steps — it takes about 5 minutes the first time.
                </p>

                {/* Step 1 */}
                <SetupStep n={1} title="Install Android Studio">
                  <p className="text-xs text-muted-foreground mb-2">
                    Download and install Android Studio if you haven&apos;t already.
                  </p>
                  <a
                    href="https://developer.android.com/studio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-system-blue hover:underline"
                  >
                    developer.android.com/studio <ExternalLink className="h-3 w-3" />
                  </a>
                </SetupStep>

                {/* Step 2 */}
                <SetupStep n={2} title="Create a virtual device (AVD)">
                  <p className="text-xs text-muted-foreground mb-2">
                    In Android Studio: <strong>Tools → Device Manager → Create Device</strong>.
                    Choose <strong>Pixel 6</strong> → <strong>API 33 (Android 13)</strong> → Finish.
                  </p>
                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {["Pixel 6", "API 33", "x86_64 ABI"].map(tag => (
                      <span key={tag} className="bg-muted border border-border px-2 py-0.5 rounded-md font-mono">
                        {tag}
                      </span>
                    ))}
                  </div>
                </SetupStep>

                {/* Step 3 */}
                <SetupStep n={3} title="Start the emulator">
                  <p className="text-xs text-muted-foreground mb-2">
                    Either click ▶ in Device Manager, or run from terminal:
                  </p>
                  <CodeBlock code={`# list available AVDs\nemulator -list-avds\n\n# boot your AVD (replace Pixel_6_API_33 with your AVD name)\nemulator -avd Pixel_6_API_33`} />
                </SetupStep>

                {/* Step 4 */}
                <SetupStep n={4} title="Verify the emulator is visible to ADB">
                  <p className="text-xs text-muted-foreground mb-2">
                    Run this — you should see <code className="font-mono">emulator-5554   device</code>:
                  </p>
                  <CodeBlock code="adb devices" />
                </SetupStep>

                {/* Step 5 */}
                <SetupStep n={5} title="Build a debug APK of your app">
                  <p className="text-xs text-muted-foreground mb-2">
                    In your app repo, run one of these depending on your framework:
                  </p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold">React Native / Expo</p>
                      <CodeBlock code={`# Expo managed workflow\nnpx expo run:android\n\n# React Native CLI\ncd android && ./gradlew assembleDebug`} />
                    </div>
                  </div>
                </SetupStep>

                {/* Step 6 */}
                <SetupStep n={6} title="Come back and click Auto-capture">
                  <p className="text-xs text-muted-foreground">
                    Once the emulator is running and your app is installed,
                    click <strong>Auto-capture</strong> below and Bob will handle the rest —
                    navigating every screen and saving screenshots automatically.
                  </p>
                </SetupStep>

                {/* Quick-start alternative */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <p className="text-xs font-semibold mb-1">
                    ⚡ Skip setup — use Demo Mode instead
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Add <code className="font-mono">DEMO_MODE=true</code> to your{" "}
                    <code className="font-mono">.env.local</code> and restart the dev server.
                    Bob will generate labelled placeholder screenshots from your detected
                    screen names instantly — perfect for the hackathon demo.
                  </p>
                  <CodeBlock code={`# .env.local\nDEMO_MODE=true`} />
                </div>
              </div>
            </div>
          )}

          {/* Generic error (non-setup errors) */}
          {captureError && !showSetupGuide && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm">
              <div className="flex items-center gap-2 text-destructive font-medium mb-1">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Auto-capture failed
              </div>
              <p className="text-xs text-muted-foreground">{captureError}</p>
            </div>
          )}

          {/* Success banner */}
          {captureDone && !captureError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-system-green/10 border border-system-green/20 text-sm text-system-green font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Screenshots captured successfully
            </div>
          )}

          {/* Action row */}
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <Button variant="apple" disabled={capturing} onClick={handleAutoCapture}>
              {capturing
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Capturing…</>
                : <><Camera className="h-4 w-4" /> Auto-capture Screenshots</>
              }
            </Button>

            {/* Show "retry" hint when guide is open */}
            {showSetupGuide && !capturing && (
              <Button variant="outline" size="sm" onClick={handleAutoCapture}>
                <RefreshCw className="h-3.5 w-3.5" /> Retry after setup
              </Button>
            )}

            {/* Show setup guide toggle when no error yet */}
            {!captureError && !capturing && !captureDone && (
              <button
                onClick={() => setShowSetupGuide(v => !v)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                {showSetupGuide ? "Hide setup guide" : "How do I set up an emulator?"}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Play Store requirements ──────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {[
              { label: "Phone",       req: "2–8 screenshots (required)", size: "1080×1920px min", required: true  },
              { label: "7\" Tablet",  req: "Optional",                   size: "1080×1920px min", required: false },
              { label: "10\" Tablet", req: "Optional",                   size: "1080×1920px min", required: false },
            ].map(item => (
              <div key={item.label}
                className={cn(
                  "p-3 rounded-xl border",
                  item.required ? "border-system-blue/30 bg-system-blue/5" : "border-border bg-muted/20"
                )}>
                <p className={cn("font-semibold", item.required ? "text-system-blue" : "text-foreground")}>
                  {item.label}
                </p>
                <p className="text-muted-foreground mt-0.5">{item.req}</p>
                <p className="text-muted-foreground/70">{item.size}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Screenshot grid ───────────────────────────────────────────────────── */}
      {screenshots.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Camera className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-1">No screenshots yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Use <strong>Auto-capture</strong> above to have Bob navigate your running
              app and save real screenshots, or upload them manually.
            </p>
            <div className="flex gap-2">
              <Button variant="apple" disabled={capturing} onClick={handleAutoCapture}>
                {capturing
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Capturing…</>
                  : <><Camera className="h-4 w-4" /> Auto-capture</>
                }
              </Button>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={handleFileUpload} disabled={uploading} />
                <Button variant="outline" disabled={uploading}>
                  <Upload className="h-4 w-4" /> Upload manually
                </Button>
              </label>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {screenshots.map(ss => (
              <div key={ss.id}
                className="group relative rounded-2xl overflow-hidden border border-border bg-muted/30 aspect-[9/16]">
                {ss.file_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ss.file_url} alt={ss.screen_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}

                {/* Source badge */}
                {ss.source && ss.source !== "manual" && (
                  <div className="absolute top-2 left-2">
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md",
                      ss.source === "demo"
                        ? "bg-amber-500/80 text-white"
                        : "bg-system-blue/80 text-white"
                    )}>
                      {ss.source}
                    </span>
                  </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                  <button
                    onClick={() => handleApprove(ss.id, !ss.approved_at)}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition-colors">
                    {ss.approved_at
                      ? <><CheckCircle2 className="h-3.5 w-3.5 text-system-green" /> Approved</>
                      : "Approve"}
                  </button>
                  <button
                    onClick={() => handleDelete(ss.id)}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
                    <Trash2 className="h-3.5 w-3.5" /> Remove
                  </button>
                </div>

                {/* Approved tick */}
                {ss.approved_at && (
                  <div className="absolute top-2 right-2">
                    <div className="h-5 w-5 rounded-full bg-system-green flex items-center justify-center">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                  </div>
                )}

                {/* Screen name label */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-white text-[10px] font-medium truncate">{ss.screen_name}</p>
                  <Badge variant="outline" className="text-[9px] text-white/70 border-white/20 mt-0.5">
                    {ss.device_type}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {/* Footer bar */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border">
            <div>
              <p className="text-sm font-semibold">
                {screenshots.length} screenshot{screenshots.length !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {screenshots.filter(s => s.approved_at).length} approved ·{" "}
                {screenshots.length >= 2
                  ? <span className="text-system-green">Minimum met ✓</span>
                  : "Need at least 2"}
              </p>
            </div>
            <Button
              variant="apple"
              onClick={() => { window.location.href = `/projects/${id}/release`; }}
              disabled={screenshots.length < 2}>
              Next: Release <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
