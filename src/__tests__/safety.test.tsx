// @ts-nocheck
// Host-app safety: nothing the SDK does may throw or reject into the app,
// and the app's own error handling must always still run.
import {
  it,
  expect,
  describe,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { NativeModules } from 'react-native';
import Unilitix, {
  setupUnilitixCrashHandler,
  sanitizeProperties,
  createUnilitixNavigationListener,
} from '../index';

function freshNative() {
  const m = {};
  for (const k of [
    'init',
    'track',
    'identify',
    'screen',
    'recordException',
    'addBreadcrumb',
    'startSession',
    'endSession',
    'flush',
    'optOut',
    'optIn',
    'reset',
    'setConsent',
  ]) {
    m[k] = jest.fn().mockResolvedValue(undefined);
  }
  return m;
}

const settle = () => new Promise((r) => setImmediate(r));

/** What RN's bridge does with a value it cannot serialise. */
const throwSync = () =>
  jest.fn(() => {
    throw new TypeError('Converting circular structure to JSON');
  });

function circular() {
  const o = { name: 'cart', items: [{ sku: 'a' }] };
  o.self = o;
  o.items[0].parent = o;
  return o;
}

describe('host-app safety', () => {
  beforeEach(() => {
    NativeModules.Unilitix = freshNative();
    Unilitix._resetForTests();
    delete globalThis.ErrorUtils;
    delete globalThis.HermesInternal;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('synchronous native throws never reach the app', () => {
    beforeEach(() => Unilitix.init('k', { installJsCrashHandler: false }));

    it.each([
      ['track', () => Unilitix.track('x', { a: 1 })],
      ['identify', () => Unilitix.identify('u1', { plan: 'pro' })],
      ['screen', () => Unilitix.screen('Home')],
      ['recordException', () => Unilitix.captureException(new Error('e'))],
      ['addBreadcrumb', () => Unilitix.addBreadcrumb('m')],
      ['flush', () => Unilitix.flush()],
      ['reset', () => Unilitix.reset()],
      ['setConsent', () => Unilitix.setConsent('denied')],
    ])('%s', async (method, call) => {
      NativeModules.Unilitix[method] = throwSync();
      let p;
      expect(() => {
        p = call();
      }).not.toThrow();
      await expect(p).resolves.toBeUndefined();
      expect(NativeModules.Unilitix[method]).toHaveBeenCalled();
    });

    it('a throw while calls replay after init does not stop the rest', async () => {
      Unilitix._resetForTests();
      NativeModules.Unilitix.track = throwSync();
      Unilitix.track('a');
      Unilitix.screen('S');
      await expect(
        Unilitix.init('k', { installJsCrashHandler: false })
      ).resolves.toBeUndefined();
      expect(NativeModules.Unilitix.screen).toHaveBeenCalledWith({
        screenName: 'S',
      });
    });

    it('init resolves when native init throws synchronously', async () => {
      Unilitix._resetForTests();
      NativeModules.Unilitix.init = throwSync();
      await expect(
        Unilitix.init('k', { installJsCrashHandler: false })
      ).resolves.toBeUndefined();
      expect(Unilitix.isInitialized).toBe(false);
    });
  });

  describe('circular and hostile properties', () => {
    beforeEach(() => Unilitix.init('k', { installJsCrashHandler: false }));

    it('track with a circular object does not throw and sends a clean copy', async () => {
      await expect(Unilitix.track('x', circular())).resolves.toBeUndefined();
      const sent = NativeModules.Unilitix.track.mock.calls[0][0];
      expect(sent.event).toBe('x');
      expect(sent.properties.self).toBe('[Circular]');
      expect(sent.properties.items[0].parent).toBe('[Circular]');
      expect(() => JSON.stringify(sent)).not.toThrow();
    });

    it('identify with circular traits does not throw', async () => {
      await expect(
        Unilitix.identify('u1', circular())
      ).resolves.toBeUndefined();
      const sent = NativeModules.Unilitix.identify.mock.calls[0][0];
      expect(() => JSON.stringify(sent)).not.toThrow();
    });

    it('drops functions/symbols, caps depth and string length', () => {
      const deep = { l1: { l2: { l3: { l4: { l5: { l6: 'x' } } } } } };
      const out = sanitizeProperties({
        fn: () => 1,
        sym: Symbol('s'),
        undef: undefined,
        nan: NaN,
        big: BigInt(5),
        when: new Date(0),
        err: new RangeError('r'),
        long: 'a'.repeat(5000),
        list: [1, () => 2, 'three'],
        shared: [{ a: 1 }],
        deep,
        get boom() {
          throw new Error('getter');
        },
      });
      expect('fn' in out).toBe(false);
      expect('sym' in out).toBe(false);
      expect('undef' in out).toBe(false);
      expect('boom' in out).toBe(false);
      expect(out.nan).toBeNull();
      expect(out.big).toBe('5');
      expect(out.when).toBe('1970-01-01T00:00:00.000Z');
      expect(out.err).toBe('RangeError: r');
      expect(out.long).toHaveLength(1024);
      expect(out.list).toEqual([1, null, 'three']);
      expect(out.deep.l1.l2.l3.l4).toBe('[Truncated]');
    });

    it('keeps an object referenced twice (not circular)', () => {
      const shared = { a: 1 };
      expect(sanitizeProperties({ x: shared, y: shared })).toEqual({
        x: { a: 1 },
        y: { a: 1 },
      });
    });

    it('non-object properties become {}', () => {
      expect(sanitizeProperties(undefined)).toEqual({});
      expect(sanitizeProperties('str')).toEqual({});
      expect(sanitizeProperties([1, 2])).toEqual({});
    });
  });

  describe('global error handler always chains', () => {
    function install() {
      const previous = jest.fn();
      let installed;
      globalThis.ErrorUtils = {
        getGlobalHandler: () => previous,
        setGlobalHandler: (h) => (installed = h),
      };
      setupUnilitixCrashHandler();
      return { previous, handler: (e, f) => installed(e, f) };
    }

    beforeEach(() => Unilitix.init('k', { installJsCrashHandler: false }));

    it.each([[true], [false]])(
      'recordException throwing synchronously still chains (isFatal=%s)',
      async (isFatal) => {
        NativeModules.Unilitix.recordException = throwSync();
        const { previous, handler } = install();
        const err = new Error('boom');
        expect(() => handler(err, isFatal)).not.toThrow();
        await settle();
        expect(previous).toHaveBeenCalledTimes(1);
        expect(previous).toHaveBeenCalledWith(err, isFatal);
      }
    );

    it('recordException rejecting still chains with isFatal=true', async () => {
      NativeModules.Unilitix.recordException = jest
        .fn()
        .mockRejectedValue(new Error('disk full'));
      const { previous, handler } = install();
      const err = new Error('boom');
      handler(err, true);
      await settle();
      expect(previous).toHaveBeenCalledWith(err, true);
    });

    it('captureException itself throwing still chains immediately', () => {
      const { previous, handler } = install();
      const original = Unilitix.captureException;
      Unilitix.captureException = () => {
        throw new Error('sdk bug');
      };
      try {
        const err = new Error('boom');
        handler(err, true);
        expect(previous).toHaveBeenCalledWith(err, true);
      } finally {
        Unilitix.captureException = original;
      }
    });

    it('passes isFatal through unchanged when undefined', async () => {
      const { previous, handler } = install();
      const err = new Error('x');
      handler(err, undefined);
      expect(previous).toHaveBeenCalledWith(err, undefined);
    });
  });

  describe('unlinked native module (Expo Go)', () => {
    beforeEach(() => {
      NativeModules.Unilitix = undefined;
    });

    it('init resolves, warns once in dev, and every call is a no-op', async () => {
      globalThis.__DEV__ = true;
      jest.resetModules();
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const RN = require('react-native');
        RN.NativeModules.Unilitix = undefined;
        const fresh = require('../index').default;
        fresh.track('before');
        await expect(fresh.init('k')).resolves.toBeUndefined();
        await expect(fresh.track('x', { a: 1 })).resolves.toBeUndefined();
        await expect(fresh.identify('u')).resolves.toBeUndefined();
        await expect(fresh.screen('S')).resolves.toBeUndefined();
        await expect(fresh.flush()).resolves.toBeUndefined();
        expect(fresh.isAvailable).toBe(false);
        expect(fresh.isInitialized).toBe(false);
        const linking = warn.mock.calls.filter((c) =>
          String(c[0]).includes("doesn't seem to be linked")
        );
        expect(linking).toHaveLength(1);
      } finally {
        warn.mockRestore();
        delete globalThis.__DEV__;
      }
    });

    it('calls before and without init are no-ops', async () => {
      await expect(Unilitix.track('x')).resolves.toBeUndefined();
      await expect(Unilitix.init('k')).resolves.toBeUndefined();
      await expect(Unilitix.captureException('e')).resolves.toBeUndefined();
    });
  });

  describe('consent set before init', () => {
    it('is kept, passed to native init, and not overwritten by config', async () => {
      Unilitix.setConsent('denied');
      await Unilitix.init('k', {
        consent: 'granted',
        installJsCrashHandler: false,
      });
      expect(NativeModules.Unilitix.init).toHaveBeenCalledWith(
        expect.objectContaining({ consent: 'denied' })
      );
      expect(Unilitix.consent).toBe('denied');
      await settle();
      expect(NativeModules.Unilitix.setConsent).toHaveBeenCalledWith({
        value: 'denied',
      });
    });

    it('config consent applies when the app did not decide', async () => {
      await Unilitix.init('k', {
        consent: 'pending',
        installJsCrashHandler: false,
      });
      expect(Unilitix.consent).toBe('pending');
    });
  });

  describe('unhandled rejection tracking', () => {
    it('is not installed with trackUnhandledRejections: false', async () => {
      const enable = jest.fn();
      globalThis.HermesInternal = { enablePromiseRejectionTracker: enable };
      await Unilitix.init('k', { trackUnhandledRejections: false });
      expect(enable).not.toHaveBeenCalled();
    });

    it('is installed by default', async () => {
      const enable = jest.fn();
      globalThis.HermesInternal = { enablePromiseRejectionTracker: enable };
      await Unilitix.init('k');
      expect(enable).toHaveBeenCalledTimes(1);
    });

    it('a throwing tracker install does not break init', async () => {
      globalThis.HermesInternal = {
        enablePromiseRejectionTracker: () => {
          throw new Error('nope');
        },
      };
      await expect(Unilitix.init('k')).resolves.toBeUndefined();
      expect(Unilitix.isInitialized).toBe(true);
    });
  });

  describe('navigation listener', () => {
    beforeEach(() => Unilitix.init('k', { installJsCrashHandler: false }));

    it('tracks the deepest active route', async () => {
      const listener = createUnilitixNavigationListener();
      listener({
        index: 0,
        routes: [
          {
            name: 'Tabs',
            state: { index: 1, routes: [{ name: 'A' }, { name: 'B' }] },
          },
        ],
      });
      await settle();
      expect(NativeModules.Unilitix.screen).toHaveBeenCalledWith({
        screenName: 'B',
      });
    });

    it('ignores malformed state without throwing', () => {
      const listener = createUnilitixNavigationListener();
      expect(() => listener({ index: 0 })).not.toThrow();
      expect(() => listener(undefined)).not.toThrow();
    });
  });
});
