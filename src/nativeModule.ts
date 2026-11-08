// Namespace import on purpose: react-native-web has no TurboModuleRegistry,
// and a named import of it fails the web (Vite/Rollup) build. Reading it as
// a property is undefined there and falls through to NativeModules.
import * as ReactNative from 'react-native';
import type { Spec } from './NativeUnilitix';

/**
 * The bridge as the JS layer uses it: the codegen {@link Spec}, with the
 * methods added after 1.0 optional so an older or partially linked native
 * side degrades instead of throwing.
 */
export type NativeUnilitix = Omit<
  Spec,
  'setConsent' | 'currentSessionId' | 'getBuildInfo' | 'getConstants'
> & {
  setConsent?: Spec['setConsent'];
  currentSessionId?: Spec['currentSessionId'];
  getBuildInfo?: Spec['getBuildInfo'];
};

/**
 * The Unilitix native module: the TurboModule on the New Architecture,
 * `NativeModules.Unilitix` on the legacy bridge, or null when it is not
 * linked (Expo Go, web, a missing `pod install`). Looked up on every call,
 * never cached, so tests and reloads see the current module.
 */
export function lookupNativeModule(): NativeUnilitix | null {
  let m: unknown = null;
  try {
    const registry = (
      ReactNative as unknown as {
        TurboModuleRegistry?: { get?: (name: string) => unknown };
      }
    ).TurboModuleRegistry;
    m = registry?.get?.('Unilitix') ?? null;
  } catch {
    m = null;
  }
  if (!m) {
    try {
      m = (ReactNative.NativeModules as Record<string, unknown> | undefined)
        ?.Unilitix;
    } catch {
      m = null;
    }
  }
  return (m as NativeUnilitix | null | undefined) ?? null;
}

/** True when the native module is linked into this build. */
export function isNativeModuleLinked(): boolean {
  return lookupNativeModule() !== null;
}
