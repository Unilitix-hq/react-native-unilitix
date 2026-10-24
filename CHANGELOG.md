# Changelog

## [1.7.0] - 2026-10-24

### Added
- **App hangs on iOS** are reported as `ANR` issues (embeds UnilitixCore
  0.6.0): when the main thread is blocked for `appHangTimeoutMs` (default
  2000 ms, 0 turns it off) the main thread's stack is captured; the event is
  sent when the app recovers, or on the next launch if the app was killed
  during the hang. Sessions are not marked crashed. Requires
  `autoTrackCrashes`. A stuck JS thread is not a main-thread hang.
- iOS hang events include `debugImages` (image UUIDs and load addresses), so
  uploaded dSYMs symbolicate their stacks exactly.

## [1.6.2] - 2026-10-24

### Added
- **App-not-responding (ANR) reports on Android 11+.** Requires
  unilitix-android 1.9.0 (bumped here): when the app froze and the system
  killed it, the next launch reports an ANR with the main thread's stack.
  ANRs are their own issue type in the dashboard and do not mark the session
  crashed.
- **Jetpack Compose masking** comes with unilitix-android 1.8.0+ (only
  relevant to apps that mix native Compose screens into a React Native app).

### Changed
- SDK contract 1.3.0 (adds the `ANR` event type).

## [1.6.1] - 2026-10-24

### Added
- **Native (NDK) crashes on Android.** Requires unilitix-android 1.7.0
  (bumped here): crashes in native code (C/C++ libraries, React Native's
  own native modules, Hermes) are reported on the next launch as a CRASH on
  the session that crashed, with the same fingerprint as iOS. Android 11+
  reads the system's exit history; Android 8–10 uses a small signal handler
  (~10 KB per ABI). A fatal JS error already reported from JS suppresses the
  abort that may follow, so it is not reported twice.

## [1.6.0] - 2026-10-24

### Added
- **Native crashes from fatal signals on iOS** (SIGSEGV, SIGBUS, SIGABRT,
  SIGILL, SIGFPE, SIGTRAP), with `autoTrackCrashes`. Embeds UnilitixCore
  0.5.0: the dying process records the signal, and on the next launch it is
  reported as a fatal `CRASH` (`exceptionType` `SIGNAL`, message such as
  `Fatal signal 11 (SIGSEGV)`) against the session that crashed, which is
  marked crashed. Consent `pending` holds it; `denied` drops it.

### Fixed
- A fatal JS error is reported once: the `RCTFatalException` React Native
  raises afterwards was already ignored, and now the SIGABRT that ends the
  process is not reported either. The same holds for any uncaught
  Objective-C exception.

## [1.5.1] - 2026-10-23

### Added
- **View-tree snapshots on iOS.** `captureSnapshots`, `snapshotIntervalMs`
  and `maxSnapshotsPerSession` now apply on iOS too (embeds UnilitixCore
  0.4.0). Text follows the same masking as screenshots; private views, web
  views and SwiftUI content are sent as masked boxes.

### Changed
- Requires unilitix-android 1.6.1: taps, screen size and replay coordinates
  are sent in dp (logical pixels, as the contract specifies) instead of
  physical pixels; private views are kept as masked placeholders; the view
  tree is read on the main thread. Heatmaps that mix sessions from older
  Android versions will show those taps at pixel scale.

## [1.5.0] - 2026-10-23

### Added
- **Android replay parity.** `maskAllText` (default on), `maskImages`,
  `maxScreenshotsPerMinute` (20) and `screenshotHeartbeatMs` (10000) now
  apply on Android too. Requires unilitix-android 1.6.0 (bumped here), which
  also brings contract retry (Retry-After clamped, 401/403 pause uploads) and
  crash dedup (3 per fingerprint, 50 per session).

### Changed
- `maxSnapshotsPerSession` and `maxScreenshotsPerSession` default to 1500 on
  both platforms (were 200 and 300). Android replays now mask all text by
  default, so they look more masked after upgrading.

## [1.4.1] - 2026-10-23

### Fixed
- iOS replay frames are uploaded as JPEG (`image/jpeg`, stored as `.jpg`)
  instead of being labelled `image/webp`. Embeds UnilitixCore 0.3.1.

## [1.4.0] - 2026-10-18

### Added
- **Session replay on iOS.** Screenshots are captured when the screen
  changes (plus a heartbeat on static screens), masked on the device, capped
  per minute and per session, and uploaded through the same screenshot API as
  Android, on Wi-Fi only by default. Text, inputs and (optionally) images are
  masked before a frame is saved: `maskAllText` (default on), `maskInputs`,
  `maskImages`. New options `maxScreenshotsPerMinute` (20) and
  `screenshotHeartbeatMs` (10000) apply on iOS. Embeds UnilitixCore 0.3.0.
