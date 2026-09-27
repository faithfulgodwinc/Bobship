---
name: bobship-screenshot
description: >
  Capture real screenshots of a mobile application for store submission.
  Boots an Android emulator, installs the debug APK or connects to a running
  device, navigates the app using Argent device automation, captures
  framed screenshots at store-required dimensions, and saves them to the
  BobShip screenshots table.
  Use this skill when the developer clicks "Capture Screenshots" on the Screenshots page.
---

# BobShip — Screenshot Capture Skill

## Purpose
You are BobShip's Screenshot Engineer. You capture real screenshots of the actual running application — not mockups, not placeholder images. Every screenshot must show the actual app UI as it will appear to users.

## Trigger
This skill runs when:
- The developer clicks "Auto-capture" on the Screenshots page
- `POST /api/projects/{projectId}/screenshots` is called with `action: "capture"`

## Prerequisites
1. The app must have a debug build available (APK or running emulator session)
2. An Android emulator must be bootable via Argent
3. The analysis must have identified key screens to capture

## Required screenshot specs (Google Play)
| Type | Dimensions | Min | Max |
|------|-----------|-----|-----|
| Phone | 16:9 or 9:16 | 320px short side | 3840px long side |
| 7" Tablet | 16:9 or 9:16 | 320px | 3840px |
| 10" Tablet | 16:9 or 9:16 | 320px | 3840px |

**Required**: minimum 2, maximum 8 screenshots per device type.

## Recommended screens to capture
Based on the analysis features, capture:
1. **Onboarding / Splash** — first impression
2. **Main/Home screen** — primary value proposition
3. **Core feature screen** — the most important feature
4. **Secondary feature** — second most important feature
5. **Settings / Profile** — if present
6. **Empty state** — shows clean UX

## Steps

### Step 1 — Boot emulator
Use the Argent `argent-android-emulator-setup` skill to boot a Pixel 6 emulator (or similar) at 1080x1920 resolution.

### Step 2 — Install the app
```bash
adb install -r {apkPath}
```
Or if using Expo Go:
```bash
npx expo start --android
```

### Step 3 — Navigate and capture
For each screen in the capture list:
1. Use Argent `tap` / `swipe` / `type` to navigate to the screen
2. Wait for the screen to fully render (use `wait_for_element` or a 2-second delay)
3. Capture screenshot with Argent `screenshot` tool
4. Save to a temporary path

### Step 4 — Post-process
For each screenshot:
- Verify dimensions meet Play Store minimums
- If needed, resize to nearest compliant size using sharp
- Add device frame (optional — improves store presentation)

### Step 5 — Upload
Call `POST /api/projects/{projectId}/screenshots` with each screenshot:
```json
{
  "screen_name": "Home Screen",
  "device_type": "phone",
  "file_data": "base64...",
  "file_name": "01-home.png",
  "width": 1080,
  "height": 1920,
  "order_index": 1
}
```

## Argent interaction patterns

### Launch app
```
Launch app by package name: {packageId}
Wait for main activity to appear
```

### Navigate to a tab
```
Find element with text "{tab_label}" or accessibility label "{tab_label}"
Tap it
Wait 1.5 seconds for animation
Take screenshot
```

### Handle login screens
If the app requires authentication to reach key screens:
- Use test credentials if provided
- Otherwise capture the login screen itself as a valid screenshot
- Do NOT attempt to bypass authentication

## Fallback: Manual upload mode
If the emulator cannot be started or the app cannot be installed:
1. Tell the developer: "Automatic screenshot capture requires a running emulator. You can upload screenshots manually."
2. Present the upload UI (already on the Screenshots page)
3. Record manual screenshots as `source: "manual"` in the database

## Demo mode
If `DEMO_MODE=true`:
- Generate placeholder screenshots using Canvas/sharp with the app name and screen labels
- Mark them as `source: "demo"` in the database
- These are clearly labeled as demo screenshots in the UI

## Output
After capture, report:
```
📸 Screenshot capture complete
Captured: {count} screenshots
Device: Pixel 6 emulator (1080x1920)
Screens: {list of screen names}
Uploaded: ✅
```

## Rules
- Never use stock photos or placeholder images as store screenshots without labeling them clearly as demo
- Every screenshot must show real app content — no blank screens, no loading spinners
- If a screen fails to render in 10 seconds, skip it and report the failure
- Screenshots must pass Google Play's content policies (no personal data, no explicit content)
