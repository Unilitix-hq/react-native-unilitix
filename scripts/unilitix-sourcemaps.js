#!/usr/bin/env node
'use strict';
/**
 * Uploads a release bundle's source map to Unilitix so JS stack traces are
 * symbolicated. Called by the Gradle hook (android/unilitix-sourcemaps.gradle),
 * the Xcode build phase (scripts/upload-sourcemaps.sh) and the Expo config
 * plugin; it can also be run by hand:
 *
 *   node unilitix-sourcemaps.js upload --platform android|ios \
 *     --bundle <bundle> --sourcemap <map> --app-version <v> --build <b> \
 *     [--packager-sourcemap <map> --hermes-sourcemap <map>] [--bundle-id <id>] [--dry-run]
 *   node unilitix-sourcemaps.js bundle-id <bundle>
 *
 * - With --packager-sourcemap and --hermes-sourcemap, the two maps are first
 *   composed into --sourcemap with react-native/scripts/compose-source-maps.js
 *   (Hermes builds whose tooling did not compose them already).
 * - The bundle id is read from the bundle (written there by
 *   react-native-unilitix/metro) unless --bundle-id is given; without one
 *   the CLI uses the bundle file name, which is also the SDK's default.
 * - Runs `unilitix-cli upload-sourcemap` ($UNILITIX_CLI or unilitix-cli on
 *   PATH) with the key in $UNILITIX_API_KEY (never printed).
 *
 * A missing key, CLI, bundle or map, or a failed upload, is a warning and
 * exit 0 so a release build never fails because of analytics; set
 * UNILITIX_SOURCEMAPS_STRICT=1 to fail instead. UNILITIX_SOURCEMAPS_DISABLED=1
 * skips everything.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const MARKER = 'UNILITIX_BUNDLE_ID=';
const BUNDLE_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;
const MARKER_RE = /UNILITIX_BUNDLE_ID=([A-Za-z0-9._-]{1,128})/;

class SkipError extends Error {}

/** The bundle id the Metro plugin wrote into [bundlePath], or null. */
function extractBundleId(bundlePath) {
  let data;
  try {
    data = fs.readFileSync(bundlePath);
  } catch {
    return null;
  }
  // Plain JS and Hermes bytecode both keep the literal as ASCII bytes.
  const m = MARKER_RE.exec(data.toString('latin1'));
  return m ? m[1] : null;
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a.startsWith('--')) {
      const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`${a} needs a value`);
      }
      out[key] = value;
      i++;
    } else {
      out._.push(a);
    }
  }
  return out;
}

/** Arguments for `unilitix-cli upload-sourcemap`. */
function cliArgs(o) {
  const args = [
    'upload-sourcemap',
    '--platform',
    o.platform,
    '--sourcemap',
    o.sourcemap,
    '--app-version',
    o.appVersion,
    '--build',
    o.build,
  ];
  if (o.bundle) args.push('--bundle', o.bundle);
  if (o.bundleId) args.push('--bundle-id', o.bundleId);
  if (o.baseUrl) args.push('--base-url', o.baseUrl);
  if (o.dryRun) args.push('--dry-run');
  return args;
}

/** react-native/scripts/compose-source-maps.js, resolved from [from]. */
function composeScript(from) {
  const pkg = require.resolve('react-native/package.json', {
    paths: [from, process.cwd(), __dirname],
  });
  return path.join(path.dirname(pkg), 'scripts', 'compose-source-maps.js');
}

function composeMaps(o, log, run) {
  const script = composeScript(path.dirname(o.bundle || o.sourcemap));
  log(`composing ${o.packagerSourcemap} + ${o.hermesSourcemap}`);
  const r = run(process.execPath, [
    script,
    o.packagerSourcemap,
    o.hermesSourcemap,
    '-o',
    o.sourcemap,
  ]);
  if (r.status !== 0) throw new Error('compose-source-maps.js failed');
}

/**
 * Validates [o], composes Hermes maps when asked, resolves the bundle id
 * and runs the CLI. Returns the CLI arguments it ran (for tests).
 */
function upload(o, env = process.env, deps = {}) {
  const log = deps.log || ((m) => console.log(`[unilitix] ${m}`));
  const run =
    deps.run ||
    ((cmd, args) =>
      spawnSync(cmd, args, { stdio: 'inherit', env: { ...env } }));
  const exists = deps.exists || fs.existsSync;

  if (o.platform !== 'android' && o.platform !== 'ios') {
    throw new Error('--platform must be android or ios');
  }
  if (!o.appVersion || !o.build) {
    throw new SkipError('no app version / build number: not uploading');
  }
  if (!o.sourcemap) throw new Error('--sourcemap is required');
  if (o.bundle && !exists(o.bundle)) {
    throw new SkipError(`no bundle at ${o.bundle} (debug build?): skipped`);
  }
  if (o.packagerSourcemap && o.hermesSourcemap) {
    composeMaps(o, log, run);
  }
  if (!exists(o.sourcemap)) {
    throw new SkipError(
      `no source map at ${o.sourcemap}: on iOS export SOURCEMAP_FILE in ios/.xcode.env (see README "Source maps")`
    );
  }
  if (o.bundleId !== undefined && !BUNDLE_ID_RE.test(o.bundleId)) {
    throw new Error(`--bundle-id "${o.bundleId}": letters, digits, . _ - only`);
  }
  const bundleId =
    o.bundleId || (o.bundle ? extractBundleId(o.bundle) : null) || undefined;
  if (!env.UNILITIX_API_KEY && !o.dryRun) {
    throw new SkipError('UNILITIX_API_KEY is not set: source map not uploaded');
  }
  const cli = env.UNILITIX_CLI || 'unilitix-cli';
  const args = cliArgs({ ...o, bundleId });
  log(
    `uploading ${path.basename(o.sourcemap)} (${o.platform} ${o.appVersion} (${o.build}), bundle id ${bundleId || 'default'})`
  );
  const r = run(cli, args);
  if (r.error && r.error.code === 'ENOENT') {
    throw new SkipError(
      `${cli} not found: install unilitix-cli or set UNILITIX_CLI`
    );
  }
  if (r.status !== 0) throw new Error(`${cli} exited with ${r.status}`);
  return args;
}

function main(argv, env = process.env, deps = {}) {
  const warn = deps.warn || ((m) => console.warn(`[unilitix] warning: ${m}`));
  const strict = env.UNILITIX_SOURCEMAPS_STRICT === '1';
  if (env.UNILITIX_SOURCEMAPS_DISABLED === '1') return 0;
  try {
    const o = parseArgs(argv);
    const [command, file] = o._;
    if (command === 'bundle-id') {
      const id = file ? extractBundleId(file) : null;
      (deps.log || console.log)(id || '');
      return id ? 0 : 1;
    }
    if (command !== 'upload') {
      throw new Error('usage: unilitix-sourcemaps.js upload|bundle-id ...');
    }
    upload(o, env, deps);
    return 0;
  } catch (e) {
    if (e instanceof SkipError && !strict) {
      warn(e.message);
      return 0;
    }
    warn(e && e.message ? e.message : String(e));
    return strict ? 1 : 0;
  }
}

module.exports = {
  extractBundleId,
  parseArgs,
  cliArgs,
  upload,
  main,
  MARKER,
};

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}
