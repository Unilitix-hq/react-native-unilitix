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

// Read at call time (tests switch platforms).
const isIOS = () => Platform.OS === 'ios';
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
   * `'pending'` keeps events on the device and uploads nothing until
   * `setConsent('granted')` (iOS). On Android it currently behaves like
   * `'denied'` until consent is granted: the Android library does not yet
   * hold data while a decision is pending.
   * @default 'granted'
   */
  consent?: UnilitixConsent;
  /** Mask text inputs in replay snapshots and screenshots. Default: true */
  maskInputs?: boolean;
  /**
   * Mask every text view in replay (balances, names, OTPs are usually plain
   * text). Default: true. Not yet honoured by unilitix-android < 1.5; sent
   * so an upgrade of the library picks it up without a JS change.
   */
  maskAllText?: boolean;
  /** Black out image views in replay. Default: false */
  maskImages?: boolean;
  /** Capture DOM snapshots for session replay. Default: true */
  captureSnapshots?: boolean;
  /** Capture screenshots for session replay. Default: true */
  captureScreenshots?: boolean;
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
  /** Max snapshots stored per session. Default: 200 */
  maxSnapshotsPerSession?: number;
  /** Screenshot capture interval in ms. Default: 1000 */
  screenshotIntervalMs?: number;
  /** Screenshot JPEG quality 0–100. Default: 30 */
  screenshotQuality?: number;
  /** Max screenshot width in px (downscaled). Default: 480 */
  screenshotMaxWidth?: number;
  /** Max screenshots stored per session. Default: 300 */
  maxScreenshotsPerSession?: number;
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

function native(): NativeUnilitix | null {
  const m = NativeModules.Unilitix as NativeUnilitix | undefined;
  if (!m) throw new Error(LINKING_ERROR);
  return m;
}

// ── State ────────────────────────────────────────────────────────────────────

let _initPromise: Promise<void> | null = null;
let _initialized = false;
let _consent: UnilitixConsent = 'granted';
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
 * Runs [fn] now when the SDK is ready, queues it when init is in flight,
 * and drops it (with a warning) when init was never called. Native
 * rejections are swallowed after logging: analytics must never throw into
 * the app.
 */