- `maskInputsInScreenshots` option (defaults to `maskInputs`).

### Changed
- **`consent: 'pending'` now works on Android.** Data is held on the device
  until `setConsent('granted')` uploads it or `setConsent('denied')` deletes
  it, as on iOS; it no longer behaves like `'denied'`. `setConsent` calls the
  native consent API on both platforms. Requires unilitix-android 1.5.1
  (bumped here), which also makes `debug: true` log in release builds.

### Note
- SwiftUI screens have no UIKit text views to mask individually, so with
  `maskAllText` on (the default) their replay frames are fully masked.
  View-tree snapshots (`captureSnapshots`) are still Android-only.

## [1.3.0] - 2026-10-18

### Added
- **iOS taps and rage taps.** Taps are recorded with their position and the
  tapped view's class and accessibility identifier (never its text); three
  quick taps in one spot become a rage tap. Keyboard taps are ignored.
  `autoTrackTaps` / `autoTrackRageTaps` control it, as on Android.
- iOS sessions carry the screen size, so tap heatmaps line up.

Screens on iOS still come from the navigation listener or `Unilitix.screen`.
Embeds UnilitixCore 0.2.0.

## [1.2.0] - 2026-10-18

### Added
- **iOS support.** Every call now works on iOS: sessions (a new one after
  30 minutes in the background), `track`, `screen`, `identify`, handled and
  uncaught JS errors with breadcrumbs and fingerprints, uncaught native
  (Objective-C) exceptions, consent, `flush`, `reset` and session control.
  Data is queued on the device and survives offline periods and crashes.
  Powered by UnilitixCore 0.1, vendored into the pod (no extra dependency).
- On iOS, `consent: 'pending'` holds events on the device until
  `setConsent('granted')` uploads them (Android still treats pending as
  denied until the Android library adds a pending state).

### Not yet on iOS
- Automatic tap and rage-tap capture, and session replay (UnilitixCore 0.2).

## [1.1.1] - 2026-10-18

Requires `com.unilitix:unilitix-android` 1.5.0 (pulled in automatically).

### Fixed
- **One JS bug is one issue.** Crash fingerprints no longer include the
  error message when it ends in parentheses (Hermes' `(evaluating 'a.b')`),
  so a bug no longer splits into many dashboard issues. Fixed in the Android
  library.
- **Rage taps are detected on high-density screens.** The radius is now
  100 dp; it was 100 physical pixels (~33 dp on a 3x phone).

### Added
- `src/generated/sdkContract.ts`, generated from the shared SDK contract
  (`yarn api:contract` copies it from the api repo), and a conformance test
  for the config defaults and limits. Known gaps are listed in the contract.

## [1.1.0] - 2026-10-17

Requires `com.unilitix:unilitix-android` 1.4.2 (pulled in automatically).

### Fixed
- **JS crashes reach the crash dashboard.** They were sent as a custom event
  named `_crash`. Uncaught JS errors are now `CRASH` reports (with the last
  50 breadcrumbs, a stable fingerprint and `fatal` as React Native reports
  it); unhandled promise rejections are non-fatal `EXCEPTION`s.
- A fatal JS error is persisted on-device (bounded to 2 s) before the
  previous global handler runs, so the report survives the process ending.
- `init()` is memoised; calling it twice no longer re-initialises the native
  side. A failed `init()` can be retried.
- `track`/`screen`/`identify`/… called before `init()` resolves are queued
  and replayed in order instead of racing the bridge (or throwing).
- Native rejections no longer propagate into the app from `track()` and
  friends; they are logged in development.
- The navigation listener catches its own errors.
- On iOS the warning is printed once, not on every call.
- The Android module failed to compile on React Native 0.79+ (`ReadableMap.toHashMap()` now returns nullable values); `track` properties and `identify` traits drop `null` values instead.

### Added
- `Unilitix.captureException(error, { fatal })`, `Unilitix.addBreadcrumb(message, category)`.
- `Unilitix.isAvailable`, `Unilitix.isInitialized`, `Unilitix.consent`,
  `Unilitix.setConsent('granted' | 'pending' | 'denied')`.
- Config: `consent`, `maskAllText`, `maskImages`, `replaySampleRate`
  (`sampleRate` kept as an alias), `installJsCrashHandler`.
- `setupUnilitixCrashHandler()` is installed by `init()` and is idempotent.

### Changed
- Every bridge method takes one options object and a promise (`startSession`,
  `endSession`, `flush`, `optOut`, `optIn`, `reset` included), on Android and
  in the iOS stubs, so the iOS implementation can land without changing call
  shapes.

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
