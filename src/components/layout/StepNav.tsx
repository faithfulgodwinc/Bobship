import Link from "next/link";
import {
  Search,
  FileCode2,
  ShieldCheck,
  Sparkles,
  Hammer,
  Camera,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Project } from "@/types";

interface StepNavProps {
  project: Project;
  activeStep?: string;
  className?: string;
}

interface Step {
  id: string;
  label: string;
  icon: React.ElementType;
  href: (id: string) => string;
  status: "pending" | "active" | "complete" | "error";
}

function getStepStatus(
  stepId: string,
  project: Project,
  activeStep: string
): "pending" | "active" | "complete" | "error" {
  if (stepId === activeStep) return "active";

  const order = ["analyze", "preflight", "metadata", "build", "screenshots", "release"];
  const stepIdx = order.indexOf(stepId);
  const activeIdx = order.indexOf(activeStep);

  if (stepIdx < activeIdx) return "complete";
  return "pending";
}

export function StepNav({ project, activeStep = "analyze", className }: StepNavProps) {
  const steps: Step[] = [
    {
      id: "analyze",
      label: "Analyze",
      icon: Search,
      href: (id) => `/projects/${id}/analysis`,
      status: "pending",
    },
    {
      id: "preflight",
      label: "Preflight",
      icon: ShieldCheck,
      href: (id) => `/projects/${id}/preflight`,
      status: "pending",
    },
    {
      id: "metadata",
      label: "Metadata",
      icon: Sparkles,
      href: (id) => `/projects/${id}/metadata`,
      status: "pending",
    },
    {
      id: "build",
      label: "Build",
      icon: Hammer,
      href: (id) => `/projects/${id}/build`,
      status: "pending",
    },
    {
      id: "screenshots",
      label: "Screenshots",
      icon: Camera,
      href: (id) => `/projects/${id}/screenshots`,
      status: "pending",
    },
    {
      id: "release",
      label: "Release",
      icon: Send,
      href: (id) => `/projects/${id}/release`,
      status: "pending",
    },
  ];

  return (
    <nav className={cn("flex items-center gap-1", className)}>
      {steps.map((step, i) => {
        const status = getStepStatus(step.id, project, activeStep);
        const Icon = step.icon;
        const isActive = status === "active";
        const isComplete = status === "complete";

        return (
          <div key={step.id} className="flex items-center">
            <Link
              href={step.href(project.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive &&
                  "bg-system-blue/10 text-system-blue",
                isComplete &&
                  "text-muted-foreground hover:text-foreground hover:bg-accent",
                !isActive &&
                  !isComplete &&
                  "text-muted-foreground/50 cursor-not-allowed pointer-events-none"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{step.label}</span>
            </Link>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-px w-4 mx-1",
                  isComplete ? "bg-system-green/40" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
