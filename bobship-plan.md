# BobShip — Hackathon Architecture & Implementation Plan

## Top-Level Overview

BobShip is an AI-powered autonomous mobile app release engineer.
A developer connects a GitHub repository and store credentials; BobShip analyzes
the application, generates every release asset, identifies compliance blockers,
and prepares/submits the store release — with explicit human approval before any
irreversible action.

**Scope:** 48-hour hackathon MVP targeting Google Play as the primary store,
with the architecture cleanly extensible to App Store Connect.

**Key constraint:** All agent intelligence runs inside IBM Bob 2.0 sessions via
MCP tools and Bob skills. The web application drives Bob rather than replacing it.

**Confirmed technical context:**
- Google Play service-account JSON key available
- App Store Connect API key available (future use)
- Target framework: React Native (any public React Native repo works)
- Build step: BobShip builds a signed release AAB from source (Gradle + keystore)
- Screenshots: Argent device automation on the freshly-built APK (real UI)
- Database: Supabase (hosted Postgres)
- GitHub: public repo by URL for demo; OAuth scaffolded for private repos
- Deployment: Vercel (serverless functions + ephemeral filesystem via /tmp)
- Design system: Apple-inspired (SF Pro typography, glassmorphism surfaces,
  neutral palette, generous whitespace, subtle blur layers, system-like iconography)

---

## 1. Product Thesis

BobShip is not "AI that fills App Store forms."
It is an **autonomous AI release engineer** that reads your codebase as the
source of truth, reasons about what your app actually does, generates every
artifact a store submission requires, and executes the submission workflow with
human approval gates on irreversible steps.

The repository is the source of truth. BobShip never invents features.

---

## 2. Target User

A mobile developer (solo or small team) who has finished building their app and
now faces the painful, time-consuming store submission process. They are
comfortable with GitHub and have a Google Play Developer account.

---

## 3. Core User Journey

```
1. Paste GitHub repository URL
2. BobShip clones and analyzes the repository
3. Release-readiness report displayed (score + blockers)
4. BobShip generates full store metadata (description, short desc, what's new, keywords)
5. Developer reviews / edits metadata inline
6. BobShip builds a signed release AAB from source (Gradle + keystore injection)
7. BobShip captures real screenshots via Argent device automation on the freshly built APK
8. Developer reviews screenshot set
9. BobShip assembles the Google Play submission package
10. Developer clicks "Approve & Submit" (explicit confirmation modal)
11. BobShip calls Google Play Developer API to create/update the release
```

---

## 4. MVP Scope

