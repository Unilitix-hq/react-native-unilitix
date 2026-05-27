import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-unilitix' doesn't seem to be linked. ` +
  `Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const UnilitixNative = NativeModules.Unilitix
  ? NativeModules.Unilitix
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export interface UnilitixConfig {
  /** API endpoint. Default: https://api.unilitix.com */
  endpoint?: string;
  /** Enable console logging. Default: false */
  debug?: boolean;
  /** Auto-track screen changes. Default: true */
  autoTrackScreens?: boolean;
  /** Auto-track user taps. Default: true */
  autoTrackTaps?: boolean;
  /** Auto-capture crashes. Default: true */
  autoTrackCrashes?: boolean;
  /** Auto-detect rage taps. Default: true */
  autoTrackRageTaps?: boolean;
  /** Flush interval in seconds. Default: 30 */
  flushIntervalSeconds?: number;
  /** Session timeout in seconds. Default: 1800 */
  sessionTimeoutSeconds?: number;
  /** Mask input fields. Default: true */
  maskInputs?: boolean;
  /** Sample rate 0.0-1.0. Default: 1.0 */
  sampleRate?: number;
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
  init(apiKey: string, config?: UnilitixConfig): Promise<void> {
    return UnilitixNative.init({
      apiKey,
      endpoint: config?.endpoint ?? 'https://api.unilitix.com',
      debug: config?.debug ?? false,
      autoTrackScreens: config?.autoTrackScreens ?? true,
      autoTrackTaps: config?.autoTrackTaps ?? true,
      autoTrackCrashes: config?.autoTrackCrashes ?? true,
      autoTrackRageTaps: config?.autoTrackRageTaps ?? true,
      flushIntervalSeconds: config?.flushIntervalSeconds ?? 30,
      sessionTimeoutSeconds: config?.sessionTimeoutSeconds ?? 1800,
      maskInputs: config?.maskInputs ?? true,
      sampleRate: config?.sampleRate ?? 1.0,
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
  track(event: string, properties?: Record<string, unknown>): Promise<void> {
    return UnilitixNative.track({
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
  identify(userId: string, traits?: Record<string, unknown>): Promise<void> {
    return UnilitixNative.identify({
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
  screen(screenName: string): Promise<void> {
    return UnilitixNative.screen({ screenName });
  },

  /** Start a new session manually. */
  startSession(): Promise<void> {
    return UnilitixNative.startSession();
  },

  /** End the current session manually. */
  endSession(): Promise<void> {
    return UnilitixNative.endSession();
  },

  /** Flush all queued events immediately. */
  flush(): Promise<void> {
    return UnilitixNative.flush();
  },

  /**
   * Stop all tracking.
   * Call when user opts out of analytics.
   */
  optOut(): Promise<void> {
    return UnilitixNative.optOut();
  },

  /** Resume tracking after optOut. */
  optIn(): Promise<void> {
    return UnilitixNative.optIn();
  },

  /**
   * Reset user identity.
   * Call on logout.
   */
  reset(): Promise<void> {
    return UnilitixNative.reset();
  },
};

export default Unilitix;
