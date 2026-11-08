# Contract coverage (behaviour fixtures, contract 1.4.0)

The shared behaviour fixtures (`src/__tests__/behaviour/`, copied from the
api repo with `yarn api:contract`) describe what every Unilitix SDK does.
In this package the work is split between the JS layer (`src/`) and the
native cores it wraps (unilitix-android on Android, the vendored
UnilitixCore on iOS). Each fixture case is either run here or owned by the
native runners; `src/__tests__/behaviour.test.ts` fails when a new case is
not classified.

## How the JS runner works

Each JS-run case drives the public API (`init`, `track`, `screen`,
`identify`, `reset`, `setConsent`, `flush`, `captureException`, process
restarts) against **FakeCore** (`src/__tests__/behaviour/harness/fakeCore.ts`),
a minimal contract-conforming model of the native core: sessions,
`SESSION_START`, `eventId`/`seq`, consent gating and identify requests.
FakeCore deliberately does **not** normalise properties, buffer pre-init
calls, dedupe screens, fingerprint errors or add `jsBundleId`/`release`/
`dist`: those are the JS layer's job, so a case passes only when the JS
layer does its part. Every case is checked twice:

1. the fixture's own `expectRequests` / `expectEvents` / `expectState`, with
   the contract matcher (`harness/matcher.ts`, README "Matchers");
2. the **exact** state-changing native calls the JS layer made
   (`EXPECTED_NATIVE_CALLS` in the runner), e.g. that a duplicate screen
   never reaches native and that `recordException` carries the contract
   fingerprint and metadata.

## Run in Jest (JS layer) — 15 cases

| Area | Cases | What the JS layer is responsible for |
|---|---|---|
| Pre-init buffer | `lifecycle.pre-init-calls-replayed-in-order`, `lifecycle.pre-init-buffer-cap` | Calls before `init` are buffered (200, oldest dropped) and replayed in call order; calls made while init is in flight never overtake them. |
| Property normalisation | `properties.normalised`, `properties.traits-normalised`, `properties.names-truncated` | Non-finite → `null`, depth 5 → `"[Truncated]"`, 100 keys/items, 1024 UTF-16 units without splitting a surrogate pair; names, screens and user ids cut too — before anything reaches native. |
| Error capture / fingerprint | `crashes.exception-fingerprint`, `crashes.fatal-error-is-crash`, `crashes.react-native-js-error-metadata` | Type/message/stack/fatal passed through; contract fingerprint computed in JS; `metadata.platform`, `jsBundleId`, `release`, `dist` attached. |
| Screen dedupe | `screens.consecutive-duplicates-dropped`, `screens.new-session-emits-again` | A screen equal to the session's current screen is dropped in JS; reset/startSession/endSession, a foreground after the session timeout and a new native session id start over. |
| Consent passthrough | `consent.pending-holds-until-granted`, `consent.denied-purges-queue`, `consent.granted-to-denied-drops-unsent`, `consent.decision-persists-across-restart`, `consent.denied-then-granted-captures-again` | Initial consent and every `setConsent` reach native in order; JS never drops or reorders calls on the core's behalf (the core holds, purges and persists). |

The fingerprint port also runs every `SdkContract.fingerprintVectors` entry
(`src/__tests__/sdkContract.test.tsx`); native signal types are left to the
cores.

## Owned by the native cores — 35 cases

| Area | Cases | Covered by |
|---|---|---|
| Identity | `identity.*` (4) | unilitix-android / UnilitixCore runners (ids, persistence, identify requests). JS passes `identify`/`reset` through (unit tests). |
| Sessions, timestamps, network | `lifecycle.init-starts-session`, `lifecycle.queue-survives-restart`, `lifecycle.timestamps-follow-clock`, `network.*` (2), `sessions.*` (5) | Native runners (clock, reachability, lifecycle, replay sampling). |
| Queue and uploads | `queue.cap-drops-oldest`, `retry.*` (12) | Native runners (offline queue, HTTP, backoff). |
| Crash grouping | `crashes.reports-per-fingerprint-capped`, `crashes.native-*` (7) | Native runners (per-session caps, crash files, native fingerprint). |

## Divergences closed in 2.0.0 (React Native)

From `DIVERGENCES.md` (contract 1.4.0):

- `crashes.react-native-js-error-metadata` — JS errors now carry
  `jsBundleId`, `release`, `dist` (and the JS-computed fingerprint).
  **Closed.**
- `screens.consecutive-duplicates-dropped` (Android and iOS rows) — for
  React Native apps the dedupe now happens in JS, before native.
  **Closed for RN.**
- `properties.*` — JS normalisation now also keeps surrogate pairs whole at
  the 1024 cut (1.7.x could split an emoji). **Closed.**
- `lifecycle.pre-init-buffer-cap` — 1.7.x dropped the *newest* call when the
  pre-init buffer was full; the contract drops the oldest. **Closed.**
- `lifecycle.pre-init-*` (Android row) — closed for RN by the JS buffer.

The native rows (identity requests, eventId/seq, network types, 402, native
fingerprints) apply to React Native through the cores and close with
unilitix-android 1.11.0 and UnilitixCore 0.8.0. The RN rows above should be
deleted from `DIVERGENCES.md` in the api repo when 2.0.0 ships.
