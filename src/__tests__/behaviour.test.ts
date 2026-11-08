// @ts-nocheck
// Behaviour fixtures (contract 1.4.0) for the JS layer. Each JS-relevant case
// runs through the public API against FakeCore (a minimal conforming model of
// the native core, see harness/fakeCore.ts) and is checked twice:
//   1. the fixture's own expectations (requests, events, state), with the
//      contract matcher, and
//   2. the exact state-changing native calls the JS layer made
//      (EXPECTED_NATIVE_CALLS below).
// Every other case is native-owned and listed in NATIVE_OWNED with the
// reason; COVERAGE.md documents the split. A new fixture fails the
// "every case is classified" test until it is added to one of the lists.
import { it, expect, describe, beforeEach, afterEach } from '@jest/globals';
import { join } from 'path';
import { NativeModules, Platform } from 'react-native';
import Unilitix from '../index';
import {
  loadBehaviourCases,
  decodeInput,
  substitute,
} from '../generated/behaviourFixtures';
import { FakeCore, QUERY_METHODS } from './behaviour/harness/fakeCore';
import { match, matches, type Captures } from './behaviour/harness/matcher';

const { harness, cases } = loadBehaviourCases(
  join(__dirname, 'behaviour'),
  'react-native'
);
const byId = new Map(cases.map((c) => [c.id, c]));

/** Native-owned cases, by the reason the JS layer cannot affect them. */
const NATIVE_OWNED: Record<string, string> = {
  'crashes.reports-per-fingerprint-capped':
    'per-session cap is applied by the core',
  'crashes.native-android-app-frames': 'native crash files and grouping',
  'crashes.native-android-unsymbolicated-frames':
    'native crash files and grouping',
  'crashes.native-android-system-only-falls-back':
    'native crash files and grouping',
  'crashes.native-react-native-engine-frames-skipped':
    'native crash files and grouping',
  'crashes.native-apple-app-frames': 'native crash files and grouping',
  'crashes.native-apple-unsymbolicated': 'native crash files and grouping',
  'crashes.native-apple-system-only-falls-back':
    'native crash files and grouping',
  'identity.identify-links-anonymous-id': 'identity and ids live in the core',
  'identity.identify-persists-across-restart':
    'identity and ids live in the core',
  'identity.reset-rotates-ids': 'identity and ids live in the core',
  'identity.reset-does-not-relink-queued-events':
    'identity and ids live in the core',
  'lifecycle.init-starts-session':
    'eventId, timestamps and network are set by the core',
  'lifecycle.queue-survives-restart': 'the offline queue lives in the core',
  'lifecycle.timestamps-follow-clock': 'timestamps are set by the core',
  'network.canonical-types': 'network state is read by the core',
  'network.offline-capture': 'network state is read by the core',
  'queue.cap-drops-oldest': 'the offline queue lives in the core',
  'retry.5xx-keeps-batch-and-backs-off': 'uploads and retry are in the core',
  'retry.no-response-is-retryable': 'uploads and retry are in the core',
  'retry.408-is-retryable': 'uploads and retry are in the core',
  'retry.429-honours-retry-after': 'uploads and retry are in the core',
  'retry.retry-after-is-clamped': 'uploads and retry are in the core',
  'retry.backoff-grows-exponentially': 'uploads and retry are in the core',
  'retry.401-pauses-until-next-init': 'uploads and retry are in the core',
  'retry.403-pauses-until-next-init': 'uploads and retry are in the core',
  'retry.402-pauses-with-default-window': 'uploads and retry are in the core',
  'retry.402-honours-retry-after': 'uploads and retry are in the core',
  'retry.other-4xx-drops-batch': 'uploads and retry are in the core',
  'retry.413-drops-batch': 'uploads and retry are in the core',
  'sessions.short-background-keeps-session':
    'session timeout is applied by the core',
  'sessions.long-background-starts-new-session':
    'session timeout is applied by the core',
  'sessions.timeout-is-configurable': 'session timeout is applied by the core',
  'sessions.replay-sampling-once-per-session':
    'replay sampling is decided by the core',
  'sessions.replay-sample-rate-bounds':
    'replay sampling is decided by the core',
};