function whenReady(what: string, fn: (m: NativeUnilitix) => Promise<void>) {
  const run = () => {
    const m = native();
    if (!m) return Promise.resolve();
    return fn(m).catch((e: unknown) => {
      if (DEV) console.warn(`[Unilitix] ${what} failed:`, e);
    });
  };
  if (_initialized) return run();
  if (_initPromise) {
    return _initPromise.then(run, () => undefined);
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
    autoTrackRageTaps: config?.autoTrackRageTaps ?? true,
    flushIntervalSeconds: config?.flushIntervalSeconds ?? 30,
    flushBatchSize: config?.flushBatchSize ?? 100,
    maxOfflineEvents: config?.maxOfflineEvents ?? 1000,
    sessionTimeoutSeconds: config?.sessionTimeoutSeconds ?? 1800,
    maskInputs: config?.maskInputs ?? true,
    maskAllText: config?.maskAllText ?? true,
    maskImages: config?.maskImages ?? false,
    captureSnapshots: config?.captureSnapshots ?? true,
    captureScreenshots: config?.captureScreenshots ?? true,
    uploadScreenshotsOnWifiOnly: config?.uploadScreenshotsOnWifiOnly ?? true,
    sampleRate: config?.replaySampleRate ?? config?.sampleRate ?? 1.0,
    snapshotIntervalMs: config?.snapshotIntervalMs ?? 1000,
    maxSnapshotsPerSession: config?.maxSnapshotsPerSession ?? 200,
    screenshotIntervalMs: config?.screenshotIntervalMs ?? 1000,
    screenshotQuality: config?.screenshotQuality ?? 30,
    screenshotMaxWidth: config?.screenshotMaxWidth ?? 480,
    maxScreenshotsPerSession: config?.maxScreenshotsPerSession ?? 300,
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
   * @example
   * ```ts
   * await Unilitix.init('your_api_key');
   * ```
   */
  init(apiKey: string, config?: UnilitixConfig): Promise<void> {
    if (_initPromise) return _initPromise;
    _consent = config?.consent ?? 'granted';
    _initPromise = (async () => {
      const m = native();
      if (!m) return;
      await m.init({ ...buildInitOptions(apiKey, config), consent: _consent });
      if (_consent !== 'granted' && !isIOS()) {
        // The Android library has no "pending" state yet: collection is off
        // until setConsent('granted'). Documented on UnilitixConfig.consent.
        await m.optOut({}).catch(() => undefined);
      }
      _initialized = true;
      if (config?.installJsCrashHandler !== false) {
        setupUnilitixCrashHandler();
      }
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
    })().catch((e: unknown) => {
      // Let the app retry init rather than latching a failed promise.
      _initPromise = null;
      throw e;
    });
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
    return whenReady('track', (m) =>
      m.track({ event, properties: properties ?? {} })
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
    return whenReady('identify', (m) =>
      m.identify({ userId, traits: traits ?? {} })
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
    return whenReady('screen', (m) => m.screen({ screenName }));
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
    const err = toError(error);
    return whenReady('captureException', (m) =>
      m.recordException({
        type: err.name || 'Error',
        message: err.message ?? '',
        stack: err.stack ?? '',
        fatal: options?.fatal ?? false,
      })
    );
  },

  /**
   * Add a breadcrumb to the trail attached to the next crash report
   * (last 50 kept). Use it for app state that explains a crash — never for
   * personal data.
   */
  addBreadcrumb(message: string, category = 'custom'): Promise<void> {
    return whenReady('addBreadcrumb', (m) =>
      m.addBreadcrumb({ message, category })
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
   * the device (iOS; on Android it stops collection until granted).
   */
  setConsent(value: UnilitixConsent): Promise<void> {
    _consent = value;
    return whenReady('setConsent', (m) => {
      if (isIOS() && m.setConsent) return m.setConsent({ value });
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
    _initialized = false;
    _consent = 'granted';
    _screenEventReceived = false;
    _crashHandlerInstalled = false;
    _preInit.length = 0;
  },
};

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
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
    if (!state) return;
    const route = getActiveRoute(state);
    if (route?.name) {
      Unilitix.screen(route.name).catch(() => undefined);
    }
  };
}

function getActiveRoute(state: any): any {
  if (!state) return null;
  const route = state.routes[state.index];
  if (route?.state) return getActiveRoute(route.state);
  return route;
}

/** Upper bound on how long a fatal error waits for its report to persist. */
const FATAL_FLUSH_BUDGET_MS = SdkContract.fatalFlushBudgetMs;

/**
 * Installs the global JS error handler and unhandled-promise-rejection
 * tracking, forwarding to Unilitix crash reporting. `init()` calls this for
 * you; calling it again is a no-op.
 *
 * - Uncaught JS errors become `CRASH` (fatal as React Native reports it);
 *   the report is persisted (bounded to 2 s) before the previous handler —
 *   which usually ends the process — runs.
 * - Unhandled promise rejections become non-fatal `EXCEPTION`s.
 *
 * Does not replace React Native's default error handler — chains to it.
 */
export function setupUnilitixCrashHandler(): void {
  if (_crashHandlerInstalled) return;
  _crashHandlerInstalled = true;

  const errorUtils = (globalThis as any).ErrorUtils;
  if (errorUtils?.getGlobalHandler && errorUtils?.setGlobalHandler) {
    const previousHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      const fatal = isFatal ?? false;
      const report = Unilitix.captureException(error, { fatal });
      const chain = () => {
        if (previousHandler) previousHandler(error, isFatal);
      };
      if (!fatal) {
        chain();
        return;
      }
      // A fatal error: give the report a bounded head start before the
      // default handler shows the red box / kills the process.
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        chain();
      };
      const timer = setTimeout(finish, FATAL_FLUSH_BUDGET_MS);
      report.then(
        () => {
          clearTimeout(timer);
          finish();
        },
        () => {
          clearTimeout(timer);
          finish();
        }
      );
    });
  }

  installRejectionTracking();
}

/**
 * Hermes (the default engine since React Native 0.70) exposes
 * `HermesInternal.enablePromiseRejectionTracker`; only unhandled rejections
 * are reported, as non-fatal exceptions. On JSC there is no tracker to hook
 * without a dependency on the `promise` polyfill internals, so rejections
 * there are not reported — `captureException` in your own `.catch` covers it.
 */
function installRejectionTracking() {
  const hermes = (globalThis as any).HermesInternal;
  if (!hermes?.enablePromiseRejectionTracker) return;
  try {
    hermes.enablePromiseRejectionTracker({
      allRejections: true,
      onUnhandled: (_id: number, reason: unknown) => {
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
