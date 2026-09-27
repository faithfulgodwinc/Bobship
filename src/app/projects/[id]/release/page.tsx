"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Send, CheckCircle2, XCircle, AlertTriangle,
  ChevronRight, Shield, Loader2, AlertCircle, ExternalLink,
  Package, FileText, Camera, Hammer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface ReleaseState {
  project: Record<string, unknown>;
  analysis: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  screenshots: unknown[];
  build: Record<string, unknown> | null;
  release: Record<string, unknown> | null;
}

function CheckRow({ label, status, detail, href }: {
  label: string; status: "ok" | "warn" | "missing";
  detail: string; href?: string;
}) {
  const icons = {
    ok: <CheckCircle2 className="h-4 w-4 text-system-green flex-shrink-0" />,
    warn: <AlertTriangle className="h-4 w-4 text-system-orange flex-shrink-0" />,
    missing: <XCircle className="h-4 w-4 text-system-red flex-shrink-0" />,
  };
  return (
    <div className="flex items-center gap-3 py-2.5">
      {icons[status]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {href && status !== "ok" && (
        <Link href={href} className="text-xs text-system-blue hover:underline flex items-center gap-1">
          Fix <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

export default function ReleasePage() {
  const params = useParams();
  const id = params.id as string;

  const [state, setState] = React.useState<ReleaseState | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [assembling, setAssembling] = React.useState(false);
  const [approving, setApproving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [showApproval, setShowApproval] = React.useState(false);
  const [submissionResult, setSubmissionResult] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [track, setTrack] = React.useState<"internal" | "alpha" | "beta" | "production">("internal");

  async function load() {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      const d = data.data;
      setState({
        project: d.project,
        analysis: d.latestAnalysis,
        metadata: d.latestMetadata,
        screenshots: d.screenshots || [],
        build: d.latestBuild,
        release: d.latestRelease,
      });
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { load(); }, [id]);

  async function handleAssemble() {
    setAssembling(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      await load();
      setShowApproval(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assemble release");
    } finally {
      setAssembling(false);
    }
  }

  async function handleApproveAndSubmit() {
    setApproving(true);
    setSubmitting(false);
    setError(null);
    try {
      // Step 1: Record approval
      const approveRes = await fetch(`/api/projects/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved_by: "developer" }),
      });
      const approveData = await approveRes.json();
      if (!approveRes.ok || approveData.error) throw new Error(approveData.error || "Failed to record approval");

      setApproving(false);
      setSubmitting(true);

      // Step 2: Submit to Google Play
      const submitRes = await fetch(`/api/projects/${id}/submit`, { method: "POST" });
      const submitData = await submitRes.json();

      if (!submitRes.ok || submitData.error) {
        // NO_CREDENTIALS: keep modal open so user can go to Settings then retry
        if (submitData.code === "NO_CREDENTIALS") {
          setError(submitData.error + " — connect your account in Settings, then click Approve & Submit again.");
          // Re-assemble the release so it's back to pending_approval for the next attempt
          await fetch(`/api/projects/${id}/release`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ track }),
          });
          await load();
          setSubmitting(false);
          return;
        }
        throw new Error(submitData.error || "Submission failed");
      }

      setSubmissionResult(submitData.data);
      setShowApproval(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setApproving(false);
      setSubmitting(false);
    }
  }

  if (loading) return (
    <div className="container mx-auto max-w-3xl px-6 py-8 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-muted/40 animate-pulse" />)}
    </div>
  );

  // Guard against null state (e.g. project not found)
  if (!state) return (
    <div className="container mx-auto max-w-3xl px-6 py-8 text-center py-20">
      <p className="text-muted-foreground mb-4">Project not found or failed to load.</p>
      <Button variant="outline" onClick={() => window.history.back()}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
    </div>
  );

  const s = state;
  const releaseStatus = (s.release as Record<string, unknown>)?.status as string | undefined;

  // Pre-flight check list
  const checks = [
    {
      label: "Repository analyzed",
      status: s.analysis ? "ok" : "missing",
      detail: s.analysis
        ? `${(s.analysis.features as unknown[])?.length || 0} features detected · score ${s.analysis.readiness_score}`
        : "Run analysis first",
      href: s.analysis ? undefined : `/projects/${id}`,
    },
    {
      label: "Store metadata",
      status: s.metadata ? (s.metadata.title ? "ok" : "warn") : "missing",
      detail: s.metadata ? `"${(s.metadata.title as string)?.slice(0, 40) || "No title yet"}"` : "Generate metadata first",
      href: s.metadata ? undefined : `/projects/${id}/metadata`,
    },
    {
      label: "Screenshots",
      status: (s.screenshots.length as number) >= 2 ? "ok" : s.screenshots.length > 0 ? "warn" : "missing",
      detail: `${s.screenshots.length} screenshot${s.screenshots.length !== 1 ? "s" : ""} (2 required minimum)`,
      href: `/projects/${id}/screenshots`,
    },
    {
      label: "Build artifact",
      status: (s.build as Record<string, unknown>)?.status === "succeeded" ? "ok" : "warn",
      detail: (s.build as Record<string, unknown>)?.status === "succeeded"
        ? "Release AAB available"
        : "No build yet — submission will update listing only",
      href: `/projects/${id}/build`,
    },
    {
      label: "Google Play credentials",
      status: "warn" as "ok" | "warn" | "missing",
      detail: "Verified at submit time via Settings credentials",
      href: "/settings",
    },
  ] as const;

  const blockingIssues = checks.filter((c) => c.status === "missing");

  return (
    <div className="container mx-auto max-w-3xl px-6 py-8 animate-fade-in">
      <div className="flex items-center gap-2 mb-6">
        <Link href={`/projects/${id}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />{(s.project.name as string) || "Project"}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">Release</span>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Release</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review everything before submitting to Google Play.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />{error}
          {error.includes("credentials") && (
            <Link href="/settings" className="ml-auto text-system-blue hover:underline text-xs">Go to Settings →</Link>
          )}
        </div>
      )}

      {/* Submission success */}
      {(submissionResult || releaseStatus === "submitted") && (
        <Card className="mb-6 border-system-green/30 bg-system-green/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-6 w-6 text-system-green flex-shrink-0" />
              <div>
                <p className="font-bold text-system-green text-base">
                  {submissionResult?.demo ? "Demo submission complete!" : "Submitted to Google Play!"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {submissionResult?.demo
                    ? "This was a demo — no real submission was made. In production, your app would now appear in the internal track."
                    : `Your release is now in the ${submissionResult?.track || "internal"} track on Google Play Console.`}
                </p>
                {!submissionResult?.demo && (
                  <a href="https://play.google.com/console" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-system-blue mt-2 hover:underline">
                    Open Play Console <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pre-flight checklist */}
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Pre-flight Checklist</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0 divide-y divide-border">
          {checks.map((c) => (
            <CheckRow key={c.label} {...c} />
          ))}
        </CardContent>
      </Card>

      {/* Track selector */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Release Track</CardTitle></CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-4 gap-2">
            {(["internal", "alpha", "beta", "production"] as const).map((t) => (
              <button key={t}
                onClick={() => setTrack(t)}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all ${
                  track === t
                    ? "bg-system-blue text-white border-system-blue"
                    : "border-border text-muted-foreground hover:border-system-blue/40 hover:text-foreground"
                }`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {track === "internal" && "Only team members (up to 100) can access internal track releases."}
            {track === "alpha" && "Closed testing — invite specific testers."}
            {track === "beta" && "Open testing — anyone can join."}
            {track === "production" && "⚠️ Public release — visible to all users."}
          </p>
        </CardContent>
      </Card>

      {/* Action */}
      {releaseStatus !== "submitted" && (
        <div className="flex flex-col gap-3">
          {blockingIssues.length > 0 && (
            <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
              <p className="text-sm font-semibold text-destructive mb-1">Cannot submit yet</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {blockingIssues.map((b) => <li key={b.label}>• {b.detail}</li>)}
              </ul>
            </div>
          )}
          <Button variant="apple" size="lg" className="w-full gap-2"
            onClick={handleAssemble} loading={assembling}
            disabled={blockingIssues.length > 0 || assembling}>
            <Send className="h-4 w-4" />
            Prepare Release & Review
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            You will review everything before any irreversible action is taken.
          </p>
        </div>
      )}

      {/* Approval modal */}
      <Dialog open={showApproval} onOpenChange={setShowApproval}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-system-blue/10 flex items-center justify-center">
                <Send className="h-4 w-4 text-system-blue" />
              </div>
              <DialogTitle>Ready to Ship</DialogTitle>
            </div>
            <DialogDescription>
              Review the release package below. Once you approve, BobShip will submit
              to Google Play. <strong>This action cannot be undone.</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {[
              { icon: Package, label: "App", value: (s.analysis?.package_id as string) || (s.project.name as string) },
              { icon: FileText, label: "Track", value: track },
              { icon: FileText, label: "Title", value: (s.metadata?.title as string) || "—" },
              { icon: Camera, label: "Screenshots", value: `${s.screenshots.length} screenshot${s.screenshots.length !== 1 ? "s" : ""}` },
              { icon: Hammer, label: "Build", value: (s.build as Record<string, unknown>)?.status === "succeeded" ? "Release AAB available" : "Listing update only (no build)" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <p className="text-sm font-medium truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p>{error}</p>
                {error.includes("Settings") && (
                  <Link href="/settings" className="inline-flex items-center gap-1 text-xs text-system-blue mt-1 hover:underline">
                    Go to Settings <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowApproval(false); setError(null); }}
              disabled={approving || submitting}>
              Cancel
            </Button>
            <Button variant="apple" onClick={handleApproveAndSubmit}
              loading={approving || submitting} className="gap-2">
              {approving ? "Recording approval…" : submitting ? "Submitting to Google Play…" : (
                <><Shield className="h-4 w-4" /> Approve & Submit</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