const BEHAVIOUR_INIT = {
  apiKey: harness.apiKey,
  apiUrl: harness.apiUrl,
  autoTrackCrashes: false,
  captureSnapshots: false,
  captureScreenshots: false,
  flushIntervalSeconds: 3600,
};
const JS_ERROR_META = {
  platform: 'react-native',
  jsBundleId: 'index.android.bundle',
  release: '1.4.2',
  dist: '42',
};
const STACK = (id) =>
  byId.get(id).steps.find((s) => s.action === 'recordError').args.stack;
const expectedEvent = (id, type) =>
  byId
    .get(id)
    .steps.find((s) => s.action === 'expectEvents')
    .args.events.find((e) => e.type === type);
const expectedRequest = (id, path) =>
  byId
    .get(id)
    .steps.find((s) => s.action === 'expectRequests')
    .args.find((r) => r.path === path);

/**
 * The exact state-changing native calls (queries such as currentSessionId
 * and getBuildInfo left out), as contract matchers. `restart` marks a
 * process restart.
 */
const EXPECTED_NATIVE_CALLS: Record<string, unknown[]> = {
  'lifecycle.pre-init-calls-replayed-in-order': [
    ['init', { ...BEHAVIOUR_INIT, consent: 'granted' }],
    ['track', { event: 'a', properties: { $size: 0 } }],
    ['screen', { screenName: 'Home' }],
    ['identify', { userId: 'u1', traits: { $size: 0 } }],
    ['track', { event: 'b', properties: { $size: 0 } }],
    ['flush', {}],
  ],
  'lifecycle.pre-init-buffer-cap': [
    ['init', BEHAVIOUR_INIT],
    {
      $each: {
        from: 5,
        to: 204,
        match: ['track', { event: 'e${i}' }],
      },
    },
    ['flush', {}],
  ],
  'properties.normalised': [
    ['init', BEHAVIOUR_INIT],
    [
      'track',
      {
        event: 'p',
        properties: {
          $match: expectedEvent('properties.normalised', 'CUSTOM').properties,
          $size: 18,
        },
      },
    ],
    ['flush', {}],
  ],
  'properties.traits-normalised': [
    ['init', BEHAVIOUR_INIT],
    [
      'identify',
      {
        userId: 'u1',
        traits: expectedRequest(
          'properties.traits-normalised',
          '/v1/ingest/identify'
        ).body.traits,
      },
    ],
    ['flush', {}],
  ],
  'properties.names-truncated': [
    ['init', BEHAVIOUR_INIT],
    ['track', { event: { $repeat: { string: 'n', count: 1024 } } }],
    ['screen', { screenName: { $repeat: { string: 's', count: 1024 } } }],
    ['identify', { userId: { $repeat: { string: 'u', count: 1024 } } }],
    ['flush', {}],
  ],
  'crashes.exception-fingerprint': [
    ['init', BEHAVIOUR_INIT],
    [
      'recordException',
      {
        type: 'java.lang.IllegalStateException',
        message: 'cart empty',
        stack: STACK('crashes.exception-fingerprint'),
        fatal: false,
        fingerprint: '76bec3cae7c2c295',
        metadata: JS_ERROR_META,
      },
    ],
    ['flush', {}],
  ],
  'crashes.fatal-error-is-crash': [
    ['init', BEHAVIOUR_INIT],
    [
      'recordException',
      {
        type: 'java.lang.IllegalStateException',
        message: 'boom',
        fatal: true,
        fingerprint: '76bec3cae7c2c295',
        metadata: JS_ERROR_META,
      },
    ],
    ['flush', {}],
  ],
  'crashes.react-native-js-error-metadata': [
    ['init', BEHAVIOUR_INIT],
    [
      'recordException',
      {
        type: 'TypeError',
        message: 'undefined is not an object',
        stack: STACK('crashes.react-native-js-error-metadata'),
        fatal: false,
        fingerprint: 'a3ad739a097ccbc5',
        metadata: JS_ERROR_META,
      },
    ],
    ['flush', {}],
  ],
  'screens.consecutive-duplicates-dropped': [
    ['init', BEHAVIOUR_INIT],
    ['screen', { screenName: 'Home' }],
    ['screen', { screenName: 'Cart' }],
    ['screen', { screenName: 'Home' }],
    ['track', { event: 'a' }],
    ['flush', {}],
  ],
  'screens.new-session-emits-again': [
    ['init', BEHAVIOUR_INIT],
    ['screen', { screenName: 'Home' }],
    ['reset', {}],
    ['screen', { screenName: 'Home' }],
    ['flush', {}],
  ],
  'consent.pending-holds-until-granted': [
    ['init', { consent: 'pending' }],
    ['identify', { userId: 'u1' }],
    ['track', { event: 'a' }],
    ['flush', {}],
    ['setConsent', { value: 'granted' }],
    ['flush', {}],
  ],
  'consent.denied-purges-queue': [
    ['init', { consent: 'pending' }],
    ['track', { event: 'a' }],
    ['track', { event: 'b' }],
    ['identify', { userId: 'u1' }],
    ['setConsent', { value: 'denied' }],
    ['flush', {}],
    ['track', { event: 'c' }],
    ['screen', { screenName: 'Home' }],
    ['flush', {}],
  ],
  'consent.granted-to-denied-drops-unsent': [
    ['init', { consent: 'granted' }],
    ['track', { event: 'a' }],
    ['setConsent', { value: 'denied' }],
    ['flush', {}],
  ],
  'consent.decision-persists-across-restart': [
    ['init', { consent: 'granted' }],
    ['setConsent', { value: 'denied' }],
    ['flush', {}],
    'restart',
    // The app passes its configured consent again; the core's persisted
    // decision wins (checked by the fixture's expectState).
    ['init', { consent: 'granted' }],
    ['track', { event: 'x' }],
    ['flush', {}],
  ],
  'consent.denied-then-granted-captures-again': [
    ['init', { consent: 'denied' }],
    ['track', { event: 'while-denied' }],
    ['setConsent', { value: 'granted' }],
    ['track', { event: 'after-grant' }],
    ['flush', {}],
  ],
};

