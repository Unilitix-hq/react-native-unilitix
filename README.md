# react-native-unilitix

Official React Native SDK for [Unilitix](https://unilitix.com) —
African-first mobile UX analytics.

[![npm version](https://img.shields.io/npm/v/react-native-unilitix.svg)](https://www.npmjs.com/package/react-native-unilitix)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Install

```bash
npm install react-native-unilitix@^1.0.4
# or
yarn add react-native-unilitix@^1.0.4
```

## Quick start

```tsx
import Unilitix, { setupUnilitixCrashHandler } from 'react-native-unilitix';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    Unilitix.init('YOUR_API_KEY', { debug: true }).then(() => {
      setupUnilitixCrashHandler();
    });
  }, []);
}
```

Get your API key at [app.unilitix.com](https://app.unilitix.com)
→ Settings → Apps → Create App.

## Track events

```ts
Unilitix.track('purchase_completed', {
  amount: 5000,
  currency: 'NGN',
});
```

## Identify users

```ts
// After login
Unilitix.identify('user_123', {
  name: 'Tosin',
  plan: 'pro',
  country: 'Nigeria',
});

// After logout
Unilitix.reset();
```

## Screen tracking

Automatic screen tracking requires wiring the navigation listener:

```ts
import { createUnilitixNavigationListener } from 'react-native-unilitix';

<NavigationContainer onStateChange={createUnilitixNavigationListener()}>
  {/* your app */}
</NavigationContainer>
```

> **Note:** The `autoTrackScreens` config option has no effect in React Native — all screens run inside a single Android `Activity`, so native lifecycle callbacks cannot detect React Navigation transitions. Always use `createUnilitixNavigationListener` or call `Unilitix.screen()` manually.

## Crash tracking

Native (Kotlin/Java) crashes and JS errors are both captured once `init()`
has run — no extra wiring:

- An uncaught JS error is reported as a `CRASH` with the last 50
  breadcrumbs (taps, screens, custom events, your own `addBreadcrumb`).
  The report is persisted on-device (bounded to 2 s) before React Native's
  own handler runs, so a fatal error still reaches the dashboard.
- An unhandled promise rejection is reported as a non-fatal `EXCEPTION`
  (Hermes; on JSC use `captureException` in your `.catch`).
- On iOS, an uncaught Objective-C exception is reported as a `CRASH` with
  its stack, and a fatal signal in native code (SIGSEGV, SIGBUS, SIGABRT,
  SIGILL, SIGFPE, SIGTRAP) is reported on the next launch against the
  session that crashed (`exceptionType` `SIGNAL`, e.g.
  `Fatal signal 11 (SIGSEGV)`). A fatal JS error is reported once: the
  native exception and abort React Native raise after it are not reported
  again.
- Every report carries a stable fingerprint so one bug is counted once
  across devices.

```ts
try {
  await pay(card);
} catch (e) {
  Unilitix.captureException(e); // non-fatal EXCEPTION
}

Unilitix.addBreadcrumb('checkout started', 'flow');
```

Pass `installJsCrashHandler: false` to `init()` and call
`setupUnilitixCrashHandler()` yourself if you need to order it with another
error-reporting SDK; handlers installed before Unilitix still run.

## Verify your integration

In debug mode, after `init()` resolves you will see in Metro console:

```
[Unilitix] ✅ SDK initialized
[Unilitix] ✅ Session started
[Unilitix] ⚠️ No screen events detected. Did you wire
Unilitix.screen() to NavigationContainer.onStateChange?
```

The `⚠️` warning only appears if `Unilitix.screen()` or `createUnilitixNavigationListener` is never called within 5 seconds of init. Wire the navigation listener to suppress it. Silent in production builds.

## Configuration

```ts
await Unilitix.init('YOUR_API_KEY', {
  // Behaviour
  debug: true,
  autoTrackScreens: true,
  autoTrackTaps: true,
  autoTrackCrashes: true,
  autoTrackRageTaps: true,
  // Privacy
  consent: 'granted',           // 'denied' collects nothing; see below
  maskInputs: true,
  maskAllText: true,            // iOS; applied on Android once the library exposes it
  maskImages: false,
  captureSnapshots: true,       // session replay DOM snapshots
  captureScreenshots: true,     // session replay screenshots
  uploadScreenshotsOnWifiOnly: true,
  replaySampleRate: 1.0,        // fraction of sessions with replay
  // Performance
  flushIntervalSeconds: 30,
  flushBatchSize: 100,
  maxOfflineEvents: 1000,
  sessionTimeoutSeconds: 1800,
});
```

`init()` is memoised and calls made before it resolves (`track`, `screen`,
`identify`, …) are queued and replayed in order, so you can track from the
first render. `Unilitix.isAvailable` is `false` in Expo Go, where every call
is a no-op.

## Privacy

```ts
Unilitix.setConsent('denied');   // stop tracking (same as optOut)
Unilitix.setConsent('granted');  // resume tracking (same as optIn)
Unilitix.reset();                // clear user identity
```

Apps that must ask first (NDPR, GDPR) start with `consent: 'pending'`:
events and replay are kept on the device and nothing is uploaded until
`setConsent('granted')` sends them, or `setConsent('denied')` deletes them.
The decision is persisted and wins over `consent` on later launches. This
works the same on Android and iOS.

## Session control

```ts
// Manually start a new session
await Unilitix.startSession();

// End the current session
await Unilitix.endSession();

// Force upload all queued events immediately
await Unilitix.flush();
```

## Requirements

| Platform     | Version      |
|--------------|--------------|
| Android      | API 21+      |
| iOS          | iOS 13+: events, sessions, errors, crashes, taps, rage taps and screenshot replay |
| React Native | 0.71+        |

## iOS internals

The iOS side embeds [UnilitixCore](https://github.com/Unilitix-hq/unilitix-ios),
the native Unilitix iOS SDK. Its Swift sources are vendored into
`ios/UnilitixCore/` so the pod builds with any React Native version and no
extra dependency; `ios/UnilitixBridge.swift` adapts it to the JS bridge.
After changing UnilitixCore, refresh the copy with:

```sh
yarn ios:core   # scripts/sync-ios-core.sh ../unilitix-ios/UnilitixCore
```

