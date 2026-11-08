/**
 * Expo config plugin for react-native-unilitix (development builds and EAS
 * Build; Expo Go has no native module and the SDK is a no-op there).
 *
 *   // app.json
 *   { "plugins": ["react-native-unilitix"] }
 *   { "plugins": [["react-native-unilitix", { "uploadSourceMaps": false }]] }
 *
 * - Android: applies android/unilitix-sourcemaps.gradle in app/build.gradle
 *   (one upload task after each release bundle task) and makes sure the
 *   manifest has the permissions the SDK needs.
 * - iOS: makes "Bundle React Native code and images" write the source map
 *   (SOURCEMAP_FILE) and adds an "Upload Unilitix source maps" phase after
 *   it. No Info.plist keys are required.
 *
 * Uploads need UNILITIX_API_KEY in the build environment (an EAS secret)
 * and unilitix-cli on PATH (or UNILITIX_CLI).
 */
import {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withAppBuildGradle,
  withXcodeProject,
  type ConfigPlugin,
} from '@expo/config-plugins';

export interface UnilitixPluginProps {
  /** Add the source map upload steps. @default true */
  uploadSourceMaps?: boolean;
  /**
   * Android: also request READ_PHONE_STATE so cellular events report
   * 5G/4G/3G/2G instead of CELLULAR. Off by default (a runtime permission).
   */
  cellularGeneration?: boolean;
}

// plugin/build/index.js and plugin/src/index.ts are both two levels down.

const pkg = require('../../package.json') as { name: string; version: string };

export const GRADLE_MARKER = '// react-native-unilitix: source maps';
export const GRADLE_LINE =
  'apply from: new File(["node", "--print", "require.resolve(\'react-native-unilitix/package.json\')"]' +
  '.execute(null, rootDir).text.trim(), "../android/unilitix-sourcemaps.gradle")';
export const UPLOAD_PHASE_NAME = 'Upload Unilitix source maps';
export const BUNDLE_PHASE_NAME = 'Bundle React Native code and images';
export const SOURCEMAP_EXPORT =
  'export SOURCEMAP_FILE="$DERIVED_FILE_DIR/main.jsbundle.map"';
export const UPLOAD_PHASE_SCRIPT =
  '[ -f "$PODS_ROOT/../.xcode.env" ] && . "$PODS_ROOT/../.xcode.env"; ' +
  '[ -f "$PODS_ROOT/../.xcode.env.local" ] && . "$PODS_ROOT/../.xcode.env.local"; ' +
  '/bin/bash "$("${NODE_BINARY:-node}" --print "require(\'path\').dirname(require.resolve(\'react-native-unilitix/package.json\')) + \'/scripts/upload-sourcemaps.sh\'")"';

/** app/build.gradle with the source-map hook applied (idempotent). */
export function addGradleHook(contents: string): string {
  if (contents.includes(GRADLE_MARKER)) return contents;
  const block = `\n${GRADLE_MARKER}\n${GRADLE_LINE}\n`;
  const react = /^apply plugin:\s*["']com\.facebook\.react["'].*$/m.exec(
    contents
  );
  if (react) {
    const end = react.index + react[0].length;
    return contents.slice(0, end) + '\n' + block + contents.slice(end);
  }
  return contents + block;
}

/** Escapes [s] the way a pbxproj quoted string stores it. */
function pbxEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * The bundle phase's quoted pbxproj `shellScript` with SOURCEMAP_FILE
 * exported first (idempotent).
 */
export function addSourcemapExport(quotedScript: string): string {
  if (quotedScript.includes('SOURCEMAP_FILE')) return quotedScript;
  const line = pbxEscape(SOURCEMAP_EXPORT) + '\\n';
  if (quotedScript.startsWith('"')) return '"' + line + quotedScript.slice(1);
  return line + quotedScript;
}

type ShellPhase = { name?: string; shellScript?: string };
type XcodeProjectLike = {
  hash: { project: { objects: Record<string, Record<string, unknown>> } };
  getFirstTarget(): { uuid: string } | null | undefined;
  addBuildPhase(
    files: string[],
    type: string,
    name: string,
    target: string,
    options: { shellPath: string; shellScript: string }
  ): unknown;
};

const unquote = (s: unknown) =>
  typeof s === 'string' ? s.replace(/^"(.*)"$/, '$1') : '';

/** Adds the SOURCEMAP_FILE export and the upload phase (idempotent). */
export function configureXcodeProject<T extends XcodeProjectLike>(
  project: T
): T {
  const phases = (project.hash.project.objects.PBXShellScriptBuildPhase ??
    {}) as Record<string, ShellPhase | string>;
  let hasUpload = false;
  for (const phase of Object.values(phases)) {
    if (typeof phase !== 'object' || !phase) continue;
    const name = unquote(phase.name);
    if (name === UPLOAD_PHASE_NAME) hasUpload = true;
    if (name === BUNDLE_PHASE_NAME && typeof phase.shellScript === 'string') {
      phase.shellScript = addSourcemapExport(phase.shellScript);
    }
  }
  const target = project.getFirstTarget();
  if (!hasUpload && target) {
    project.addBuildPhase(
      [],
      'PBXShellScriptBuildPhase',
      UPLOAD_PHASE_NAME,
      target.uuid,
      { shellPath: '/bin/sh', shellScript: UPLOAD_PHASE_SCRIPT }
    );
  }
  return project;
}

const withUnilitix: ConfigPlugin<UnilitixPluginProps | void> = (
  config,
  props
) => {
  const upload = props?.uploadSourceMaps !== false;

  config = withAndroidManifest(config, (c) => {
    const permissions = [
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
    ];
    if (props?.cellularGeneration) {
      permissions.push('android.permission.READ_PHONE_STATE');
    }
    AndroidConfig.Permissions.ensurePermissions(c.modResults, permissions);
    return c;
  });

  if (!upload) return config;

  config = withAppBuildGradle(config, (c) => {
    if (c.modResults.language === 'groovy') {
      c.modResults.contents = addGradleHook(c.modResults.contents);
    } else {
      console.warn(
        '[react-native-unilitix] app/build.gradle.kts: add the source map hook by hand (README "Source maps").'
      );
    }
    return c;
  });

  config = withXcodeProject(config, (c) => {
    configureXcodeProject(c.modResults as unknown as XcodeProjectLike);
    return c;
  });

  return config;
};

export default createRunOncePlugin(withUnilitix, pkg.name, pkg.version);
