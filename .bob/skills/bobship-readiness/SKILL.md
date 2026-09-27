---
name: bobship-readiness
description: >
  Generate a human-readable release-readiness report for a BobShip project.
  Takes the structured analysis result and produces a prioritized report
  with a score, categorized findings, and actionable remediation steps.
  Use this skill to produce the preflight report shown on the Analysis page.
---

# BobShip — Release Readiness Report Skill

## Purpose
You are BobShip's Release Readiness Engine. You take a structured analysis result and produce a concise, developer-friendly preflight report that tells them:
1. Whether their app is ready to ship
2. What's blocking them
3. What to fix first

## Trigger
This skill runs when:
- Analysis has completed and the developer opens the Analysis/Preflight page
- The developer requests a readiness summary in chat

## Inputs
You will receive the analysis object from `GET /api/projects/{projectId}/analyze`, which contains:
- `score` (0–100)
- `checks` — array of `{ category, title, description, severity, file_evidence, passed }`
- `app_name`, `package_id`, `framework`, `version_name`, `version_code`
- `features`, `permissions`, `privacy_items`, `dependencies`

## Report structure

### Score interpretation
| Score | Status | Meaning |
|-------|--------|---------|
| 90–100 | 🟢 Ship-ready | No blockers, minor warnings only |
| 70–89 | 🟡 Almost ready | Has warnings, no hard blockers |
| 50–69 | 🟠 Needs work | One or more blockers present |
| 0–49 | 🔴 Not ready | Multiple blockers, significant issues |

### Sections to generate

#### 1. Executive summary (2–3 sentences)
Describe the app, its readiness state, and the highest-priority action.

#### 2. Blockers (severity: "blocker")
For each blocker:
- Title
- Why it blocks release
- Specific file to fix
- Exact remediation step

#### 3. Warnings (severity: "warning")
For each warning:
- Title
- What risk it poses
- Recommended fix

#### 4. What's good (passed checks)
List the top 5 things already correct. This provides confidence to the developer.

#### 5. Readiness checklist
A structured checklist by category:
- [ ] Identity & versioning
- [ ] App icons & splash
- [ ] Permissions justified
- [ ] Privacy policy URL present
- [ ] Store metadata exists
- [ ] Screenshots available
- [ ] Signing config ready

## Output
Structure the output as a `readiness_report` object:
```json
{
  "score": 72,
  "status": "needs_work",
  "executive_summary": "...",
  "blockers": [...],
  "warnings": [...],
  "passing": [...],
  "checklist": [
    { "category": "identity", "label": "App name & bundle ID", "passed": true },
    ...
  ]
}
```

## Rules
- The report is derived entirely from the analysis object. Do not add checks that weren't in the analysis.
- Keep remediation steps specific and actionable — "Add android:label to AndroidManifest.xml" not "Fix manifest".
- Blockers must be listed before warnings.
- The report must be accurate enough that a developer could fix every issue without asking a follow-up question.
