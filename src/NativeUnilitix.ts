/**
 * Codegen spec of the Unilitix native module (New Architecture TurboModule;
 * the same methods are exported to the legacy bridge). Every method takes
 * one options object and returns a promise, so the shape stays identical on
 * iOS and Android and new fields never change a signature.
 *
 * Do not import the default export at module load in app code paths: the
 * SDK looks the module up lazily (`TurboModuleRegistry.get`, falling back to
 * `NativeModules`) so a missing module (Expo Go, web) is a no-op.
 */
import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
  init(options: Object): Promise<void>;
  track(options: Object): Promise<void>;
  identify(options: Object): Promise<void>;
  screen(options: Object): Promise<void>;
  /**
   * A JS error: `{type, message, stack, fatal, fingerprint?, metadata}`.
   * Native forwards it to the core's `recordExternalError(platform: "js")`.
   */
  recordException(options: Object): Promise<void>;
  addBreadcrumb(options: Object): Promise<void>;
  setConsent(options: Object): Promise<void>;
  startSession(options: Object): Promise<void>;
  endSession(options: Object): Promise<void>;
  flush(options: Object): Promise<void>;
  optOut(options: Object): Promise<void>;
  optIn(options: Object): Promise<void>;
  reset(options: Object): Promise<void>;
  /** The core's current session id, or '' when there is none. */
  currentSessionId(options: Object): Promise<string>;
  /**
   * `{appVersion, buildNumber}` of the host app (release / dist of JS
   * errors).
   */
  getBuildInfo(options: Object): Promise<Object>;
}

export default TurboModuleRegistry.get<Spec>('Unilitix');
