// ─── Project ────────────────────────────────────────────────────────────────

export type ProjectStatus =
  | "idle"
  | "analyzing"
  | "building"
  | "ready"
  | "submitting"
  | "submitted";

export type Platform = "android" | "ios" | "both";
export type Framework = "react_native" | "flutter" | "native_android" | "native_ios" | "expo";
export type Store = "google_play" | "app_store";
export type ReleaseTrack = "internal" | "alpha" | "beta" | "production";

export interface Project {
  id: string;
  name: string;
  repo_url: string;
  repo_branch: string;
  platform: Platform;
  framework: Framework;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

// ─── Analysis ───────────────────────────────────────────────────────────────

export type CheckSeverity = "pass" | "warning" | "blocker" | "info";

export interface AnalysisCheck {
  id: string;
  category: string;
  title: string;
  severity: CheckSeverity;
  description: string;
  evidence?: string;
  file_path?: string;
  recommended_action?: string;
}

export interface DetectedFeature {
  name: string;
  description: string;
  evidence: string; // file path or code reference
}

export interface DetectedPermission {
  name: string;
  platform: "android" | "ios";
  is_dangerous: boolean;
  purpose?: string;
}

export interface DetectedScreen {
  name: string;
  route?: string;
  deep_link?: string;
  navigator?: string;
}

export interface Analysis {
  id: string;
  project_id: string;
  app_name: string | null;
  package_id: string | null;
  framework: Framework | null;
  version_name: string | null;
  version_code: string | null;
  min_sdk: string | null;
  target_sdk: string | null;
  features: DetectedFeature[];
  permissions: DetectedPermission[];
  api_deps: string[];
  privacy_flags: string[];
  navigation_screens: DetectedScreen[];
  existing_assets: Record<string, string>;
  readiness_score: number;
  checks: AnalysisCheck[];
  raw_report: string | null;
  created_at: string;
}

// ─── Build ───────────────────────────────────────────────────────────────────

export type BuildStatus = "pending" | "running" | "succeeded" | "failed";
export type BuildType = "debug" | "release";

export interface Build {
  id: string;
  project_id: string;
  status: BuildStatus;
  build_type: BuildType;
  artifact_url: string | null;
  apk_url: string | null;
  build_log: string | null;
  gradle_version: string | null;
  node_version: string | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Store Metadata ──────────────────────────────────────────────────────────

export interface StoreMetadata {
  id: string;
  project_id: string;
  analysis_id: string | null;
  store: Store;
  language: string;
  title: string | null;
  short_description: string | null;
  full_description: string | null;
  whats_new: string | null;
  keywords: string | null;
  category: string | null;
  content_rating: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Screenshots ─────────────────────────────────────────────────────────────

export type DeviceType = "phone" | "tablet_7" | "tablet_10";

export interface Screenshot {
  id: string;
  project_id: string;
  store: Store;
  device_type: DeviceType;
  screen_name: string;
  file_path: string | null;
  file_url: string | null;
  order_index: number;
  approved_at: string | null;
  created_at: string;
}

// ─── Release Jobs ─────────────────────────────────────────────────────────────

export type ReleaseJobStatus =
  | "pending_approval"
  | "approved"
  | "submitting"
  | "submitted"
  | "failed";

export interface ReleaseJob {
  id: string;
  project_id: string;
  store: Store;
  track: ReleaseTrack;
  status: ReleaseJobStatus;
  build_artifact: string | null;
  google_edit_id: string | null;
  submission_result: Record<string, unknown> | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export type AuditAction =
  | "project_created"
  | "analyze_started"
  | "analyze_completed"
  | "analyze_failed"
  | "build_started"
  | "build_completed"
  | "build_failed"
  | "metadata_generated"
  | "metadata_approved"
  | "screenshots_captured"
  | "screenshots_approved"
  | "release_assembled"
  | "submission_approved"
  | "submission_started"
  | "submission_completed"
  | "submission_failed";

export interface AuditLog {
  id: string;
  project_id: string;
  action: AuditAction;
  actor: "system" | "user";
  payload: Record<string, unknown> | null;
  created_at: string;
}

// ─── Store Adapter ────────────────────────────────────────────────────────────

export interface StoreListing {
  title: string;
  short_description: string;
  full_description: string;
  whats_new: string;
}

export interface BuildArtifact {
  path: string;
  type: "apk" | "aab" | "ipa";
  version_name: string;
  version_code: string;
}

export interface ReleaseResult {
  success: boolean;
  edit_id?: string;
  release_id?: string;
  error?: string;
}

export interface StoreAdapter {
  validateCredentials(): Promise<boolean>;
  getExistingListing(packageId: string): Promise<StoreListing | null>;
  uploadScreenshots(screenshots: Screenshot[]): Promise<void>;
  updateListing(metadata: StoreMetadata): Promise<void>;
  createRelease(
    build: BuildArtifact,
    track: ReleaseTrack
  ): Promise<ReleaseResult>;
  commitRelease(editId: string): Promise<void>;
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface JobResponse {
  jobId: string;
  status: string;
}

// ─── UI Component Types ───────────────────────────────────────────────────────

export interface NavStep {
  id: string;
  label: string;
  href: string;
  status: "pending" | "in_progress" | "complete" | "error";
  description?: string;
}

export interface ReadinessBreakdown {
  total: number;
  passed: number;
  warnings: number;
  blockers: number;
  score: number;
}
