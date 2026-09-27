"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft, Package, CheckCircle2, Clock, AlertCircle,
  ExternalLink, ChevronRight, Rocket,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { GlassCard } from "@/components/design/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatDate } from "@/lib/utils";

interface ReleaseJob {
  id: string;
  project_id: string;
  status: string;
  track: string;
  version_name: string | null;
  version_code: number | null;
  approved_at: string | null;
  approved_by: string | null;
  submitted_at: string | null;
  created_at: string;
  projects?: { name: string; package_id: string };
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  submitted: {
    label: "Submitted",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: "text-system-green",
  },
  approved: {
    label: "Approved",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: "text-system-blue",
  },
  submitting: {
    label: "Submitting…",
    icon: <Clock className="h-3.5 w-3.5 animate-spin" />,
    color: "text-system-orange",
  },
  ready: {
    label: "Ready",
    icon: <Package className="h-3.5 w-3.5" />,
    color: "text-muted-foreground",
  },
  failed: {
    label: "Failed",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    color: "text-system-red",
  },
};

export default function ReleasesPage() {
  const [releases, setReleases] = React.useState<ReleaseJob[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    loadReleases();
  }, []);

  async function loadReleases() {
    try {
      const res = await fetch("/api/releases");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReleases(data.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load releases");
    } finally {
      setLoading(false);
    }
  }

  const grouped = React.useMemo(() => {
    const map = new Map<string, ReleaseJob[]>();
    for (const r of releases) {
      const key = r.projects?.name || r.project_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return map;
  }, [releases]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 pt-8 pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Rocket className="h-6 w-6 text-system-blue" />
              Release History
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              All store submission jobs across your projects
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {releases.length} release{releases.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Error */}
        {error && (
          <GlassCard className="mb-6 border-system-red/20 bg-system-red/5">
            <div className="flex items-center gap-2 text-system-red text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          </GlassCard>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <GlassCard key={i}>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && releases.length === 0 && !error && (
          <GlassCard className="text-center py-16">
            <Rocket className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-semibold text-foreground mb-1">No releases yet</p>
            <p className="text-sm text-muted-foreground">
              Open a project and run through the release pipeline to see history here.
            </p>
            <Link href="/" className="mt-4 inline-flex items-center gap-1.5 text-sm text-system-blue hover:underline">
              Go to Dashboard <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </GlassCard>
        )}

        {/* Release groups */}
        {!loading && grouped.size > 0 && (
          <div className="space-y-8">
            {Array.from(grouped.entries()).map(([projectName, jobs]) => (
              <div key={projectName}>
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 px-1">
                  {projectName}
                </h2>
                <div className="space-y-3">
                  {jobs.map((job) => {
                    const statusCfg =
                      STATUS_CONFIG[job.status] || STATUS_CONFIG.ready;
                    return (
                      <GlassCard
                        key={job.id}
                        className="flex items-center gap-4 py-4 hover:border-border/80 transition-colors"
                      >
                        {/* Status icon */}
                        <div
                          className={cn(
                            "flex items-center justify-center h-9 w-9 rounded-full bg-muted/40 shrink-0",
                            statusCfg.color
                          )}
                        >
                          {statusCfg.icon}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-sm truncate">
                              {job.version_name || "Unknown version"}
                            </span>
                            {job.version_code && (
                              <span className="text-xs text-muted-foreground">
                                ({job.version_code})
                              </span>
                            )}
                            <Badge
                              variant="secondary"
                              className="text-[10px] uppercase tracking-wider"
                            >
                              {job.track || "internal"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-3">
                            <span>Created {formatDate(job.created_at)}</span>
                            {job.approved_at && (
                              <span className="flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-system-green" />
                                Approved {formatDate(job.approved_at)}
                              </span>
                            )}
                            {job.submitted_at && (
                              <span className="flex items-center gap-1 text-system-green">
                                <ExternalLink className="h-3 w-3" />
                                Submitted {formatDate(job.submitted_at)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status badge + link */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={cn(
                              "text-xs font-semibold flex items-center gap-1",
                              statusCfg.color
                            )}
                          >
                            {statusCfg.icon}
                            {statusCfg.label}
                          </span>
                          <Link
                            href={`/projects/${job.project_id}/release`}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