/** Steps the JS runner can drive; the rest need a native harness. */
const NO_OP_STEPS = new Set(['advanceTime']);

const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

/** README "Normalised requests", steps 4–5 (merge consecutive 2xx). */
function normalise(requests) {
  const byPath = new Map();
  for (const r of requests) {
    const path = r.path === '/v1/ingest/events' ? '/v1/ingest/session' : r.path;
    const list = byPath.get(path) ?? [];
    const prev = list[list.length - 1];
    if (
      path === '/v1/ingest/session' &&
      prev &&
      prev.status >= 200 &&
      prev.status < 300 &&
      r.status >= 200 &&
      r.status < 300 &&
      prev.body.sessionId === r.body.sessionId
    ) {
      prev.body = {
        ...prev.body,
        ...r.body,
        events: [...prev.body.events, ...r.body.events],
      };
    } else {
      list.push({ path, status: r.status, body: structuredClone(r.body) });
    }
    byPath.set(path, list);
  }
  return byPath;
}

function errorOf(args) {
  const e = new Error(args.message);
  e.name = args.type;
  e.stack = args.stack ?? '';
  return e;
}

class Runner {
  core: FakeCore;
  captures: Captures = new Map();
  consumed = 0;
  pending: Promise<unknown>[] = [];
  marks: Array<'restart' | number> = [];

  constructor(readonly c) {
    this.core = new FakeCore(() => c.clock);
    NativeModules.Unilitix = this.core.module();
    Unilitix._resetForTests();
  }

  config() {
    const cfg = { ...this.c.config, apiUrl: harness.apiUrl };
    return { ...cfg, installJsCrashHandler: false };
  }

  async run(steps) {
    for (const step of steps) await this.step(step.action, step.args);
  }

  async step(action, args) {
    const call = (p) => this.pending.push(p);
    switch (action) {
      case 'init':
        call(Unilitix.init(harness.apiKey, this.config()));
        return;
      case 'track':
        call(
          Unilitix.track(
            decodeInput(args.name),
            args.properties === undefined
              ? undefined
              : decodeInput(args.properties)
          )
        );
        return;
      case 'screen':
        call(Unilitix.screen(decodeInput(args.name)));
        return;
      case 'identify':
        call(
          Unilitix.identify(
            decodeInput(args.userId),
            args.traits === undefined ? undefined : decodeInput(args.traits)
          )
        );
        return;
      case 'reset':
        call(Unilitix.reset());
        return;
      case 'flush':
        call(Unilitix.flush());
        return;
      case 'setConsent':
        call(Unilitix.setConsent(args.state));
        return;
      case 'recordError':
        call(Unilitix.captureException(errorOf(args), { fatal: args.fatal }));
        return;
      case 'repeat':
        for (let i = 0; i < args.times; i++) {
          for (const s of args.steps) {
            const k = Object.keys(s)[0];
            await this.step(k, substitute(s[k], i));
          }
        }
        return;
      case 'restart':
        await this.settle();
        this.marks.push('restart', this.core.calls.length);
        Unilitix._resetForTests();
        this.core.restart();
        return;
      case 'expectRequests':
        await this.settle();
        this.expectRequests(args);
        return;
      case 'expectEvents':
        await this.settle();
        this.expectEvents(args);
        return;
      case 'expectState':
        await this.settle();
        match(args, this.core.state(), this.captures, 'state');
        return;
      default:
        if (NO_OP_STEPS.has(action)) return;
        throw new Error(`step ${action} needs a native runner`);
    }
  }

