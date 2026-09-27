"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Lock,
  Wifi,
  Camera,
  MapPin,
  Bell,
  CreditCard,
  Shield,
  Package,
  Wrench,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreRing } from "@/components/design/ScoreRing";
import { Analysis, AnalysisCheck } from "@/types";
import { formatDate } from "@/lib/utils";

const categoryIcons: Record<string, React.ElementType> = {
  "App Identity": Package,
  "Build Configuration": Wrench,
  Privacy: Shield,
  Permissions: Lock,
  "Store Metadata": FileText,
  Screenshots: Camera,
  "Version Information": Info,
  Authentication: Lock,
};

function CheckItem({ check }: { check: AnalysisCheck }) {
  const [expanded, setExpanded] = React.useState(
    check.severity === "blocker" || check.severity === "warning"
  );

  const icons: Record<string, React.ReactNode> = {
    pass: <CheckCircle2 className="h-4 w-4 text-system-green flex-shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 text-system-orange flex-shrink-0" />,
    blocker: <XCircle className="h-4 w-4 text-system-red flex-shrink-0" />,
    info: <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />,
  };

  const bg: Record<string, string> = {
    pass: "bg-system-green/5 border-system-green/15",
    warning: "bg-system-orange/5 border-system-orange/15",
    blocker: "bg-system-red/5 border-system-red/15",
    info: "bg-muted/30 border-border",
  };

  const labelColors: Record<string, string> = {
    pass: "text-system-green bg-system-green/10",
    warning: "text-system-orange bg-system-orange/10",
    blocker: "text-system-red bg-system-red/10",
    info: "text-muted-foreground bg-muted",
  };

  return (
    <div className={`rounded-xl border p-3 ${bg[check.severity]}`}>
      <button
        className="w-full text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5">{icons[check.severity]}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{check.title}</span>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${labelColors[check.severity]}`}
              >
                {check.severity}
              </span>
            </div>
          </div>
          {(check.description || check.evidence || check.recommended_action) && (
            <div className="flex-shrink-0 mt-0.5">
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
      </button>

      {expanded && (
        <div className="mt-2.5 pl-7 space-y-2">
          {check.description && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {check.description}
            </p>
          )}
          {check.evidence && (
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Evidence:
              </span>
              <code className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded font-mono break-all">
                {check.evidence}
              </code>
            </div>
          )}
          {check.file_path && (
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                File:
              </span>
              <code className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded font-mono break-all">
                {check.file_path}
              </code>
            </div>
          )}
          {check.recommended_action && (
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] font-semibold text-system-blue uppercase tracking-wide">
                Fix:
              </span>
              <p className="text-xs text-system-blue">{check.recommended_action}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  const params = useParams();
  const id = params.id as string;

  const [analysis, setAnalysis] = React.useState<Analysis | null>(null);
  const [projectName, setProjectName] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/${id}`);
        const data = await res.json();
        setAnalysis(data.data?.latestAnalysis || null);
        setProjectName(data.data?.project?.name || "");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl px-6 py-8">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="container mx-auto max-w-4xl px-6 py-8 text-center py-20">
        <p className="text-muted-foreground mb-4">No analysis found for this project.</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Project
        </Button>
      </div>
    );
  }

  // Defensive: checks/features may be null if DB insert missed them
  const checks: AnalysisCheck[] = Array.isArray(analysis.checks) ? analysis.checks : [];
  const features = Array.isArray(analysis.features) ? analysis.features : [];

  // Group checks by category
  const byCategory: Record<string, AnalysisCheck[]> = {};
  for (const check of checks) {
    if (!byCategory[check.category]) byCategory[check.category] = [];
    byCategory[check.category].push(check);
  }

  const blockers = checks.filter((c) => c.severity === "blocker");
  const warnings = checks.filter((c) => c.severity === "warning");
  const passed   = checks.filter((c) => c.severity === "pass");

  return (
    <div className="container mx-auto max-w-4xl px-6 py-8 animate-fade-in">
      {/* Back nav */}
      <div className="flex items-center gap-2 mb-6">
        <Link
          href={`/projects/${id}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {projectName}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">Analysis</span>
      </div>

      {/* Score header */}
      <Card className="mb-6 overflow-hidden">
        <div
          className={`h-1.5 w-full ${
            analysis.readiness_score >= 80
              ? "bg-system-green"
              : analysis.readiness_score >= 60
              ? "bg-system-orange"
              : "bg-system-red"
          }`}
        />
        <CardContent className="p-6">
          <div className="flex items-center gap-6">
            <ScoreRing score={analysis.readiness_score} size={120} />
            <div className="flex-1">
              <h1 className="text-xl font-bold">Release Readiness</h1>
              <p className="text-muted-foreground text-sm mt-1">
                {checks.length} checks · analyzed {formatDate(analysis.created_at)}
              </p>
              <div className="grid grid-cols-3 gap-3 mt-4 max-w-xs">
                <div className="text-center">
                  <p className="text-xl font-bold text-system-green">{passed.length}</p>
                  <p className="text-xs text-muted-foreground">Passed</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-system-orange">{warnings.length}</p>
                  <p className="text-xs text-muted-foreground">Warnings</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-system-red">{blockers.length}</p>
                  <p className="text-xs text-muted-foreground">Blockers</p>
                </div>
              </div>
            </div>

            {/* Quick info */}
            <div className="hidden lg:flex flex-col gap-2 text-sm border-l border-border pl-6">
              {analysis.app_name && (
                <div>
                  <span className="text-muted-foreground text-xs">App</span>
                  <p className="font-semibold">{analysis.app_name}</p>
                </div>
              )}
              {analysis.package_id && (
                <div>
                  <span className="text-muted-foreground text-xs">Package</span>
                  <p className="font-mono text-xs">{analysis.package_id}</p>
                </div>
              )}
              {analysis.version_name && (
                <div>
                  <span className="text-muted-foreground text-xs">Version</span>
                  <p className="font-semibold">{analysis.version_name}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preflight checks by category */}
      <div className="space-y-4">
        {Object.keys(byCategory).sort((a, b) => {
          const aSev = byCategory[a].some((c) => c.severity === "blocker") ? 0 :
                       byCategory[a].some((c) => c.severity === "warning") ? 1 : 2;
          const bSev = byCategory[b].some((c) => c.severity === "blocker") ? 0 :
                       byCategory[b].some((c) => c.severity === "warning") ? 1 : 2;
          return aSev - bSev;
        }).map((category) => {
          const categoryChecks = byCategory[category];
          const CategoryIcon = categoryIcons[category] || Info;
          const hasBlockers = categoryChecks.some((c) => c.severity === "blocker");
          const hasWarnings = categoryChecks.some((c) => c.severity === "warning");

          return (
            <Card key={category}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                    hasBlockers ? "bg-system-red/10" :
                    hasWarnings ? "bg-system-orange/10" :
                    "bg-system-green/10"
                  }`}>
                    <CategoryIcon className={`h-4 w-4 ${
                      hasBlockers ? "text-system-red" :
                      hasWarnings ? "text-system-orange" :
                      "text-system-green"
                    }`} />
                  </div>
                  <CardTitle className="text-base">{category}</CardTitle>
                  <div className="flex items-center gap-1 ml-auto">
                    {categoryChecks.filter((c) => c.severity === "blocker").length > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {categoryChecks.filter((c) => c.severity === "blocker").length} blockers
                      </Badge>
                    )}
                    {categoryChecks.filter((c) => c.severity === "warning").length > 0 && (
                      <Badge variant="warning" className="text-[10px]">
                        {categoryChecks.filter((c) => c.severity === "warning").length} warnings
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {categoryChecks.map((check) => (
                  <CheckItem key={check.id} check={check} />
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Features & Permissions */}
      {features.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Detected Features ({features.length})</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {features.map((feature) => (
              <div key={feature.name} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                <CheckCircle2 className="h-4 w-4 text-system-blue flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{feature.name}</p>
                  <p className="text-xs text-muted-foreground">{feature.description}</p>
                  {feature.evidence && (
                    <code className="text-[10px] font-mono text-muted-foreground/70">
                      {feature.evidence}
                    </code>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Next step */}
      <div className="mt-6 flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border">
        <div>
          <p className="text-sm font-semibold">Next: Generate Store Metadata</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Bob will generate a complete store listing grounded in this analysis
          </p>
        </div>
        <Button variant="apple" onClick={() => window.location.href = `/projects/${id}/metadata`}>
          Generate Metadata
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
