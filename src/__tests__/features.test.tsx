// @ts-nocheck
// 2.0.0 JS features: TurboModule lookup, JS error metadata (source maps),
// screen dedupe across sessions, pre-init cap, Hermes tracker chaining,
// navigation helpers and the masking components.
import {
  it,
  expect,
  describe,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createElement, createRef } from 'react';
import { act, create } from 'react-test-renderer';
import { AppState, NativeModules, Platform, turboModules } from 'react-native';
import Unilitix, {
  createUnilitixNavigationListener,
  expoRouterScreenName,
  setupUnilitixCrashHandler,
  truncate,
  currentJsBundleId,
  useUnilitixExpoRouterTracking,
  useUnilitixNavigationTracking,
  withUnilitixNavigation,
  UnilitixMask,
  UnilitixUnmask,
} from '../index';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const METHODS = [
  'init',
  'track',
  'identify',
  'screen',
  'recordException',
  'addBreadcrumb',
  'setConsent',
  'startSession',
  'endSession',
  'flush',
  'optOut',
  'optIn',
  'reset',
];

function freshNative(extra = {}) {
  const m = {};
  for (const name of METHODS) m[name] = jest.fn().mockResolvedValue(undefined);
  m.getBuildInfo = jest
    .fn()
    .mockResolvedValue({ appVersion: '2.3.0', buildNumber: '230' });
  m.currentSessionId = jest.fn().mockResolvedValue('s1');
  return Object.assign(m, extra);
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

const screens = () =>
  NativeModules.Unilitix.screen.mock.calls.map((c) => c[0].screenName);

beforeEach(() => {
  Platform.OS = 'android';
  NativeModules.Unilitix = freshNative();
  delete turboModules.Unilitix;
  Unilitix._resetForTests();
  delete globalThis.ErrorUtils;
  delete globalThis.HermesInternal;
  delete globalThis.__UNILITIX_BUNDLE_ID__;
});

afterEach(() => {
  Unilitix._resetForTests();
  Platform.OS = 'android';
  jest.restoreAllMocks();
});

describe('native module lookup', () => {
  it('prefers the TurboModule over the legacy bridge module', async () => {
    const turbo = freshNative();
    turboModules.Unilitix = turbo;
    await Unilitix.init('k', { installJsCrashHandler: false });
    await Unilitix.track('a');
    expect(turbo.track).toHaveBeenCalledWith({ event: 'a', properties: {} });
    expect(NativeModules.Unilitix.track).not.toHaveBeenCalled();
  });

  it('is unavailable with neither module', () => {
    NativeModules.Unilitix = undefined;
    expect(Unilitix.isAvailable).toBe(false);
    turboModules.Unilitix = freshNative();
    expect(Unilitix.isAvailable).toBe(true);
  });

  it('the codegen spec looks the module up by name', () => {
    jest.isolateModules(() => {
      const RN = require('react-native');
      RN.turboModules.Unilitix = freshNative();
      const spec = require('../NativeUnilitix').default;
      expect(spec).toBe(RN.turboModules.Unilitix);
    });
  });

  it('a throwing registry falls back to NativeModules', async () => {
    const RN = require('react-native');
    const get = RN.TurboModuleRegistry.get;
    RN.TurboModuleRegistry.get = () => {
      throw new Error('no turbo');
    };
    try {
      await Unilitix.init('k', { installJsCrashHandler: false });
      expect(NativeModules.Unilitix.init).toHaveBeenCalled();
    } finally {
      RN.TurboModuleRegistry.get = get;
    }
  });
});

describe('JS error metadata (source maps)', () => {
  const lastReport = () =>
    NativeModules.Unilitix.recordException.mock.calls.at(-1)[0];

  it('sends release/dist from the native build info', async () => {
    await Unilitix.init('k', { installJsCrashHandler: false });
    await Unilitix.captureException(new Error('x'));
    expect(lastReport().metadata).toEqual({
      platform: 'react-native',
      jsBundleId: 'index.android.bundle',
      release: '2.3.0',
      dist: '230',
    });
  });

  it('uses the bundle id injected by the Metro plugin', async () => {
    globalThis.__UNILITIX_BUNDLE_ID__ =
      'UNILITIX_BUNDLE_ID=0f8e3c1a-1b2c-4d5e-8f90-a1b2c3d4e5f6';
    await Unilitix.init('k', { installJsCrashHandler: false });
    await Unilitix.captureException(new Error('x'));
    expect(lastReport().metadata.jsBundleId).toBe(
      '0f8e3c1a-1b2c-4d5e-8f90-a1b2c3d4e5f6'
    );
  });

  it('ignores an injected id the CLI would reject', () => {
    globalThis.__UNILITIX_BUNDLE_ID__ = 'UNILITIX_BUNDLE_ID=../evil';
    expect(currentJsBundleId()).toBe('index.android.bundle');
    globalThis.__UNILITIX_BUNDLE_ID__ = 'plain-id_1.2';
    expect(currentJsBundleId()).toBe('plain-id_1.2');
    globalThis.__UNILITIX_BUNDLE_ID__ = 42;
    expect(currentJsBundleId()).toBe('index.android.bundle');
  });

  it('defaults to main.jsbundle on iOS', () => {
    Platform.OS = 'ios';
    expect(currentJsBundleId()).toBe('main.jsbundle');
  });

  it('config overrides win (OTA updates)', async () => {
    globalThis.__UNILITIX_BUNDLE_ID__ = 'UNILITIX_BUNDLE_ID=abc';
    await Unilitix.init('k', {
      installJsCrashHandler: false,
      jsBundleId: 'eas-update-1',
      release: '2.3.0-ota.4',
      dist: '231',
    });
    await Unilitix.captureException(new Error('x'));
    expect(lastReport().metadata).toMatchObject({
      jsBundleId: 'eas-update-1',
      release: '2.3.0-ota.4',
      dist: '231',
    });
  });

  it('accepts a numeric build number and copes without build info', async () => {
    NativeModules.Unilitix.getBuildInfo = jest
      .fn()
      .mockResolvedValue({ appVersion: '1.0', buildNumber: 7 });
    await Unilitix.init('k', { installJsCrashHandler: false });
    await Unilitix.captureException(new Error('x'));
    expect(lastReport().metadata).toMatchObject({ release: '1.0', dist: '7' });

    Unilitix._resetForTests();
    NativeModules.Unilitix = freshNative({
      getBuildInfo: jest.fn().mockRejectedValue(new Error('old native')),
    });
    await Unilitix.init('k', { installJsCrashHandler: false });
    await Unilitix.captureException(new Error('x'));
    expect(lastReport().metadata).toEqual({
      platform: 'react-native',
      jsBundleId: 'index.android.bundle',
    });

    Unilitix._resetForTests();
    NativeModules.Unilitix = freshNative({ getBuildInfo: undefined });
    await Unilitix.init('k', { installJsCrashHandler: false });
    await Unilitix.captureException(new Error('x'));
    expect(lastReport().metadata.release).toBeUndefined();
  });

  it('leaves native signal types for the core to fingerprint', async () => {
    await Unilitix.init('k', { installJsCrashHandler: false });
    const e = new Error('x');
    e.name = 'SIGNAL:11';
    await Unilitix.captureException(e);
    expect(lastReport().fingerprint).toBeUndefined();
  });
});

describe('screen dedupe', () => {
  beforeEach(() => Unilitix.init('k', { installJsCrashHandler: false }));

  it('drops a screen equal to the current one', async () => {
    await Unilitix.screen('Home');
    await Unilitix.screen('Home');
    await Unilitix.screen('Cart');
    await Unilitix.screen('Home');
    expect(screens()).toEqual(['Home', 'Cart', 'Home']);
  });

  it('sends the first screen of every new session', async () => {
    await Unilitix.screen('Home');
    await Unilitix.reset();
    await Unilitix.screen('Home');
    await Unilitix.startSession();
    await Unilitix.screen('Home');
    await Unilitix.endSession();
    await Unilitix.screen('Home');
    expect(screens()).toEqual(['Home', 'Home', 'Home', 'Home']);
  });

  it('a long background starts over, a short one does not', async () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000_000);
    await Unilitix.screen('Home');
    AppState._emit('inactive');
    AppState._emit('background');
    now.mockReturnValue(1_000_000 + 60_000);
    AppState._emit('active');
    await Unilitix.screen('Home');
    expect(screens()).toEqual(['Home']);
    AppState._emit('background');
    now.mockReturnValue(1_000_000 + 60_000 + 1800 * 1000);
    AppState._emit('active');
    await Unilitix.screen('Home');
    expect(screens()).toEqual(['Home', 'Home']);
    AppState._emit('unknown');
  });

  it('a new native session id starts over', async () => {
    await settle();
    await Unilitix.screen('Home');
    NativeModules.Unilitix.currentSessionId.mockResolvedValue('s2');
    AppState._emit('active');
    await settle();
    await Unilitix.screen('Home');
    expect(screens()).toEqual(['Home', 'Home']);
  });

  it('copes with a native module without currentSessionId', async () => {
    Unilitix._resetForTests();
    NativeModules.Unilitix = freshNative({
      currentSessionId: () => {
        throw new Error('nope');
      },
    });
    await Unilitix.init('k', { installJsCrashHandler: false });
    AppState._emit('active');
    await Unilitix.screen('A');
    expect(screens()).toEqual(['A']);
  });

  it('listens to AppState once', async () => {
    await Unilitix.init('k');
    expect(AppState._listenerCount()).toBe(1);
  });
});

