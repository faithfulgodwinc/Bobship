/**
 * GooglePlayAdapter — implements the StoreAdapter interface for Google Play.
 *
 * This wraps the googleapis androidpublisher v3 client behind a clean
 * interface so the rest of the codebase never imports googleapis directly.
 * The Apple App Store Connect adapter will follow the same interface.
 */

import { google } from "googleapis";

// ─── StoreAdapter interface ───────────────────────────────────────────────────

export interface StoreListingUpdate {
  language: string;
  title?: string;
  shortDescription?: string;
  fullDescription?: string;
  whatsNew?: string;
}

export interface StoreReleasePayload {
  track: "internal" | "alpha" | "beta" | "production";
  status: "draft" | "inProgress" | "halted" | "completed";
  versionCodes?: string[];
  releaseNotes?: { language: string; text: string }[];
}

export interface StoreSubmitResult {
  editId: string;
  packageName: string;
  listingUpdated: boolean;
  releaseCreated: boolean;
  committed: boolean;
  timestamp: string;
}

export interface StoreAdapter {
  /** Update the store listing text for a given language. */
  updateListing(
    packageName: string,
    listing: StoreListingUpdate
  ): Promise<void>;

  /** Create or update a release on a track (does NOT commit). */
  updateRelease(
    packageName: string,
    payload: StoreReleasePayload
  ): Promise<{ editId: string }>;

  /** Commit the open edit — IRREVERSIBLE. Call only after human approval. */
  commitEdit(packageName: string, editId: string): Promise<void>;

  /** Abort / delete an open edit (rollback on failure). */
  deleteEdit(packageName: string, editId: string): Promise<void>;

  /** Full flow: open edit → update listing → update release → commit. */
  submitRelease(
    packageName: string,
    listing: StoreListingUpdate | null,
    release: StoreReleasePayload | null
  ): Promise<StoreSubmitResult>;
}

// ─── GooglePlayAdapter ────────────────────────────────────────────────────────

export class GooglePlayAdapter implements StoreAdapter {
  private readonly androidpublisher;
  private readonly editIds: Map<string, string> = new Map();

  constructor(serviceAccountJson: Record<string, unknown>) {
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountJson as Record<string, string>,
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    this.androidpublisher = google.androidpublisher({ version: "v3", auth });
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private async openEdit(packageName: string): Promise<string> {
    const cached = this.editIds.get(packageName);
    if (cached) return cached;
    const res = await this.androidpublisher.edits.insert({ packageName });
    const editId = res.data.id!;
    this.editIds.set(packageName, editId);
    return editId;
  }

  private clearEdit(packageName: string) {
    this.editIds.delete(packageName);
  }

  // ── StoreAdapter implementation ─────────────────────────────────────────────

  async updateListing(
    packageName: string,
    listing: StoreListingUpdate
  ): Promise<void> {
    const editId = await this.openEdit(packageName);
    await this.androidpublisher.edits.listings.update({
      packageName,
      editId,
      language: listing.language,
      requestBody: {
        ...(listing.title !== undefined && { title: listing.title }),
        ...(listing.shortDescription !== undefined && {
          shortDescription: listing.shortDescription,
        }),
        ...(listing.fullDescription !== undefined && {
          fullDescription: listing.fullDescription,
        }),
      },
    });
  }

  async updateRelease(
    packageName: string,
    payload: StoreReleasePayload
  ): Promise<{ editId: string }> {
    const editId = await this.openEdit(packageName);
    const releaseNotes = payload.releaseNotes?.map((n) => ({
      language: n.language,
      text: n.text,
    }));
    await this.androidpublisher.edits.tracks.update({
      packageName,
      editId,
      track: payload.track,
      requestBody: {
        releases: [
          {
            status: payload.status,
            ...(payload.versionCodes?.length
              ? { versionCodes: payload.versionCodes }
              : {}),
            ...(releaseNotes?.length ? { releaseNotes } : {}),
          },
        ],
      },
    });
    return { editId };
  }

  async commitEdit(packageName: string, editId: string): Promise<void> {
    await this.androidpublisher.edits.commit({ packageName, editId });
    this.clearEdit(packageName);
  }

  async deleteEdit(packageName: string, editId: string): Promise<void> {
    try {
      await this.androidpublisher.edits.delete({ packageName, editId });
    } catch {
      // Best-effort — ignore if already gone
    }
    this.clearEdit(packageName);
  }

  async submitRelease(
    packageName: string,
    listing: StoreListingUpdate | null,
    release: StoreReleasePayload | null
  ): Promise<StoreSubmitResult> {
    const editId = await this.openEdit(packageName);
    let listingUpdated = false;
    let releaseCreated = false;

    try {
      if (listing) {
        await this.updateListing(packageName, listing);
        listingUpdated = true;
      }

      if (release) {
        await this.updateRelease(packageName, release);
        releaseCreated = true;
      }

      await this.commitEdit(packageName, editId);

      return {
        editId,
        packageName,
        listingUpdated,
        releaseCreated,
        committed: true,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      // Rollback — delete the open edit so Play Console isn't left with stale state
      await this.deleteEdit(packageName, editId);
      throw err;
    }
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/** Create a GooglePlayAdapter from a raw service-account JSON string or object. */
export function createGooglePlayAdapter(
  serviceAccountJson: string | Record<string, unknown>
): GooglePlayAdapter {
  const parsed =
    typeof serviceAccountJson === "string"
      ? (JSON.parse(serviceAccountJson) as Record<string, unknown>)
      : serviceAccountJson;
  return new GooglePlayAdapter(parsed);
}
