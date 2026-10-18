// VENDORED from UnilitixCore 0.3.0 (Engine.swift) by scripts/sync-ios-core.sh.
// Do not edit here; change UnilitixCore and re-run the script.

import Foundation

/// The SDK's state machine. Everything except the crash path and
/// `replayGate()` runs on `queue`.
final class Engine {
    let config: UnilitixConfig
    let store: EventStore
    let screenshots: ScreenshotStore
    let breadcrumbs = Breadcrumbs()
    let queue = DispatchQueue(label: "io.unilitix.engine", qos: .utility)

    private let transport: Transport
    private let prefs: Preferences
    private let device: DeviceInfo
    private let reachability: Reachability
    private let random: () -> Double
    private let now: () -> Date
    private let log: (String) -> Void

    private(set) var consent: UnilitixConsent
    private var session: SessionInfo?
    private var backgroundedAt: Date?
    private var screen = ""
    private let rageTaps = RageTapDetector()
    private var seq = 0

    // Upload state (contract: one request per cycle, backoff window, auth latch).
    // `inFlight` covers event batches and screenshot passes alike.
    private var inFlight = false
    private var failures = 0
    private(set) var backoffUntil: Date?
    private(set) var authRejected = false
    private var timer: DispatchSourceTimer?

    // Per-session error caps (contract limits).
    private var seenFingerprints: [String: Int] = [:]
    private var errorReports = 0

    // Session replay. `replaySampled` and `screenshotCount` belong to the
    // current session; the gate is what the main-thread capturer reads.
    private var replaySampled = false
    private var screenshotCount = 0
    private let replayLock = NSLock()
    private var gate: ReplayGate?
    // Storage PUT failures back off separately: a storage outage must not
    // hold back events.
    private var screenshotFailures = 0
    private(set) var screenshotBackoffUntil: Date?
    private var screenshotPasses = 0

    /// Frames per init request (the API accepts 1–200).
    static let screenshotsPerPass = 20
    /// Passes chained in one flush cycle while each one fully succeeds.
    static let maxScreenshotPassesPerCycle = 10
    /// The API presigns upload URLs for this type; the PUT must send it.
    static let screenshotContentType = "image/webp"

    /// Read by the crash handler without going through `queue`.
    private let sessionLock = NSLock()
    private var crashSessionId: String?

    init(config: UnilitixConfig, transport: Transport, store: EventStore,
         prefs: Preferences, device: DeviceInfo, consent: UnilitixConsent,
         screenshots: ScreenshotStore = ScreenshotStore(directory: nil),
         reachability: Reachability = PathReachability(),
         random: @escaping () -> Double = { Double.random(in: 0..<1) },
         now: @escaping () -> Date = Date.init,
         log: @escaping (String) -> Void = { _ in }) {
        self.config = config
        self.transport = transport
        self.store = store
        self.screenshots = screenshots
        self.prefs = prefs
        self.device = device
        self.reachability = reachability
        self.random = random
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
        screenshotCount = 0
        replaySampled = config.captureScreenshots
            && ReplaySampling.isSampled(rate: config.replaySampleRate, roll: random())
        breadcrumbs.clear()
        sessionLock.lock(); crashSessionId = info.id; sessionLock.unlock()
        store.upsertSession(info)
        emit(IngestEvent(type: "SESSION_START", screen: screen, at: t))
        publishReplayGate()
        log("session \(info.id) started\(config.captureScreenshots && !replaySampled ? " (replay not sampled)" : "")")
    }

