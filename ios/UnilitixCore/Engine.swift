// VENDORED from UnilitixCore 0.1.1 (Engine.swift) by scripts/sync-ios-core.sh.
// Do not edit here; change UnilitixCore and re-run the script.

import Foundation

/// The SDK's state machine. Everything except the crash path runs on `queue`.
final class Engine {
    let config: UnilitixConfig
    let store: EventStore
    let breadcrumbs = Breadcrumbs()
    let queue = DispatchQueue(label: "io.unilitix.engine", qos: .utility)

    private let transport: Transport
    private let prefs: Preferences
    private let device: DeviceInfo
    private let now: () -> Date
    private let log: (String) -> Void

    private(set) var consent: UnilitixConsent
    private var session: SessionInfo?
    private var backgroundedAt: Date?
    private var screen = ""
    private var seq = 0

    // Upload state (contract: one request per cycle, backoff window, auth latch).
    private var inFlight = false
    private var failures = 0
    private(set) var backoffUntil: Date?
    private(set) var authRejected = false
    private var timer: DispatchSourceTimer?

    // Per-session error caps (contract limits).
    private var seenFingerprints: [String: Int] = [:]
    private var errorReports = 0

    /// Read by the crash handler without going through `queue`.
    private let sessionLock = NSLock()
    private var crashSessionId: String?

    init(config: UnilitixConfig, transport: Transport, store: EventStore,
         prefs: Preferences, device: DeviceInfo, consent: UnilitixConsent,
         now: @escaping () -> Date = Date.init,
         log: @escaping (String) -> Void = { _ in }) {
        self.config = config
        self.transport = transport
        self.store = store
        self.prefs = prefs
        self.device = device
        self.now = now
        self.log = log
        // A decision persisted from a previous launch wins over the argument.
        self.consent = prefs.consent ?? consent
    }

    // MARK: Lifecycle

    /// Starts the first session and the flush timer. Call on `queue`.
    func start() {
        if consent != .denied { startSession() }
        let t = DispatchSource.makeTimerSource(queue: queue)
        let interval = DispatchTimeInterval.seconds(max(1, config.flushIntervalSeconds))
        t.schedule(deadline: .now() + interval, repeating: interval)
        t.setEventHandler { [weak self] in self?.flush() }
        t.resume()
        timer = t
        flush()
    }

    func stop() {
        timer?.cancel()
        timer = nil
    }

    func didEnterBackground() {
        backgroundedAt = now()
        touchSession()
        flush()
        store.saveNow()
    }

    func willEnterForeground() {
        let t = now()
        if let bg = backgroundedAt,
           t.timeIntervalSince(bg) >= TimeInterval(config.sessionTimeoutSeconds) {
            startSession()
        }
        backgroundedAt = nil
        flush()
    }

    var sessionId: String? { session?.id }

    /// Starts a new session now. Also used when the app returns after the timeout.
    func startSession() {
        guard consent != .denied else { return }
        let t = now()
        let info = SessionInfo(id: UUID().uuidString.lowercased(), startedAt: t, lastActivityAt: t,
                               crashed: false, customUserId: prefs.customUserId)
        session = info
        seq = 0
        seenFingerprints = [:]
        errorReports = 0
        breadcrumbs.clear()
        sessionLock.lock(); crashSessionId = info.id; sessionLock.unlock()
        store.upsertSession(info)
        emit(IngestEvent(type: "SESSION_START", screen: screen, at: t))
        log("session \(info.id) started")
    }

    /// Ends the current session and uploads it; the next event starts a new one.
    func endSession() {
        touchSession()
        flush()
        store.saveNow()
        session = nil
    }

    private func touchSession() {
        guard var s = session else { return }
        s.lastActivityAt = now()
        session = s
        store.upsertSession(s)
    }

    // MARK: Capture

    func track(_ name: String, properties: [String: Any]) {
        var e = IngestEvent(type: "CUSTOM", screen: screen, at: now())
        e.metadata = ["name": .string(name)]
        if !properties.isEmpty { e.properties = JSONValue.objectMap(from: properties) }
        breadcrumbs.add(type: "CUSTOM", screen: screen, message: name)
        emit(e)
    }

    func screenView(_ name: String) {
        screen = name
        breadcrumbs.add(type: "NAVIGATE", screen: name)
        emit(IngestEvent(type: "NAVIGATE", screen: name, at: now()))
    }

    func addBreadcrumb(_ message: String, category: String?) {
        breadcrumbs.add(type: category ?? "custom", screen: screen, message: message)
    }

    /// A handled error (EXCEPTION) or, with `fatal`, a crash (CRASH).
    func recordError(type: String, message: String, stack: String?, fatal: Bool, platform: String = "ios") {
        guard let e = errorEvent(type: type, message: message, stack: stack, fatal: fatal, checkCaps: true,
                                 platform: platform) else {
            return
        }
        if fatal, var s = session {
            s.crashed = true
            session = s
        }
        emit(e)
        if fatal {
            store.saveNow()
            flush()
        }
    }

    /// Crash path: runs on the crashing thread, never touches `queue`, and
    /// waits at most the contract's fatal budget for the store.
    func recordFatalSynchronously(type: String, message: String, stack: String?) {
        sessionLock.lock()
        let sid = crashSessionId
        sessionLock.unlock()
        guard let sessionId = sid, consent != .denied,
              let e = errorEvent(type: type, message: message, stack: stack, fatal: true, checkCaps: false,
                                 platform: "ios") else {
            return
        }
        let budget = TimeInterval(SdkContract.fatalFlushBudgetMs) / 1000
        if store.append(e, sessionId: sessionId, waitUpTo: budget) {
            store.saveNow()
        }
    }

