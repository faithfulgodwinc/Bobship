import Link from "next/link";
import {
  GitBranch,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Package,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Project, Analysis } from "@/types";
import { formatRelativeTime, truncate } from "@/lib/utils";

interface ProjectCardProps {
  project: Project;
  analysis?: Analysis | null;
}

function StatusBadge({ status }: { status: Project["status"] }) {
  const map: Record<
    Project["status"],
    { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" | "outline" }
  > = {
    idle: { label: "Idle", variant: "secondary" },
    analyzing: { label: "Analyzing…", variant: "default" },
    building: { label: "Building…", variant: "default" },
    ready: { label: "Ready", variant: "success" },
    submitting: { label: "Submitting…", variant: "warning" },
    submitted: { label: "Submitted", variant: "success" },
  };
  const { label, variant } = map[status] || { label: status, variant: "secondary" };
  return (
    <Badge variant={variant} className="text-[10px]">
      {(status === "analyzing" || status === "building" || status === "submitting") && (
        <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
      )}
      {label}
    </Badge>
  );
}

function ReadinessMini({
  score,
  checks,
}: {
  score: number;
  checks: Analysis["checks"];
}) {
  const blockers = checks.filter((c) => c.severity === "blocker").length;
  const warnings = checks.filter((c) => c.severity === "warning").length;
  const passed = checks.filter((c) => c.severity === "pass").length;

  const color =
    score >= 80
      ? "text-system-green"
      : score >= 60
      ? "text-system-orange"
      : "text-system-red";

  return (
    <div className="flex items-center gap-3">
      <span className={`text-2xl font-bold tabular-nums ${color}`}>{score}</span>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 text-system-green" />
          <span>{passed} passed</span>
        </div>
        {warnings > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3 text-system-orange" />
            <span>{warnings} warnings</span>
          </div>
        )}
        {blockers > 0 && (
          <div className="flex items-center gap-1 text-xs text-system-red">
            <XCircle className="h-3 w-3" />
            <span>{blockers} blockers</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProjectCard({ project, analysis }: ProjectCardProps) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card className="group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer border-border/60 overflow-hidden">
        {/* Top accent bar */}
        <div
          className={`h-0.5 w-full ${
            project.status === "submitted"
              ? "bg-system-green"
              : project.status === "ready"
              ? "bg-system-blue"
              : "bg-border"
          }`}
        />

        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{project.name}</h3>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {truncate(project.repo_url.replace("https://github.com/", ""), 40)}
                </p>
              </div>
            </div>
            <StatusBadge status={project.status} />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            {analysis ? (
              <ReadinessMini score={analysis.readiness_score} checks={analysis.checks} />
            ) : (
              <div className="text-xs text-muted-foreground">
                {project.status === "idle"
                  ? "Not yet analyzed"
                  : "Analysis in progress…"}
              </div>
            )}

            <div className="flex flex-col items-end gap-1">
              {analysis?.package_id && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded-md">
                    {truncate(analysis.package_id, 28)}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                <span>{project.repo_branch}</span>
                <Clock className="h-3 w-3 ml-1" />
                <span>{formatRelativeTime(project.updated_at)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[10px]">
                {project.framework?.replace("_", " ")}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {project.platform}
              </Badge>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
