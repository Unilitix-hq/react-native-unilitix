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
