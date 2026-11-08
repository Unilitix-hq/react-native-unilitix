// @ts-nocheck
// Conformance with the shared SDK contract (api/sdk-contract.md in the api
// repo). src/generated/sdkContract.ts is generated there; refresh it with
// `yarn api:contract`, never edit it by hand. Keys in
// SdkContract.divergences are known gaps with a planned fix and are skipped.
import { it, expect, describe, beforeEach, jest } from '@jest/globals';
import { NativeModules } from 'react-native';
import Unilitix from '../index';
import { SdkContract } from '../generated/sdkContract';

const skipped = (key: string) => SdkContract.divergences.includes(key);

describe('SdkContract', () => {
  beforeEach(() => {
    NativeModules.Unilitix = {
      init: jest.fn().mockResolvedValue(undefined),
      optOut: jest.fn().mockResolvedValue(undefined),
      optIn: jest.fn().mockResolvedValue(undefined),
    };
    Unilitix._resetForTests();
  });

  it('config defaults match the contract', async () => {
    await Unilitix.init('k', { installJsCrashHandler: false });
    const sent = { ...NativeModules.Unilitix.init.mock.calls[0][0] };
    // The bridge field is sampleRate; the public option is replaySampleRate.
    const actual = {
      ...sent,
      replaySampleRate: sent.sampleRate,
      consent: Unilitix.consent,
    };
    for (const [key, want] of Object.entries(SdkContract.defaults)) {
      if (skipped(key)) continue;
      expect([key, actual[key]]).toEqual([key, want]);
    }
  });

  it('event types the SDK reports are canonical', () => {
    for (const t of ['CRASH', 'EXCEPTION']) {
      expect(SdkContract.eventTypes).toContain(t);
    }
  });
});

describe('fingerprint (contract "Crash fingerprint")', () => {
  // The normaliser is shared by every platform's stack format, so the JS
  // port runs every vector; native signal types are left to the cores.
  const { fingerprint, isSignalType } = require('../fingerprint');

  it.each(SdkContract.fingerprintVectors.map((v) => [v.name, v]))(
    '%s',
    (_name, v) => {
      if (isSignalType(v.exceptionType)) {
        expect(fingerprint(v.exceptionType, v.stack)).toBeUndefined();
      } else {
        expect(fingerprint(v.exceptionType, v.stack)).toBe(v.fingerprint);
      }
    }
  );

  it('normalises each frame form', () => {
    const { normaliseFrame } = require('../fingerprint');
    expect(normaliseFrame('#0      Foo.bar (package:a/b.dart:12:5)')).toBe(
      'Foo.bar (package:a/b.dart)'
    );
    expect(
      normaliseFrame('#00 abs 0000007a1b2c3d4e virt 00000000002c3d4e _kDart')
    ).toBe('virt:00000000002c3d4e');
    expect(normaliseFrame('<asynchronous suspension>')).toBeNull();
    expect(normaliseFrame('#3      <asynchronous suspension>')).toBeNull();
    expect(
      normaliseFrame('at foo (address at index.android.bundle:1:2345)')
    ).toBe('foo (address at index.android.bundle)');
    // The Go reference (fingerprint.go) matches the JS frame form first, so
    // a JVM frame with a line number keeps a space; the vectors pin it.
    expect(normaliseFrame('at com.a.B.c(B.kt:12)')).toBe('com.a.B.c (B.kt)');
    expect(normaliseFrame('at com.a.B.c(Native Method)')).toBe(
      'com.a.B.c(Native Method)'
    );
    expect(normaliseFrame('at index.android.bundle:1:2345')).toBe(
      'index.android.bundle'
    );
    expect(
      normaliseFrame(
        '2   Shop  0x00000001043a81c4 -[CartViewController pay:] + 52'
      )
    ).toBe('Shop -[CartViewController pay:]');
    expect(normaliseFrame('2   Shop  0x00000001043a81c4 Shop + 70084')).toBe(
      'Shop+70084'
    );
    expect(normaliseFrame("TypeError: x (evaluating 'a.b')")).toBeNull();
    expect(normaliseFrame('   ')).toBeNull();
  });

  it('hashes non-BMP characters as UTF-8', () => {
    /* eslint-disable no-bitwise */
    // Same algorithm, computed independently with Node's Buffer.
    const fnv = (bytes, seed) => {
      let h = seed >>> 0;
      for (const b of bytes) h = Math.imul(h ^ b, 16777619) >>> 0;
      return h.toString(16).padStart(8, '0');
    };
    const type = 'Err😀é';
    const b = [...Buffer.from(type, 'utf8')];
    expect(fingerprint(type, '')).toBe(
      fnv(b, 0x811c9dc5) + fnv(b, (0x811c9dc5 ^ 0x5bd1e995) >>> 0)
    );
    /* eslint-enable no-bitwise */
  });

  it('metadata keys of JS errors are the contract names', () => {
    expect([
      SdkContract.metadataJsBundleId,
      SdkContract.metadataRelease,
      SdkContract.metadataDist,
    ]).toEqual(['jsBundleId', 'release', 'dist']);
  });
});