describe('pre-init buffer', () => {
  it('keeps the newest preInitBufferSize calls', async () => {
    for (let i = 0; i < 205; i++) Unilitix.track(`e${i}`);
    await Unilitix.init('k', { installJsCrashHandler: false });
    const names = NativeModules.Unilitix.track.mock.calls.map(
      (c) => c[0].event
    );
    expect(names).toHaveLength(200);
    expect(names[0]).toBe('e5');
    expect(names.at(-1)).toBe('e204');
  });

  it('calls during init never overtake earlier ones', async () => {
    const order = [];
    for (const m of ['track', 'screen', 'identify', 'flush']) {
      NativeModules.Unilitix[m] = jest.fn(async () => {
        order.push(m);
      });
    }
    const p = Unilitix.init('k', { installJsCrashHandler: false });
    Unilitix.track('a');
    await Promise.resolve();
    Unilitix.screen('S');
    await Promise.resolve();
    await Promise.resolve();
    Unilitix.identify('u');
    await p;
    await Unilitix.flush();
    expect(order).toEqual(['track', 'screen', 'identify', 'flush']);
  });
});

describe('string limits', () => {
  it('never splits a surrogate pair', () => {
    const s = 'd'.repeat(1023) + '😀';
    expect(truncate(s)).toBe('d'.repeat(1023));
    expect(truncate('a'.repeat(1500))).toHaveLength(1024);
    expect(truncate('😀😀', 3)).toBe('😀');
    expect(truncate('short')).toBe('short');
  });
});

