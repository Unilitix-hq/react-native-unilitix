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
import Unilitix from '../index';

type NativeModule = {
  [key: string]: jest.Mock;
};

// Mock the native module
NativeModules.Unilitix = {
  init: jest.fn().mockResolvedValue(undefined),
  track: jest.fn().mockResolvedValue(undefined),
  identify: jest.fn().mockResolvedValue(undefined),
  screen: jest.fn().mockResolvedValue(undefined),
  startSession: jest.fn().mockResolvedValue(undefined),
  endSession: jest.fn().mockResolvedValue(undefined),
  flush: jest.fn().mockResolvedValue(undefined),
  optOut: jest.fn().mockResolvedValue(undefined),
  optIn: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn().mockResolvedValue(undefined),
} as NativeModule;

describe('Unilitix SDK', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('API surface', () => {
    it('exposes all 10 methods', () => {
      expect(typeof Unilitix.init).toBe('function');
      expect(typeof Unilitix.track).toBe('function');
      expect(typeof Unilitix.identify).toBe('function');
      expect(typeof Unilitix.screen).toBe('function');
      expect(typeof Unilitix.startSession).toBe('function');
      expect(typeof Unilitix.endSession).toBe('function');
      expect(typeof Unilitix.flush).toBe('function');
      expect(typeof Unilitix.optOut).toBe('function');
      expect(typeof Unilitix.optIn).toBe('function');
      expect(typeof Unilitix.reset).toBe('function');
    });
  });

  describe('init()', () => {
    it('calls native init with apiKey', async () => {
      await Unilitix.init('test_api_key');
      expect(NativeModules.Unilitix.init).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'test_api_key' })
      );
    });

    it('passes config to native init', async () => {
      await Unilitix.init('test_key', {
        debug: true,
        flushIntervalSeconds: 60,
      });
      expect(NativeModules.Unilitix.init).toHaveBeenCalledWith(
        expect.objectContaining({ debug: true, flushIntervalSeconds: 60 })
      );
    });

    it('rejects when native throws', async () => {
      NativeModules.Unilitix.init = jest
        .fn()
        .mockRejectedValue(new Error('INIT_ERROR'));
      await expect(Unilitix.init('bad_key')).rejects.toThrow('INIT_ERROR');
    });
  });

  describe('track()', () => {
    it('calls native track with event and properties', async () => {
      await Unilitix.track('button_tapped', { screen: 'home' });
      expect(NativeModules.Unilitix.track).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'button_tapped',
          properties: { screen: 'home' },
        })
      );
    });

    it('passes empty object when no properties given', async () => {
      await Unilitix.track('page_viewed');
      expect(NativeModules.Unilitix.track).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'page_viewed', properties: {} })
      );
    });
  });

  describe('identify()', () => {
    it('calls native identify with userId and traits', async () => {
      await Unilitix.identify('user_123', { name: 'Tosin', plan: 'growth' });
      expect(NativeModules.Unilitix.identify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_123',
          traits: { name: 'Tosin', plan: 'growth' },
        })
      );
    });
  });

  describe('screen()', () => {
    it('calls native screen with name', async () => {
      await Unilitix.screen('/dashboard');
      expect(NativeModules.Unilitix.screen).toHaveBeenCalledWith(
        expect.objectContaining({ screenName: '/dashboard' })
      );
    });

    it('sets _screenEventReceived flag', async () => {
      await Unilitix.screen('/home');
      // @ts-ignore — accessing private field for testing
      expect(Unilitix._screenEventReceived).toBe(true);
    });
  });

  describe('session control', () => {
    it('startSession calls native', async () => {
      await Unilitix.startSession();
      expect(NativeModules.Unilitix.startSession).toHaveBeenCalled();
    });

    it('endSession calls native', async () => {
      await Unilitix.endSession();
      expect(NativeModules.Unilitix.endSession).toHaveBeenCalled();
    });
  });

  describe('privacy controls', () => {
    it('optOut calls native', async () => {
      await Unilitix.optOut();
      expect(NativeModules.Unilitix.optOut).toHaveBeenCalled();
    });

    it('optIn calls native', async () => {
      await Unilitix.optIn();
      expect(NativeModules.Unilitix.optIn).toHaveBeenCalled();
    });

    it('reset calls native', async () => {
      await Unilitix.reset();
      expect(NativeModules.Unilitix.reset).toHaveBeenCalled();
    });
  });

  describe('flush()', () => {
    it('calls native flush', async () => {
      await Unilitix.flush();
      expect(NativeModules.Unilitix.flush).toHaveBeenCalled();
    });
  });
});