    private func errorEvent(type: String, message: String, stack: String?, fatal: Bool,
                            checkCaps: Bool, platform: String) -> IngestEvent? {
        let fp = Fingerprint.of(type, stack: stack)
        if checkCaps {
            let n = (seenFingerprints[fp] ?? 0) + 1
            seenFingerprints[fp] = n
            if n > SdkContract.maxReportsPerFingerprint || errorReports >= SdkContract.maxErrorReportsPerSession {
                log("error \(fp) not sent (per-session cap)")
                return nil
            }
            errorReports += 1
        }
        var e = IngestEvent(type: fatal ? "CRASH" : "EXCEPTION", screen: breadcrumbs.lastScreen, at: now())
        e.fatal = fatal
        e.title = message.isEmpty ? type : "\(type): \(message)"
        e.exceptionType = type
        e.exceptionMessage = message
        if let stack = stack { e.stackTrace = String(stack.prefix(16 * 1024)) }
        e.breadcrumbs = breadcrumbs.toWire()
        e.metadata = ["fingerprint": .string(fp), "platform": .string(platform)]
        return e
    }

    private func emit(_ event: IngestEvent) {
        guard consent != .denied else { return }
        if session == nil { startSession() }  // after endSession()
        guard let s = session else { return }
        var e = event
        e.seq = seq
        seq += 1
        store.append(e, sessionId: s.id)
        if store.eventCount >= config.flushBatchSize { flush() }
    }

    // MARK: Identity and consent

    func identify(_ userId: String, traits: [String: Any]) {
        prefs.customUserId = userId
        if var s = session {
            s.customUserId = userId
            session = s
            store.upsertSession(s)
        }
        guard consent == .granted, !authRejected else { return }
        let body = IdentifyRequest(anonymousId: prefs.anonymousId, customUserId: userId,
                                   traits: traits.isEmpty ? nil : JSONValue.objectMap(from: traits))
        if let data = try? JSONEncoder().encode(body) {
            transport.post("/v1/ingest/identify", body: data) { _, _ in }
        }
    }

    func setConsent(_ value: UnilitixConsent) {
        let previous = consent
        consent = value
        prefs.consent = value
        switch value {
        case .denied:
            store.purge()
            session = nil
            sessionLock.lock(); crashSessionId = nil; sessionLock.unlock()
        case .granted:
            if session == nil { startSession() }
            flush()
        case .pending:
            if previous == .denied { startSession() }
        }
    }

    /// New anonymous identity and a new session (e.g. on logout).
    func reset() {
        prefs.customUserId = nil
        prefs.anonymousId = UUID().uuidString.lowercased()
        startSession()
    }

    // MARK: Upload

    func flush() {
        guard consent == .granted, !authRejected, !inFlight else { return }
        if let until = backoffUntil, now() < until { return }
        touchSession()
        guard let batch = store.nextBatch(limit: config.flushBatchSize) else { return }

        var events = batch.events
        var body = encode(batch.session, events)
        while let b = body, b.count > SdkContract.maxRequestBytes, events.count > 1 {
            events = Array(events.prefix(events.count / 2))
            body = encode(batch.session, events)
        }
        guard let data = body else { return }
        if data.count > SdkContract.maxRequestBytes, let only = events.first {
            log("event \(only.eventId) is larger than the API accepts; dropped")
            store.drop(eventId: only.eventId, sessionId: batch.session.id)
            return
        }

        inFlight = true
        let sent = Batch(batch: batch, events: events)
        transport.post("/v1/ingest/session", body: data) { [weak self] status, headers in
            self?.queue.async { self?.handle(status: status, headers: headers, sent: sent) }
        }
    }

    private struct Batch {
        let batch: EventStore.Batch
        let events: [IngestEvent]
    }

    private func handle(status: Int?, headers: [String: String], sent: Batch) {
        inFlight = false
        switch RetryPolicy.classify(status: status, headers: headers, attempt: failures) {
        case .accepted:
            failures = 0
            backoffUntil = nil
            store.acknowledge(sent.batch, eventIds: Set(sent.events.map { $0.eventId }), keep: session?.id)
            if store.nextBatch(limit: 1) != nil, store.eventCount >= config.flushBatchSize { flush() }
        case .retry(let after):
            failures += 1
            backoffUntil = now().addingTimeInterval(after)
            log("upload failed (\(status.map { "HTTP \($0)" } ?? "no response")); retrying in \(Int(after))s")
        case .authFailure:
            authRejected = true
            log("API key rejected (\(status ?? 0)). Uploads paused until the app restarts; data stays on the device.")
        case .rejected:
            log("batch rejected by the API (\(status ?? 0)); dropped")
            store.acknowledge(sent.batch, eventIds: Set(sent.events.map { $0.eventId }), keep: session?.id)
        }
    }

    private func encode(_ s: SessionInfo, _ events: [IngestEvent]) -> Data? {
        let req = IngestSessionRequest(
            sessionId: s.id,
            anonymousId: prefs.anonymousId,
            installId: prefs.installId,
            customUserId: s.customUserId,
            sdkVersion: UnilitixVersion.reported,
            os: device.os,
            osVersion: device.osVersion,
            deviceModel: device.deviceModel,
            manufacturer: "Apple",
            deviceType: device.deviceType,
            appVersion: device.appVersion,
            buildNumber: device.buildNumber,
            packageName: device.packageName,
            locale: device.locale,
            timezone: device.timezone,
            startedAt: ISO8601.string(from: s.startedAt),
            durationMs: Int64(max(0, s.lastActivityAt.timeIntervalSince(s.startedAt)) * 1000),
            crashed: s.crashed,
            events: events)
        return try? JSONEncoder().encode(req)
    }
}