describe('Hermes rejection tracker', () => {
  function hermes() {
    const h = {
      installed: [],
      enablePromiseRejectionTracker(opts) {
        h.installed.push(opts);
      },
    };
    globalThis.HermesInternal = h;
    return h;
  }

  beforeEach(() => Unilitix.init('k', { installJsCrashHandler: false }));

  it('chains a tracker passed in and one installed later', async () => {
    const h = hermes();
    const before = { onUnhandled: jest.fn(), onHandled: jest.fn() };
    const after = { onUnhandled: jest.fn(), onHandled: jest.fn() };
    setupUnilitixCrashHandler({ rejectionTracker: before });
    expect(h.installed).toHaveLength(1);
    // A library installs its tracker after init: it is chained, ours stays.
    globalThis.HermesInternal.enablePromiseRejectionTracker(after);
    expect(h.installed).toHaveLength(1);
    const ours = h.installed[0];
    ours.onUnhandled(7, new Error('lost'));
    ours.onHandled(7);
    await settle();
    expect(before.onUnhandled).toHaveBeenCalledWith(7, expect.any(Error));
    expect(after.onUnhandled).toHaveBeenCalledWith(7, expect.any(Error));
    expect(before.onHandled).toHaveBeenCalledWith(7);
    expect(after.onHandled).toHaveBeenCalledWith(7);
    expect(NativeModules.Unilitix.recordException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'lost', fatal: false })
    );
  });

  it('a throwing chained tracker does not stop reporting', async () => {
    const h = hermes();
    setupUnilitixCrashHandler({
      rejectionTracker: {
        onUnhandled: () => {
          throw new Error('bad tracker');
        },
      },
    });
    h.installed[0].onUnhandled(1, 'reason');
    await settle();
    expect(NativeModules.Unilitix.recordException).toHaveBeenCalled();
    globalThis.HermesInternal.enablePromiseRejectionTracker(null);
  });

  it('a frozen HermesInternal keeps working (later trackers replace)', () => {
    const installed = [];
    globalThis.HermesInternal = Object.freeze({
      enablePromiseRejectionTracker: (o) => installed.push(o),
    });
    expect(() => setupUnilitixCrashHandler()).not.toThrow();
    expect(installed).toHaveLength(1);
  });

  it('can be turned off from init config', async () => {
    Unilitix._resetForTests();
    const h = hermes();
    await Unilitix.init('k', { trackUnhandledRejections: false });
    expect(h.installed).toHaveLength(0);
  });
});

