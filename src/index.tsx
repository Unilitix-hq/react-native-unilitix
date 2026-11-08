import { AppState, Platform } from 'react-native';
import { fingerprint } from './fingerprint';
import type { components as IngestComponents } from './generated/ingest';
import { SdkContract } from './generated/sdkContract';
import { setScreenSink } from './navigation';
import { lookupNativeModule, type NativeUnilitix } from './nativeModule';

export {
  createUnilitixNavigationListener,
  useUnilitixNavigationTracking,
  withUnilitixNavigation,
  useUnilitixExpoRouterTracking,
  expoRouterScreenName,
  type NavigationContainerRefLike,
} from './navigation';
export { UnilitixMask, UnilitixUnmask } from './UnilitixMask';
export { fingerprint as unilitixFingerprint } from './fingerprint';

/**
 * Wire types of the Unilitix ingest API, generated from the server's
 * OpenAPI contract (`yarn api:types`). The native module builds these
 * payloads; they are exported so integrators and tests can type fixtures.
 */
export type IngestSchemas = IngestComponents['schemas'];
export type IngestEvent = IngestSchemas['IngestEvent'];
export type IngestSessionRequest = IngestSchemas['IngestSessionRequest'];
export type IngestEventsRequest = IngestSchemas['IngestEventsRequest'];
export type IdentifyRequest = IngestSchemas['IdentifyRequest'];
export type ApiErrorResponse = IngestSchemas['ErrorResponse'];

