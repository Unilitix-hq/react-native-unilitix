// @ts-nocheck
import {
  it,
  expect,
  describe,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { NativeModules } from 'react-native';
import Unilitix, { setupUnilitixCrashHandler } from '../index';

type NativeModule = {
  [key: string]: jest.Mock;
};

function freshNative(): NativeModule {
  return {
    init: jest.fn().mockResolvedValue(undefined),
    track: jest.fn().mockResolvedValue(undefined),
    identify: jest.fn().mockResolvedValue(undefined),
    screen: jest.fn().mockResolvedValue(undefined),
    recordException: jest.fn().mockResolvedValue(undefined),
    addBreadcrumb: jest.fn().mockResolvedValue(undefined),
    startSession: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn().mockResolvedValue(undefined),
    flush: jest.fn().mockResolvedValue(undefined),
    optOut: jest.fn().mockResolvedValue(undefined),
    optIn: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn().mockResolvedValue(undefined),
  } as NativeModule;
}

/** Lets queued microtasks and native promises settle. */
const settle = () => new Promise((r) => setImmediate(r));

describe('Unilitix SDK', () => {
  beforeEach(() => {
    NativeModules.Unilitix = freshNative();
    Unilitix._resetForTests();
    delete globalThis.ErrorUtils;
    delete globalThis.HermesInternal;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('API surface', () => {
    it('exposes the public methods', () => {
      for (const m of [
        'init',
        'track',
        'identify',
        'screen',
        'captureException',
        'addBreadcrumb',
        'startSession',
        'endSession',
        'flush',
        'setConsent',
        'optOut',
        'optIn',
        'reset',
      ]) {
        expect(typeof Unilitix[m]).toBe('function');
      }
      expect(Unilitix.isAvailable).toBe(true);
      expect(Unilitix.isInitialized).toBe(false);
    });

    it('isAvailable is false when the native module is missing', () => {
      NativeModules.Unilitix = undefined;
      expect(Unilitix.isAvailable).toBe(false);
    });
  });

  describe('init()', () => {
    it('calls native init with apiKey and defaults', async () => {
      await Unilitix.init('test_api_key');
      expect(NativeModules.Unilitix.init).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test_api_key',
          maskInputs: true,
          maskAllText: true,
          sampleRate: 1.0,
        })
      );
      expect(Unilitix.isInitialized).toBe(true);
    });

    it('passes config to native init', async () => {
      await Unilitix.init('test_key', {
        debug: true,
        flushIntervalSeconds: 60,
        replaySampleRate: 0.1,
        installJsCrashHandler: false,
      });
      expect(NativeModules.Unilitix.init).toHaveBeenCalledWith(
        expect.objectContaining({
          debug: true,
          flushIntervalSeconds: 60,
          sampleRate: 0.1,
        })
      );
    });

    it('is memoised: a second call does not re-init native', async () => {
      const a = Unilitix.init('k', { installJsCrashHandler: false });
      const b = Unilitix.init('k', { installJsCrashHandler: false });
      expect(a).toBe(b);
      await a;
      expect(NativeModules.Unilitix.init).toHaveBeenCalledTimes(1);
    });

    it('rejects when native throws, and allows a retry', async () => {
      NativeModules.Unilitix.init = jest
        .fn()
        .mockRejectedValueOnce(new Error('INIT_ERROR'))
        .mockResolvedValueOnce(undefined);
      await expect(Unilitix.init('bad_key')).rejects.toThrow('INIT_ERROR');
      await Unilitix.init('bad_key', { installJsCrashHandler: false });
      expect(Unilitix.isInitialized).toBe(true);
    });

    it('passes pending consent to native init instead of opting out', async () => {
      NativeModules.Unilitix.setConsent = jest
        .fn()
        .mockResolvedValue(undefined);
      await Unilitix.init('k', {
        consent: 'pending',
        installJsCrashHandler: false,
      });
      expect(NativeModules.Unilitix.init).toHaveBeenCalledWith(
        expect.objectContaining({ consent: 'pending' })
      );
      expect(NativeModules.Unilitix.optOut).not.toHaveBeenCalled();
      expect(Unilitix.consent).toBe('pending');
      await Unilitix.setConsent('granted');
      expect(NativeModules.Unilitix.setConsent).toHaveBeenCalledWith({
        value: 'granted',
      });
      expect(NativeModules.Unilitix.optIn).not.toHaveBeenCalled();
    });

    it('falls back to optIn/optOut when native setConsent is missing', async () => {
      await Unilitix.init('k', { installJsCrashHandler: false });
      await Unilitix.setConsent('denied');
      expect(NativeModules.Unilitix.optOut).toHaveBeenCalledTimes(1);
      await Unilitix.setConsent('granted');
      expect(NativeModules.Unilitix.optIn).toHaveBeenCalledTimes(1);
    });

    it('installs the JS crash handler by default', async () => {
      const previous = jest.fn();
      globalThis.ErrorUtils = {
        getGlobalHandler: () => previous,
        setGlobalHandler: jest.fn(),
      };
      await Unilitix.init('k');
      expect(globalThis.ErrorUtils.setGlobalHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('pre-init buffer', () => {
    it('replays calls made before init, in order', async () => {
      Unilitix.track('first');
      Unilitix.screen('/home');
      Unilitix.identify('u1');
      expect(NativeModules.Unilitix.track).not.toHaveBeenCalled();
      await Unilitix.init('k', { installJsCrashHandler: false });
      await settle();
      expect(NativeModules.Unilitix.track).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'first' })
      );
      expect(NativeModules.Unilitix.screen).toHaveBeenCalledWith({
        screenName: '/home',
      });
      expect(NativeModules.Unilitix.identify).toHaveBeenCalled();
      const order = [
        NativeModules.Unilitix.track.mock.invocationCallOrder[0],
        NativeModules.Unilitix.screen.mock.invocationCallOrder[0],
        NativeModules.Unilitix.identify.mock.invocationCallOrder[0],
      ];
      expect([...order].sort((x, y) => x - y)).toEqual(order);
    });

    it('queues calls made while init is in flight', async () => {
      let resolveInit;
      NativeModules.Unilitix.init = jest.fn(
        () => new Promise((r) => (resolveInit = r))
      );
      const init = Unilitix.init('k', { installJsCrashHandler: false });
      Unilitix.track('during');
      await settle();
      expect(NativeModules.Unilitix.track).not.toHaveBeenCalled();
      resolveInit();
      await init;
      await settle();
      expect(NativeModules.Unilitix.track).toHaveBeenCalledTimes(1);
    });
  });

  describe('track()', () => {
    beforeEach(() => Unilitix.init('k', { installJsCrashHandler: false }));

    it('calls native track with event and properties', async () => {
      await Unilitix.track('button_tapped', { screen: 'home' });
      expect(NativeModules.Unilitix.track).toHaveBeenCalledWith({
        event: 'button_tapped',
        properties: { screen: 'home' },
      });
    });

    it('passes empty object when no properties given', async () => {
      await Unilitix.track('page_viewed');
      expect(NativeModules.Unilitix.track).toHaveBeenCalledWith({
        event: 'page_viewed',
        properties: {},
      });
    });

    it('never rejects into the app when native fails', async () => {
      NativeModules.Unilitix.track = jest
        .fn()
        .mockRejectedValue(new Error('TRACK_ERROR'));
      await expect(Unilitix.track('x')).resolves.toBeUndefined();
    });
  });

  describe('identify() and screen()', () => {
    beforeEach(() => Unilitix.init('k', { installJsCrashHandler: false }));

    it('calls native identify with userId and traits', async () => {
      await Unilitix.identify('user_123', { name: 'Tosin', plan: 'growth' });
      expect(NativeModules.Unilitix.identify).toHaveBeenCalledWith({
        userId: 'user_123',
        traits: { name: 'Tosin', plan: 'growth' },
      });
    });

    it('calls native screen with name and sets the flag', async () => {
      await Unilitix.screen('/dashboard');
      expect(NativeModules.Unilitix.screen).toHaveBeenCalledWith({
        screenName: '/dashboard',
      });
      expect(Unilitix._screenEventReceived).toBe(true);
    });
  });

  describe('one-options bridge shape', () => {
    beforeEach(() => Unilitix.init('k', { installJsCrashHandler: false }));

    it.each([['startSession'], ['endSession'], ['flush'], ['reset']])(
      '%s sends an options object',
      async (method) => {
        await Unilitix[method]();
        expect(NativeModules.Unilitix[method]).toHaveBeenCalledWith({});
      }
    );

    it('optOut / optIn map to setConsent', async () => {
      await Unilitix.optOut();
      expect(NativeModules.Unilitix.optOut).toHaveBeenCalledWith({});
      expect(Unilitix.consent).toBe('denied');
      await Unilitix.optIn();
      expect(NativeModules.Unilitix.optIn).toHaveBeenCalledWith({});
      expect(Unilitix.consent).toBe('granted');
    });
  });

  describe('crash reporting', () => {
    beforeEach(() => Unilitix.init('k', { installJsCrashHandler: false }));

    it('captureException sends type, message, stack and fatal', async () => {
      const err = new TypeError('nope');
      await Unilitix.captureException(err);
      expect(NativeModules.Unilitix.recordException).toHaveBeenCalledWith({
        type: 'TypeError',
        message: 'nope',
        stack: err.stack,
        fatal: false,
      });
    });

    it('captureException copes with non-Error values', async () => {
      await Unilitix.captureException({ code: 42 });
      expect(NativeModules.Unilitix.recordException).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'NonError', message: '{"code":42}' })
      );
    });

    it('addBreadcrumb forwards message and category', async () => {
      await Unilitix.addBreadcrumb('checkout started', 'flow');
      expect(NativeModules.Unilitix.addBreadcrumb).toHaveBeenCalledWith({
        message: 'checkout started',
        category: 'flow',
      });
    });

    it('global handler reports a CRASH, persists, then chains', async () => {
      const previous = jest.fn();
      let installed;
      globalThis.ErrorUtils = {
        getGlobalHandler: () => previous,
        setGlobalHandler: (h) => (installed = h),
      };
      setupUnilitixCrashHandler();
      setupUnilitixCrashHandler(); // idempotent
      const err = new Error('boom');
      installed(err, true);
      expect(previous).not.toHaveBeenCalled();
      await settle();
      expect(NativeModules.Unilitix.recordException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'boom', fatal: true })
      );
      expect(previous).toHaveBeenCalledWith(err, true);
      expect(previous).toHaveBeenCalledTimes(1);
    });

    it('global handler chains within the budget when native hangs', () => {
      jest.useFakeTimers();
      NativeModules.Unilitix.recordException = jest.fn(
        () => new Promise(() => undefined)
      );
      const previous = jest.fn();
      let installed;
      globalThis.ErrorUtils = {
        getGlobalHandler: () => previous,
        setGlobalHandler: (h) => (installed = h),
      };
      setupUnilitixCrashHandler();
      installed(new Error('stuck'), true);
      expect(previous).not.toHaveBeenCalled();
      jest.advanceTimersByTime(2000);
      expect(previous).toHaveBeenCalledTimes(1);
    });

    it('non-fatal errors chain immediately as EXCEPTION', async () => {
      const previous = jest.fn();
      let installed;
      globalThis.ErrorUtils = {
        getGlobalHandler: () => previous,
        setGlobalHandler: (h) => (installed = h),
      };
      setupUnilitixCrashHandler();
      installed(new Error('soft'), false);
      expect(previous).toHaveBeenCalledTimes(1);
      await settle();
      expect(NativeModules.Unilitix.recordException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'soft', fatal: false })
      );
    });

    it('unhandled promise rejections are reported via Hermes tracker', async () => {
      let tracker;
      globalThis.HermesInternal = {
        enablePromiseRejectionTracker: (opts) => (tracker = opts),
      };
      setupUnilitixCrashHandler();
      expect(tracker.allRejections).toBe(true);
      tracker.onUnhandled(1, new RangeError('bad range'));
      await settle();
      expect(NativeModules.Unilitix.recordException).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RangeError',
          message: 'bad range',
          fatal: false,
        })
      );
    });
  });
});
