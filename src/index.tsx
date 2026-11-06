import { NativeModules, Platform } from 'react-native';
import type { components as IngestComponents } from './generated/ingest';
import { SdkContract } from './generated/sdkContract';

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
   * `EXCEPTION`s. Hermes keeps a single rejection tracker, so this replaces
   * any tracker installed before `init()` (React Native's own dev-mode
   * warning is kept: Unilitix logs the same warning in `__DEV__`). Set false
   * if another library must own the tracker.
   * @default true
   */
  trackUnhandledRejections?: boolean;
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

/** Shape of every native call: one options object, one promise. */
type NativeUnilitix = {
  init(options: Record<string, unknown>): Promise<void>;
  track(options: {
    event: string;
    properties: Record<string, unknown>;
  }): Promise<void>;
  identify(options: {
    userId: string;
    traits: Record<string, unknown>;
  }): Promise<void>;
  screen(options: { screenName: string }): Promise<void>;
  recordException(options: {
    type: string;
    message: string;
    stack: string;
    fatal: boolean;
  }): Promise<void>;
  addBreadcrumb(options: { message: string; category: string }): Promise<void>;
  startSession(options: Record<string, never>): Promise<void>;
  endSession(options: Record<string, never>): Promise<void>;
  flush(options: Record<string, never>): Promise<void>;
  optOut(options: Record<string, never>): Promise<void>;
  optIn(options: Record<string, never>): Promise<void>;
  reset(options: Record<string, never>): Promise<void>;
  /** iOS only: the core supports a real pending state. */
  setConsent?(options: { value: UnilitixConsent }): Promise<void>;
};

let _warnedMissing = false;

/**
 * The native module, or null when it is not linked (Expo Go, a missing
 * `pod install`, web). Every call is then a no-op; dev builds warn once.
 */