const LINKING_ERROR =
  `The package 'react-native-unilitix' doesn't seem to be linked. ` +
  `Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

// `__DEV__` is defined by React Native, not by every test runner.
const DEV = typeof __DEV__ !== 'undefined' && __DEV__;

/** The user's consent to analytics and replay collection. */
export type UnilitixConsent = 'granted' | 'pending' | 'denied';

export interface UnilitixConfig {
  /** API endpoint URL. Default: https://api.unilitix.com */
  apiUrl?: string;
  /** Enable console logging. Default: false */
  debug?: boolean;
  /**
   * Enable automatic screen tracking.
   * Note: In React Native, this has no effect on React Navigation screens
   * (all screens run in a single Activity). Use createUnilitixNavigationListener
   * or call Unilitix.screen() manually via NavigationContainer.onStateChange.
   * @default true
   */
  autoTrackScreens?: boolean;
  /** Auto-track user taps. Default: true */
  autoTrackTaps?: boolean;
  /**
   * Enable automatic crash tracking of native (Kotlin/Java) crashes.
   * JS errors are reported by `setupUnilitixCrashHandler()`, which `init()`
   * installs for you unless `installJsCrashHandler` is false.
   * @default true
   */
  autoTrackCrashes?: boolean;
  /**
   * iOS: report the app as not responding (an `ANR` issue) when the main
   * thread is blocked for this long. 0 turns it off. Requires
   * `autoTrackCrashes`. Android reports ANRs from the system (Android 11+).
   * @default 2000
   */
  appHangTimeoutMs?: number;
  /**
   * Install the JS error and unhandled-promise-rejection handlers during
   * `init()`. Set false to call `setupUnilitixCrashHandler()` yourself.
   * @default true
   */
  installJsCrashHandler?: boolean;
  /** Auto-detect rage taps. Default: true */
  autoTrackRageTaps?: boolean;
  /** Flush interval in seconds. Default: 30 */
  flushIntervalSeconds?: number;
  /** Max events per flush batch. Default: 100 */
  flushBatchSize?: number;
  /** Max events stored offline when there is no connectivity. Default: 1000 */
  maxOfflineEvents?: number;
  /** Session timeout in seconds. Default: 1800 */
  sessionTimeoutSeconds?: number;
  /**
   * Consent state to start in when the user has not decided yet.
   * `'granted'` collects and uploads (default). `'denied'` collects nothing.
   * `'pending'` keeps events (and replay) on the device and uploads nothing
   * until `setConsent('granted')` sends them, or `setConsent('denied')`
   * deletes them. Works the same on iOS and Android.
   * A decision recorded with `setConsent` on an earlier launch wins.
   * @default 'granted'
   */
  consent?: UnilitixConsent;
  /** Mask text inputs in replay snapshots and screenshots. Default: true */
  maskInputs?: boolean;
  /**
   * Mask text inputs in screenshots specifically. Defaults to `maskInputs`.
   */
  maskInputsInScreenshots?: boolean;
  /**
   * Mask every text view in replay (balances, names, OTPs are usually plain
   * text). Default: true. Opt a view out with the native unmask API.
   */
  maskAllText?: boolean;
  /** Black out image views in replay. Default: false */
  maskImages?: boolean;
  /** Capture DOM snapshots for session replay. Default: true */
  captureSnapshots?: boolean;
  /** Capture screenshots for session replay. Default: true */
  captureScreenshots?: boolean;
  /**
   * Report unhandled promise rejections (Hermes only) as non-fatal
   * `EXCEPTION`s. Hermes keeps a single rejection tracker and has no getter
   * for it: a tracker installed *after* `init()` is chained (it keeps
   * receiving every callback); one installed *before* is chained when you
   * pass it as {@link rejectionTracker}. React Native's own dev-mode warning
   * is kept (logged in `__DEV__`). Set false if another library must own
   * the tracker outright.
   * @default true
   */
  trackUnhandledRejections?: boolean;
  /**
   * A Hermes rejection tracker your app (or a library) installed before
   * `init()`, so Unilitix keeps calling it after taking over the tracker.
   */
  rejectionTracker?: UnilitixRejectionTracker;
  /**
   * `metadata.jsBundleId` of JS errors: the id the source map was uploaded
   * with. Default: the id the Metro plugin (`react-native-unilitix/metro`)
   * injected into the bundle, else the bundle file name
   * (`index.android.bundle` / `main.jsbundle`). Set it for over-the-air
   * updates (e.g. the EAS Update id).
   */
  jsBundleId?: string;
  /**
   * `metadata.release` of JS errors. Default: the app version
   * (versionName / CFBundleShortVersionString). Set it to the OTA release
   * label when the JS ships over the air.
   */
  release?: string;
  /**
   * `metadata.dist` of JS errors. Default: the build number
   * (versionCode / CFBundleVersion).
   */
  dist?: string;
  /** Only upload screenshots on Wi-Fi. Default: true */
  uploadScreenshotsOnWifiOnly?: boolean;
  /**
   * Fraction of sessions for which replay is captured (0–1). Default: 1.
   * Alias of the older `sampleRate`.
   */
  replaySampleRate?: number;
  /** @deprecated use `replaySampleRate` */
  sampleRate?: number;
  // Advanced tuning — defaults are suitable for most apps
  /** Snapshot capture interval in ms. Default: 1000 */
  snapshotIntervalMs?: number;
  /** Max snapshots stored per session. Default: 1500 */
  maxSnapshotsPerSession?: number;
  /** Screenshot capture interval in ms. Default: 1000 */
  screenshotIntervalMs?: number;
  /** Screenshot JPEG quality 0–100. Default: 30 */
  screenshotQuality?: number;
  /** Max screenshot width in px (downscaled). Default: 480 */
  screenshotMaxWidth?: number;
  /** Max screenshots stored per session. Default: 1500 */
  maxScreenshotsPerSession?: number;
  /**
   * Max screenshots per rolling minute. Default: 20
   */
  maxScreenshotsPerMinute?: number;
  /**
   * Capture a frame this often (ms) even when the screen does not change,
   * so a replay never looks frozen. 0 turns it off.
   * Default: 10000
   */
  screenshotHeartbeatMs?: number;
}

/**
 * A Hermes promise rejection tracker
 * (`HermesInternal.enablePromiseRejectionTracker` options).
 */
export interface UnilitixRejectionTracker {
  allRejections?: boolean;
  onUnhandled?: (id: number, reason: unknown) => void;
  onHandled?: (id: number) => void;
}

let _warnedMissing = false;

/**
 * The native module (TurboModule, or the legacy bridge module), or null
 * when it is not linked (Expo Go, a missing `pod install`, web). Every call
 * is then a no-op; dev builds warn once.
 */
function native(): NativeUnilitix | null {
  const m = lookupNativeModule();
  if (!m) {
    if (DEV && !_warnedMissing) {
      _warnedMissing = true;
      console.warn(`[Unilitix] Disabled (calls are no-ops). ${LINKING_ERROR}`);
    }
    return null;
  }
  return m;
}

function warn(what: string, e: unknown) {
  if (!DEV) return;
  try {
    console.warn(`[Unilitix] ${what} failed:`, e);
  } catch {
    // A broken console must not break the app either.
  }
}

/**
 * Runs [fn] and turns anything it throws synchronously, or any rejection of
 * the promise it returns, into a resolved promise. Analytics must never
 * throw or reject into the host app.
 */
function safely(what: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    return Promise.resolve(fn()).then(
      () => undefined,
      (e: unknown) => warn(what, e)
    );
  } catch (e) {
    warn(what, e);
    return Promise.resolve();
  }
}

// ── Property sanitising ─────────────────────────────────────────────────────

/** Deepest nesting passed to native; deeper values become `'[Truncated]'`. */
const MAX_DEPTH = SdkContract.maxPropertyDepth;
/** Longest string passed to native, in UTF-16 units; longer ones are cut. */
const MAX_STRING_LENGTH = SdkContract.maxStringLength;
/** Most keys (or array items) kept per object. */
const MAX_KEYS = SdkContract.maxPropertyKeys;
const TRUNCATED = SdkContract.truncatedMarker;

/**
 * Cuts [s] to at most [max] UTF-16 units without splitting a surrogate
 * pair (an emoji at the cut point is dropped whole).
 * @internal exported for tests
 */
export function truncate(s: string, max = MAX_STRING_LENGTH): string {
  if (s.length <= max) return s;
  let end = max;
  const last = s.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end -= 1;
  return s.slice(0, end);
}

function sanitizeValue(
  v: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown {
  switch (typeof v) {
    case 'string':
      return truncate(v);
    case 'number':
      return Number.isFinite(v) ? v : null;
    case 'boolean':
      return v;
    case 'bigint':
      return v.toString();
    case 'undefined':
    case 'function':
    case 'symbol':
      return undefined;
  }
  if (v === null) return null;
  const o = v as object;
  if (o instanceof Date) {
    return Number.isNaN(o.getTime()) ? null : o.toISOString();
  }
  if (o instanceof Error) {
    return sanitizeValue(`${o.name}: ${o.message}`, depth, seen);
  }
  if (seen.has(o)) return '[Circular]';
  if (depth >= MAX_DEPTH) return TRUNCATED;
  seen.add(o);
  try {
    if (Array.isArray(o)) {
      return o.slice(0, MAX_KEYS).map((item) => {
        const s = sanitizeValue(item, depth + 1, seen);
        return s === undefined ? null : s;
      });
    }
    return sanitizeObject(o as Record<string, unknown>, depth + 1, seen);
  } finally {
    // Only ancestors count as circular; the same object twice is fine.
    seen.delete(o);
  }
}

function sanitizeObject(
  o: Record<string, unknown>,
  depth: number,
  seen: WeakSet<object>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let keys: string[];
  try {
    keys = Object.keys(o);
  } catch {
    return out;
  }
  for (const key of keys.slice(0, MAX_KEYS)) {
    let value: unknown;
    try {
      value = o[key]; // a getter may throw
    } catch {
      continue;
    }
    const s = sanitizeValue(value, depth, seen);
    if (s !== undefined) out[key] = s;
  }
  return out;
}

/**
 * Makes event properties / user traits safe for the bridge: drops functions,
 * symbols and undefined, replaces circular references with `'[Circular]'`,
 * caps nesting at {@link MAX_DEPTH}, string length at
 * {@link MAX_STRING_LENGTH} and keys per object at {@link MAX_KEYS}.
 * @internal exported for tests
 */
export function sanitizeProperties(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  try {
    const seen = new WeakSet<object>();
    seen.add(input);
    return sanitizeObject(input as Record<string, unknown>, 1, seen);
  } catch {
    return {};
  }
}

function str(v: unknown): string {
  try {
    return truncate(typeof v === 'string' ? v : String(v ?? ''));
  } catch {
    return '';
  }
}

// ── State ────────────────────────────────────────────────────────────────────

/** What the app awaits: always resolves. */
let _initPromise: Promise<void> | null = null;
/** The native init itself: rejects on failure, so queued calls are held. */
let _initAttempt: Promise<void> | null = null;
let _initialized = false;
let _consent: UnilitixConsent = 'granted';
/** True once the app called `setConsent` (before or after init). */
let _consentSetByApp = false;
let _screenEventReceived = false;
let _crashHandlerInstalled = false;

/**
 * The screen last sent to native in the current session, for the
 * contract's dedupe rule (`screen(name)` emits only when the name differs
 * from the session's current screen). Cleared whenever a new session may
 * have started: init, reset, startSession/endSession, and a return to the
 * foreground after the session timeout or with a new native session id.
 */
let _lastScreen: string | null = null;
/** The native session id `_lastScreen` belongs to, when native reports it. */
let _screenSessionId: string | null = null;
let _sessionTimeoutMs = 1800 * 1000;
let _backgroundedAt: number | null = null;
let _appStateSubscription: { remove(): void } | null = null;

/** release / dist / jsBundleId sent with every JS error. */
type JsErrorInfo = { jsBundleId?: string; release?: string; dist?: string };
let _configuredErrorInfo: JsErrorInfo = {};
let _buildInfo: { release?: string; dist?: string } = {};

/**
 * Calls made before `init()` resolves. Replayed in order once the native
 * side is ready, so an app can track from its first render without racing
 * the bridge. Bounded so a never-initialised SDK cannot grow without limit:
 * the oldest call is dropped first (`preInitBufferSize`).
 */
const PRE_INIT_LIMIT = SdkContract.preInitBufferSize;
const _preInit: Array<() => Promise<void>> = [];
/** Calls chained on the in-flight init that have not run yet. */
let _waitingForInit = 0;

/**
 * Runs [fn] now when the SDK is ready, queues it while init is in flight or
 * not yet called (bounded), and is a no-op when the native module is
 * missing. Synchronous native throws (e.g. a value the bridge cannot
 * serialise) and rejections are swallowed after a dev warning: analytics
 * must never throw into the app.
 */
function whenReady(
  what: string,
  fn: (m: NativeUnilitix) => Promise<unknown> | void
): Promise<void> {
  const run = (): Promise<void> =>
    safely(what, () => {
      const m = native();
      if (!m) return undefined;
      return fn(m) as Promise<void> | void;
    });
  if (_initialized && _waitingForInit === 0) return run();
  if (_initAttempt) {
    // Ordered after the replay of earlier calls (and after calls already
    // waiting, so nothing overtakes them); a failed init drops calls made
    // while it was in flight.
    _waitingForInit++;
    return _initAttempt.then(
      () => {
        _waitingForInit--;
        return run();
      },
      () => {
        _waitingForInit--;
      }
    );
  }
  if (_preInit.length >= PRE_INIT_LIMIT) {
    _preInit.shift();
    if (DEV) {
      console.warn(
        `[Unilitix] buffer of calls before init() is full: oldest dropped`
      );
    }
  }
  _preInit.push(run);
  return Promise.resolve();
}

function buildInitOptions(apiKey: string, config?: UnilitixConfig) {
  return {
    apiKey,
    apiUrl: config?.apiUrl ?? 'https://api.unilitix.com',
    debug: config?.debug ?? false,
    autoTrackScreens: config?.autoTrackScreens ?? true,
    autoTrackTaps: config?.autoTrackTaps ?? true,
    autoTrackCrashes: config?.autoTrackCrashes ?? true,
    ...(config?.appHangTimeoutMs !== undefined
      ? { appHangTimeoutMs: config.appHangTimeoutMs }
      : {}),
    autoTrackRageTaps: config?.autoTrackRageTaps ?? true,
    flushIntervalSeconds: config?.flushIntervalSeconds ?? 30,
    flushBatchSize: config?.flushBatchSize ?? 100,
    maxOfflineEvents: config?.maxOfflineEvents ?? 1000,
    sessionTimeoutSeconds: config?.sessionTimeoutSeconds ?? 1800,
    maskInputs: config?.maskInputs ?? true,
    maskInputsInScreenshots:
      config?.maskInputsInScreenshots ?? config?.maskInputs ?? true,
    maskAllText: config?.maskAllText ?? true,
    maskImages: config?.maskImages ?? false,
    captureSnapshots: config?.captureSnapshots ?? true,
    captureScreenshots: config?.captureScreenshots ?? true,
    uploadScreenshotsOnWifiOnly: config?.uploadScreenshotsOnWifiOnly ?? true,
    sampleRate: config?.replaySampleRate ?? config?.sampleRate ?? 1.0,
    snapshotIntervalMs: config?.snapshotIntervalMs ?? 1000,
    maxSnapshotsPerSession: config?.maxSnapshotsPerSession ?? 1500,
    screenshotIntervalMs: config?.screenshotIntervalMs ?? 1000,
    screenshotQuality: config?.screenshotQuality ?? 30,
    screenshotMaxWidth: config?.screenshotMaxWidth ?? 480,
    maxScreenshotsPerSession: config?.maxScreenshotsPerSession ?? 1500,
    maxScreenshotsPerMinute: config?.maxScreenshotsPerMinute ?? 20,
    screenshotHeartbeatMs: config?.screenshotHeartbeatMs ?? 10000,
  };
}

// ── JS error metadata (source maps) ─────────────────────────────────────────

/** Prefix of the bundle id the Metro plugin injects (see metro.js). */
const BUNDLE_ID_MARKER = 'UNILITIX_BUNDLE_ID=';
/** What `unilitix-cli upload-sourcemap --bundle-id` accepts. */
const BUNDLE_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;

function nonEmpty(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? str(v.trim()) : undefined;
}

/**
 * `metadata.jsBundleId`: the configured id, else the id injected at build
 * time by `react-native-unilitix/metro`, else the bundle file name the CLI
 * uses by default.
 * @internal exported for tests
 */
export function currentJsBundleId(): string {
  const configured = nonEmpty(_configuredErrorInfo.jsBundleId);
  if (configured) return configured;
  try {
    const injected = (globalThis as { __UNILITIX_BUNDLE_ID__?: unknown })
      .__UNILITIX_BUNDLE_ID__;
    if (typeof injected === 'string') {
      const id = injected.startsWith(BUNDLE_ID_MARKER)
        ? injected.slice(BUNDLE_ID_MARKER.length)
        : injected;
      if (BUNDLE_ID_RE.test(id)) return id;
    }
  } catch {
    // fall through to the default
  }
  return Platform.OS === 'ios' ? 'main.jsbundle' : 'index.android.bundle';
}

/** Contract 1.4.0 metadata of a JS error (`metadata.*`). */
function jsErrorMetadata(): Record<string, string> {
  const out: Record<string, string> = {
    platform: 'react-native',
    [SdkContract.metadataJsBundleId]: currentJsBundleId(),
  };
  const release =
    nonEmpty(_configuredErrorInfo.release) ?? nonEmpty(_buildInfo.release);
  const dist = nonEmpty(_configuredErrorInfo.dist) ?? nonEmpty(_buildInfo.dist);
  if (release) out[SdkContract.metadataRelease] = release;
  if (dist) out[SdkContract.metadataDist] = dist;
  return out;
}

async function loadBuildInfo(m: NativeUnilitix): Promise<void> {
  try {
    if (!m.getBuildInfo) return;
    const info = (await m.getBuildInfo({})) as {
      appVersion?: unknown;
      buildNumber?: unknown;
    } | null;
    _buildInfo = {
      release: nonEmpty(info?.appVersion),
      dist: nonEmpty(
        typeof info?.buildNumber === 'number'
          ? String(info.buildNumber)
          : info?.buildNumber
      ),
    };
  } catch (e) {
    warn('getBuildInfo', e);
  }
}

// ── Sessions (screen dedupe) ────────────────────────────────────────────────

/** A new session may have started: the next screen is always sent. */
function forgetScreen() {
  _lastScreen = null;
  _screenSessionId = null;
}

/** Remembers the native session the current screen belongs to. */
function refreshSessionId(m: NativeUnilitix): void {
  if (!m.currentSessionId) return;
  try {
    Promise.resolve(m.currentSessionId({})).then(
      (id) => {
        const sid = typeof id === 'string' && id !== '' ? id : null;
        if (_screenSessionId !== null && sid !== _screenSessionId) {
          // The core started a new session we were not told about.
          _lastScreen = null;
        }
        _screenSessionId = sid;
      },
      () => undefined
    );
  } catch {
    // Older native module: the timeout rule below still applies.
  }
}

function onAppStateChange(state: string) {
  if (state === 'background' || state === 'inactive') {
    if (state === 'background') _backgroundedAt = Date.now();
    return;
  }
  if (state !== 'active') return;
  const since = _backgroundedAt;
  _backgroundedAt = null;
  if (since !== null && Date.now() - since >= _sessionTimeoutMs) {
    // The core starts a new session on this foreground.
    _lastScreen = null;
  }
  const m = _initialized ? native() : null;
  if (m) refreshSessionId(m);
}

function watchAppState() {
  if (_appStateSubscription) return;
  try {
    const sub = AppState?.addEventListener?.('change', onAppStateChange);
    _appStateSubscription = sub ?? null;
  } catch {
    _appStateSubscription = null;
  }
}

/**
 * Unilitix React Native SDK
 *
 * @example
 * ```ts
 * // In App.tsx or index.js
 * await Unilitix.init('YOUR_API_KEY');
 * ```
 */
const Unilitix = {
  /**
   * True when the SDK can collect on this platform and the native module is
   * linked (false in Expo Go).
   */
  get isAvailable(): boolean {
    return lookupNativeModule() !== null;
  },

  /** True once `init()` has completed on the native side. */
  get isInitialized(): boolean {
    return _initialized;
  },

  /** The current consent state. */
  get consent(): UnilitixConsent {
    return _consent;
  },

  /**
   * Initialize the Unilitix SDK. Call once; later calls return the same
   * promise. Calls to `track`/`identify`/`screen` made before this resolves
   * are queued and replayed.
   *
   * Never rejects: when the native init fails the SDK stays uninitialised
   * (`isInitialized` is false, dev builds log a warning) and `init()` can be
   * called again. When the native module is not linked (Expo Go) it
   * resolves at once and every call is a no-op.
   *
   * @example
   * ```ts
   * await Unilitix.init('your_api_key');
   * ```
   */
  init(apiKey: string, config?: UnilitixConfig): Promise<void> {
    if (_initPromise) return _initPromise;
    // A decision the app recorded with setConsent() before init wins over
    // the configured starting state.
    if (!_consentSetByApp) _consent = config?.consent ?? 'granted';
    _configuredErrorInfo = {
      jsBundleId: config?.jsBundleId,
      release: config?.release,
      dist: config?.dist,
    };
    const attempt = (async () => {
      const m = native();
      if (!m) {
        // Not linked (Expo Go): stay a no-op, free the pre-init buffer.
        _preInit.length = 0;
        return;
      }
      // Installed before the native init resolves, so an error thrown while
      // the app is still starting is reported (queued until init completes).
      if (config?.installJsCrashHandler !== false) {
        setupUnilitixCrashHandler({
          trackUnhandledRejections: config?.trackUnhandledRejections,
          rejectionTracker: config?.rejectionTracker,
        });
      }
      // Both native layers take the initial consent (pending included);
      // a decision persisted on an earlier launch wins over it.
      await m.init({ ...buildInitOptions(apiKey, config), consent: _consent });
      _sessionTimeoutMs = (config?.sessionTimeoutSeconds ?? 1800) * 1000;
      forgetScreen();
      await loadBuildInfo(m);
      refreshSessionId(m);
      watchAppState();
      // Replay in call order; calls made meanwhile wait for the replay.
      const queued = _preInit.splice(0, _preInit.length);
      for (const fn of queued) {
        await fn();
      }
      _initialized = true;
      if (config?.debug) {
        console.log('[Unilitix] ✅ SDK initialized');
        const hint = setTimeout(() => {
          if (!_screenEventReceived) {
            console.warn(
              '[Unilitix] ⚠️ No screen events detected. Did you add ' +
                'useUnilitixNavigationTracking(navigationRef)?'
            );
          }
        }, 5000);
        // Never keep a Node-based test runner alive for a hint.
        (hint as unknown as { unref?: () => void }).unref?.();
      }
    })();
    _initAttempt = attempt;
    _initPromise = attempt.then(
      () => undefined,
      (e: unknown) => {
        // Let the app retry init rather than latching a failed promise.
        _initPromise = null;
        _initAttempt = null;
        warn('init', e);
      }
    );
    return _initPromise;
  },

  /**
   * Track a custom event.
   *
   * @example
   * ```ts
   * Unilitix.track('purchase_completed', { amount: 5000, currency: 'NGN' });
   * ```
   */
  track(event: string, properties?: Record<string, unknown>): Promise<void> {
    return safely('track', () => {
      const payload = {
        event: str(event),
        properties: sanitizeProperties(properties),
      };
      return whenReady('track', (m) => m.track(payload));
    });
  },

  /**
   * Identify the current user. Call after login.
   *
   * @example
   * ```ts
   * Unilitix.identify('user_123', { plan: 'pro', country: 'Nigeria' });
   * ```
   */
  identify(userId: string, traits?: Record<string, unknown>): Promise<void> {
    return safely('identify', () => {
      const payload = {
        userId: str(userId),
        traits: sanitizeProperties(traits),
      };
      return whenReady('identify', (m) => m.identify(payload));
    });
  },

  /**
   * Track a screen view. Sends route names, never params. A screen equal to
   * the session's current screen is dropped (contract rule), so calling it
   * from several places is harmless.
   *
   * @example
   * ```ts
   * Unilitix.screen('HomeScreen');
   * ```
   */
  screen(screenName: string): Promise<void> {
    _screenEventReceived = true;
    return safely('screen', () => {
      const name = str(screenName);
      return whenReady('screen', (m) => {
        if (name === _lastScreen) return undefined;
        _lastScreen = name;
        return m.screen({ screenName: name });
      });
    });
  },

  /**
   * Report an error you caught yourself as a non-fatal `EXCEPTION` (or a
   * `CRASH` with `fatal: true`), with the current breadcrumb trail, the
   * contract fingerprint and the source-map ids (`jsBundleId`, `release`,
   * `dist`).
   *
   * @example
   * ```ts
   * try { await pay(card); } catch (e) { Unilitix.captureException(e); }
   * ```
   */
  captureException(
    error: unknown,
    options?: { fatal?: boolean }
  ): Promise<void> {
    return safely('captureException', () => {
      const err = toError(error);
      const type = str(err.name || 'Error');
      const message = String(err.message ?? '');
      const stack = String(err.stack ?? '');
      const fp = fingerprint(type, stack);
      const fatal = options?.fatal === true;
      return whenReady('captureException', (m) =>
        m.recordException({
          type,
          message,
          stack,
          fatal,
          ...(fp ? { fingerprint: fp } : {}),
          metadata: jsErrorMetadata(),
        })
      );
    });
  },

  /**
   * Add a breadcrumb to the trail attached to the next crash report
   * (last 50 kept). Use it for app state that explains a crash — never for
   * personal data.
   */
  addBreadcrumb(message: string, category = 'custom'): Promise<void> {
    return safely('addBreadcrumb', () => {
      const payload = { message: str(message), category: str(category) };
      return whenReady('addBreadcrumb', (m) => m.addBreadcrumb(payload));
    });
  },

  /** Start a new session manually. */
  startSession(): Promise<void> {
    return whenReady('startSession', (m) => {
      forgetScreen();
      const done = m.startSession({});
      refreshSessionId(m);
      return done;
    });
  },

  /** End the current session manually. */
  endSession(): Promise<void> {
    return whenReady('endSession', (m) => {
      forgetScreen();
      return m.endSession({});
    });
  },

  /** Flush all queued events immediately. */
  flush(): Promise<void> {
    return whenReady('flush', (m) => m.flush({}));
  },

  /**
   * Record the user's consent decision, persisted across launches.
   * `'granted'` uploads (including anything held while pending); `'denied'`
   * stops collection and deletes what is queued; `'pending'` holds data on
   * the device without uploading it.
   */
  setConsent(value: UnilitixConsent): Promise<void> {
    _consent = value;
    _consentSetByApp = true;
    return whenReady('setConsent', (m) => {
      if (m.setConsent) return m.setConsent({ value });
      // Older native modules without setConsent.
      return value === 'granted' ? m.optIn({}) : m.optOut({});
    });
  },

  /** Stop all tracking. Same as `setConsent('denied')`. */
  optOut(): Promise<void> {
    return Unilitix.setConsent('denied');
  },

  /** Resume tracking after optOut. Same as `setConsent('granted')`. */
  optIn(): Promise<void> {
    return Unilitix.setConsent('granted');
  },

  /**
   * Reset user identity and start a new session. Call on logout.
   */
  reset(): Promise<void> {
    return whenReady('reset', (m) => {
      forgetScreen();
      const done = m.reset({});
      refreshSessionId(m);
      return done;
    });
  },

  /** @internal — exposed for testing only */
  get _screenEventReceived() {
    return _screenEventReceived;
  },

  /** @internal — exposed for testing only */
  _onAppStateChange(state: string) {
    onAppStateChange(state);
  },

  /** @internal — exposed for testing only */
  _resetForTests() {
    _initPromise = null;
    _initAttempt = null;
    _initialized = false;
    _consent = 'granted';
    _consentSetByApp = false;
    _warnedMissing = false;
    _screenEventReceived = false;
    _crashHandlerInstalled = false;
    _preInit.length = 0;
    _waitingForInit = 0;
    _lastScreen = null;
    _screenSessionId = null;
    _sessionTimeoutMs = 1800 * 1000;
    _backgroundedAt = null;
    try {
      _appStateSubscription?.remove();
    } catch {
      // ignore
    }
    _appStateSubscription = null;
    _configuredErrorInfo = {};
    _buildInfo = {};
  },
};

setScreenSink((name) => {
  Unilitix.screen(name).catch(() => undefined);
});

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  if (e !== null && typeof e === 'object') {
    // An Error from another realm, or an error-like object.
    const o = e as { name?: unknown; message?: unknown; stack?: unknown };
    if (typeof o.message === 'string' && typeof o.stack === 'string') {
      const err = new Error(o.message);
      err.name = typeof o.name === 'string' ? o.name : 'Error';
      err.stack = o.stack;
      return err;
    }
  }
  const err = new Error(typeof e === 'string' ? e : safeStringify(e));
  err.name = 'NonError';
  return err;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v) ?? String(v);
  } catch {
    return String(v);
  }
}

/** Upper bound on how long a fatal error waits for its report to persist. */
const FATAL_FLUSH_BUDGET_MS = SdkContract.fatalFlushBudgetMs;

/** Options for {@link setupUnilitixCrashHandler}. */
export interface UnilitixCrashHandlerOptions {
  /** See {@link UnilitixConfig.trackUnhandledRejections}. @default true */
  trackUnhandledRejections?: boolean;
  /** See {@link UnilitixConfig.rejectionTracker}. */
  rejectionTracker?: UnilitixRejectionTracker;
}

/**
 * Installs the global JS error handler and unhandled-promise-rejection
 * tracking, forwarding to Unilitix crash reporting. `init()` calls this for
 * you; calling it again is a no-op.
 *
 * - Uncaught JS errors become `CRASH` (fatal as React Native reports it);
 *   the report is persisted (bounded to 2 s) before the previous handler —
 *   which usually ends the process — runs.
 * - Unhandled promise rejections become non-fatal `EXCEPTION`s (Hermes;
 *   turn off with `trackUnhandledRejections: false`). Other trackers are
 *   chained, see {@link UnilitixConfig.trackUnhandledRejections}.
 *
 * Does not replace React Native's default error handler — chains to it,
 * always, with the original `isFatal`, even if reporting fails.
 */
export function setupUnilitixCrashHandler(
  options?: UnilitixCrashHandlerOptions
): void {
  if (_crashHandlerInstalled) return;
  _crashHandlerInstalled = true;
  try {
    installGlobalHandler();
  } catch (e) {
    warn('installing the JS error handler', e);
  }
  if (options?.trackUnhandledRejections !== false) {
    installRejectionTracking(options?.rejectionTracker);
  }
}

function installGlobalHandler() {
  const errorUtils = (globalThis as any).ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) return;
  const previousHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
    let chained = false;
    // Runs the previous handler exactly once, with the original arguments.
    // Its own exceptions propagate as they would without Unilitix.
    const chain = () => {
      if (chained) return;
      chained = true;
      if (typeof previousHandler === 'function')
        previousHandler(error, isFatal);
    };
    let report: Promise<void> | null = null;
    try {
      report = Unilitix.captureException(error, { fatal: isFatal === true });
    } catch {
      report = null;
    }
    if (isFatal !== true || !report) {
      chain();
      return;
    }
    // A fatal error: give the report a bounded head start before the
    // default handler shows the red box / kills the process.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (timer !== undefined) clearTimeout(timer);
      chain();
    };
    try {
      timer = setTimeout(finish, FATAL_FLUSH_BUDGET_MS);
      report.then(finish, finish);
    } catch {
      finish();
    }
  });
}

function callSafely(fn: (() => void) | undefined) {
  if (!fn) return;
  try {
    fn();
  } catch {
    // Another tracker's failure must not stop ours (or the app).
  }
}

/**
 * Hermes (the default engine since React Native 0.70) exposes
 * `HermesInternal.enablePromiseRejectionTracker`; only unhandled rejections
 * are reported, as non-fatal exceptions. Hermes keeps one tracker and has
 * no getter for the current one, so:
 *
 * - a tracker passed as [previous] (installed before init) is chained;
 * - `enablePromiseRejectionTracker` is wrapped so a tracker installed
 *   after this one is chained too instead of silently replacing it;
 * - React Native's own tracker only warns in development: the same warning
 *   is logged in `__DEV__`.
 *
 * On JSC there is no tracker to hook without a dependency on the `promise`
 * polyfill internals, so rejections there are not reported —
 * `captureException` in your own `.catch` covers it.
 */
function installRejectionTracking(previous?: UnilitixRejectionTracker) {
  try {
    const hermes = (globalThis as any).HermesInternal;
    const enable = hermes?.enablePromiseRejectionTracker;
    if (typeof enable !== 'function') return;
    const chained: UnilitixRejectionTracker[] = previous ? [previous] : [];
    enable.call(hermes, {
      allRejections: true,
      onUnhandled: (id: number, reason: unknown) => {
        if (DEV) {
          try {
            console.warn(
              `Possible unhandled promise rejection (id: ${id}):`,
              reason
            );
          } catch {
            // ignore
          }
        }
        Unilitix.captureException(reason, { fatal: false }).catch(
          () => undefined
        );
        for (const t of chained) callSafely(() => t.onUnhandled?.(id, reason));
      },
      onHandled: (id: number) => {
        for (const t of chained) callSafely(() => t.onHandled?.(id));
      },
    });
    try {
      hermes.enablePromiseRejectionTracker = (
        options?: UnilitixRejectionTracker
      ) => {
        if (options && typeof options === 'object') chained.push(options);
      };
    } catch {
      // A frozen HermesInternal: later trackers replace ours, as before.
    }
  } catch {
    // Older Hermes without the tracker: nothing to install.
  }
}

export default Unilitix;
