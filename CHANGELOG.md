# Changelog

## [1.0.4] - 2026-06-13
### Fixed
- iOS method stubs now reject with `IOS_NOT_SUPPORTED` instead of silently returning `undefined`
- Added `RCT_EXPORT_MODULE()` to iOS implementation
- All 10 SDK methods explicitly stubbed in `Unilitix.mm` (added `startSession`, `endSession`)
- Lowered `minSdkVersion` from 24 to 21 to match documented Android API 21+ requirement
- Moved `Unilitix.init()` into `useEffect` in example app to prevent premature Android Application context access
- Added `Unilitix.screen('Home')` after init in example app to demonstrate screen tracking
- Added pre-publish quality gates to `publish.yml` (lint, typecheck, test, build before publish)
- Added `--access public` to `npm publish` and `--frozen-lockfile` to `yarn install`
- Added `createUnilitixNavigationListener()` utility for automatic React Navigation screen tracking
- Clarified `autoTrackScreens` JSDoc — no effect in React Native (single-Activity architecture)
- Updated README screen tracking section with `createUnilitixNavigationListener` pattern
- Added `setupUnilitixCrashHandler()` utility for JS exception tracking via `ErrorUtils`
- Clarified `autoTrackCrashes` JSDoc — only captures native Kotlin/Java crashes in React Native
- Added crash tracking section to README
- Fixed `sampleRate` type bug in `UnilitixModule.kt` (`.toFloat()` cast on a `Double` field caused compile failure)
- Renamed `endpoint` config option to `apiUrl` to match Android SDK naming
- Added `flushBatchSize`, `maxOfflineEvents`, `captureSnapshots`, `captureScreenshots`, `uploadScreenshotsOnWifiOnly` to `UnilitixConfig` and wired through to Android
- Added advanced tuning options (`snapshotIntervalMs`, `maxSnapshotsPerSession`, `screenshotIntervalMs`, `screenshotQuality`, `screenshotMaxWidth`, `maxScreenshotsPerSession`) to `UnilitixConfig`
- Updated README configuration example with privacy and performance sections
- Added iOS platform guards to all 10 SDK methods, `setupUnilitixCrashHandler`, and `createUnilitixNavigationListener` — all are silent no-ops on iOS (init logs a console warning)

## [1.0.3] - 2026-05-29
### Fixed
- Migrated Android dependency from JitPack to Maven Central (`com.unilitix:unilitix-android:1.4.1`)
- Removed JitPack repository blocks from `android/build.gradle`
- Removed `src/` from published npm package
### Added
- Automated npm publish workflow on tag push
- `.npmignore` to keep source files out of published package
- "Verify your integration" section in README
- Version pin in README install command

## [1.0.2] - 2026-05-28
### Fixed
- Version comment in README install block
### Added
- npm badges in README
- GitHub Actions CI workflow
- CONTRIBUTING.md

## [1.0.1] - 2026-05-28
### Fixed
- Bumped Android SDK dependency to 1.4.1
- Fixed JitPack allprojects repository block
- Replaced iOS TurboModule scaffold with no-op stub
- Removed stale scaffold files
### Added
- JS-side debug verification log
- 5-second screen tracking health check
- startSession, endSession, flush in README

## [1.0.0] - 2026-05-27
### Added
- Initial release
- Android support via unilitix-android
- All 10 SDK methods with TypeScript types
