/**
 * BobShip Repository Analyzer
 *
 * Analyzes a React Native (or Expo) repository to extract structured
 * release-relevant information. All findings are grounded in actual file
 * evidence — nothing is invented.
 */

import * as fs from "fs";
import * as path from "path";
import {
  Analysis,
  AnalysisCheck,
  DetectedFeature,
  DetectedPermission,
  DetectedScreen,
  Framework,
} from "@/types";
import { readFileSafe, findFiles, relativePath } from "@/lib/github/clone";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AnalysisInput {
  repoPath: string;
  projectId: string;
  platform?: "android" | "ios" | "both";
}

export interface AnalysisOutput
  extends Omit<Analysis, "id" | "project_id" | "created_at"> {
  project_id?: string;
}

// ─── Main Analysis Function ───────────────────────────────────────────────────

export async function analyzeRepository(
  input: AnalysisInput
): Promise<AnalysisOutput> {
  const { repoPath, projectId } = input;
  const checks: AnalysisCheck[] = [];
  const features: DetectedFeature[] = [];
  const permissions: DetectedPermission[] = [];
  const apiDeps: string[] = [];
  const privacyFlags: string[] = [];
  const navigationScreens: DetectedScreen[] = [];
  const existingAssets: Record<string, string> = {};

  let appName: string | null = null;
  let packageId: string | null = null;
  let framework: Framework = "react_native";
  let versionName: string | null = null;
  let versionCode: string | null = null;
  let minSdk: string | null = null;
  let targetSdk: string | null = null;

  // ─── 1. package.json ──────────────────────────────────────────────────────

  const packageJsonPath = path.join(repoPath, "package.json");
  const packageJsonRaw = readFileSafe(packageJsonPath);
  let packageJson: Record<string, unknown> = {};

  if (packageJsonRaw) {
    try {
      packageJson = JSON.parse(packageJsonRaw);

      const deps = {
        ...(packageJson.dependencies as Record<string, string> || {}),
        ...(packageJson.devDependencies as Record<string, string> || {}),
      };

      // Detect framework
      if (deps["expo"] || (packageJson.expo as unknown)) {
        framework = "expo";
      } else if (deps["react-native"]) {
        framework = "react_native";
      }

      // App name from package.json
      if (typeof packageJson.name === "string") {
        appName = packageJson.name;
      }

      // Version from package.json
      if (typeof packageJson.version === "string") {
        versionName = packageJson.version;
      }

      // Detect navigation
      if (deps["@react-navigation/native"]) {
        features.push({
          name: "React Navigation",
          description: "App uses React Navigation for screen routing",
          evidence: relativePath(repoPath, packageJsonPath),
        });
      }
      if (deps["expo-router"]) {
        features.push({
          name: "Expo Router",
          description: "App uses Expo Router (file-based navigation)",
          evidence: relativePath(repoPath, packageJsonPath),
        });
        framework = "expo";
      }

      // Detect auth
      if (deps["@react-native-firebase/auth"] || deps["firebase"]) {
        features.push({
          name: "Firebase Authentication",
          description: "App uses Firebase for user authentication",
          evidence: relativePath(repoPath, packageJsonPath),
        });
        privacyFlags.push("Authentication data collected (Firebase Auth)");
        apiDeps.push("Firebase");
      }
      if (deps["@supabase/supabase-js"]) {
        features.push({
          name: "Supabase Auth/Database",
          description: "App uses Supabase for backend services",
          evidence: relativePath(repoPath, packageJsonPath),
        });
        apiDeps.push("Supabase");
      }
      if (deps["@react-native-google-signin/google-signin"] || deps["expo-auth-session"]) {
        features.push({
          name: "Social Authentication",
          description: "App supports social sign-in (Google/OAuth)",
          evidence: relativePath(repoPath, packageJsonPath),
        });
        privacyFlags.push("Social authentication provider integration");
      }

      // Detect analytics
      if (deps["@segment/analytics-react-native"] || deps["analytics"]) {
        features.push({
          name: "Analytics (Segment)",
          description: "App collects usage analytics via Segment",
          evidence: relativePath(repoPath, packageJsonPath),
        });
        privacyFlags.push("User analytics and event tracking (Segment)");
        apiDeps.push("Segment Analytics");
      }
      if (deps["@react-native-firebase/analytics"] || deps["firebase"]) {
        privacyFlags.push("Usage analytics collected (Firebase Analytics)");
        apiDeps.push("Firebase Analytics");
      }
      if (deps["posthog-react-native"] || deps["posthog-js"]) {
        features.push({
          name: "Analytics (PostHog)",
          description: "App uses PostHog for product analytics",
          evidence: relativePath(repoPath, packageJsonPath),
        });
        privacyFlags.push("User analytics collected (PostHog)");
        apiDeps.push("PostHog");
      }

      // Detect payments
      if (deps["react-native-iap"] || deps["expo-in-app-purchases"]) {
        features.push({
          name: "In-App Purchases",
          description: "App offers in-app purchases or subscriptions",
          evidence: relativePath(repoPath, packageJsonPath),
        });
        privacyFlags.push("Financial transactions via in-app purchases");
      }
      if (deps["@stripe/stripe-react-native"]) {
        features.push({
          name: "Stripe Payments",
          description: "App processes payments via Stripe",
          evidence: relativePath(repoPath, packageJsonPath),
        });
        privacyFlags.push("Financial data (Stripe payment processing)");
        apiDeps.push("Stripe");
      }

      // Detect maps/location
      if (deps["react-native-maps"] || deps["expo-location"]) {
        features.push({
          name: "Maps / Location",
          description: "App uses device location or maps",
          evidence: relativePath(repoPath, packageJsonPath),
        });
        privacyFlags.push("Precise location data accessed");
      }

      // Detect camera
      if (deps["react-native-camera"] || deps["expo-camera"] || deps["react-native-vision-camera"]) {
        features.push({
          name: "Camera",
          description: "App accesses the device camera",
          evidence: relativePath(repoPath, packageJsonPath),
        });
        privacyFlags.push("Camera access required");
      }

      // Detect push notifications
      if (
        deps["@react-native-firebase/messaging"] ||
        deps["expo-notifications"] ||
        deps["react-native-push-notification"]
      ) {
        features.push({
          name: "Push Notifications",
          description: "App sends push notifications to users",
          evidence: relativePath(repoPath, packageJsonPath),
        });
      }

      // Detect state management
      if (deps["@reduxjs/toolkit"] || deps["redux"]) {
        features.push({
          name: "Redux State Management",
          description: "App uses Redux for state management",
          evidence: relativePath(repoPath, packageJsonPath),
        });
      }
      if (deps["zustand"]) {
        features.push({
          name: "Zustand State Management",
          description: "App uses Zustand for state management",
          evidence: relativePath(repoPath, packageJsonPath),
        });
      }

      // Detect UI libraries
      if (deps["@shopify/restyle"] || deps["native-base"] || deps["@ui-kitten/components"]) {
        const uiLib = deps["@shopify/restyle"] ? "Restyle" : deps["native-base"] ? "NativeBase" : "UI Kitten";
        features.push({
          name: `${uiLib} UI`,
          description: `App uses ${uiLib} component library`,
          evidence: relativePath(repoPath, packageJsonPath),
        });
      }

      // Detect Sentry
      if (deps["@sentry/react-native"] || deps["sentry-expo"]) {
        features.push({
          name: "Crash Reporting (Sentry)",
          description: "App uses Sentry for crash reporting and error monitoring",
          evidence: relativePath(repoPath, packageJsonPath),
        });
        apiDeps.push("Sentry");
      }

    } catch {
      checks.push({
        id: "package-json-parse",
        category: "Build Configuration",
        title: "Could not parse package.json",
        severity: "warning",
        description: "package.json exists but could not be parsed",
        evidence: "package.json",
      });
    }
  } else {
    checks.push({
      id: "package-json-missing",
      category: "Build Configuration",
      title: "No package.json found",
      severity: "blocker",
      description: "This does not appear to be a Node.js/React Native project",
      recommended_action: "Ensure the repository contains a package.json at the root",
    });
  }

  // ─── 2. app.json / app.config.js (Expo) ──────────────────────────────────

  const appJsonPath = path.join(repoPath, "app.json");
  const appJsonRaw = readFileSafe(appJsonPath);

  if (appJsonRaw) {
    try {
      const appJson = JSON.parse(appJsonRaw);
      const expoConfig = appJson.expo || appJson;

      if (expoConfig.name) appName = expoConfig.name;
      if (expoConfig.version) versionName = expoConfig.version;

      if (expoConfig.android?.package) {
        packageId = expoConfig.android.package;
      }
      if (expoConfig.ios?.bundleIdentifier && !packageId) {
        packageId = expoConfig.ios.bundleIdentifier;
      }

      // Expo assets
      if (expoConfig.icon) {
        existingAssets["icon"] = expoConfig.icon;
        checks.push({
          id: "app-icon-expo",
          category: "App Identity",
          title: "App icon defined",
          severity: "pass",
          description: `App icon found at ${expoConfig.icon}`,
          evidence: relativePath(repoPath, appJsonPath),
        });
      }

      if (expoConfig.splash?.image) {
        existingAssets["splash"] = expoConfig.splash.image;
      }

      // Expo permissions
      if (expoConfig.android?.permissions) {
        for (const perm of expoConfig.android.permissions) {
          permissions.push({
            name: perm,
            platform: "android",
            is_dangerous: isDangerousPermission(perm),
          });
        }
      }

    } catch {
      // app.json exists but malformed
    }
  }

  // ─── 3. android/app/build.gradle ─────────────────────────────────────────

  const buildGradlePaths = findFiles(repoPath, ["build.gradle"]);
  const appBuildGradle = buildGradlePaths.find(
    (p) => p.includes(path.join("android", "app"))
  );

  if (appBuildGradle) {
    const content = readFileSafe(appBuildGradle);
    if (content) {
      // Extract applicationId / packageId
      const appIdMatch = content.match(/applicationId\s+["']([^"']+)["']/);
      if (appIdMatch && !packageId) {
        packageId = appIdMatch[1];
      }

      // Extract version info
      const versionNameMatch = content.match(/versionName\s+["']([^"']+)["']/);
      if (versionNameMatch && !versionName) {
        versionName = versionNameMatch[1];
      }
      const versionCodeMatch = content.match(/versionCode\s+(\d+)/);
      if (versionCodeMatch) {
        versionCode = versionCodeMatch[1];
      }

      // Extract SDK versions
      const minSdkMatch = content.match(/minSdkVersion\s+(\d+)/);
      if (minSdkMatch) {
        minSdk = minSdkMatch[1];
        const minSdkNum = parseInt(minSdkMatch[1]);
        if (minSdkNum < 21) {
          checks.push({
            id: "min-sdk-too-low",
            category: "Build Configuration",
            title: `minSdkVersion ${minSdkMatch[1]} is below Google Play minimum`,
            severity: "blocker",
            description:
              "Google Play requires minSdkVersion 21 or higher since 2023.",
            evidence: relativePath(repoPath, appBuildGradle),
            recommended_action: "Set minSdkVersion to at least 21 in build.gradle",
          });
        } else {
          checks.push({
            id: "min-sdk-ok",
            category: "Build Configuration",
            title: `minSdkVersion ${minSdkMatch[1]} meets Play requirement`,
            severity: "pass",
            description: "Minimum SDK version meets Google Play requirements",
            evidence: relativePath(repoPath, appBuildGradle),
          });
        }
      }

      const targetSdkMatch = content.match(/targetSdkVersion\s+(\d+)/);
      if (targetSdkMatch) {
        targetSdk = targetSdkMatch[1];
        const targetNum = parseInt(targetSdkMatch[1]);
        const currentYear = new Date().getFullYear();
        // Google Play requires targetSdkVersion >= API 33 (Android 13) as of 2024
        if (targetNum < 33) {
          checks.push({
            id: "target-sdk-outdated",
            category: "Build Configuration",
            title: `targetSdkVersion ${targetSdkMatch[1]} may be outdated`,
            severity: "warning",
            description:
              "Google Play requires apps to target at least Android 13 (API 33) for new submissions.",
            evidence: relativePath(repoPath, appBuildGradle),
            recommended_action: "Update targetSdkVersion to 34 or higher",
          });
        } else {
          checks.push({
            id: "target-sdk-ok",
            category: "Build Configuration",
            title: `targetSdkVersion ${targetSdkMatch[1]} is current`,
            severity: "pass",
            description: "Target SDK version meets current Play Store requirements",
            evidence: relativePath(repoPath, appBuildGradle),
          });
        }
      }

      // Check for debuggable in release
      if (content.includes("debuggable true")) {
        checks.push({
          id: "debuggable-release",
          category: "Build Configuration",
          title: "debuggable true found in build config",
          severity: "blocker",
          description:
            "Release builds must not be debuggable. This is a security risk and will be rejected by Google Play.",
          evidence: relativePath(repoPath, appBuildGradle),
          recommended_action: 'Remove "debuggable true" from the release build config',
        });
      }

      // Check for signing config
      const hasSigningConfig =
        content.includes("signingConfig") ||
        content.includes("storeFile") ||
        content.includes("keyAlias");
      if (hasSigningConfig) {
        checks.push({
          id: "signing-config-present",
          category: "Build Configuration",
          title: "Signing configuration detected",
          severity: "pass",
          description: "Build file contains signing configuration",
          evidence: relativePath(repoPath, appBuildGradle),
        });
      } else {
        checks.push({
          id: "signing-config-missing",
          category: "Build Configuration",
          title: "No signing configuration in build.gradle",
          severity: "warning",
          description:
            "A signing keystore is required for Google Play submission. BobShip will inject signing configuration during the build step.",
          evidence: relativePath(repoPath, appBuildGradle),
          recommended_action:
            "Configure signing in build.gradle or provide keystore via BobShip environment variables",
        });
      }
    }
  } else {
    // No android directory — could be Expo managed
    if (framework === "expo" || framework === "react_native") {
      checks.push({
        id: "android-project-missing",
        category: "Build Configuration",
        title: "No Android native project found",
        severity: "warning",
        description:
          "No android/ directory detected. If using Expo managed workflow, BobShip will run expo prebuild before building.",
        recommended_action:
          'Run "npx expo prebuild --platform android" or commit the android/ directory',
      });
    }
  }

  // ─── 4. AndroidManifest.xml ───────────────────────────────────────────────

  const manifestPaths = findFiles(repoPath, ["AndroidManifest.xml"]);
  const mainManifest = manifestPaths.find(
    (p) => p.includes("main") && !p.includes("debug") && !p.includes("release")
  ) || manifestPaths[0];

  if (mainManifest) {
    const content = readFileSafe(mainManifest);
    if (content) {
      // Extract package name if not already found
      if (!packageId) {
        const pkgMatch = content.match(/package="([^"]+)"/);
        if (pkgMatch) packageId = pkgMatch[1];
      }

      // Extract permissions
      const permissionMatches = Array.from(
        content.matchAll(/uses-permission.*?android:name="([^"]+)"/g)
      );
      for (const match of permissionMatches) {
        const perm = match[1];
        const shortName = perm.replace("android.permission.", "");
        if (!permissions.find((p) => p.name === perm)) {
          permissions.push({
            name: perm,
            platform: "android",
            is_dangerous: isDangerousPermission(perm),
          });

          // Add feature for dangerous permissions
          if (isDangerousPermission(perm)) {
            const featureName = permissionToFeature(perm);
            if (featureName && !features.find((f) => f.name === featureName)) {
              features.push({
                name: featureName,
                description: `App requests ${shortName} permission`,
                evidence: relativePath(repoPath, mainManifest),
              });
            }
          }
        }
      }

      // Detect INTERNET permission
      if (content.includes("android.permission.INTERNET")) {
        apiDeps.push("Network / Internet access");
      }

      // Check for backup flag
      if (content.includes('android:allowBackup="false"')) {
        checks.push({
          id: "backup-disabled",
          category: "Privacy",
          title: "Auto-backup disabled",
          severity: "info",
          description: "App has disabled Android auto-backup",
          evidence: relativePath(repoPath, mainManifest),
        });
      }
    }
  }

  // ─── 5. ios/Info.plist ───────────────────────────────────────────────────

  const infoPlistPaths = findFiles(repoPath, ["Info.plist"]);
  const mainInfoPlist = infoPlistPaths.find(
    (p) => !p.includes("test") && !p.includes("Test")
  );

  if (mainInfoPlist) {
    const content = readFileSafe(mainInfoPlist);
    if (content) {
      // Extract bundle ID
      const bundleIdMatch = content.match(
        /<key>CFBundleIdentifier<\/key>\s*<string>([^<]+)<\/string>/
      );
      if (bundleIdMatch && !packageId) {
        packageId = bundleIdMatch[1];
      }

      // Extract version
      const versionMatch = content.match(
        /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/
      );
      if (versionMatch && !versionName) {
        versionName = versionMatch[1];
      }

      // iOS permissions
      const iosPermissions = [
        { key: "NSCameraUsageDescription", name: "NSCameraUsageDescription", feature: "Camera" },
        { key: "NSLocationWhenInUseUsageDescription", name: "NSLocationWhenInUseUsageDescription", feature: "Location" },
        { key: "NSMicrophoneUsageDescription", name: "NSMicrophoneUsageDescription", feature: "Microphone" },
        { key: "NSPhotoLibraryUsageDescription", name: "NSPhotoLibraryUsageDescription", feature: "Photo Library" },
        { key: "NSContactsUsageDescription", name: "NSContactsUsageDescription", feature: "Contacts" },
        { key: "NSFaceIDUsageDescription", name: "NSFaceIDUsageDescription", feature: "Face ID / Biometrics" },
        { key: "NSHealthShareUsageDescription", name: "NSHealthShareUsageDescription", feature: "HealthKit" },
      ];

      for (const iosPerm of iosPermissions) {
        if (content.includes(iosPerm.key)) {
          if (!permissions.find((p) => p.name === iosPerm.name)) {
            permissions.push({
              name: iosPerm.name,
              platform: "ios",
              is_dangerous: true,
            });
          }
          if (!features.find((f) => f.name === iosPerm.feature)) {
            features.push({
              name: iosPerm.feature,
              description: `App requests ${iosPerm.feature} access`,
              evidence: relativePath(repoPath, mainInfoPlist),
            });
          }
        }
      }
    }
  }

  // ─── 6. Source File Analysis ──────────────────────────────────────────────

  const sourceFiles = findSourceFiles(repoPath);
  analyzeSourceFiles(sourceFiles, repoPath, features, privacyFlags, navigationScreens, checks);

  // ─── 7. Existing Assets ───────────────────────────────────────────────────

  detectExistingAssets(repoPath, existingAssets, checks);

  // ─── 8. App Name Final Resolution ────────────────────────────────────────

  if (!appName && packageJson.name) {
    appName = String(packageJson.name);
  }

  // Run final preflight checks
  runPreflightChecks({
    appName,
    packageId,
    versionName,
    permissions,
    privacyFlags,
    existingAssets,
    checks,
  });

  // ─── 9. Compute Readiness Score ───────────────────────────────────────────

  const blockers = checks.filter((c) => c.severity === "blocker").length;
  const warnings = checks.filter((c) => c.severity === "warning").length;
  const readinessScore = Math.max(0, 100 - blockers * 20 - warnings * 10);

  // ─── 10. Build Report Summary ─────────────────────────────────────────────

  const rawReport = buildReport({
    appName,
    packageId,
    framework,
    versionName,
    versionCode,
    features,
    permissions,
    apiDeps,
    privacyFlags,
    checks,
    readinessScore,
  });

  return {
    project_id: projectId,
    app_name: appName,
    package_id: packageId,
    framework,
    version_name: versionName,
    version_code: versionCode,
    min_sdk: minSdk,
    target_sdk: targetSdk,
    features,
    permissions,
    api_deps: Array.from(new Set(apiDeps)),
    privacy_flags: Array.from(new Set(privacyFlags)),
    navigation_screens: navigationScreens,
    existing_assets: existingAssets,
    readiness_score: readinessScore,
    checks,
    raw_report: rawReport,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDangerousPermission(permission: string): boolean {
  const dangerous = [
    "CAMERA",
    "READ_CONTACTS",
    "WRITE_CONTACTS",
    "ACCESS_FINE_LOCATION",
    "ACCESS_COARSE_LOCATION",
    "ACCESS_BACKGROUND_LOCATION",
    "READ_CALL_LOG",
    "WRITE_CALL_LOG",
    "PROCESS_OUTGOING_CALLS",
    "READ_EXTERNAL_STORAGE",
    "WRITE_EXTERNAL_STORAGE",
    "RECORD_AUDIO",
    "READ_PHONE_STATE",
    "CALL_PHONE",
    "READ_SMS",
    "SEND_SMS",
    "BODY_SENSORS",
    "ACTIVITY_RECOGNITION",
    "BLUETOOTH_SCAN",
    "BLUETOOTH_CONNECT",
    "NSCameraUsage",
    "NSLocation",
    "NSMicrophone",
    "NSPhotoLibrary",
    "NSContacts",
    "NSFaceID",
    "NSHealth",
  ];
  return dangerous.some((d) =>
    permission.toUpperCase().includes(d.toUpperCase())
  );
}

function permissionToFeature(permission: string): string | null {
  if (permission.includes("CAMERA")) return "Camera";
  if (permission.includes("LOCATION")) return "Location Services";
  if (permission.includes("RECORD_AUDIO")) return "Microphone";
  if (permission.includes("READ_CONTACTS") || permission.includes("WRITE_CONTACTS")) return "Contacts";
  if (permission.includes("STORAGE")) return "File Storage";
  if (permission.includes("BLUETOOTH")) return "Bluetooth";
  if (permission.includes("ACTIVITY_RECOGNITION")) return "Activity Recognition";
  if (permission.includes("BODY_SENSORS")) return "Body Sensors";
  return null;
}

function findSourceFiles(repoPath: string): string[] {
  const sourceExts = [".tsx", ".ts", ".jsx", ".js"];
  const results: string[] = [];

  function walk(dir: string, depth: number) {
    if (depth > 5) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (
          entry.isDirectory() &&
          !["node_modules", ".git", "build", "dist", "__tests__", "__mocks__"].includes(
            entry.name
          )
        ) {
          walk(fullPath, depth + 1);
        } else if (
          entry.isFile() &&
          sourceExts.some((ext) => entry.name.endsWith(ext))
        ) {
          results.push(fullPath);
        }
      }
    } catch {
      // skip
    }
  }

  walk(repoPath, 0);
  // Limit to first 60 files to keep analysis fast
  return results.slice(0, 60);
}

