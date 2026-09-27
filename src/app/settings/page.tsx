"use client";

import * as React from "react";
import {
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Key,
  Github,
  Smartphone,
  Apple,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CredentialSummary } from "@/lib/credentials/vault";
import { formatRelativeTime } from "@/lib/utils";

// ─── Provider config ──────────────────────────────────────────────────────────

const PROVIDERS = {
  google_play: {
    label: "Google Play Console",
    icon: Smartphone,
    color: "text-system-green",
    bg: "bg-system-green/10",
    description:
      "Connect your Google Play Developer account to submit releases directly from BobShip.",
    instructions: [
      "Go to Google Play Console → Setup → API access",
      'Link to a Google Cloud project and create a Service Account',
      "Grant the service account 'Release manager' role in Play Console",
      "Create and download a JSON key for the service account",
      "Paste the full JSON content below",
    ],
  },
  android_keystore: {
    label: "Android Signing Keystore",
    icon: Key,
    color: "text-system-orange",
    bg: "bg-system-orange/10",
    description:
      "Your Android keystore is used to sign release builds. BobShip reconstructs it in memory during builds and never stores it in plaintext.",
    instructions: [
      "Convert your .jks / .keystore file to base64:",
      "  macOS/Linux: base64 -i my-keystore.jks | tr -d '\\n'",
      "  Windows: [Convert]::ToBase64String([IO.File]::ReadAllBytes('my-keystore.jks'))",
      "Paste the base64 output below along with your passwords",
    ],
  },
  github: {
    label: "GitHub",
    icon: Github,
    color: "text-foreground",
    bg: "bg-muted",
    description:
      "A GitHub Personal Access Token with repo read scope lets BobShip clone private repositories.",
    instructions: [
      "Go to GitHub → Settings → Developer settings → Personal access tokens",
      "Create a token with 'repo' scope (read access is sufficient)",
      "Paste the token below",
    ],
  },
  app_store: {
    label: "App Store Connect",
    icon: Apple,
    color: "text-system-blue",
    bg: "bg-system-blue/10",
    description:
      "Connect App Store Connect for iOS releases. BobShip uses the App Store Connect API with JWT authentication.",
    instructions: [
      "Go to App Store Connect → Users and Access → Integrations → App Store Connect API",
      "Create an API key with App Manager role",
      "Download the .p8 private key file",
      "Convert to base64: base64 -i AuthKey_XXXXXXXXXX.p8 | tr -d '\\n'",
    ],
  },
} as const;

type Provider = keyof typeof PROVIDERS;

// ─── Forms ────────────────────────────────────────────────────────────────────

function GooglePlayForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: Record<string, string>) => void;
  loading: boolean;
}) {
  const [label, setLabel] = React.useState("My Google Play Account");
  const [json, setJson] = React.useState("");
  const [showJson, setShowJson] = React.useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ provider: "google_play", label, serviceAccountJson: json });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">Label</label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Service Account JSON</label>
          <button
            type="button"
            onClick={() => setShowJson(!showJson)}
            className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground"
          >
            {showJson ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showJson ? "Hide" : "Show"}
          </button>
        </div>
        <Textarea
          placeholder='{"type": "service_account", "project_id": "...", ...}'
          value={showJson ? json : json ? "••••••••••••••••" : ""}
          onChange={(e) => setJson(e.target.value)}
          onFocus={() => setShowJson(true)}
          rows={6}
          className="font-mono text-xs"
          required
        />
        <p className="text-xs text-muted-foreground">
          Paste the complete JSON content of your service account key file. This is
          encrypted before storage and never exposed to the browser.
        </p>
      </div>
      <Button type="submit" variant="apple" loading={loading} className="w-full">
        Save Google Play Connection
      </Button>
    </form>
  );
}

function AndroidKeystoreForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: Record<string, string>) => void;
  loading: boolean;
}) {
  const [label, setLabel] = React.useState("Release Keystore");
  const [ksBase64, setKsBase64] = React.useState("");
  const [ksPassword, setKsPassword] = React.useState("");
  const [keyAlias, setKeyAlias] = React.useState("");
  const [keyPassword, setKeyPassword] = React.useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          provider: "android_keystore",
          label,
          keystoreBase64: ksBase64,
          keystorePassword: ksPassword,
          keyAlias,
          keyPassword: keyPassword || ksPassword,
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">Label</label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Keystore (base64)</label>
        <Textarea
          placeholder="Paste base64-encoded .jks or .keystore file…"
          value={ksBase64}
          onChange={(e) => setKsBase64(e.target.value)}
          rows={4}
          className="font-mono text-xs"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Keystore Password</label>
          <Input
            type="password"
            value={ksPassword}
            onChange={(e) => setKsPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Key Alias</label>
          <Input
            value={keyAlias}
            onChange={(e) => setKeyAlias(e.target.value)}
            placeholder="my-key"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Key Password (leave blank if same as keystore)</label>
        <Input
          type="password"
          value={keyPassword}
          onChange={(e) => setKeyPassword(e.target.value)}
          placeholder="Same as keystore password"
        />
      </div>
      <Button type="submit" variant="apple" loading={loading} className="w-full">
        Save Keystore
      </Button>
    </form>
  );
}

function GitHubForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: Record<string, string>) => void;
  loading: boolean;
}) {
  const [label, setLabel] = React.useState("My GitHub Account");
  const [pat, setPat] = React.useState("");
  const [username, setUsername] = React.useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ provider: "github", label, personalAccessToken: pat, username });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">Label</label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">GitHub Username (optional)</label>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="your-username"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Personal Access Token</label>
        <Input
          type="password"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          placeholder="ghp_…"
          required
        />
        <p className="text-xs text-muted-foreground">
          Requires repo scope (read access). Only needed for private repositories —
          public repos work without a token.
        </p>
      </div>
      <Button type="submit" variant="apple" loading={loading} className="w-full">
        Save GitHub Connection
      </Button>
    </form>
  );
}

function AppStoreForm({
  onSubmit,
  loading,
}: {
  onSubmit: (data: Record<string, string>) => void;
  loading: boolean;
}) {
  const [label, setLabel] = React.useState("App Store Connect");
  const [keyId, setKeyId] = React.useState("");
  const [issuerId, setIssuerId] = React.useState("");
  const [privateKey, setPrivateKey] = React.useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          provider: "app_store",
          label,
          keyId,
          issuerId,
          privateKeyBase64: privateKey,
        });
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">Label</label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-sm font-medium">Key ID</label>
          <Input
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder="XXXXXXXXXX"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Issuer ID</label>
          <Input
            value={issuerId}
            onChange={(e) => setIssuerId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-…"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Private Key (.p8 file, base64 encoded)</label>
        <Textarea
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
          rows={4}
          className="font-mono text-xs"
          placeholder="LS0tLS1CRUdJTi…"
          required
        />
      </div>
      <Button type="submit" variant="apple" loading={loading} className="w-full">
        Save App Store Connection
      </Button>
    </form>
  );
}

// ─── Credential card ──────────────────────────────────────────────────────────

