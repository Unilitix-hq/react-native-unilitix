#!/usr/bin/env node
// Fails when the npm tarball is missing a file the release needs, or carries
// files it must not (tests, the example app). Run after `yarn prepare`
// (scripts are skipped here so the build output on disk is what is checked).
import { execFileSync } from 'node:child_process';

const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});
// Lifecycle scripts may still print to stdout; the JSON report is the last
// top-level array in the output.
const json = out.slice(out.lastIndexOf('\n[\n') + 1 || 0);
const files = JSON.parse(json)[0].files.map((f) => f.path);

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
];
const forbidden = [/__tests__/, /__mocks__/, /^example\//, /^\.github\//];

const missing = required.filter((r) => !files.includes(r));
const extra = files.filter((f) => forbidden.some((re) => re.test(f)));
if (missing.length || extra.length) {
  if (missing.length) console.error('Missing from package:', missing);
  if (extra.length) console.error('Must not be in package:', extra);
  process.exit(1);
}
console.log(`Package contents OK (${files.length} files).`);
