# react-native-unilitix

Official React Native SDK for [Unilitix](https://unilitix.com) —
African-first mobile UX analytics.

[![npm version](https://img.shields.io/npm/v/react-native-unilitix.svg)](https://www.npmjs.com/package/react-native-unilitix)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Install

```bash
npm install react-native-unilitix
# or
yarn add react-native-unilitix
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

```ts
// With React Navigation
<NavigationContainer
  onStateChange={(state) => {
    const route = state?.routes[state.index];
    if (route) Unilitix.screen(route.name);
  }}
>
```

## Configuration

```ts
await Unilitix.init('YOUR_API_KEY', {
  debug: true,
  autoTrackScreens: true,
  autoTrackTaps: true,
  autoTrackCrashes: true,
  autoTrackRageTaps: true,
  flushIntervalSeconds: 30,
  sessionTimeoutSeconds: 1800,
  maskInputs: true,
  sampleRate: 1.0,
});
```

## Privacy

```ts
Unilitix.optOut();  // stop tracking
Unilitix.optIn();   // resume tracking
Unilitix.reset();   // clear user identity
```

## Requirements

| Platform     | Version      |
|--------------|--------------|
| Android      | API 21+      |
| iOS          | Coming soon  |
| React Native | 0.71+        |
