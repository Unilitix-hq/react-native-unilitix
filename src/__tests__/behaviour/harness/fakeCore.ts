// A minimal, conforming model of the native core behind the bridge, for the
// JS-layer behaviour runner. It owns what the cores own (sessions,
// SESSION_START, eventId/seq, consent gating, identify requests, uploads)
// in the simplest contract-conforming way, and does NOT do what the JS layer
// must do itself (property/name normalisation, pre-init buffering, screen
// dedupe, fingerprints, jsBundleId/release/dist). So a case passes only when
// the JS layer does its part. Native-owned behaviour (retry, network,
// timeouts, queue caps, crash files) is verified by the native runners.
import { randomUUID } from 'crypto';

export type NativeCall = { method: string; args: Record<string, unknown> };
export type RecordedRequest = {
  path: string;
  status: number;
  body: Record<string, unknown>;
};

/** Read-only calls the JS layer makes for its own bookkeeping. */
export const QUERY_METHODS = new Set(['currentSessionId', 'getBuildInfo']);

type Disk = {
  consent: string | null;
  anonymousId: string | null;
  userId: string | null;
  queue: Array<{ sessionId: string; event: Record<string, unknown> }>;
  identifies: Array<Record<string, unknown>>;
  sessions: Map<string, { anonymousId: string; customUserId: string | null }>;
};

export class FakeCore {
  readonly calls: NativeCall[] = [];
  requests: RecordedRequest[] = [];
  private disk: Disk = {
    consent: null,
    anonymousId: null,
    userId: null,
    queue: [],
    identifies: [],
    sessions: new Map(),
  };
  private started = false;
  private consent = 'granted';
  private sessionId: string | null = null;
  private screen: string | null = null;
  private seq = 0;

  constructor(
    private readonly now: () => string,
    private readonly build = { appVersion: '1.4.2', buildNumber: '42' }
  ) {}

  /** The object installed as NativeModules.Unilitix. */
  module(): Record<string, (o?: Record<string, unknown>) => Promise<unknown>> {
    const method =
      (name: string, fn: (o: Record<string, unknown>) => unknown) =>
      (o: Record<string, unknown> = {}) => {
        this.calls.push({ method: name, args: JSON.parse(JSON.stringify(o)) });
        return Promise.resolve(fn(o));
      };
    return {
      init: method('init', (o) => this.init(o)),
      track: method('track', (o) =>
        this.capture({
          type: 'CUSTOM',
          metadata: { name: o.event },
          properties: o.properties ?? {},
        })
      ),
      screen: method('screen', (o) => {
        if (!this.started || this.consent === 'denied') return;
        this.screen = o.screenName as string;
        this.capture({ type: 'NAVIGATE', screen: o.screenName });
      }),
      identify: method('identify', (o) => this.identify(o)),
      recordException: method('recordException', (o) =>
        this.capture({
          type: o.fatal ? 'CRASH' : 'EXCEPTION',
          exceptionType: o.type,
          exceptionMessage: o.message,
          stackTrace: o.stack,
          fatal: o.fatal === true,
          metadata: {
            ...((o.metadata as Record<string, unknown>) ?? {}),
            fingerprint: o.fingerprint ?? null,
          },
        })
      ),
      addBreadcrumb: method('addBreadcrumb', () => undefined),
      setConsent: method('setConsent', (o) =>
        this.setConsent(o.value as string)
      ),
      optIn: method('optIn', () => this.setConsent('granted')),
      optOut: method('optOut', () => this.setConsent('denied')),
      startSession: method('startSession', () => this.startSession()),
      endSession: method('endSession', () => undefined),
      reset: method('reset', () => {
        if (!this.started) return;
        this.disk.anonymousId = randomUUID();
        this.disk.userId = null;
        this.startSession();
      }),
      flush: method('flush', () => this.flush()),
      currentSessionId: method('currentSessionId', () => this.sessionId ?? ''),
      getBuildInfo: method('getBuildInfo', () => ({ ...this.build })),
    };
  }

  /** Process death: memory is lost, the disk is kept. */
  restart() {
    this.started = false;
    this.sessionId = null;
    this.screen = null;
    this.seq = 0;
  }

  state(): Record<string, unknown> {
    return {
      anonymousId: this.disk.anonymousId,
      sessionId: this.sessionId,
      userId: this.disk.userId,
      consent: this.consent,
      queueLength: this.disk.queue.length,
      uploadsPaused: false,
      replaySampled: false,
      screen: this.screen,
    };
  }

  private init(o: Record<string, unknown>) {
    if (this.started) return;
    this.started = true;
    this.consent = this.disk.consent ?? (o.consent as string) ?? 'granted';
    this.disk.anonymousId ??= randomUUID();
    this.startSession();
  }

  private startSession() {
    this.sessionId = randomUUID();
    this.seq = 0;
    this.screen = null;
    this.disk.sessions.set(this.sessionId, {
      anonymousId: this.disk.anonymousId!,
      customUserId: this.disk.userId,
    });
    this.capture({ type: 'SESSION_START' });
  }

  private capture(event: Record<string, unknown>) {
    if (!this.started || this.consent === 'denied' || !this.sessionId) return;
    this.disk.queue.push({
      sessionId: this.sessionId,
      event: {
        eventId: randomUUID(),
        seq: this.seq++,
        timestamp: this.now(),
        ...(this.screen !== null && event.type !== 'NAVIGATE'
          ? { screen: this.screen }
          : {}),
        ...event,
      },
    });
  }

  private identify(o: Record<string, unknown>) {
    if (!this.started || this.consent === 'denied') return;
    this.disk.userId = o.userId as string;
    const s = this.sessionId && this.disk.sessions.get(this.sessionId);
    if (s) s.customUserId = this.disk.userId;
    this.disk.identifies.push({
      anonymousId: this.disk.anonymousId,
      customUserId: o.userId,
      traits: o.traits ?? {},
    });
  }

  private setConsent(value: string) {
    this.disk.consent = value;
    this.consent = value;
    if (value === 'denied') {
      this.disk.queue = [];
      this.disk.identifies = [];
    }
  }

  private flush() {
    if (!this.started || this.consent !== 'granted') return;
    for (const body of this.disk.identifies) {
      this.requests.push({ path: '/v1/ingest/identify', status: 202, body });
    }
    this.disk.identifies = [];
    let current: RecordedRequest | null = null;
    for (const { sessionId, event } of this.disk.queue) {
      if (!current || current.body.sessionId !== sessionId) {
        const info = this.disk.sessions.get(sessionId)!;
        current = {
          path: '/v1/ingest/session',
          status: 202,
          body: {
            sessionId,
            anonymousId: info.anonymousId,
            ...(info.customUserId ? { customUserId: info.customUserId } : {}),
            events: [],
          },
        };
        this.requests.push(current);
      }
      (current.body.events as unknown[]).push(event);
    }
    this.disk.queue = [];
  }
}
