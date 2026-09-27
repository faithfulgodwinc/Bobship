import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) return formatDate(date);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

export function extractRepoName(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1]?.replace(/\.git$/, "") || url;
  } catch {
    return url.split("/").pop()?.replace(/\.git$/, "") || url;
  }
}

export function scoreToColor(score: number): string {
  if (score >= 80) return "text-system-green";
  if (score >= 60) return "text-system-orange";
  return "text-system-red";
}

export function scoreToLabel(score: number): string {
  if (score >= 80) return "Ready to Ship";
  if (score >= 60) return "Needs Attention";
  if (score >= 40) return "Major Issues";
  return "Not Ready";
}

export function severityToColor(severity: string): string {
  switch (severity) {
    case "pass": return "text-system-green";
    case "warning": return "text-system-orange";
    case "blocker": return "text-system-red";
    default: return "text-muted-foreground";
  }
}

export function statusToLabel(status: string): string {
  const labels: Record<string, string> = {
    idle: "Idle",
    analyzing: "Analyzing…",
    building: "Building…",
    ready: "Ready",
    submitting: "Submitting…",
    submitted: "Submitted",
  };
  return labels[status] || status;
}
