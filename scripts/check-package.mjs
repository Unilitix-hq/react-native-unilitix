#!/usr/bin/env node
// Fails when the npm tarball is missing a file the release needs, carries
// files it must not (tests, fixtures, the example app), or grows past the
// size budget. Run after `yarn prepare` (scripts are skipped here so the
// build output on disk is what is checked).
import { execFileSync } from 'node:child_process';

const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
// Lifecycle scripts may still print to stdout; the JSON report is the last
// top-level array in the output.
const json = out.slice(out.lastIndexOf('\n[\n') + 1 || 0);
const report = JSON.parse(json)[0];
const files = report.files.map((f) => f.path);

// Size budget of the published package (2.0.0: ~166 kB packed, ~810 kB
// unpacked, most of it the vendored UnilitixCore sources). Raise it on
// purpose, in the same change that explains the growth.
const BUDGET = { packed: 200 * 1024, unpacked: 1000 * 1024 };

const required = [
  'package.json',
  'Unilitix.podspec',
  'ios/PrivacyInfo.xcprivacy',
  'ios/UnilitixBridge.swift',
  'android/build.gradle',
  'lib/commonjs/index.js',
  'lib/module/index.js',
  'lib/typescript/commonjs/src/index.d.ts',
  'lib/typescript/module/src/index.d.ts',
  'src/index.tsx',
  // 2.0.0: TurboModule / Fabric specs and native sides
  'src/NativeUnilitix.ts',
  'src/UnilitixMaskViewNativeComponent.ts',
  'src/UnilitixUnmaskViewNativeComponent.ts',
  'android/src/newarch/com/unilitix/UnilitixSpec.kt',
  'android/src/oldarch/com/unilitix/UnilitixSpec.kt',
  'android/src/main/java/com/unilitix/UnilitixMaskViews.kt',
  'ios/UnilitixMaskViews.mm',
  // source maps and Expo
  'metro.js',
  'app.plugin.js',
  'plugin/build/index.js',
  'scripts/unilitix-sourcemaps.js',
  'scripts/upload-sourcemaps.sh',
  'android/unilitix-sourcemaps.gradle',
];
const forbidden = [
  /__tests__/,
  /__mocks__/,
  /^example\//,
  /^\.github\//,
  /^plugin\/src\//,
  /^coverage\//,
  /behaviourFixtures/,
];

const missing = required.filter((r) => !files.includes(r));
const extra = files.filter((f) => forbidden.some((re) => re.test(f)));
const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
const overBudget =
  report.size > BUDGET.packed || report.unpackedSize > BUDGET.unpacked;
if (missing.length || extra.length || overBudget) {
  if (missing.length) console.error('Missing from package:', missing);
  if (extra.length) console.error('Must not be in package:', extra);
  if (overBudget) {
    console.error(
      `Package over budget: ${kb(report.size)} packed (max ${kb(BUDGET.packed)}), ` +
        `${kb(report.unpackedSize)} unpacked (max ${kb(BUDGET.unpacked)})`
    );
  }
  process.exit(1);
}
console.log(
  `Package contents OK (${files.length} files, ${kb(report.size)} packed, ` +
    `${kb(report.unpackedSize)} unpacked).`
);