    /// Ends the current session and uploads it; the next event starts a new one.
    func endSession() {
        touchSession()
        flush()
        store.saveNow()
        session = nil
        publishReplayGate()
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

    /// `automatic` views (from view controllers) skip a repeat of the current
    /// screen, e.g. a child appearing again after a modal is dismissed.
    func screenView(_ name: String, automatic: Bool = false) {
        if automatic && name == screen { return }
        screen = name
        breadcrumbs.add(type: "NAVIGATE", screen: name)
        emit(IngestEvent(type: "NAVIGATE", screen: name, at: now()))
        publishReplayGate()
    }

    /// A tap at (x, y) in points; becomes a RAGE_TAP when it completes one.
    func recordTap(x: Double, y: Double, view: String) {
        guard consent != .denied, config.autoTrackTaps else { return }
        let t = now()
        if config.autoTrackRageTaps,
           let hit = rageTaps.record(x: x, y: y, screen: screen, at: t.timeIntervalSince1970) {
            var e = IngestEvent(type: "RAGE_TAP", screen: screen, at: t)
            e.x = hit.x
            e.y = hit.y
            e.properties = ["taps": .int(Int64(hit.taps))]
            if !view.isEmpty { e.properties?["view"] = .string(view) }
            breadcrumbs.add(type: "RAGE_TAP", screen: screen, message: view.isEmpty ? nil : view, at: t)
            emit(e)
            return
        }
        var e = IngestEvent(type: "TAP", screen: screen, at: t)
        e.x = x
        e.y = y
        if !view.isEmpty { e.properties = ["view": .string(view)] }
        breadcrumbs.add(type: "TAP", screen: screen, message: view.isEmpty ? nil : view, at: t)
        emit(e)
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

    // MARK: Session replay

    /// The session and screen a new frame belongs to, or nil when no frame is
    /// wanted. Safe to call from any thread (the capturer calls it on main).
    func replayGate() -> ReplayGate? {
        replayLock.lock(); defer { replayLock.unlock() }
        return gate
    }

    private func publishReplayGate() {
        var g: ReplayGate?
        if config.captureScreenshots, consent != .denied, replaySampled, let s = session,
           screenshotCount < config.maxScreenshotsPerSession {
            g = ReplayGate(sessionId: s.id, screen: screen)
        }
        replayLock.lock(); gate = g; replayLock.unlock()
    }

    /// A masked, encoded frame from the capturer. Assigns the next ordinal of
    /// the session it was captured in, or drops it (returning nil) when that
    /// session has ended, is not sampled, or reached its cap.
    @discardableResult
    func addScreenshot(_ jpeg: Data, sessionId: String, screen frameScreen: String, capturedAt: Date,
                       viewportWidth: Int, viewportHeight: Int) -> Int? {
        guard config.captureScreenshots, consent != .denied, replaySampled,
              let s = session, s.id == sessionId,
              screenshotCount < config.maxScreenshotsPerSession else { return nil }
        let ordinal = screenshotCount
        screenshotCount += 1
        let frame = PendingScreenshot(sessionId: sessionId, ordinal: ordinal, screenName: frameScreen,
                                      capturedAt: capturedAt, viewportWidth: viewportWidth,
                                      viewportHeight: viewportHeight, bytes: jpeg.count)
        if !screenshots.add(frame, jpeg: jpeg) { log("screenshot \(ordinal) could not be stored") }
        if screenshotCount >= config.maxScreenshotsPerSession {
            log("screenshot cap (\(config.maxScreenshotsPerSession)) reached for this session")
            publishReplayGate()
        }
        return ordinal
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
            screenshots.purge()
            session = nil
            sessionLock.lock(); crashSessionId = nil; sessionLock.unlock()
        case .granted:
            if session == nil { startSession() }
            flush()
        case .pending:
            if previous == .denied { startSession() }
        }
        publishReplayGate()
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
        screenshotPasses = 0
        touchSession()
        guard let batch = store.nextBatch(limit: config.flushBatchSize) else {
            uploadScreenshots()
            return
        }

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
        switch note(status: status, headers: headers, what: "upload") {
        case .accepted:
            store.acknowledge(sent.batch, eventIds: Set(sent.events.map { $0.eventId }), keep: session?.id)
            if store.nextBatch(limit: 1) != nil, store.eventCount >= config.flushBatchSize {
                flush()
            } else {
                uploadScreenshots()
            }
        case .retry, .authFailure:
            break
        case .rejected:
            log("batch rejected by the API (\(status ?? 0)); dropped")
            store.acknowledge(sent.batch, eventIds: Set(sent.events.map { $0.eventId }), keep: session?.id)
        }
    }

    /// Applies an API response to the shared backoff and auth state.
    private func note(status: Int?, headers: [String: String], what: String) -> UploadOutcome {
        let outcome = RetryPolicy.classify(status: status, headers: headers, attempt: failures)
        switch outcome {
        case .accepted:
            failures = 0
            backoffUntil = nil
        case .retry(let after):
            failures += 1
            backoffUntil = now().addingTimeInterval(after)
            log("\(what) failed (\(status.map { "HTTP \($0)" } ?? "no response")); retrying in \(Int(after))s")
        case .authFailure:
            authRejected = true
            log("API key rejected (\(status ?? 0)). Uploads paused until the app restarts; data stays on the device.")
        case .rejected:
            break
        }
        return outcome
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
            screenWidth: device.screenWidth,
            screenHeight: device.screenHeight,
            screenDensity: device.screenDensity,
            locale: device.locale,
            timezone: device.timezone,
            startedAt: ISO8601.string(from: s.startedAt),
            durationMs: Int64(max(0, s.lastActivityAt.timeIntervalSince(s.startedAt)) * 1000),
            crashed: s.crashed,
            events: events)
        return try? JSONEncoder().encode(req)
    }