function native(): NativeUnilitix | null {
  let m: NativeUnilitix | undefined;
  try {
    m = NativeModules.Unilitix as NativeUnilitix | undefined;
  } catch {
    m = undefined;
  }
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
const MAX_DEPTH = 5;
/** Longest string passed to native; longer ones are cut. */
const MAX_STRING_LENGTH = 1024;
/** Most keys (or array items) kept per object. */
const MAX_KEYS = 100;

function sanitizeValue(
  v: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown {
  switch (typeof v) {
    case 'string':
      return v.length > MAX_STRING_LENGTH ? v.slice(0, MAX_STRING_LENGTH) : v;
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
  if (depth >= MAX_DEPTH) return '[Truncated]';
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
    const s = typeof v === 'string' ? v : String(v ?? '');
    return s.length > MAX_STRING_LENGTH ? s.slice(0, MAX_STRING_LENGTH) : s;
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
 * Calls made before `init()` resolves. Replayed in order once the native
 * side is ready, so an app can track from its first render without racing
 * the bridge. Bounded so a never-initialised SDK cannot grow without limit.
 */
const PRE_INIT_LIMIT = SdkContract.preInitBufferSize;
const _preInit: Array<() => Promise<void>> = [];

/**
 * Runs [fn] now when the SDK is ready, queues it while init is in flight or
 * not yet called (bounded), and is a no-op when the native module is
 * missing. Synchronous native throws (e.g. a value the bridge cannot
 * serialise) and rejections are swallowed after a dev warning: analytics
 * must never throw into the app.
 */
function whenReady(
  what: string,
  fn: (m: NativeUnilitix) => Promise<void> | void
): Promise<void> {
  const run = (): Promise<void> =>
    safely(what, () => {
      const m = native();
      if (!m) return undefined;
      return fn(m);
    });
  if (_initialized) return run();
  if (_initAttempt) {
    // A failed init drops calls made while it was in flight.
    return _initAttempt.then(run, () => undefined);
  }
  if (_preInit.length < PRE_INIT_LIMIT) {
    _preInit.push(run);
  } else if (DEV) {
    console.warn(`[Unilitix] ${what} before init() dropped (buffer full)`);
  }
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
    return !!NativeModules.Unilitix;
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
        });
      }
      // Both native layers take the initial consent (pending included);
      // a decision persisted on an earlier launch wins over it.
      await m.init({ ...buildInitOptions(apiKey, config), consent: _consent });
      _initialized = true;
      const queued = _preInit.splice(0, _preInit.length);
      for (const fn of queued) {
        await fn();
      }
      if (config?.debug) {
        console.log('[Unilitix] ✅ SDK initialized');
        const hint = setTimeout(() => {
          if (!_screenEventReceived) {
            console.warn(
              '[Unilitix] ⚠️ No screen events detected. Did you wire ' +
                'Unilitix.screen() to NavigationContainer.onStateChange?'
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
    return safely('track', () =>
      whenReady('track', (m) =>
        m.track({
          event: str(event),
          properties: sanitizeProperties(properties),
        })
      )
    );
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
    return safely('identify', () =>
      whenReady('identify', (m) =>
        m.identify({ userId: str(userId), traits: sanitizeProperties(traits) })
      )
    );
  },

  /**
   * Track a screen view manually.
   *
   * @example
   * ```ts
   * Unilitix.screen('HomeScreen');
   * ```
   */
  screen(screenName: string): Promise<void> {
    _screenEventReceived = true;
    return safely('screen', () =>
      whenReady('screen', (m) => m.screen({ screenName: str(screenName) }))
    );
  },

  /**
   * Report an error you caught yourself as a non-fatal `EXCEPTION` (or a
   * `CRASH` with `fatal: true`), with the current breadcrumb trail.
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
      const report = {
        type: str(err.name || 'Error'),
        message: String(err.message ?? ''),
        stack: String(err.stack ?? ''),
        fatal: options?.fatal === true,
      };
      return whenReady('captureException', (m) => m.recordException(report));
    });
  },

  /**
   * Add a breadcrumb to the trail attached to the next crash report
   * (last 50 kept). Use it for app state that explains a crash — never for
   * personal data.
   */
  addBreadcrumb(message: string, category = 'custom'): Promise<void> {
    return safely('addBreadcrumb', () =>
      whenReady('addBreadcrumb', (m) =>
        m.addBreadcrumb({ message: str(message), category: str(category) })
      )
    );
  },

  /** Start a new session manually. */
  startSession(): Promise<void> {
    return whenReady('startSession', (m) => m.startSession({}));
  },

  /** End the current session manually. */
  endSession(): Promise<void> {
    return whenReady('endSession', (m) => m.endSession({}));
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

  /** Reset user identity. Call on logout. */
  reset(): Promise<void> {
    return whenReady('reset', (m) => m.reset({}));
  },

  /** @internal — exposed for testing only */
  get _screenEventReceived() {
    return _screenEventReceived;
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
  },
};

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

/**
 * Creates a React Navigation state change listener that automatically
 * tracks screen changes with Unilitix.
 *
 * Usage:
 * ```tsx
 * <NavigationContainer onStateChange={createUnilitixNavigationListener()}>
 * ```
 */
export function createUnilitixNavigationListener() {
  return (state: any) => {
    try {
      if (!state) return;
      const route = getActiveRoute(state, 0);
      if (typeof route?.name === 'string') {
        Unilitix.screen(route.name).catch(() => undefined);
      }
    } catch (e) {
      warn('navigation listener', e);
    }
  };
}

function getActiveRoute(state: any, depth: number): any {
  if (!state || !Array.isArray(state.routes) || depth > 32) return null;
  const route = state.routes[state.index ?? state.routes.length - 1];
  if (route?.state) return getActiveRoute(route.state, depth + 1);
  return route;
}

/** Upper bound on how long a fatal error waits for its report to persist. */
const FATAL_FLUSH_BUDGET_MS = SdkContract.fatalFlushBudgetMs;

/** Options for {@link setupUnilitixCrashHandler}. */
export interface UnilitixCrashHandlerOptions {
  /** See {@link UnilitixConfig.trackUnhandledRejections}. @default true */
  trackUnhandledRejections?: boolean;
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
 *   turn off with `trackUnhandledRejections: false`).
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
    installRejectionTracking();
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

/**
 * Hermes (the default engine since React Native 0.70) exposes
 * `HermesInternal.enablePromiseRejectionTracker`; only unhandled rejections
 * are reported, as non-fatal exceptions. Hermes keeps one tracker and has no
 * getter for the current one, so this replaces React Native's (which only
 * warns in development — kept here: the same warning is logged in
 * `__DEV__`). On JSC there is no tracker to hook without a dependency on the
 * `promise` polyfill internals, so rejections there are not reported —
 * `captureException` in your own `.catch` covers it.
 */
function installRejectionTracking() {
  try {
    const hermes = (globalThis as any).HermesInternal;
    if (!hermes?.enablePromiseRejectionTracker) return;
    hermes.enablePromiseRejectionTracker({
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
      },
      onHandled: () => undefined,
    });
  } catch {
    // Older Hermes without the tracker: nothing to install.
  }
}

export default Unilitix;
