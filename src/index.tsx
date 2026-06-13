import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-unilitix' doesn't seem to be linked. ` +
  `Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const IS_IOS = Platform.OS === 'ios';
const IOS_WARNING =
  '[Unilitix] iOS SDK not yet available — tracking disabled on iOS.';

function getNative() {
  if (!NativeModules.Unilitix) {
    throw new Error(LINKING_ERROR);
  }
  return NativeModules.Unilitix;
}

let _screenEventReceived = false;

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
   * Enable automatic crash tracking.
   * Note: In React Native, this only captures native Kotlin/Java crashes.
   * JS exceptions require additional wiring:
   * ```
   * import { setupUnilitixCrashHandler } from 'react-native-unilitix';
   * setupUnilitixCrashHandler(); // Call after Unilitix.init()
   * ```
   * @default true
   */
  autoTrackCrashes?: boolean;
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
  /** Mask input fields in tap tracking. Default: true */
  maskInputs?: boolean;
  /** Capture DOM snapshots for session replay. Default: true */
  captureSnapshots?: boolean;
  /** Capture screenshots for session replay. Default: true */
  captureScreenshots?: boolean;
  /** Only upload screenshots on Wi-Fi. Default: true */
  uploadScreenshotsOnWifiOnly?: boolean;
  /** Sample rate 0.0–1.0. Default: 1.0 */
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
   * Initialize the Unilitix SDK.
   * Call once before using any other methods.
   *
   * @example
   * ```ts
   * await Unilitix.init('your_api_key');
   * ```
   */
  async init(apiKey: string, config?: UnilitixConfig): Promise<void> {
    if (IS_IOS) {
      console.warn(IOS_WARNING);
      return;
    }
    return getNative()
      .init({
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
        captureSnapshots: config?.captureSnapshots ?? true,
        captureScreenshots: config?.captureScreenshots ?? true,
        uploadScreenshotsOnWifiOnly:
          config?.uploadScreenshotsOnWifiOnly ?? true,
        sampleRate: config?.sampleRate ?? 1.0,
        snapshotIntervalMs: config?.snapshotIntervalMs ?? 1000,
        maxSnapshotsPerSession: config?.maxSnapshotsPerSession ?? 200,
        screenshotIntervalMs: config?.screenshotIntervalMs ?? 1000,
        screenshotQuality: config?.screenshotQuality ?? 30,
        screenshotMaxWidth: config?.screenshotMaxWidth ?? 480,
        maxScreenshotsPerSession: config?.maxScreenshotsPerSession ?? 300,
      })
      .then(() => {
        if (config?.debug) {
          console.log('[Unilitix] ✅ SDK initialized');
          console.log('[Unilitix] ✅ Session started');
          setTimeout(() => {
            if (!_screenEventReceived) {
              console.warn(
                '[Unilitix] ⚠️ No screen events detected. Did you wire ' +
                  'Unilitix.screen() to NavigationContainer.onStateChange?'
              );
            }
          }, 5000);
        }
      });
  },

  /**
   * Track a custom event.
   *
   * @example
   * ```ts
   * Unilitix.track('purchase_completed', {
   *   amount: 5000,
   *   currency: 'NGN',
   * });
   * ```
   */
  async track(
    event: string,
    properties?: Record<string, unknown>
  ): Promise<void> {
    if (IS_IOS) return;
    return getNative().track({
      event,
      properties: properties ?? {},
    });
  },

  /**
   * Identify the current user.
   * Call after login.
   *
   * @example
   * ```ts
   * Unilitix.identify('user_123', {
   *   name: 'Tosin',
   *   plan: 'pro',
   *   country: 'Nigeria',
   * });
   * ```
   */
  async identify(
    userId: string,
    traits?: Record<string, unknown>
  ): Promise<void> {
    if (IS_IOS) return;
    return getNative().identify({
      userId,
      traits: traits ?? {},
    });
  },

  /**
   * Track a screen view manually.
   *
   * @example
   * ```ts
   * Unilitix.screen('HomeScreen');
   * ```
   */
  async screen(screenName: string): Promise<void> {
    if (IS_IOS) return;
    _screenEventReceived = true;
    return getNative().screen({ screenName });
  },

  /** Start a new session manually. */
  async startSession(): Promise<void> {
    if (IS_IOS) return;
    return getNative().startSession();
  },

  /** End the current session manually. */
  async endSession(): Promise<void> {
    if (IS_IOS) return;
    return getNative().endSession();
  },

  /** Flush all queued events immediately. */
  async flush(): Promise<void> {
    if (IS_IOS) return;
    return getNative().flush();
  },

  /**
   * Stop all tracking.
   * Call when user opts out of analytics.
   */
  async optOut(): Promise<void> {
    if (IS_IOS) return;
    return getNative().optOut();
  },

  /** Resume tracking after optOut. */
  async optIn(): Promise<void> {
    if (IS_IOS) return;
    return getNative().optIn();
  },

  /**
   * Reset user identity.
   * Call on logout.
   */
  async reset(): Promise<void> {
    if (IS_IOS) return;
    return getNative().reset();
  },

  /** @internal — exposed for testing only */
  get _screenEventReceived() {
    return _screenEventReceived;
  },
};

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
  if (IS_IOS) return () => {};
  return (state: any) => {
    if (!state) return;
    const route = getActiveRoute(state);
    if (route?.name) {
      Unilitix.screen(route.name);
    }
  };
}

function getActiveRoute(state: any): any {
  if (!state) return null;
  const route = state.routes[state.index];
  if (route?.state) return getActiveRoute(route.state);
  return route;
}

/**
 * Installs a global JS error handler that forwards unhandled JS exceptions
 * to Unilitix crash tracking. Call once after Unilitix.init().
 *
 * Captures:
 * - Unhandled JS exceptions
 * - Unhandled Promise rejections
 *
 * Does not replace React Native's default error handler — chains to it.
 */
export function setupUnilitixCrashHandler(): void {
  if (IS_IOS) return;

  const previousHandler = ErrorUtils.getGlobalHandler();

  ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    Unilitix.track('_crash', {
      message: error.message,
      stack: error.stack ?? '',
      isFatal: isFatal ?? false,
      type: 'js',
    }).catch(() => {});

    // Chain to previous handler
    if (previousHandler) {
      previousHandler(error, isFatal);
    }
  });
}

export default Unilitix;