    // MARK: Screenshot upload
    //
    // One pass: POST /screenshots/init for up to `screenshotsPerPass` frames
    // of the oldest session, PUT each JPEG to its presigned URL, then one
    // POST /screenshots/confirm for the frames that went up. Frames are
    // deleted only once confirmed (or rejected for good). Runs only with
    // consent granted, outside any backoff, and on Wi-Fi when
    // `uploadScreenshotsOnWifiOnly`.

    private struct ScreenshotPass {
        let sessionId: String
        let frames: [PendingScreenshot]
        var urls: [Int: URL] = [:]
    }

    func uploadScreenshots() {
        guard consent == .granted, !authRejected, !inFlight else { return }
        let t = now()
        if let until = backoffUntil, t < until { return }
        if let until = screenshotBackoffUntil, t < until { return }
        if config.uploadScreenshotsOnWifiOnly && !reachability.isOnUnmeteredNetwork { return }
        guard screenshotPasses < Engine.maxScreenshotPassesPerCycle,
              let next = screenshots.nextUpload(limit: Engine.screenshotsPerPass) else { return }
        let req = ScreenshotInitRequest(sessionId: next.sessionId, count: next.frames.count,
                                        ordinals: next.frames.map { $0.ordinal })
        guard let body = try? JSONEncoder().encode(req) else { return }
        screenshotPasses += 1
        inFlight = true
        let pass = ScreenshotPass(sessionId: next.sessionId, frames: next.frames)
        transport.postForResponse("/v1/ingest/screenshots/init", body: body) { [weak self] status, headers, data in
            self?.queue.async { self?.handleInit(status: status, headers: headers, body: data, pass: pass) }
        }
    }

    private func handleInit(status: Int?, headers: [String: String], body: Data?, pass: ScreenshotPass) {
        switch note(status: status, headers: headers, what: "screenshot init") {
        case .accepted:
            guard let data = body,
                  let response = try? JSONDecoder().decode(ScreenshotInitResponse.self, from: data) else {
                log("screenshot init: unexpected response; retrying later")
                backOffScreenshots()
                inFlight = false
                return
            }
            var p = pass
            for slot in response.slots {
                if let url = URL(string: slot.presignedUrl) { p.urls[slot.ordinal] = url }
            }
            putScreenshot(0, p, uploaded: [])
        case .retry, .authFailure:
            inFlight = false
        case .rejected:
            log("screenshots rejected by the API (\(status ?? 0)); \(pass.frames.count) dropped")
            screenshots.remove(pass.frames)
            inFlight = false
        }
    }

