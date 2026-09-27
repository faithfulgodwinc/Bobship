"use client";

import * as React from "react";
import { cn, scoreToColor } from "@/lib/utils";

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  animate?: boolean;
}

export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
  className,
  animate = true,
}: ScoreRingProps) {
  const [displayed, setDisplayed] = React.useState(animate ? 0 : score);

  React.useEffect(() => {
    if (!animate) return;
    const step = score / 60;
    let current = 0;
    const interval = setInterval(() => {
      current = Math.min(current + step, score);
      setDisplayed(Math.round(current));
      if (current >= score) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, [score, animate]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayed / 100) * circumference;

  const colorMap = {
    green: "#34C759",
    orange: "#FF9500",
    red: "#FF3B30",
  };

  const strokeColor =
    score >= 80 ? colorMap.green : score >= 60 ? colorMap.orange : colorMap.red;

  const label =
    score >= 80 ? "Ready" : score >= 60 ? "Attention" : "Not Ready";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Score ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.05s ease-out",
            filter: `drop-shadow(0 0 6px ${strokeColor}40)`,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className={cn("text-3xl font-bold tabular-nums", scoreToColor(score))}>
          {displayed}
        </span>
        <span className="text-xs text-muted-foreground font-medium mt-0.5">{label}</span>
      </div>
    </div>
  );
}
