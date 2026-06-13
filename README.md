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

```ts
import Unilitix from 'react-native-unilitix';

// In App.tsx — initialize once
await Unilitix.init('YOUR_API_KEY');
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

Native crashes are captured automatically. For JS exception tracking, add:

```ts
import { setupUnilitixCrashHandler } from 'react-native-unilitix';

// Call once after init()
Unilitix.init('YOUR_API_KEY').then(() => {
  setupUnilitixCrashHandler();
});
```

## Verify your integration

In debug mode, after `init()` resolves you will see in Metro console:

```
[Unilitix] ✅ SDK initialized
[Unilitix] ✅ Session started
[Unilitix] ⚠️ No screen events detected. Did you wire
Unilitix.screen() to NavigationContainer.onStateChange?
```

The `⚠️` warning only appears if `Unilitix.screen()` is never called within 5 seconds of init. Silent in production builds.

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
  maskInputs: true,
  captureSnapshots: true,       // session replay DOM snapshots
  captureScreenshots: true,     // session replay screenshots
  uploadScreenshotsOnWifiOnly: true,
  // Performance
  flushIntervalSeconds: 30,
  flushBatchSize: 100,
  maxOfflineEvents: 1000,
  sessionTimeoutSeconds: 1800,
  sampleRate: 1.0,
});
```

## Privacy

```ts
Unilitix.optOut();  // stop tracking
Unilitix.optIn();   // resume tracking
Unilitix.reset();   // clear user identity
```

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
| iOS          | Coming soon  |
| React Native | 0.71+        |
