"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Rocket, Github, Loader2, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProjectCard } from "@/components/project/ProjectCard";
import { Project, Analysis } from "@/types";
import { extractRepoName } from "@/lib/utils";

interface ProjectWithAnalysis extends Project {
  latestAnalysis?: Analysis | null;
}

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = React.useState<ProjectWithAnalysis[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showImport, setShowImport] = React.useState(false);
  const [repoUrl, setRepoUrl] = React.useState("");
  const [branch, setBranch] = React.useState("main");
  const [importing, setImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load projects on mount — fetchProjects is intentionally excluded from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProjects(data.data || []);
    } catch (err) {
      console.error("Failed to load projects:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: repoUrl.trim(),
          repoBranch: branch.trim() || "main",
          platform: "android",
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Failed to create project");

      setShowImport(false);
      setRepoUrl("");
      setBranch("main");
      router.push(`/projects/${data.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-6 py-8">
      {/* Hero section — shown only when no projects */}
      {!loading && projects.length === 0 && (
        <div className="flex flex-col items-center text-center py-20 animate-fade-in">
          <div className="h-16 w-16 rounded-2xl bg-system-blue/10 flex items-center justify-center mb-6">
            <Rocket className="h-8 w-8 text-system-blue" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            Ship your app, not your weekend
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mb-8 text-balance">
            Connect a GitHub repository and BobShip will analyze your app, generate
            store metadata, capture screenshots, and prepare your Google Play release.
          </p>
          <div className="flex items-center gap-3">
            <Button
              variant="apple"
              size="lg"
              onClick={() => setShowImport(true)}
              className="gap-2"
            >
              <Github className="h-4 w-4" />
              Import Repository
            </Button>
            <Button variant="outline" size="lg" onClick={() => {
              setRepoUrl("https://github.com/facebook/react-native");
              setShowImport(true);
            }}>
              Try Demo App
            </Button>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-12">
            {[
              "Reads real source code",
              "Detects permissions & features",
              "Generates grounded metadata",
              "Captures real screenshots",
              "Google Play submission",
              "Human approval gate",
            ].map((f) => (
              <div
                key={f}
                className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full border border-border/50"
              >
                <Sparkles className="h-3 w-3 text-system-blue" />
                {f}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard header */}
      {(loading || projects.length > 0) && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading ? "Loading…" : `${projects.length} release project${projects.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button
            variant="apple"
            onClick={() => setShowImport(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      )}

      {/* Project grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-48 rounded-2xl bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              analysis={project.latestAnalysis}
            />
          ))}
        </div>
      )}

      {/* Import Dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              Import Repository
            </DialogTitle>
            <DialogDescription>
              Enter a public GitHub repository URL. BobShip will clone and analyze the app.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleImport} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Repository URL</label>
              <Input
                type="url"
                placeholder="https://github.com/owner/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Branch</label>
              <Input
                type="text"
                placeholder="main"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-xl">
                {error}
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowImport(false);
                  setError(null);
                }}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button type="submit" variant="apple" loading={importing}>
                {importing ? "Importing…" : "Import & Analyze"}
                {!importing && <ArrowRight className="h-4 w-4" />}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
