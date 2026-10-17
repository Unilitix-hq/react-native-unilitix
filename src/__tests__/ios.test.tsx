// @ts-nocheck
import {
  it,
  expect,
  describe,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NativeModules, Platform } from 'react-native';
import Unilitix from '../index';

function freshNative() {
  const m = {};
  for (const name of [
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
  ]) {
    m[name] = jest.fn().mockResolvedValue(undefined);
  }
  return m;
}

describe('iOS (UnilitixCore)', () => {
  beforeEach(() => {
    Platform.OS = 'ios';
    NativeModules.Unilitix = freshNative();
    Unilitix._resetForTests();
    delete globalThis.ErrorUtils;
  });

  afterEach(() => {
    Platform.OS = 'android';
  });

  it('is available when the native module is linked', () => {
    expect(Unilitix.isAvailable).toBe(true);
  });

  it('forwards calls to the native module', async () => {
    await Unilitix.init('k', { installJsCrashHandler: false });
    await Unilitix.track('purchase', { amount: 5000 });
    await Unilitix.screen('Cart');
    expect(NativeModules.Unilitix.init).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'k', consent: 'granted' })
    );
    expect(NativeModules.Unilitix.track).toHaveBeenCalledWith({
      event: 'purchase',
      properties: { amount: 5000 },
    });
    expect(NativeModules.Unilitix.screen).toHaveBeenCalledWith({
      screenName: 'Cart',
    });
  });

  it('keeps a real pending state instead of opting out', async () => {
    await Unilitix.init('k', {
      consent: 'pending',
      installJsCrashHandler: false,
    });
    expect(NativeModules.Unilitix.init).toHaveBeenCalledWith(
      expect.objectContaining({ consent: 'pending' })
    );
    expect(NativeModules.Unilitix.optOut).not.toHaveBeenCalled();
    await Unilitix.setConsent('granted');
    expect(NativeModules.Unilitix.setConsent).toHaveBeenCalledWith({
      value: 'granted',
    });
    expect(NativeModules.Unilitix.optIn).not.toHaveBeenCalled();
  });

  it('installs the JS crash handler', async () => {
    const setGlobalHandler = jest.fn();
    globalThis.ErrorUtils = {
      getGlobalHandler: () => jest.fn(),
      setGlobalHandler,
    };
    await Unilitix.init('k');
    expect(setGlobalHandler).toHaveBeenCalledTimes(1);
  });

  it('the Swift bridge reports the package version', () => {
    const root = join(__dirname, '..', '..');
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const swift = readFileSync(
      join(root, 'ios', 'UnilitixBridge.swift'),
      'utf8'
    );
    const m = swift.match(/packageVersion = "([^"]+)"/);
    expect(m?.[1]).toBe(pkg.version);
  });
});