### MUST HAVE
- Repository import by URL (public GitHub)
- Full repository analysis targeting React Native apps (Bob agent reading source files via MCP tools)
- Release-readiness report with score and blockers list
- Store metadata generation (description, short desc, what's new, keywords)
- React Native build step: run Gradle to produce a signed release AAB (keystore from env vars)
- Real screenshot capture via Argent on simulator/emulator using the freshly built APK
- Google Play submission package assembly
- Human approval gate before submission
- Google Play Developer API integration (at minimum track/release creation)
- Supabase persistence for projects, analysis results, metadata, screenshots, build artifacts

### SHOULD HAVE
- GitHub OAuth for private repository access
- Metadata inline editing in the dashboard
- Multiple screenshot device profiles (phone, 7-inch tablet)
- Release history per project
- Partial resume (re-run only failed phases)
- Build log streaming to the dashboard UI

### NICE TO HAVE
- App Store Connect metadata generation (same pipeline, different adapter)
- Slack/webhook notification on submission complete
- Diff view showing what changed between releases
- Auto-detection of semver from git tags
- iOS build via `xcodebuild` archive + export

---

## 5. Feature Prioritization

Priority order (build in this sequence):
1. Repository analysis engine — React Native focused (Bob skill)
2. Release-readiness report (Bob skill + report UI)
3. Metadata generation (Bob skill)
4. Build step — Gradle AAB build with keystore injection (Bob skill)
5. Screenshot capture via Argent on freshly built APK (Bob skill)
6. Google Play submission (API integration)
7. Dashboard UI tying all phases together
8. Human approval gate
9. Supabase persistence

---

## 6. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Dashboard                        │
│  (React UI: project dashboard, report view, approval gates)     │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP / Server Actions
┌────────────────────────▼────────────────────────────────────────┐
│                     Next.js API Routes                          │
│  /api/projects  /api/analyze  /api/metadata  /api/screenshots   │
│  /api/release   /api/submit   /api/approve                      │
└──────┬──────────────────┬─────────────────────┬─────────────────┘
       │                  │                      │
┌──────▼──────┐  ┌────────▼────────┐  ┌─────────▼──────────────┐
│  Supabase   │  │  Bob Agent      │  │  Google Play           │
│  (Postgres) │  │  Orchestrator   │  │  Developer API         │
│             │  │  (MCP server)   │  │  (googleapis npm pkg)  │
│  projects   │  │                 │  │                        │
│  analyses   │  │  Bob Skills:    │  │  Tracks / Releases     │
│  metadata   │  │  - repo-analyze │  │  APK/AAB upload        │
│  screenshots│  │  - readiness    │  │  Store listings        │
│  releases   │  │  - metadata-gen │  │                        │
│  audit_logs │  │  - screenshot   │  └────────────────────────┘
└─────────────┘  │  - play-submit  │
                 │                 │
                 │  Argent MCP:    │
                 │  - device ctrl  │
                 │  - screenshots  │
                 └─────────────────┘
```

### Component Responsibilities

**Next.js Dashboard (frontend + API routes)**
- Deployed to Vercel (serverless functions, no persistent filesystem)
- Long-running operations (build, analyze, screenshots) use Vercel's 60-second max function timeout;
  heavy work is dispatched to background jobs or run locally via Bob sessions
- Ephemeral file I/O (clone, build output, screenshots) uses `/tmp` on Vercel; files are
  uploaded to Supabase Storage immediately and `/tmp` references discarded
- API routes are thin orchestrators — they trigger Bob sessions and persist results
- Never exposes secrets to the browser
- Server-side environment variables only for all credentials
- Design language: Apple-inspired — SF Pro (Inter as web fallback), neutral grays,
  glassmorphism card surfaces, generous whitespace, rounded-2xl corners, subtle blur layers,
  system-like iconography via Lucide React

**Bob Agent Orchestrator**
- Each analysis phase is a Bob skill
- Bob reads repository files via filesystem or git clone MCP tools
- Bob skills return structured JSON consumed by the API routes
- Bob's agentic loop handles file-by-file analysis, reasoning, and synthesis

**Supabase (Postgres)**
- Stores project state, analysis results, generated metadata, screenshot paths, release jobs, and audit logs
- Row-level security on all tables
- Service role key used server-side only

**Google Play Developer API**
- Node.js `googleapis` package
- Service account JSON stored as server-side env var (never in DB, never in browser)
- Operations: list tracks, create release, upload APK/AAB, update store listing

**Build Layer (new)**
- `bobship-build` Bob skill runs `./gradlew bundleRelease` inside the cloned repo
- Keystore file is reconstructed from base64-encoded env var at build time; deleted after signing
- Build output (`.aab` file) is uploaded to Supabase Storage; local `/tmp` copy is used for
  APK extraction (via `bundletool`) to install on emulator for screenshot capture
- React Native dependency install: `npm install` or `yarn install` before Gradle
- Node.js `child_process.execFile` wraps the Gradle invocation server-side

**Argent MCP**
- Used by the Bob screenshot skill
- Boots emulator, installs the debug/release APK extracted from the freshly built AAB
- Navigates to key screens via UI automation, captures screenshots
- Screenshots uploaded to Supabase Storage; URLs stored in `screenshots` table

---

## 7. Data Model

### Table: `projects`
```
id            uuid PK
name          text
repo_url      text
repo_branch   text  default 'main'
platform      text  ('android' | 'ios' | 'both')
framework     text  default 'react_native'
status        text  ('idle' | 'analyzing' | 'building' | 'ready' | 'submitting' | 'submitted')
created_at    timestamptz
updated_at    timestamptz
```

### Table: `builds`
```
id              uuid PK
project_id      uuid FK -> projects.id
status          text  ('pending' | 'running' | 'succeeded' | 'failed')
build_type      text  ('debug' | 'release')
artifact_url    text  -- Supabase Storage URL for AAB
apk_url         text  -- Supabase Storage URL for extracted APK (for emulator)
build_log       text  -- captured stdout/stderr
gradle_version  text
node_version    text
duration_ms     int
error_message   text
created_at      timestamptz
updated_at      timestamptz
```

### Table: `analyses`
```
id              uuid PK
project_id      uuid FK -> projects.id
app_name        text
package_id      text
framework       text
version_name    text
version_code    text
min_sdk         text
target_sdk      text
features        jsonb   -- array of detected features
permissions     jsonb   -- array of permissions
api_deps        jsonb   -- third-party APIs detected
privacy_flags   jsonb   -- privacy-relevant findings
existing_assets jsonb   -- existing icon/screenshot paths
readiness_score int     -- 0-100
blockers        jsonb   -- array of {severity, title, description, fix}
raw_report      text    -- full markdown report from Bob
created_at      timestamptz
```

### Table: `store_metadata`
```
id                uuid PK
project_id        uuid FK -> projects.id
analysis_id       uuid FK -> analyses.id
store             text  ('google_play' | 'app_store')
language          text  default 'en-US'
title             text
short_description text
full_description  text
whats_new         text
keywords          text
category          text
content_rating    text
approved_at       timestamptz  -- null until developer approves
created_at        timestamptz
updated_at        timestamptz
```

### Table: `screenshots`
```
id            uuid PK
project_id    uuid FK -> projects.id
store         text
device_type   text  ('phone' | 'tablet_7' | 'tablet_10')
screen_name   text
file_path     text
file_url      text
order_index   int
approved_at   timestamptz
created_at    timestamptz
```

### Table: `release_jobs`
```
id                uuid PK
project_id        uuid FK -> projects.id
store             text
track             text  ('internal' | 'alpha' | 'beta' | 'production')
status            text  ('pending_approval' | 'approved' | 'submitting' | 'submitted' | 'failed')
build_artifact    text  -- path to APK/AAB
google_edit_id    text  -- Google Play edit ID
submission_result jsonb
approved_at       timestamptz
approved_by       text
created_at        timestamptz
updated_at        timestamptz
```

### Table: `audit_logs`
```
id          uuid PK
project_id  uuid FK -> projects.id
action      text  -- e.g. 'analyze_started', 'metadata_generated', 'submission_approved'
actor       text  -- 'system' | 'user'
payload     jsonb
created_at  timestamptz
```

---

## 8. API Architecture

All routes live under `/api/` in the Next.js app (App Router API route handlers).

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/projects` | Create project from repo URL |
| GET | `/api/projects/[id]` | Get project with latest analysis |
| POST | `/api/projects/[id]/analyze` | Trigger Bob repo analysis skill |
| GET | `/api/projects/[id]/analysis` | Get latest analysis result |
| POST | `/api/projects/[id]/build` | Trigger Gradle AAB build |
| GET | `/api/projects/[id]/build` | Get latest build result + log |
| POST | `/api/projects/[id]/metadata` | Trigger Bob metadata-gen skill |
| PATCH | `/api/projects/[id]/metadata` | Save developer edits to metadata |
| POST | `/api/projects/[id]/screenshots` | Trigger Argent screenshot capture |
| GET | `/api/projects/[id]/screenshots` | List screenshots |
| POST | `/api/projects/[id]/release` | Assemble release package |
| POST | `/api/projects/[id]/approve` | Record developer approval |
| POST | `/api/projects/[id]/submit` | Execute Google Play submission |
| GET | `/api/projects/[id]/audit` | Get audit log |

### Job execution pattern
Long-running phases (analyze, build, screenshots, submit) follow an async job pattern:
1. API route starts the job, sets project status, returns `{ jobId }`
2. Client polls `/api/projects/[id]` for status updates (every 3 seconds via SWR)
3. When complete, result is in Supabase and returned in the next poll

### Vercel function timeout handling
- Analyze: runs inside a Bob session on the developer's local machine (Bob is local);
  the API route records the result when Bob pushes it back via a webhook or direct Supabase write
- Build: Gradle build takes 2–5 minutes; runs in a Bob agent session locally,
  result (AAB URL) is written to Supabase; UI polls for completion
- Screenshots: Argent runs locally inside Bob; same push-back pattern
- Submit: Google Play API calls are fast (< 5 seconds); runs directly in Vercel function

---

## 9. IBM Bob 2.0's Role in the System

Bob is the **intelligence layer** — not a helper, but the core engine.

### Bob Skills Created for BobShip

**`bobship-repo-analyze` skill**
- Receives: repo path (cloned locally), platform target
- React Native specific reads: `package.json`, `android/app/build.gradle`,
  `android/app/src/main/AndroidManifest.xml`, `ios/*/Info.plist`,
  `app.json` / `app.config.js` (Expo), `src/` or `app/` source tree
- Produces: structured JSON with all fields from the `analyses` table
- Bob's agentic loop walks the file tree, reads relevant files, and synthesizes findings
- React Native specific detection: navigation library, state management, push notifications,
  camera/location/biometric usage, in-app purchases, analytics SDKs
- Critically: Bob reports only what it finds — never invents features

**`bobship-build` skill (new)**
- Receives: cloned repo path, build type ('debug' | 'release'), keystore config
- Steps:
  1. Detect package manager (`npm` / `yarn` / `bun`) from lockfile
  2. Run `npm install` (or equivalent) to restore node_modules
  3. If Expo: run `npx expo prebuild --platform android` to generate native project
  4. Reconstruct keystore from base64 env var into `/tmp/keystore.jks`
  5. Inject signing config into `gradle.properties` or `local.properties`
  6. Run `./gradlew bundleRelease` (or `assembleRelease` for APK)
  7. Capture build log line by line, write progress to Supabase `builds` table
  8. Upload resulting `.aab` to Supabase Storage
  9. Extract universal APK using `bundletool` for emulator installation
  10. Delete keystore from `/tmp` immediately after signing
- Produces: `{ aabUrl, apkUrl, buildLog, durationMs }`

**`bobship-readiness` skill**
- Receives: analysis JSON
- Produces: readiness score (0-100) and blockers array
- Checks: icon sizes, store description presence, permission justifications,
  target SDK compliance, signing config, privacy policy indicator

**`bobship-metadata-gen` skill**
- Receives: analysis JSON (app features, permissions, tech stack)
- Produces: title, short description (80 chars), full description (4000 chars),
  what's new, keywords
- Grounded strictly in the analysis — no invented capabilities

**`bobship-screenshot` skill**
- Receives: APK URL (from build step), app package id, list of target screens
- Downloads APK from Supabase Storage to `/tmp/app.apk`
- Uses Argent MCP tools to: boot Android emulator, install APK, navigate to each screen,
  capture screenshot (real app UI — not a mockup)
- Screenshots are uploaded to Supabase Storage
- Produces: array of `{ screenName, storageUrl, deviceType }` objects

**`bobship-play-submit` skill**
- Receives: release job record (metadata, screenshots, build artifact, track)
- Uses Google Play Developer API via MCP or direct Node.js googleapis call
- Produces: submission result (edit ID, release status)

### Why This Demonstrates Bob 2.0 Agentic Capabilities
- Multi-file reasoning across a real codebase (not a single-prompt summarize)
- Tool-use chaining: filesystem reads → reasoning → structured output
- Device automation loop: boot → install → navigate → screenshot (Argent)
- Approval-gated action execution: Bob does not submit without a recorded approval
- Skills are reusable, composable, and independently testable

---

## 10. Google Play Integration Strategy

**Library:** `googleapis` npm package (official Google APIs Node.js client)
**Auth:** Service account JSON — loaded from environment variable, never stored in DB

### Operations Used
1. `androidpublisher.edits.insert` — create a new edit
2. `androidpublisher.edits.apks.upload` or `.bundles.upload` — upload build artifact
3. `androidpublisher.edits.listings.update` — set store listing text per locale
4. `androidpublisher.edits.tracks.update` — assign build to internal/alpha/beta/production track
5. `androidpublisher.edits.commit` — commit the edit (irreversible — approval gate before this)

### Approval Gate
The `edits.commit` call is the only irreversible action.
BobShip will:
1. Complete all edit operations up to commit
2. Display edit summary to developer
3. Require explicit button click + confirmation modal
4. Record approval in `release_jobs.approved_at` and `audit_logs`
5. Only then call `edits.commit`

### Screenshot Upload
`androidpublisher.edits.images.upload` called for each screenshot after approval.

---

## 11. Apple Integration Strategy (future, scaffolded now)

**Do not implement in 48 hours.** Scaffold the interface so it drops in cleanly.

The architecture uses a **store adapter pattern**:

```typescript
interface StoreAdapter {
  validateCredentials(): Promise<boolean>
  getExistingListing(packageId: string): Promise<StoreListing | null>
  uploadScreenshots(screenshots: Screenshot[]): Promise<void>
  updateListing(metadata: StoreMetadata): Promise<void>
  createRelease(build: BuildArtifact, track: ReleaseTrack): Promise<ReleaseResult>
  commitRelease(editId: string): Promise<void>
}

class GooglePlayAdapter implements StoreAdapter { ... }
class AppStoreAdapter implements StoreAdapter { ... }  // stub for now
```

The `bobship-metadata-gen` skill already outputs platform-neutral metadata.
App Store Connect API uses JWT auth (key ID + issuer ID + P8 key) — credentials
shape differs from Google but the adapter pattern hides this.

---

## 12. Screenshot Generation Strategy

**Primary method: Argent device automation on freshly built APK (real UI)**

Flow:
1. `bobship-build` skill completes — APK URL is in Supabase Storage
2. `bobship-screenshot` skill downloads APK, boots Android emulator via Argent
3. Argent installs the APK (`adb install /tmp/app.apk`)
4. Bob navigates to each target screen using Argent `device-interact` tool
5. Bob calls Argent `take-screenshot` at each screen
6. Screenshots are uploaded to Supabase Storage, URLs written to `screenshots` table

**React Native screen detection:**
Bob's analysis skill identifies likely navigable screens from the navigation config
(React Navigation, Expo Router). The screenshot skill receives this list and
navigates programmatically (deep links or sequential taps).

**Target screens (generic React Native app):**
- Splash / onboarding screen (first launch)
- Home / main screen (post-login or main tab)
- Primary feature screen (detected from nav config)
- Settings or profile screen

**Fallback if Argent automation is incomplete:**
- Bob skill produces a "screenshot capture manifest" — a JSON file listing
  each screen with deep link and navigation steps
- Developer captures screenshots manually or using `adb shell screencap`
- Screenshots are uploaded via the dashboard
- Rest of the pipeline (metadata approval, submission) proceeds identically

**Screenshot sizing:**
- Android phone: 1080×1920 (required minimum)
- Captured at emulator resolution, resized server-side with `sharp` npm package if needed
- Screenshots stored in Supabase Storage, served via signed URLs

---

## 13. Release-Readiness / Compliance Engine

The `bobship-readiness` skill checks the following categories:

### Critical Blockers (score impact: -20 each, must fix before submit)
- Missing app icon (all required sizes)
- No store description (< 80 chars)
- `debuggable true` in release build config
- `minSdkVersion` below Google Play minimum (currently 21)
- Missing privacy policy URL (if app requests dangerous permissions)

### Warnings (score impact: -10 each, should fix)
- `targetSdkVersion` below current year's Google requirement
- No `what's new` text
- Permissions declared but not explained in description
- No screenshots available yet

### Info (score impact: 0, informational)
- Third-party SDK list (for developer awareness)
- Detected analytics/tracking SDKs (privacy disclosure reminder)
- Minimum OS version coverage estimate

### Score Calculation
```
100
- (critical blockers × 20)
- (warnings × 10)
= readiness score (floor 0)
```

A score of 80+ is considered "ready to submit."

---

## 14. Security Model

### Credential Handling
| Secret | Storage | Access |
|--------|---------|--------|
| Google Play service account JSON | Environment variable (server only) | API routes only |
| Supabase service role key | Environment variable (server only) | API routes only |
| Supabase anon key | Environment variable, safe for browser | Read-only public data only |
| GitHub PAT (if private repos) | Supabase `secrets` table, encrypted at rest | Server-side only, never returned to client |
| App Store Connect key | Environment variable (server only) | Future use |
| Android keystore (base64) | Environment variable (server only) | Build skill only; reconstructed in /tmp, deleted after signing |
| Keystore password + key alias | Environment variables (server only) | Build skill only |

### Principles
- All credentials injected as environment variables, never hardcoded
- Next.js API routes run server-side — credentials never reach the browser
- Supabase row-level security enabled on all tables
- Service account scoped to a single Google Play app (least privilege)
- `NEXT_PUBLIC_` prefix never used for any secret
- GitHub OAuth access tokens stored encrypted, rotated on each session

### Audit Trail
Every consequential action (analyze triggered, metadata approved, screenshots captured,
submission approved, submission executed) is written to `audit_logs` with timestamp
and actor before the action executes.

---

## 15. 48-Hour Implementation Plan

### Phase 0 — Foundation (Hours 0–4)
**Goal:** Running Next.js app with Apple-inspired design, Supabase connected, basic project creation working.

- [ ] Initialize Next.js 14 app (App Router, TypeScript, Tailwind)
- [ ] Install and configure Shadcn/ui + design tokens (neutral palette, Inter/SF Pro,
      rounded-2xl, glassmorphism via `backdrop-blur`)
- [ ] Set up Supabase project, run migrations for all 7 tables (includes new `builds` table)
- [ ] Create `/api/projects` POST route (create project from URL)
- [ ] Create project list landing page (Apple-inspired card grid)
- [ ] Confirm Supabase reads/writes work end to end
- [ ] Set up environment variable structure (`.env.local`, `.env.example`)
- [ ] Configure Supabase Storage buckets: `builds`, `screenshots`

### Phase 1 — Repository Analysis (Hours 4–12)
**Goal:** Bob analyzes a real React Native repo and returns structured findings.

- [ ] Write `bobship-repo-analyze` Bob skill (React Native focused)
- [ ] Implement server-side git clone into `/tmp` (using `simple-git` npm package)
- [ ] Create `/api/projects/[id]/analyze` route
- [ ] Bob skill reads: `package.json`, `app.json`/`app.config.js`, `build.gradle`,
      `AndroidManifest.xml`, `Info.plist`, navigation config, source directory
- [ ] Persist analysis results to Supabase `analyses` table
- [ ] Write `bobship-readiness` Bob skill (React Native specific checks)
- [ ] Display readiness report in the dashboard (animated score ring + blockers list)

### Phase 2 — Metadata Generation (Hours 12–16)
**Goal:** Bob generates complete, grounded store metadata from the analysis.

- [ ] Write `bobship-metadata-gen` Bob skill
- [ ] Create `/api/projects/[id]/metadata` POST route
- [ ] Persist generated metadata to Supabase `store_metadata` table
- [ ] Build metadata review/edit UI (inline editing, character counters)
- [ ] PATCH route to save developer edits
- [ ] Character count validation (short desc ≤ 80, title ≤ 50, full desc ≤ 4000)

### Phase 3 — Build Step (Hours 16–24)
**Goal:** BobShip builds a real signed AAB from source code.

- [ ] Write `bobship-build` Bob skill
- [ ] Keystore reconstruction from base64 env var into `/tmp`
- [ ] `npm install` / `yarn install` → `./gradlew bundleRelease` pipeline
- [ ] Expo prebuild support (`npx expo prebuild --platform android`)
- [ ] Stream build log to Supabase `builds` table (line-by-line)
- [ ] Upload AAB to Supabase Storage `builds` bucket
- [ ] Extract APK using `bundletool` for emulator installation
- [ ] Create `/api/projects/[id]/build` route
- [ ] Build progress UI (live log tail, animated progress indicator)

### Phase 4 — Screenshot Capture (Hours 24–32)
**Goal:** Real screenshots captured from the freshly built app via Argent.

- [ ] Write `bobship-screenshot` Bob skill using Argent MCP tools
- [ ] Use APK URL from build step; download to `/tmp`, install via Argent
- [ ] Navigate to screens detected during analysis (React Navigation / Expo Router)
- [ ] Create `/api/projects/[id]/screenshots` POST route
- [ ] Upload screenshots to Supabase Storage `screenshots` bucket
- [ ] Persist screenshot records to Supabase
- [ ] Build screenshot review UI (grid with approve/reject, drag-to-reorder)

### Phase 5 — Google Play Integration (Hours 32–40)
**Goal:** BobShip submits a real release to Google Play.

- [ ] Set up `googleapis` client with service account auth
- [ ] Implement `StoreAdapter` interface + `GooglePlayAdapter` with all 5 operations
- [ ] Create `/api/projects/[id]/release` POST route (assemble package)
- [ ] Create `/api/projects/[id]/approve` POST route (record approval)
- [ ] Create `/api/projects/[id]/submit` POST route (execute submission + commit)
- [ ] Build approval gate UI (full summary view + confirmation modal with checklist)
- [ ] Persist release job to Supabase, write audit log entry on every action

### Phase 6 — Dashboard Polish & Demo Prep (Hours 40–46)
**Goal:** The full flow works end-to-end and looks stunning in the demo.

- [ ] Phase progress indicator (step nav with animated completion states)
- [ ] Real-time status polling via SWR (3-second intervals)
- [ ] Audit log timeline in project view
- [ ] Apple-inspired "before/after" moment — readiness score vs. submitted state
- [ ] Error states, loading skeletons, empty states for all phases
- [ ] Full end-to-end test with the demo React Native app
- [ ] Vercel deployment test (all env vars set, Storage URLs correct)

### Phase 7 — Buffer & Demo Rehearsal (Hours 46–48)
- [ ] Rehearse demo flow 3× end to end
- [ ] Prepare demo script (< 3 minutes)
- [ ] Document any known limitations clearly
- [ ] Optional: scaffold GitHub OAuth (if time permits)

---

## 16. Demo Strategy

### The 3-Minute Demo Script

**0:00–0:30 — The Problem (before)**
> "Every developer knows this moment: your app is done, but now you're facing
> a 3-day process of reading guidelines, writing descriptions, capturing screenshots,
> configuring the release... and hoping you didn't miss something."

**0:30–1:00 — Repository Import**
> "I paste the GitHub URL. BobShip clones the repository and Bob starts reading
> the actual source code."
- *Show Bob analysis running in real-time*
- *Show the readiness report with score and blockers appearing*

**1:00–1:30 — Metadata Generation**
> "Bob reads the code — the real code — and generates a complete store listing.
> Notice it mentions [specific feature] because it's actually in the app."
- *Show generated description referencing real app features*
- *Show developer editing a line inline*

**1:30–2:00 — Real Screenshots**
> "Now Bob boots an emulator, installs the app, and captures the actual UI.
> These are real screenshots, not mockups."
- *Show Argent automation (emulator boots, app opens, screenshots appear)*

**2:00–2:30 — Release Assembly & Approval**
> "BobShip assembles the complete Google Play submission package and shows me
> exactly what it's about to do. I click Approve."
- *Show the approval modal with clear list of actions*

**2:30–3:00 — Submission & The After**
> "And it's submitted. What was a multi-day manual process took 3 minutes.
> This is what an AI release engineer looks like."
- *Show Google Play Console with the new release in internal track*

### The Dramatic Before/After Moment
The readiness report page is the "before" — showing the raw blockers and gaps.
The approved release page is the "after" — everything resolved and submitted.
Use a visual diff between these two states in the UI.

---

## 17. Biggest Technical Risks

### Risk 1: Build step — Gradle on the developer's machine
**Problem:** The build runs inside a Bob session locally (not in Vercel). The
developer's machine needs Android SDK, Java, and correct ANDROID_HOME set.
**Mitigation:** `bobship-build` skill checks for required tools at startup and
emits a clear error if anything is missing. Document prerequisites explicitly.
For the demo, pre-validate the demo machine setup before the 48-hour window starts.

### Risk 2: Keystore management and signing
**Problem:** React Native release signing requires a keystore. Managing it
securely while making it accessible to the build skill is tricky.
**Mitigation:** Store keystore as base64 in an env var. The build skill
reconstructs it to `/tmp/keystore.jks`, uses it for signing, then deletes it.
This is the same pattern used by GitHub Actions and CI pipelines.

### Risk 3: Expo vs bare React Native
**Problem:** Many React Native apps use Expo managed workflow, which requires
`expo prebuild` before Gradle can run. Others are bare React Native.
**Mitigation:** The `bobship-build` skill auto-detects Expo via `app.json` /
`expo` key in `package.json` and runs `npx expo prebuild --platform android`
before the Gradle step.

### Risk 4: Bob skill execution latency
**Problem:** Multi-file repo analysis may be slow if Bob reads hundreds of files.
**Mitigation:** Focus Bob on specific high-signal files only. Cap at 20 files.
React Native apps have predictable structure — this is manageable.

### Risk 5: Argent screenshot automation reliability
**Problem:** Argent navigating to specific app screens requires the emulator
to be in a known state.
**Mitigation:** Pre-boot emulator before demo. Use deep links where available.
Manual fallback produces identical downstream results.

### Risk 6: Google Play API — app must already exist
**Problem:** The `androidpublisher` API requires the app to already have an
existing listing in Play Console. You cannot create a brand-new app via API.
**Mitigation:** Ensure the demo app exists in Play Console as a draft before
the hackathon. Document this as a known prerequisite.

### Risk 7: Bob skill structured output consistency
**Problem:** Bob may not always return perfectly structured JSON from skills.
**Mitigation:** Skills include explicit JSON schema instructions. API routes
validate output against a Zod schema before persisting to Supabase.

### Risk 8: Vercel cold starts on long-polling routes
**Problem:** SWR polling every 3 seconds against Vercel serverless functions
may cause unnecessary cold starts.
**Mitigation:** Status polling reads only from Supabase directly (using the
anon key on the client side) rather than going through an API route.

---

## 18. Fallback Plan

### If the build step fails or takes too long for the demo
- Pre-run the build before the demo and store the resulting AAB URL in Supabase
- Demo starts from the "build complete" state
- The build step UI is shown as already green — the emphasis is on what comes next
- The architecture and code for the build skill still exist and are demoed as-is

### If Google Play API submission fails
- BobShip still delivers full value through phases 1–4 (analysis, metadata, build, screenshots)
- Show the assembled submission package as a downloadable ZIP
- Demo the approval UI against the prepared package
- "One-click submit" is clearly there — the Google Play API issue is a configuration/timing problem

### If Argent screenshot automation is incomplete
- Bob skill produces a "screenshot capture manifest" — a JSON file listing
  each screen with deep link and navigation steps
- Developer captures screenshots manually or using `adb shell screencap`
- Screenshots are uploaded via the dashboard
- Rest of the pipeline (metadata approval, submission) proceeds identically

### If Bob skill analysis is too slow for live demo
- Pre-run the analysis of the demo app before the demo
- Demo starts from the results page (analysis already complete)
- Emphasize the output quality rather than the live execution speed

### If Expo prebuild generates unexpected native code issues
- Switch to a known bare React Native demo app instead of an Expo app
- The build skill supports both; just disable the prebuild step

---

## 19. Recommended Repository / File Structure

```
bobship/
├── README.md
├── .env.example
├── .env.local                          # gitignored
├── next.config.ts
├── tailwind.config.ts                  # Apple-inspired design tokens
├── tsconfig.json
├── package.json
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql      # All 7 tables
│
├── src/
│   ├── app/                            # Next.js App Router
│   │   ├── layout.tsx                  # Root layout with Apple-inspired font + theme
│   │   ├── page.tsx                    # Landing / project list
│   │   ├── projects/
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # Project dashboard (phase stepper)
│   │   │       ├── analysis/
│   │   │       │   └── page.tsx        # Readiness report + score ring
│   │   │       ├── metadata/
│   │   │       │   └── page.tsx        # Metadata review + inline edit
│   │   │       ├── build/
│   │   │       │   └── page.tsx        # Build progress + log tail
│   │   │       ├── screenshots/
│   │   │       │   └── page.tsx        # Screenshot review grid
│   │   │       └── release/
│   │   │           └── page.tsx        # Release assembly + approval
│   │   └── api/
│   │       └── projects/
│   │           ├── route.ts            # POST /api/projects
│   │           └── [id]/
│   │               ├── route.ts        # GET /api/projects/[id]
│   │               ├── analyze/route.ts
│   │               ├── build/route.ts  # NEW
│   │               ├── metadata/route.ts
│   │               ├── screenshots/route.ts
│   │               ├── release/route.ts
│   │               ├── approve/route.ts
│   │               ├── submit/route.ts
│   │               └── audit/route.ts
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               # Browser Supabase client
│   │   │   ├── server.ts               # Server Supabase client (service role)
│   │   │   └── types.ts                # Generated DB types
│   │   ├── github/
│   │   │   └── clone.ts                # simple-git clone to /tmp
│   │   ├── build/
│   │   │   ├── gradle.ts               # Gradle invocation + log streaming
│   │   │   ├── keystore.ts             # Base64 keystore reconstruction
│   │   │   └── bundletool.ts           # AAB → APK extraction
│   │   ├── google-play/
│   │   │   ├── adapter.ts              # GooglePlayAdapter implements StoreAdapter
│   │   │   └── auth.ts                 # Service account auth setup
│   │   ├── store-adapter/
│   │   │   └── types.ts                # StoreAdapter interface + shared types
│   │   ├── bob/
│   │   │   └── runner.ts               # Bob skill invocation wrapper
│   │   └── validation/
│   │       └── schemas.ts              # Zod schemas for all Bob skill outputs
│   │
│   ├── components/
│   │   ├── ui/                         # Shadcn/ui base components
│   │   ├── design/
│   │   │   ├── GlassCard.tsx           # Glassmorphism card (backdrop-blur)
│   │   │   ├── ScoreRing.tsx           # Animated SVG score ring
│   │   │   └── PhaseStep.tsx           # Step nav item with status
│   │   ├── project/
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── AnalysisReport.tsx
│   │   │   ├── ReadinessScore.tsx
│   │   │   ├── BlockersList.tsx
│   │   │   ├── BuildLog.tsx            # NEW — live scrolling build log
│   │   │   ├── MetadataEditor.tsx
│   │   │   ├── ScreenshotGrid.tsx
│   │   │   └── ApprovalModal.tsx
│   │   └── layout/
│   │       ├── Header.tsx
│   │       └── StepNav.tsx             # Phase progress indicator
│   │
│   └── types/
│       └── index.ts                    # Shared TypeScript types
│
└── .bob/
    └── skills/
        ├── bobship-repo-analyze/
        │   └── SKILL.md
        ├── bobship-readiness/
        │   └── SKILL.md
        ├── bobship-metadata-gen/
        │   └── SKILL.md
        ├── bobship-build/              # NEW
        │   └── SKILL.md
        ├── bobship-screenshot/
        │   └── SKILL.md
        └── bobship-play-submit/
            └── SKILL.md
```

---

## 20. Exact First Implementation Task

**Task:** Initialize the Next.js project with Apple-inspired design system,
Supabase connected, and initial database migration applied.

Steps:
1. `npx create-next-app@latest bobship --typescript --tailwind --app --src-dir --import-alias "@/*"`
2. Install core dependencies:
   ```
   npm install @supabase/supabase-js simple-git googleapis zod sharp
   npm install @radix-ui/react-dialog @radix-ui/react-progress lucide-react
   npx shadcn@latest init
   ```
3. Configure Tailwind with Apple-inspired design tokens:
   - Font: `Inter` (Google Fonts) as SF Pro web fallback
   - Palette: zinc neutrals, white surfaces, system blue accent (`#007AFF`)
   - Radius: `rounded-2xl` as default card radius
   - Add `backdrop-blur` utility for glassmorphism cards
4. Create `.env.example` with all required variable names (no values), including:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`
5. Set up `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts`
6. Write `supabase/migrations/001_initial_schema.sql` with all 7 tables
   (projects, analyses, builds, store_metadata, screenshots, release_jobs, audit_logs)
7. Run migration against the Supabase project
8. Create Supabase Storage buckets: `builds` (private), `screenshots` (public)
9. Create `POST /api/projects` route that accepts `{ repoUrl, platform }`,
   inserts into `projects` table, returns the created project
10. Create the project list page with Apple-inspired card grid
11. Verify end-to-end: create a project via the UI, see it appear in Supabase

This confirms the entire data path and design system work before any Bob intelligence is added.

---

## BUILD ORDER

This is the sequence in which to implement BobShip:

```
1.  Next.js app init + Tailwind (Apple design tokens) + Shadcn/ui setup
2.  Supabase schema migration (all 7 tables) + Storage buckets (builds, screenshots)
3.  Supabase server/client helpers + type generation
4.  Environment variable structure (.env.example, all secrets documented)
5.  POST /api/projects route + Apple-inspired project list UI
6.  simple-git clone logic (server-side repo cloning to /tmp)
7.  bobship-repo-analyze Bob skill (React Native focused, outputs analysis JSON)
8.  POST /api/projects/[id]/analyze route (triggers skill, persists to analyses table)
9.  bobship-readiness Bob skill (scores analysis, React Native specific checks)
10. Analysis report UI (animated score ring + glassmorphism blockers list)
11. bobship-metadata-gen Bob skill (generates all store metadata from analysis)
12. POST /api/projects/[id]/metadata route + metadata review/edit UI (char counters)
13. bobship-build Bob skill (Expo detect → npm install → Gradle AAB → keystore sign → AAB upload)
14. POST /api/projects/[id]/build route + live build log UI (streaming log tail)
15. bobship-screenshot Bob skill (Argent: download APK → boot emulator → install → capture)
16. POST /api/projects/[id]/screenshots route + screenshot review grid
17. StoreAdapter interface + GooglePlayAdapter (all 5 Play API operations)
18. Release assembly + approval modal UI (checklist confirmation)
19. POST /api/projects/[id]/submit route with audit logging + edits.commit
20. Full end-to-end flow test with demo React Native app
21. Vercel deployment test (env vars, Storage signed URLs, cold start behavior)
22. Dashboard polish: phase stepper, audit log timeline, before/after moment, demo rehearsal
```

Status: [ ] pending implementation