function CredentialCard({
  cred,
  onDelete,
}: {
  cred: CredentialSummary;
  onDelete: (id: string) => void;
}) {
  const config = PROVIDERS[cred.provider];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:bg-muted/30 transition-colors">
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${config.bg}`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold">{cred.label}</p>
          {cred.is_valid === true && (
            <CheckCircle2 className="h-3.5 w-3.5 text-system-green flex-shrink-0" />
          )}
          {cred.is_valid === false && (
            <XCircle className="h-3.5 w-3.5 text-system-red flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-[10px]">
            {config.label}
          </Badge>
          {!!cred.metadata?.client_email && (
            <span className="text-xs text-muted-foreground truncate">
              {String(cred.metadata.client_email)}
            </span>
          )}
          {!!cred.metadata?.username && (
            <span className="text-xs text-muted-foreground">
              @{String(cred.metadata.username)}
            </span>
          )}
          {!!cred.metadata?.keyAlias && (
            <span className="text-xs font-mono text-muted-foreground">
              alias: {String(cred.metadata.keyAlias)}
            </span>
          )}
        </div>
        {cred.last_validated_at && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Last validated {formatRelativeTime(cred.last_validated_at)}
          </p>
        )}
      </div>
      <button
        onClick={() => onDelete(cred.id)}
        className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        title="Remove credential"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const [credentials, setCredentials] = React.useState<CredentialSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [addingProvider, setAddingProvider] = React.useState<Provider | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [expandedInstructions, setExpandedInstructions] = React.useState<Provider | null>(null);

  React.useEffect(() => {
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((d) => setCredentials(d.data || []))
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveCredential(data: Record<string, string>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error);
      setCredentials((prev) => [result.data, ...prev]);
      setAddingProvider(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this credential? This cannot be undone.")) return;
    const res = await fetch(`/api/credentials/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    }
  }

  const byProvider = (provider: Provider) =>
    credentials.filter((c) => c.provider === provider);

  return (
    <div className="container mx-auto max-w-3xl px-6 py-8 animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Connect your store accounts and developer credentials. All secrets are
          encrypted before storage and never exposed outside the server.
        </p>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-system-blue/5 border border-system-blue/20 mb-8">
        <ShieldCheck className="h-5 w-5 text-system-blue flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-system-blue">Your credentials are encrypted</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Secrets are encrypted with AES-256-GCM using a server-side key before being stored.
            Plaintext credentials never touch the browser and are never returned by the API.
            Each developer connects their own accounts — BobShip never uses shared credentials.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {(Object.entries(PROVIDERS) as [Provider, typeof PROVIDERS[Provider]][]).map(
          ([provider, config]) => {
            const Icon = config.icon;
            const existing = byProvider(provider);
            const isExpanded = expandedInstructions === provider;

            return (
              <Card key={provider}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${config.bg}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{config.label}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {config.description}
                        </CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAddingProvider(provider)}
                      className="gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Connect
                    </Button>
                  </div>
                </CardHeader>

                {(existing.length > 0 || true) && (
                  <CardContent className="pt-0">
                    {/* Existing credentials */}
                    {existing.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {existing.map((cred) => (
                          <CredentialCard
                            key={cred.id}
                            cred={cred}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    )}

                    {existing.length === 0 && (
                      <p className="text-xs text-muted-foreground italic mb-3">
                        No {config.label} account connected yet.
                      </p>
                    )}

                    {/* Setup instructions toggle */}
                    <button
                      onClick={() =>
                        setExpandedInstructions(isExpanded ? null : provider)
                      }
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                      Setup instructions
                    </button>

                    {isExpanded && (
                      <div className="mt-3 p-3 rounded-xl bg-muted/40 space-y-1">
                        {config.instructions.map((step, i) => (
                          <p key={i} className="text-xs text-muted-foreground font-mono">
                            {step.startsWith("  ") ? (
                              <span className="pl-4">{step.trim()}</span>
                            ) : (
                              <span>
                                <span className="text-muted-foreground/50">{i + 1}.</span>{" "}
                                {step}
                              </span>
                            )}
                          </p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          }
        )}
      </div>

      {/* Add credential dialog */}
      <Dialog
        open={addingProvider !== null}
        onOpenChange={(open) => {
          if (!open) setAddingProvider(null);
          setError(null);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {addingProvider && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  {React.createElement(PROVIDERS[addingProvider].icon, {
                    className: `h-5 w-5 ${PROVIDERS[addingProvider].color}`,
                  })}
                  <DialogTitle>
                    Connect {PROVIDERS[addingProvider].label}
                  </DialogTitle>
                </div>
                <DialogDescription>
                  Your credentials are encrypted before storage. The raw values
                  are never accessible through the API.
                </DialogDescription>
              </DialogHeader>

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {addingProvider === "google_play" && (
                <GooglePlayForm onSubmit={handleSaveCredential} loading={saving} />
              )}
              {addingProvider === "android_keystore" && (
                <AndroidKeystoreForm onSubmit={handleSaveCredential} loading={saving} />
              )}
              {addingProvider === "github" && (
                <GitHubForm onSubmit={handleSaveCredential} loading={saving} />
              )}
              {addingProvider === "app_store" && (
                <AppStoreForm onSubmit={handleSaveCredential} loading={saving} />
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
