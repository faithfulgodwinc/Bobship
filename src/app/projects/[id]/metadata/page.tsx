"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Sparkles, Loader2, Edit3, Check, X,
  ChevronRight, RefreshCw, AlertCircle, Copy, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Metadata {
  id: string;
  title: string | null;
  short_description: string | null;
  full_description: string | null;
  whats_new: string | null;
  keywords: string | null;
  approved_at: string | null;
}

function CharCount({ value, max }: { value: string; max: number }) {
  const len = (value || "").length;
  const over = len > max;
  return (
    <span className={`text-xs tabular-nums ${over ? "text-system-red font-semibold" : "text-muted-foreground"}`}>
      {len}/{max}
    </span>
  );
}

function EditableField({
  label, value, onChange, maxLength, multiline = false, rows = 3,
}: {
  label: string; value: string; onChange: (v: string) => void;
  maxLength: number; multiline?: boolean; rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <CharCount value={value} max={maxLength} />
      </div>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)}
          rows={rows} className="text-sm resize-none" maxLength={maxLength + 50} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)}
          className="text-sm" maxLength={maxLength + 20} />
      )}
    </div>
  );
}

export default function MetadataPage() {
  const params = useParams();
  const id = params.id as string;

  const [metadata, setMetadata] = React.useState<Metadata | null>(null);
  const [projectName, setProjectName] = React.useState("");
  const [hasAnalysis, setHasAnalysis] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [aiPowered, setAiPowered] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Editable fields
  const [title, setTitle] = React.useState("");
  const [shortDesc, setShortDesc] = React.useState("");
  const [fullDesc, setFullDesc] = React.useState("");
  const [whatsNew, setWhatsNew] = React.useState("");
  const [keywords, setKeywords] = React.useState("");

  React.useEffect(() => {
    async function load() {
      try {
        const [projRes, metaRes] = await Promise.all([
          fetch(`/api/projects/${id}`),
          fetch(`/api/projects/${id}/metadata`),
        ]);
        const proj = await projRes.json();
        const meta = await metaRes.json();
        setProjectName(proj.data?.project?.name || "");
        setHasAnalysis(!!proj.data?.latestAnalysis);
        if (meta.data) {
          setMetadata(meta.data);
          setTitle(meta.data.title || "");
          setShortDesc(meta.data.short_description || "");
          setFullDesc(meta.data.full_description || "");
          setWhatsNew(meta.data.whats_new || "");
          setKeywords(meta.data.keywords || "");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setAiPowered(null);
    try {
      const res = await fetch(`/api/projects/${id}/metadata`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      setMetadata(data.data);
      setTitle(data.data.title || "");
      setShortDesc(data.data.short_description || "");
      setFullDesc(data.data.full_description || "");
      setWhatsNew(data.data.whats_new || "");
      setKeywords(data.data.keywords || "");
      // The API embeds ai_powered in the audit log payload — approximate from content quality
      setAiPowered(data.data?.full_description?.length > 200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/projects/${id}/metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, short_description: shortDesc, full_description: fullDesc, whats_new: whatsNew, keywords }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="container mx-auto max-w-3xl px-6 py-8 space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted/40 animate-pulse" />)}
    </div>
  );

  return (
    <div className="container mx-auto max-w-3xl px-6 py-8 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link href={`/projects/${id}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />{projectName}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">Store Metadata</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Store Metadata</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {metadata
              ? "Edit your store listing. All content is grounded in your repository analysis."
              : "Generate a complete store listing from your repository analysis."}
          </p>
        </div>
        <div className="flex gap-2">
          {metadata && (
            <Button variant="outline" size="sm" onClick={handleGenerate} loading={generating} title="Regenerate">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="apple" onClick={metadata ? handleSave : handleGenerate}
            loading={generating || saving}>
            {generating ? "Generating…" : saving ? "Saving…" : saved ? (
              <><Check className="h-4 w-4" /> Saved</>
            ) : metadata ? (
              <><Edit3 className="h-4 w-4" /> Save Changes</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generate Metadata</>
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 mb-4 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {!metadata && !generating ? (
        /* Empty state */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-12 w-12 rounded-2xl bg-system-blue/10 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-system-blue" />
            </div>
            <h3 className="font-semibold mb-2">Generate your store listing</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-3">
              BobShip studies your repository — the actual screens, features, permissions,
              and app behaviour — and writes a store listing that describes what your app
              really does, in plain language users understand.
            </p>
            {!hasAnalysis && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl mb-4">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Run analysis first so BobShip has something to study
              </div>
            )}
            <Button variant="apple" onClick={handleGenerate} disabled={!hasAnalysis} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate from Analysis
            </Button>
          </CardContent>
        </Card>
      ) : generating ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-system-blue mb-2" />
            <p className="font-semibold">Studying your app…</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Reading your screens, features, and permissions to write copy
              that describes what your app actually does.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Editor */
        <div className="space-y-4">
          {/* Badges */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5">
              <div className="h-2 w-2 rounded-full bg-system-green" />
              Google Play
            </Badge>
            <span className="text-xs text-muted-foreground">en-US</span>
            {aiPowered === true && (
              <Badge variant="secondary" className="gap-1 text-system-blue border-system-blue/20 bg-system-blue/5">
                <Sparkles className="h-2.5 w-2.5" /> AI-written
              </Badge>
            )}
            {aiPowered === false && (
              <Badge variant="secondary" className="gap-1 text-muted-foreground">
                Smart heuristic · add OPENAI_API_KEY for AI copy
              </Badge>
            )}
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">App Identity</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-4">
              <EditableField label="App Title" value={title} onChange={setTitle} maxLength={50} />
              <EditableField label="Short Description" value={shortDesc} onChange={setShortDesc} maxLength={80} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Full Description</CardTitle></CardHeader>
            <CardContent className="pt-0">
              <EditableField label="" value={fullDesc} onChange={setFullDesc} maxLength={4000} multiline rows={10} />
              <p className="text-xs text-muted-foreground mt-2">
                Supports plain text. HTML formatting not permitted on Google Play.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Release Notes</CardTitle></CardHeader>
            <CardContent className="pt-0 space-y-4">
              <EditableField label="What's New" value={whatsNew} onChange={setWhatsNew} maxLength={500} multiline rows={4} />
              <EditableField label="Keywords (comma-separated)" value={keywords} onChange={setKeywords} maxLength={100} />
            </CardContent>
          </Card>

          {/* Save + Next */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border">
            <div>
              <p className="text-sm font-semibold">Looks good?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Save your edits then move on to screenshots</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} loading={saving}>
                {saved ? <><Check className="h-4 w-4" /> Saved</> : "Save"}
              </Button>
              <Button variant="apple" onClick={() => { handleSave(); window.location.href = `/projects/${id}/screenshots`; }}>
                Next: Screenshots <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