  async settle() {
    await Promise.all(this.pending);
    this.pending = [];
    await settle();
  }

  take() {
    const recorded = this.core.requests.slice(this.consumed);
    this.consumed = this.core.requests.length;
    return normalise(recorded);
  }

  expectRequests(expected) {
    const actual = this.take();
    const paths = new Set([...actual.keys(), ...expected.map((e) => e.path)]);
    for (const path of paths) {
      const want = expected.filter((e) => e.path === path);
      const got = actual.get(path) ?? [];
      expect([path, got.length]).toEqual([path, want.length]);
      want.forEach((w, i) => {
        if (w.status !== undefined) expect(got[i].status).toBe(w.status);
        if (w.body !== undefined) {
          match(w.body, got[i].body, this.captures, `${path}[${i}].body`);
        }
      });
    }
  }

  expectEvents({ mode, events, absent }) {
    const delivered = (this.take().get('/v1/ingest/session') ?? [])
      .filter((r) => r.status >= 200 && r.status < 300)
      .flatMap((r) => r.body.events);
    if (mode === 'exact') {
      match(events, delivered, this.captures, 'events');
    } else {
      let from = 0;
      for (const e of events) {
        const i = delivered.findIndex(
          (d, j) => j >= from && matches(e, d, this.captures)
        );
        if (i < 0)
          throw new Error(`no delivered event matches ${JSON.stringify(e)}`);
        match(e, delivered[i], this.captures, `events[${i}]`);
        from = i + 1;
      }
    }
    for (const a of absent ?? []) {
      const hit = delivered.find((d) => matches(a, d, this.captures));
      if (hit) throw new Error(`event should be absent: ${JSON.stringify(a)}`);
    }
  }

  /** State-changing native calls, with `'restart'` marks, as JSON. */
  nativeCalls() {
    const out = [];
    this.core.calls.forEach((c, i) => {
      while (this.marks[0] === 'restart' && this.marks[1] === i) {
        out.push('restart');
        this.marks.splice(0, 2);
      }
      if (!QUERY_METHODS.has(c.method)) out.push([c.method, c.args]);
    });
    return out;
  }
}

describe('behaviour fixtures (contract 1.4.0)', () => {
  beforeEach(() => {
    Platform.OS = 'android';
  });
  afterEach(() => {
    Unilitix._resetForTests();
    NativeModules.Unilitix = undefined;
  });

  it('loads the react-native cases', () => {
    expect(cases.length).toBeGreaterThanOrEqual(45);
  });

  it('every case is classified as JS-run or native-owned', () => {
    const unclassified = cases
      .map((c) => c.id)
      .filter((id) => !(id in EXPECTED_NATIVE_CALLS) && !(id in NATIVE_OWNED));
    expect(unclassified).toEqual([]);
    const stale = [
      ...Object.keys(EXPECTED_NATIVE_CALLS),
      ...Object.keys(NATIVE_OWNED),
    ].filter((id) => !byId.has(id));
    expect(stale).toEqual([]);
  });

  describe.each(Object.keys(EXPECTED_NATIVE_CALLS))('%s', (id) => {
    it('meets the fixture with exact native calls', async () => {
      const c = byId.get(id);
      const runner = new Runner(c);
      await runner.run(c.steps);
      await runner.settle();
      match(
        EXPECTED_NATIVE_CALLS[id],
        runner.nativeCalls(),
        runner.captures,
        'nativeCalls'
      );
    });
  });
});