    private func putScreenshot(_ index: Int, _ pass: ScreenshotPass, uploaded: [PendingScreenshot]) {
        guard consent == .granted, !authRejected else {
            inFlight = false
            return
        }
        guard index < pass.frames.count else {
            confirmScreenshots(uploaded, pass)
            return
        }
        let frame = pass.frames[index]
        guard let url = pass.urls[frame.ordinal] else {
            log("no upload slot for screenshot \(frame.ordinal); retrying later")
            putScreenshot(index + 1, pass, uploaded: uploaded)
            return
        }
        guard let data = screenshots.data(for: frame) else {
            screenshots.remove([frame])  // its file is gone
            putScreenshot(index + 1, pass, uploaded: uploaded)
            return
        }
        transport.put(url, body: data, contentType: Engine.screenshotContentType) { [weak self] status in
            self?.queue.async { self?.handlePut(status: status, index: index, pass: pass, uploaded: uploaded) }
        }
    }

    private func handlePut(status: Int?, index: Int, pass: ScreenshotPass, uploaded: [PendingScreenshot]) {
        let frame = pass.frames[index]
        if let s = status, (200..<300).contains(s) {
            screenshotFailures = 0
            screenshotBackoffUntil = nil
            putScreenshot(index + 1, pass, uploaded: uploaded + [frame])
            return
        }
        if let s = status, (400..<500).contains(s), s != 429 {
            // Storage refused this request (expired or malformed URL). Never
            // a reason to pause the API key.
            let dropped = screenshots.recordFailedUpload(frame)
            log("screenshot \(frame.ordinal) upload refused (HTTP \(s))\(dropped ? "; dropped" : "")")
        } else {
            backOffScreenshots()
            log("screenshot upload failed (\(status.map { "HTTP \($0)" } ?? "no response")); retrying later")
        }
        // End the pass; confirm what already went up.
        confirmScreenshots(uploaded, pass)
    }

    private func confirmScreenshots(_ uploaded: [PendingScreenshot], _ pass: ScreenshotPass) {
        guard !uploaded.isEmpty, consent == .granted, !authRejected else {
            inFlight = false
            return
        }
        let req = ScreenshotConfirmRequest(sessionId: pass.sessionId, screenshots: uploaded.map {
            ScreenshotConfirmItem(ordinal: $0.ordinal, bytes: $0.bytes,
                                  capturedAt: ISO8601.string(from: $0.capturedAt),
                                  screenName: $0.screenName, viewportWidth: $0.viewportWidth,
                                  viewportHeight: $0.viewportHeight)
        })
        guard let body = try? JSONEncoder().encode(req) else {
            inFlight = false
            return
        }
        let complete = uploaded.count == pass.frames.count
        transport.post("/v1/ingest/screenshots/confirm", body: body) { [weak self] status, headers in
            self?.queue.async {
                self?.handleConfirm(status: status, headers: headers, uploaded: uploaded, complete: complete)
            }
        }
    }

    private func handleConfirm(status: Int?, headers: [String: String], uploaded: [PendingScreenshot],
                               complete: Bool) {
        inFlight = false
        switch note(status: status, headers: headers, what: "screenshot confirm") {
        case .accepted:
            screenshots.remove(uploaded)
            if complete { uploadScreenshots() }  // drain the backlog while all goes well
        case .rejected:
            log("screenshot confirm rejected by the API (\(status ?? 0)); \(uploaded.count) dropped")
            screenshots.remove(uploaded)
        case .retry, .authFailure:
            break  // kept; uploaded and confirmed again next time
        }
    }

    private func backOffScreenshots() {
        let after = RetryPolicy.delay(attempt: screenshotFailures)
        screenshotFailures += 1
        screenshotBackoffUntil = now().addingTimeInterval(after)
    }
}