function analyzeSourceFiles(
  files: string[],
  repoPath: string,
  features: DetectedFeature[],
  privacyFlags: string[],
  navigationScreens: DetectedScreen[],
  checks: AnalysisCheck[]
) {
  // Patterns to look for in source
  const patterns: Array<{
    pattern: RegExp;
    feature: string;
    description: string;
    privacy?: string;
  }> = [
    {
      pattern: /createNativeStackNavigator|createStackNavigator/,
      feature: "Stack Navigation",
      description: "App uses stack-based navigation between screens",
    },
    {
      pattern: /createBottomTabNavigator/,
      feature: "Tab Navigation",
      description: "App has bottom tab bar navigation",
    },
    {
      pattern: /createDrawerNavigator/,
      feature: "Drawer Navigation",
      description: "App has side drawer navigation",
    },
    {
      pattern: /AsyncStorage|SecureStore|MMKV/,
      feature: "Local Storage",
      description: "App stores data locally on the device",
    },
    {
      pattern: /NetInfo|useNetInfo/,
      feature: "Network Status",
      description: "App monitors network connectivity",
    },
    {
      pattern: /Biometrics|TouchID|FaceID|LocalAuthentication/,
      feature: "Biometric Authentication",
      description: "App supports biometric authentication",
      privacy: "Biometric data used for authentication",
    },
    {
      pattern: /WebView|WebBrowser/,
      feature: "In-App Browser",
      description: "App displays web content in a WebView",
    },
    {
      pattern: /ImagePicker|launchCamera|launchImageLibrary/,
      feature: "Image Picker",
      description: "App allows selecting or capturing images",
      privacy: "Photo library or camera access for user content",
    },
    {
      pattern: /DateTimePicker|DatePicker/,
      feature: "Date/Time Picker",
      description: "App has date or time selection UI",
    },
    {
      pattern: /MapView|useCurrentLocation|getCurrentPosition/,
      feature: "Location / Maps",
      description: "App accesses device location",
      privacy: "Device location accessed",
    },
    {
      pattern: /SpeechRecognition|Voice|Audio\.Recording/,
      feature: "Audio / Speech",
      description: "App uses audio recording or speech recognition",
      privacy: "Audio/microphone access for speech or recording",
    },
    {
      pattern: /Notifications\.schedule|scheduleNotification|PushNotification/,
      feature: "Local Notifications",
      description: "App schedules or sends local notifications",
    },
  ];

  const foundFeatures = new Set<string>();
  const screenPatterns = [
    /Screen['"]\s*,?\s*component:\s*(\w+)/g,
    /name:\s*['"]([^'"]+)['"]\s*,\s*component:/g,
    /Stack\.Screen.*name=['"]([^'"]+)['"]/g,
    /Tab\.Screen.*name=['"]([^'"]+)['"]/g,
  ];

  for (const file of files) {
    const content = readFileSafe(file);
    if (!content) continue;

    const rel = relativePath(repoPath, file);

    // Check feature patterns
    for (const { pattern, feature, description, privacy } of patterns) {
      if (!foundFeatures.has(feature) && pattern.test(content)) {
        foundFeatures.add(feature);
        if (!features.find((f) => f.name === feature)) {
          features.push({ name: feature, description, evidence: rel });
        }
        if (privacy && !privacyFlags.includes(privacy)) {
          privacyFlags.push(privacy);
        }
      }
    }

    // Extract screen names from navigation config files
    const isNavFile =
      rel.includes("navigation") ||
      rel.includes("Navigation") ||
      rel.includes("router") ||
      rel.includes("Router") ||
      rel.includes("routes") ||
      rel.includes("Routes") ||
      content.includes("createNativeStackNavigator") ||
      content.includes("createBottomTabNavigator");

    if (isNavFile) {
      for (const screenPattern of screenPatterns) {
        const matches = Array.from(content.matchAll(screenPattern));
        for (const match of matches) {
          const screenName = match[1];
          if (
            screenName &&
            screenName.length > 1 &&
            !navigationScreens.find((s) => s.name === screenName)
          ) {
            navigationScreens.push({
              name: screenName,
              route: screenName,
            });
          }
        }
        screenPattern.lastIndex = 0;
      }
    }
  }
}

function detectExistingAssets(
  repoPath: string,
  existingAssets: Record<string, string>,
  checks: AnalysisCheck[]
) {
  // Common icon paths
  const iconPaths = [
    path.join(repoPath, "assets", "icon.png"),
    path.join(repoPath, "assets", "images", "icon.png"),
    path.join(repoPath, "android", "app", "src", "main", "res", "mipmap-xxxhdpi", "ic_launcher.png"),
    path.join(repoPath, "ios", "AppName", "Images.xcassets", "AppIcon.appiconset", "Icon-App-1024x1024@1x.png"),
  ];

  let iconFound = false;
  for (const iconPath of iconPaths) {
    if (fs.existsSync(iconPath)) {
      existingAssets["icon"] = iconPath;
      iconFound = true;
      break;
    }
  }

  // Check assets directory
  const assetsDir = path.join(repoPath, "assets");
  if (fs.existsSync(assetsDir)) {
    try {
      const assetFiles = fs.readdirSync(assetsDir);
      if (assetFiles.some((f) => f.includes("icon"))) {
        iconFound = true;
        existingAssets["icon"] = path.join(assetsDir, assetFiles.find((f) => f.includes("icon"))!);
      }
    } catch {
      // skip
    }
  }

  if (!iconFound && !existingAssets["icon"]) {
    checks.push({
      id: "icon-missing",
      category: "App Identity",
      title: "App icon not found",
      severity: "blocker",
      description:
        "A high-resolution app icon is required for Google Play submission. No icon file was detected.",
      recommended_action:
        "Add a 512×512 PNG icon at assets/icon.png or android/res/mipmap-xxxhdpi/ic_launcher.png",
    });
  }
}

function runPreflightChecks({
  appName,
  packageId,
  versionName,
  permissions,
  privacyFlags,
  existingAssets,
  checks,
}: {
  appName: string | null;
  packageId: string | null;
  versionName: string | null;
  permissions: DetectedPermission[];
  privacyFlags: string[];
  existingAssets: Record<string, string>;
  checks: AnalysisCheck[];
}) {
  // App name
  if (!appName) {
    checks.push({
      id: "app-name-missing",
      category: "App Identity",
      title: "App name not detected",
      severity: "warning",
      description: "Could not determine the app name from package.json or app.json",
      recommended_action: "Set the 'name' field in app.json or package.json",
    });
  } else {
    checks.push({
      id: "app-name-ok",
      category: "App Identity",
      title: `App name: "${appName}"`,
      severity: "pass",
      description: "App name detected from configuration files",
    });
  }

  // Package ID
  if (!packageId) {
    checks.push({
      id: "package-id-missing",
      category: "App Identity",
      title: "Package ID not detected",
      severity: "blocker",
      description:
        "A unique package identifier (applicationId for Android, bundleIdentifier for iOS) is required.",
      recommended_action:
        "Set applicationId in android/app/build.gradle or android.package in app.json",
    });
  } else {
    checks.push({
      id: "package-id-ok",
      category: "App Identity",
      title: `Package ID: ${packageId}`,
      severity: "pass",
      description: "Application package identifier detected",
    });
  }

  // Version
  if (!versionName) {
    checks.push({
      id: "version-missing",
      category: "Version Information",
      title: "App version not detected",
      severity: "warning",
      description: "Could not detect app version from configuration files",
      recommended_action: 'Set the "version" field in package.json or app.json',
    });
  } else {
    checks.push({
      id: "version-ok",
      category: "Version Information",
      title: `Version: ${versionName}`,
      severity: "pass",
      description: "App version detected",
    });
  }

  // Privacy policy — required if dangerous permissions are used
  const hasDangerousPermissions = permissions.some((p) => p.is_dangerous);
  if (hasDangerousPermissions) {
    checks.push({
      id: "privacy-policy-required",
      category: "Privacy",
      title: "Privacy policy required",
      severity: "blocker",
      description:
        "App requests dangerous permissions. Google Play requires a privacy policy URL in the store listing.",
      evidence: `Dangerous permissions: ${permissions.filter((p) => p.is_dangerous).map((p) => p.name.replace("android.permission.", "")).join(", ")}`,
      recommended_action:
        "Add a privacy policy URL to your Google Play Console store listing",
    });
  }

  // Store metadata
  checks.push({
    id: "store-metadata-pending",
    category: "Store Metadata",
    title: "Store listing not yet generated",
    severity: "warning",
    description:
      "App description, short description, and What's New text need to be generated or written.",
    recommended_action: "Use BobShip to generate store metadata based on repository analysis",
  });

  // Screenshots
  checks.push({
    id: "screenshots-pending",
    category: "Screenshots",
    title: "Store screenshots not yet captured",
    severity: "warning",
    description:
      "Google Play requires at least 2 screenshots for every release.",
    recommended_action: "Use BobShip to capture screenshots from the running app",
  });
}

function buildReport(data: {
  appName: string | null;
  packageId: string | null;
  framework: string;
  versionName: string | null;
  versionCode: string | null;
  features: DetectedFeature[];
  permissions: DetectedPermission[];
  apiDeps: string[];
  privacyFlags: string[];
  checks: AnalysisCheck[];
  readinessScore: number;
}): string {
  const blockers = data.checks.filter((c) => c.severity === "blocker");
  const warnings = data.checks.filter((c) => c.severity === "warning");
  const passed = data.checks.filter((c) => c.severity === "pass");

  return `# BobShip Repository Analysis

## App Identity
- Name: ${data.appName || "Unknown"}
- Package ID: ${data.packageId || "Not detected"}
- Framework: ${data.framework}
- Version: ${data.versionName || "Unknown"}${data.versionCode ? ` (build ${data.versionCode})` : ""}

## Release Readiness: ${data.readinessScore}/100

${blockers.length} Blockers | ${warnings.length} Warnings | ${passed.length} Passed

${blockers.length > 0 ? `### 🔴 Blockers\n${blockers.map((c) => `- **${c.title}**: ${c.description}`).join("\n")}` : ""}

${warnings.length > 0 ? `### ⚠️ Warnings\n${warnings.map((c) => `- **${c.title}**: ${c.description}`).join("\n")}` : ""}

## Detected Features (${data.features.length})
${data.features.map((f) => `- ${f.name}: ${f.description} (${f.evidence})`).join("\n")}

## Permissions (${data.permissions.length})
${data.permissions.map((p) => `- ${p.name} [${p.platform}]${p.is_dangerous ? " ⚠️ DANGEROUS" : ""}`).join("\n")}

## API Dependencies
${data.apiDeps.join(", ") || "None detected"}

## Privacy-Relevant Findings
${data.privacyFlags.join("\n") || "None detected"}

---
*Analysis generated by BobShip — findings are grounded in actual repository files.*
`;
}
