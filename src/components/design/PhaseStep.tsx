import * as React from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, AlertCircle, Loader2 } from "lucide-react";

export type StepStatus = "pending" | "in_progress" | "complete" | "error";

interface PhaseStepProps {
  label: string;
  description?: string;
  status: StepStatus;
  stepNumber: number;
  isLast?: boolean;
}

export function PhaseStep({
  label,
  description,
  status,
  stepNumber,
  isLast = false,
}: PhaseStepProps) {
  const iconMap: Record<StepStatus, React.ReactNode> = {
    complete: <CheckCircle2 className="h-5 w-5 text-system-green" />,
    in_progress: <Loader2 className="h-5 w-5 text-system-blue animate-spin" />,
    error: <AlertCircle className="h-5 w-5 text-system-red" />,
    pending: (
      <div className="h-5 w-5 rounded-full border-2 border-border flex items-center justify-center">
        <span className="text-[10px] text-muted-foreground font-semibold">{stepNumber}</span>
      </div>
    ),
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="flex-shrink-0 mt-0.5">{iconMap[status]}</div>
        {!isLast && (
          <div
            className={cn(
              "w-px flex-1 mt-2",
              status === "complete" ? "bg-system-green/30" : "bg-border"
            )}
          />
        )}
      </div>
      <div className={cn("pb-6", isLast && "pb-0")}>
        <p
          className={cn(
            "text-sm font-medium",
            status === "complete" && "text-foreground",
            status === "in_progress" && "text-system-blue",
            status === "error" && "text-system-red",
            status === "pending" && "text-muted-foreground"
          )}
        >
          {label}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}
