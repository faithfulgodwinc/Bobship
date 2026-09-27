---
name: bobship-build
description: >
  Build a signed Android App Bundle (AAB) from a React Native / Expo repository.
  Injects the developer's keystore credentials, runs the Gradle release build,
  and reports the output artifact path.
  Use this skill when the developer triggers a build from the Build page.
---

# BobShip — Android Build Skill

## Purpose
You are BobShip's Android Build Engineer. You orchestrate the Gradle release build of an Android app, inject signing credentials from the BobShip credential vault, and report the resulting AAB artifact.

## Trigger
This skill runs when:
- The developer clicks "Start Build" on the Build page
- `POST /api/projects/{projectId}/build` is called

## Prerequisites
Before running the build, verify:
1. The repository has been analyzed (`analysis.score` is not null)
2. An Android Keystore credential exists in the BobShip vault for this project
3. The repo has `android/` directory (native Android project present)
4. `android/app/build.gradle` contains a `signingConfigs` or we can inject one

## Inputs
```json
{
  "projectId": "...",
  "repoPath": "/tmp/bobship-{projectId}",
  "keystore": {
    "keystoreBase64": "...",
    "keystorePassword": "...",
    "keyAlias": "...",
    "keyPassword": "..."
  },
  "versionName": "1.0.0",
  "versionCode": 1
}
```

## Build steps

### Step 1 — Prepare signing
Write a `keystore.jks` file to a temporary path:
```bash
echo "$KEYSTORE_BASE64" | base64 -d > /tmp/keystore-{projectId}.jks
```

### Step 2 — Inject signing config
If `android/app/build.gradle` does not have a release signing config, inject:
```groovy
android {
  signingConfigs {
    release {
      storeFile file("/tmp/keystore-{projectId}.jks")
      storePassword "{keystorePassword}"
      keyAlias "{keyAlias}"
      keyPassword "{keyPassword}"
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
    }
  }
}
```

### Step 3 — Run Gradle build
```bash
cd {repoPath}/android
./gradlew bundleRelease \
  -Pandroid.injected.signing.store.file=/tmp/keystore-{projectId}.jks \
  -Pandroid.injected.signing.store.password={keystorePassword} \
  -Pandroid.injected.signing.key.alias={keyAlias} \
  -Pandroid.injected.signing.key.password={keyPassword} \
  --no-daemon
```

### Step 4 — Locate artifact
The AAB will be at one of:
- `android/app/build/outputs/bundle/release/app-release.aab`
- `android/app/build/outputs/bundle/release/{appName}-release.aab`

### Step 5 — Report result
Update the build record:
```json
{
  "status": "success",
  "artifact_path": "...",
  "artifact_size_bytes": 12345678,
  "build_duration_seconds": 180,
  "gradle_version": "8.x"
}
```

## Error handling

| Error | Likely cause | Action |
|-------|-------------|--------|
| `JAVA_HOME not set` | Java not installed | Report: install JDK 17+ |
| `Keystore was tampered` | Wrong password | Report: check keystore credentials |
| `SDK location not found` | Android SDK missing | Report: `local.properties` needs `sdk.dir` |
| `Could not resolve com.android.tools.build:gradle` | Network error | Retry or check proxy |
| Build exit code non-zero | Compilation error | Capture full Gradle output, surface to developer |

## Demo mode
If `DEMO_MODE=true`, skip the actual Gradle build and return:
```json
{
  "status": "success",
  "artifact_path": "demo/app-release.aab",
  "artifact_size_bytes": 28311552,
  "build_duration_seconds": 47,
  "demo": true
}
```

## Security
- Never log keystore passwords to stdout or to the database
- Write the keystore file to `/tmp` only and clean it up after the build
- The build log stored in the database must have passwords redacted
- Pattern to redact: `s/-Pandroid.injected.signing.(store|key).password=[^ ]*/\1=***REDACTED***/g`

## Post-build cleanup
```bash
rm -f /tmp/keystore-{projectId}.jks
```
