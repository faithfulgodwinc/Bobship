"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Github,
  GitBranch,
  Package,
  Loader2,
  Search,
  ShieldCheck,
  Sparkles,
  Hammer,
  Camera,
  Send,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScoreRing } from "@/components/design/ScoreRing";
import { Project, Analysis, Build, StoreMetadata, Screenshot, ReleaseJob, AuditLog } from "@/types";
import { formatRelativeTime, scoreToColor, scoreToLabel, truncate } from "@/lib/utils";

interface ProjectData {
  project: Project;
  latestAnalysis: Analysis | null;
  latestBuild: Build | null;
  latestMetadata: StoreMetadata | null;
  screenshots: Screenshot[];
  latestRelease: ReleaseJob | null;
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = React.useState<ProjectData | null>(null);
  const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      const [projectRes, auditRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/audit`),
      ]);
      const projectData = await projectRes.json();
      const auditData = await auditRes.json();

      if (projectData.error) throw new Error(projectData.error);
      setData(projectData.data);
      setAuditLogs(auditData.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchData();
    // Poll every 5s if analyzing/building
    const interval = setInterval(() => {
      if (
        data?.project.status === "analyzing" ||
        data?.project.status === "building"
      ) {
        fetchData();
      }
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, data?.project.status, fetchData]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/analyze`, {
        method: "POST",
      });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || "Analysis failed");
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-xl bg-muted animate-pulse" />
          <div className="h-6 w-48 rounded-lg bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-7xl px-6 py-8">
        <div className="text-center py-20">
          <p className="text-destructive mb-4">{error || "Project not found"}</p>
          <Button variant="outline" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  const { project, latestAnalysis } = data;
  const analysis = latestAnalysis;
  const blockers = analysis?.checks.filter((c) => c.severity === "blocker") || [];
  const warnings = analysis?.checks.filter((c) => c.severity === "warning") || [];
  const passed = analysis?.checks.filter((c) => c.severity === "pass") || [];

  const isAnalyzing =
    project.status === "analyzing" || analyzing;

  return (
    <div className="container mx-auto max-w-7xl px-6 py-8 animate-fade-in">
      {/* Back nav */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Projects
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">{project.name}</span>
      </div>

      {/* Project header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <a
                href={project.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-3.5 w-3.5" />
                {truncate(project.repo_url.replace("https://github.com/", ""), 50)}
              </a>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                {project.repo_branch}
              </span>
            </div>
          </div>
        </div>

        {/* Primary action */}
        <div className="flex items-center gap-2">
          {!analysis && (
            <Button
              variant="apple"
              onClick={handleAnalyze}
              loading={isAnalyzing}
              className="gap-2"
            >
              {isAnalyzing ? (
                <>Analyzing…</>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Analyze Repository
                </>
              )}
            </Button>
          )}
          {analysis && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAnalyze}
                loading={isAnalyzing}
                title="Re-analyze"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="apple" onClick={() => router.push(`/projects/${id}/analysis`)}>
                View Full Report
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Main content */}
        <div className="lg:col-span-2 space-y-6">

          {/* Release Readiness Card — THE most important card */}
          {analysis ? (
            <Card className="overflow-hidden">
              <div className={`h-1 w-full ${
                analysis.readiness_score >= 80
                  ? "bg-system-green"
                  : analysis.readiness_score >= 60
                  ? "bg-system-orange"
                  : "bg-system-red"
              }`} />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Release Readiness</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {analysis.checks.length} checks across all categories
                    </p>
                  </div>
                  <ScoreRing score={analysis.readiness_score} size={100} />
                </div>
              </CardHeader>
              <CardContent>
                {/* Check summary */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 rounded-xl bg-system-green/5 border border-system-green/20">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-system-green" />
                      <span className="text-2xl font-bold text-system-green">{passed.length}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Passed</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-system-orange/5 border border-system-orange/20">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <AlertTriangle className="h-4 w-4 text-system-orange" />
                      <span className="text-2xl font-bold text-system-orange">{warnings.length}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Warnings</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-system-red/5 border border-system-red/20">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <XCircle className="h-4 w-4 text-system-red" />
                      <span className="text-2xl font-bold text-system-red">{blockers.length}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Blockers</p>
                  </div>
                </div>

                {/* Top blockers */}
                {blockers.length > 0 && (
                  <div className="space-y-2 mb-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Blockers
                    </p>
                    {blockers.slice(0, 3).map((check) => (
                      <div
                        key={check.id}
                        className="flex items-start gap-2 p-3 rounded-xl bg-system-red/5 border border-system-red/10"
                      >
                        <XCircle className="h-4 w-4 text-system-red flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">{check.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{check.description}</p>
                          {check.recommended_action && (
                            <p className="text-xs text-system-blue mt-1">
                              → {check.recommended_action}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Link
                  href={`/projects/${id}/analysis`}
                  className="inline-flex items-center gap-1.5 text-sm text-system-blue hover:underline"
                >
                  View full preflight report
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-system-blue mb-4" />
                    <p className="font-semibold">Analyzing repository…</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Reading source files, detecting permissions, features, and
                      build configuration
                    </p>
                  </>
                ) : (
                  <>
                    <Search className="h-8 w-8 text-muted-foreground mb-4" />
                    <p className="font-semibold">Not yet analyzed</p>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">
                      Analyze the repository to generate a release readiness report
                    </p>
                    <Button variant="apple" onClick={handleAnalyze}>
                      Analyze Now
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pipeline steps */}
          {analysis && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Release Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {[
                    {
                      label: "Repository Analysis",
                      href: `/projects/${id}/analysis`,
                      done: !!analysis,
                      icon: Search,
                      detail: analysis
                        ? `${analysis.features.length} features, ${analysis.permissions.length} permissions`
                        : "Not started",
                    },
                    {
                      label: "Store Metadata",
                      href: `/projects/${id}/metadata`,
                      done: !!data.latestMetadata,
                      icon: Sparkles,
                      detail: data.latestMetadata?.title
                        ? `"${truncate(data.latestMetadata.title, 30)}"`
                        : "Not generated",
                    },
                    {
                      label: "Build",
                      href: `/projects/${id}/build`,
                      done: data.latestBuild?.status === "succeeded",
                      icon: Hammer,
                      detail:
                        data.latestBuild?.status === "succeeded"
                          ? "Build succeeded"
                          : data.latestBuild?.status === "running"
                          ? "Building…"
                          : "Not started",
                    },
                    {
                      label: "Screenshots",
                      href: `/projects/${id}/screenshots`,
                      done: data.screenshots.length > 0,
                      icon: Camera,
                      detail:
                        data.screenshots.length > 0
                          ? `${data.screenshots.length} screenshot${data.screenshots.length !== 1 ? "s" : ""}`
                          : "Not captured",
                    },
                    {
                      label: "Release",
                      href: `/projects/${id}/release`,
                      done: data.latestRelease?.status === "submitted",
                      icon: Send,
                      detail:
                        data.latestRelease?.status === "submitted"
                          ? "Submitted"
                          : "Not prepared",
                    },
                  ].map((step, i) => {
                    const Icon = step.icon;
                    return (
                      <Link
                        key={step.href}
                        href={step.href}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted/50 transition-colors group"
                      >
                        <div
                          className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                            step.done
                              ? "bg-system-green/10"
                              : "bg-muted"
                          }`}
                        >
                          {step.done ? (
                            <CheckCircle2 className="h-4 w-4 text-system-green" />
                          ) : (
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{step.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{step.detail}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-6">
          {/* App info */}
          {analysis && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                  App Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {[
                  { label: "Name", value: analysis.app_name },
                  { label: "Package ID", value: analysis.package_id, mono: true },
                  { label: "Version", value: analysis.version_name },
                  { label: "Framework", value: analysis.framework?.replace("_", " ") },
                  { label: "Min SDK", value: analysis.min_sdk ? `API ${analysis.min_sdk}` : null },
                  { label: "Target SDK", value: analysis.target_sdk ? `API ${analysis.target_sdk}` : null },
                ].filter((r) => r.value).map((row) => (
                  <div key={row.label} className="flex justify-between items-center gap-2">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className={`text-xs font-medium truncate ${row.mono ? "font-mono" : ""}`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Features */}
          {analysis && analysis.features.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                  Detected Features
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5">
                  {analysis.features.map((f) => (
                    <Badge key={f.name} variant="secondary" className="text-[10px]">
                      {f.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Audit log */}
          {auditLogs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
                  Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {auditLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="flex items-start gap-2.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 mt-2 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium">
                        {log.action.replace(/_/g, " ")}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {formatRelativeTime(log.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
