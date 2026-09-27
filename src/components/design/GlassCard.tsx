import * as React from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  intensity?: "subtle" | "medium" | "strong";
  hover?: boolean;
}

export function GlassCard({
  className,
  intensity = "medium",
  hover = false,
  ...props
}: GlassCardProps) {
  const intensities: Record<string, string> = {
    subtle: "bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md",
    medium: "bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl",
    strong: "bg-white/90 dark:bg-zinc-900/90 backdrop-blur-2xl",
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/20 dark:border-white/10",
        intensities[intensity],
        hover &&
          "transition-all duration-200 hover:shadow-lg hover:border-white/30 hover:-translate-y-0.5 cursor-pointer",
        className
      )}
      {...props}
    />
  );
}