describe('navigation', () => {
  beforeEach(() => Unilitix.init('k', { installJsCrashHandler: false }));

  function fakeContainerRef(initial = 'Home', ready = true) {
    const listeners = {};
    const ref = {
      route: initial,
      ready,
      isReady: () => ref.ready,
      getCurrentRoute: () => ({ name: ref.route, params: { id: 'secret' } }),
      addListener: (event, cb) => {
        (listeners[event] ??= []).push(cb);
        return () => {
          listeners[event] = listeners[event].filter((l) => l !== cb);
        };
      },
      emit: (event) => (listeners[event] ?? []).forEach((l) => l()),
      listeners,
    };
    return ref;
  }

  function Probe({ navRef, onReady }) {
    const cb = useUnilitixNavigationTracking(navRef);
    onReady.current = cb;
    return null;
  }

  it('tracks the first screen and then route changes (names only)', async () => {
    const ref = fakeContainerRef('Home');
    const onReady = { current: null };
    let r;
    await act(async () => {
      r = create(createElement(Probe, { navRef: ref, onReady }));
    });
    await settle();
    ref.route = 'Product';
    ref.emit('state');
    await settle();
    expect(screens()).toEqual(['Home', 'Product']);
    expect(
      JSON.stringify(NativeModules.Unilitix.screen.mock.calls)
    ).not.toMatch(/secret/);
    await act(async () => r.unmount());
    expect(ref.listeners.state).toHaveLength(0);
  });

  it('waits for the container to be ready (ready event or onReady)', async () => {
    const ref = fakeContainerRef('Login', false);
    const onReady = { current: null };
    await act(async () => {
      create(createElement(Probe, { navRef: { current: ref }, onReady }));
    });
    await settle();
    expect(screens()).toEqual([]);
    ref.ready = true;
    ref.emit('ready');
    onReady.current(); // also wired as the container's onReady: deduped
    await settle();
    expect(screens()).toEqual(['Login']);
  });

  it('tolerates a missing or broken ref', async () => {
    const onReady = { current: null };
    await act(async () => {
      create(createElement(Probe, { navRef: null, onReady }));
    });
    expect(() => onReady.current()).not.toThrow();
    const broken = {
      getCurrentRoute: () => {
        throw new Error('bad');
      },
      addListener: () => {
        throw new Error('no events');
      },
    };
    await act(async () => {
      create(createElement(Probe, { navRef: broken, onReady }));
    });
    expect(screens()).toEqual([]);
  });

  it('withUnilitixNavigation wraps a container and keeps app handlers', async () => {
    const containerRef = fakeContainerRef('Feed');
    let received;
    function FakeContainer(props) {
      received = props;
      if (props.ref) props.ref.current = containerRef;
      return null;
    }
    const Tracked = withUnilitixNavigation(FakeContainer);
    expect(Tracked.displayName).toBe('withUnilitixNavigation(FakeContainer)');
    const appOnReady = jest.fn();
    const appOnState = jest.fn();
    const outer = createRef();
    await act(async () => {
      create(
        createElement(Tracked, {
          ref: outer,
          onReady: appOnReady,
          onStateChange: appOnState,
          theme: 'dark',
        })
      );
    });
    expect(received.theme).toBe('dark');
    received.onReady();
    containerRef.route = 'Detail';
    received.onStateChange({ routes: [] });
    await settle();
    expect(screens()).toEqual(['Feed', 'Detail']);
    expect(appOnReady).toHaveBeenCalled();
    expect(appOnState).toHaveBeenCalledWith({ routes: [] });
    expect(outer.current).toBe(containerRef);
  });

  it('createUnilitixNavigationListener tracks the deepest route', async () => {
    const listener = createUnilitixNavigationListener();
    listener({
      index: 1,
      routes: [
        { name: 'A' },
        { name: 'Tabs', state: { routes: [{ name: 'X' }, { name: 'Y' }] } },
      ],
    });
    listener({ routes: [] });
    listener({ index: 3, routes: [{ name: 'A' }] });
    listener({ routes: [{ name: 42 }] });
    await settle();
    expect(screens()).toEqual(['Y']);
  });

  it('Expo Router names are route patterns without groups', async () => {
    expect(expoRouterScreenName(['(tabs)', 'users', '[id]'])).toBe(
      '/users/[id]'
    );
    expect(expoRouterScreenName([])).toBe('/');
    function Layout({ segments }) {
      useUnilitixExpoRouterTracking(segments);
      return null;
    }
    let r;
    await act(async () => {
      r = create(createElement(Layout, { segments: ['(tabs)', 'home'] }));
    });
    await act(async () => {
      r.update(createElement(Layout, { segments: ['users', '[id]'] }));
    });
    await act(async () => {
      r.update(createElement(Layout, { segments: null }));
    });
    await settle();
    expect(screens()).toEqual(['/home', '/users/[id]']);
  });
});

describe('masking components', () => {
  const render = (el) => {
    let r;
    act(() => {
      r = create(el);
    });
    return r.toJSON();
  };

  it('render a View where there is no native module (web, tests)', () => {
    expect(render(createElement(UnilitixMask, { testID: 'm' })).type).toBe(
      'View'
    );
    expect(render(createElement(UnilitixUnmask, {})).type).toBe('View');
  });

  it('render the native views when the module is linked', () => {
    const {
      UnilitixMask: NativeMask,
      UnilitixUnmask: NativeUnmask,
    } = require('../UnilitixMask.native');
    expect(render(createElement(NativeMask, { testID: 'm' }))).toMatchObject({
      type: 'UnilitixMaskView',
      props: { testID: 'm' },
    });
    expect(render(createElement(NativeUnmask, {})).type).toBe(
      'UnilitixUnmaskView'
    );
    NativeModules.Unilitix = undefined;
    expect(render(createElement(NativeMask, {})).type).toBe('View');
    expect(render(createElement(NativeUnmask, {})).type).toBe('View');
  });
});
