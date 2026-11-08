import {
  createElement,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ComponentType,
  type ForwardedRef,
  type Ref,
} from 'react';

/**
 * Where navigation helpers send screen names (set by the SDK entry point;
 * kept here so this module does not import it back).
 */
let screenSink: (name: string) => void = () => undefined;

/** @internal */
export function setScreenSink(sink: (name: string) => void) {
  screenSink = sink;
}

function report(name: unknown) {
  if (typeof name !== 'string' || name === '') return;
  try {
    screenSink(name);
  } catch {
    // Analytics never throws into navigation.
  }
}

/** The parts of a React Navigation container ref the helpers use. */
export interface NavigationContainerRefLike {
  isReady?: () => boolean;
  getCurrentRoute?: () => { name?: unknown } | undefined | null;
  addListener?: (
    event: string,
    callback: (...args: unknown[]) => void
  ) => (() => void) | undefined | void;
}

type NavState = {
  index?: number;
  routes?: Array<{ name?: unknown; state?: NavState }>;
};

/** Deepest focused route of a navigation state (route names only). */
export function activeRouteName(state: unknown, depth = 0): string | null {
  const s = state as NavState | null | undefined;
  if (!s || !Array.isArray(s.routes) || s.routes.length === 0 || depth > 32) {
    return null;
  }
  const route = s.routes[s.index ?? s.routes.length - 1];
  if (!route) return null;
  if (route.state) return activeRouteName(route.state, depth + 1);
  return typeof route.name === 'string' ? route.name : null;
}

/** Tracks the focused route of [ref]: route.name only, never params. */
function trackCurrentRoute(ref: NavigationContainerRefLike | null) {
  try {
    if (!ref || (ref.isReady && !ref.isReady())) return;
    report(ref.getCurrentRoute?.()?.name);
  } catch {
    // A container in a bad state must not break the app.
  }
}

/**
 * Creates a React Navigation `onStateChange` listener that tracks the
 * deepest active route's name. Prefer {@link useUnilitixNavigationTracking},
 * which also tracks the first screen (onStateChange does not fire for the
 * initial state).
 *
 * ```tsx
 * <NavigationContainer onStateChange={createUnilitixNavigationListener()}>
 * ```
 */
export function createUnilitixNavigationListener() {
  return (state: unknown) => {
    try {
      const name = activeRouteName(state);
      if (name) report(name);
    } catch {
      // ignore malformed state
    }
  };
}

/**
 * Tracks React Navigation screens from a container ref: the initial route
 * once the container is ready (the first screen, which `onStateChange`
 * never reports), then every focused-route change. Only `route.name` is
 * sent, never params. Consecutive identical names are dropped by the SDK.
 *
 * Returns an `onReady` callback; pass it to the container when the ref may
 * not be ready on mount (it is safe to call more than once).
 *
 * ```tsx
 * const navigationRef = useNavigationContainerRef();
 * const onReady = useUnilitixNavigationTracking(navigationRef);
 * <NavigationContainer ref={navigationRef} onReady={onReady}>
 * ```
 */
export function useUnilitixNavigationTracking(
  navigationRef:
    | NavigationContainerRefLike
    | { current: NavigationContainerRefLike | null }
    | null
    | undefined
): () => void {
  const refRef = useRef(navigationRef);
  refRef.current = navigationRef;
  const resolve = (): NavigationContainerRefLike | null => {
    const r = refRef.current as
      | (NavigationContainerRefLike & {
          current?: NavigationContainerRefLike | null;
        })
      | null
      | undefined;
    if (!r) return null;
    // A container ref (createNavigationContainerRef) or a React ref to one.
    if (typeof r.getCurrentRoute === 'function') return r;
    return r.current ?? null;
  };
  const onReady = useCallback(() => trackCurrentRoute(resolve()), []);

  useEffect(() => {
    const ref = resolve();
    if (!ref) return undefined;
    const unsubscribers: Array<() => void> = [];
    const listen = (event: string) => {
      try {
        const off = ref.addListener?.(event, () => trackCurrentRoute(ref));
        if (typeof off === 'function') unsubscribers.push(off);
      } catch {
        // Older containers without this event.
      }
    };
    listen('state');
    // React Navigation 7 emits 'ready' on the container ref; older versions
    // need the returned onReady passed to the container.
    listen('ready');
    trackCurrentRoute(ref); // already ready (e.g. remount)
    return () => {
      for (const off of unsubscribers) {
        try {
          off();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return onReady;
}

type ContainerProps = {
  onReady?: (...args: unknown[]) => void;
  onStateChange?: (...args: unknown[]) => void;
};

/**
 * Wraps a React Navigation `NavigationContainer` so it tracks the first
 * screen and every focused-route change (route names only). Your own
 * `ref`, `onReady` and `onStateChange` still work.
 *
 * ```tsx
 * const TrackedContainer = withUnilitixNavigation(NavigationContainer);
 * <TrackedContainer>{...}</TrackedContainer>
 * ```
 */
export function withUnilitixNavigation<P extends ContainerProps>(
  Container: ComponentType<P>
) {
  const Wrapped = forwardRef(function UnilitixNavigationContainer(
    props: ContainerProps & Record<string, unknown>,
    forwarded: ForwardedRef<unknown>
  ) {
    const inner = useRef<NavigationContainerRefLike | null>(null);
    useImperativeHandle(forwarded, () => inner.current as never, []);
    const { onReady, onStateChange } = props;
    return createElement(Container as ComponentType<Record<string, unknown>>, {
      ...props,
      ref: inner,
      onReady: (...args: unknown[]) => {
        trackCurrentRoute(inner.current);
        onReady?.(...args);
      },
      onStateChange: (...args: unknown[]) => {
        trackCurrentRoute(inner.current);
        onStateChange?.(...args);
      },
    });
  });
  Wrapped.displayName = `withUnilitixNavigation(${
    Container.displayName ?? Container.name ?? 'NavigationContainer'
  })`;
  return Wrapped as unknown as ComponentType<P & { ref?: Ref<unknown> }>;
}

/**
 * Screen name of an Expo Router location from its route segments
 * (`useSegments()`): the route pattern, never the values of dynamic
 * segments, with layout groups such as `(tabs)` left out.
 * `['(tabs)', 'users', '[id]']` → `/users/[id]`.
 */
export function expoRouterScreenName(segments: readonly unknown[]): string {
  const parts = segments.filter(
    (s): s is string => typeof s === 'string' && s !== '' && !/^\(.*\)$/.test(s)
  );
  return '/' + parts.join('/');
}

/**
 * Tracks Expo Router screens. Call it in the root layout with the result
 * of `useSegments()` (route patterns, so ids and other params never leave
 * the device), including the first screen.
 *
 * ```tsx
 * import { useSegments } from 'expo-router';
 * export default function RootLayout() {
 *   useUnilitixExpoRouterTracking(useSegments());
 *   return <Stack />;
 * }
 * ```
 */
export function useUnilitixExpoRouterTracking(
  segments: readonly unknown[] | null | undefined
): void {
  const name = Array.isArray(segments) ? expoRouterScreenName(segments) : '';
  useEffect(() => {
    if (name) report(name);
  }, [name]);
}
