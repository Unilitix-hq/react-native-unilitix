import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// The iOS side of react-native-unilitix: turns the JS bridge's option
/// dictionaries into calls on UnilitixCore (vendored in ios/UnilitixCore by
/// scripts/sync-ios-core.sh). One engine per process; `start` is idempotent.
@objc(UnilitixBridge)
public final class UnilitixBridge: NSObject {

    /// This package's version; must match package.json (checked by
    /// src/__tests__/ios.test.tsx).
    static let packageVersion = "1.6.2"

    private static let lock = NSLock()
    private static var engine: Engine?
    private static var observers: [NSObjectProtocol] = []

    @objc public static func start(_ options: NSDictionary) {
        lock.lock()
        defer { lock.unlock() }
        guard engine == nil, let apiKey = options["apiKey"] as? String, !apiKey.isEmpty else { return }

        UnilitixVersion.reported = packageVersion
        UnilitixVersion.userAgentPlatform = "ReactNative"

        var config = UnilitixConfig()
        if let v = options["apiUrl"] as? String, !v.isEmpty { config.apiUrl = v }
        if let v = options["debug"] as? Bool { config.debug = v }
        if let v = options["autoTrackCrashes"] as? Bool { config.autoTrackCrashes = v }
        if let v = options["autoTrackTaps"] as? Bool { config.autoTrackTaps = v }
        if let v = options["autoTrackRageTaps"] as? Bool { config.autoTrackRageTaps = v }
        // Screens come from JS (the navigation listener or Unilitix.screen);
        // React Native has one root view controller, so native screen
        // tracking would only record noise.
        config.autoTrackScreens = false
        if let v = options["flushIntervalSeconds"] as? Int { config.flushIntervalSeconds = v }
        if let v = options["flushBatchSize"] as? Int { config.flushBatchSize = v }
        if let v = options["maxOfflineEvents"] as? Int { config.maxOfflineEvents = v }
        if let v = options["sessionTimeoutSeconds"] as? Int { config.sessionTimeoutSeconds = v }
        // Session replay (screenshots). Wireframe snapshots are not on iOS yet.
        if let v = options["captureScreenshots"] as? Bool { config.captureScreenshots = v }
        if let v = options["screenshotIntervalMs"] as? Int { config.screenshotIntervalMs = v }
        if let v = options["screenshotHeartbeatMs"] as? Int { config.screenshotHeartbeatMs = v }
        if let v = options["screenshotQuality"] as? Int { config.screenshotQuality = v }
        if let v = options["screenshotMaxWidth"] as? Int { config.screenshotMaxWidth = v }
        if let v = options["uploadScreenshotsOnWifiOnly"] as? Bool { config.uploadScreenshotsOnWifiOnly = v }
        if let v = options["maxScreenshotsPerSession"] as? Int { config.maxScreenshotsPerSession = v }
        if let v = options["maxScreenshotsPerMinute"] as? Int { config.maxScreenshotsPerMinute = v }
        if let v = (options["replaySampleRate"] ?? options["sampleRate"]) as? Double { config.replaySampleRate = v }
        if let v = options["maskInputs"] as? Bool { config.maskInputs = v }
        if let v = options["maskAllText"] as? Bool { config.maskAllText = v }
        if let v = options["maskImages"] as? Bool { config.maskImages = v }
        if let v = options["maskInputsInScreenshots"] as? Bool { config.maskInputsInScreenshots = v }
        if let v = options["captureSnapshots"] as? Bool { config.captureSnapshots = v }
        if let v = options["snapshotIntervalMs"] as? Int { config.snapshotIntervalMs = v }
        if let v = options["maxSnapshotsPerSession"] as? Int { config.maxSnapshotsPerSession = v }
        let consent = (options["consent"] as? String).flatMap(UnilitixConsent.init(rawValue:)) ?? .granted

        let debug = config.debug
        // A fatal signal is recorded here by the dying process and reported
        // by the engine on the next launch (read at init, before the handlers
        // below are installed).
        let crashFile = CrashFile.enginePath
        let e = Engine(
            config: config,
            transport: URLSessionTransport(baseURL: config.apiUrl, apiKey: apiKey),
            store: EventStore(directory: EventStore.defaultDirectory, maxEvents: config.maxOfflineEvents),
            prefs: Preferences(),
            device: DeviceInfo.current(),
            consent: consent,
            screenshots: ScreenshotStore(directory: ScreenshotStore.defaultDirectory),
            snapshots: SnapshotStore(directory: SnapshotStore.defaultDirectory),
            reachability: PathReachability(),
            crashFilePath: crashFile,
            log: { if debug { NSLog("[Unilitix] %@", $0) } })
        engine = e

        if config.autoTrackCrashes {
            // A fatal JS error is reported by the JS handler; React Native then
            // raises RCTFatalException, which must not be reported twice. The
            // SIGABRT that follows any uncaught exception, ignored or not, is
            // not recorded either (CrashReporter marks it handled).
            CrashReporter.ignoredNamePrefixes = ["RCTFatalException"]
            CrashReporter.install(e)
            // Fatal signals (SIGSEGV, SIGBUS, SIGABRT, ...) in native code.
            CrashFile.installSignalHandlers(path: crashFile)
        }
        e.queue.async { e.start() }
        let taps = config.autoTrackTaps
        let replay = config.captureScreenshots
        let snapshots = config.captureSnapshots
        if taps || replay || snapshots {
            let replayConfig = config
            DispatchQueue.main.async {
                AutoCapture.install(e, screens: false, taps: taps, replay: replay, snapshots: snapshots)
                if replay { ScreenshotCapture.install(e, config: replayConfig) }
                if snapshots { SnapshotCapture.install(e, config: replayConfig) }
            }
        }

        #if canImport(UIKit)
        let nc = NotificationCenter.default
        observers = [
            nc.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: nil) { _ in
                e.queue.async { e.didEnterBackground() }
            },
            nc.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: nil) { _ in
                e.queue.async { e.willEnterForeground() }
            },
        ]
        #endif
    }

    @objc public static func track(_ options: NSDictionary) {
        let name = options["event"] as? String ?? ""
        let props = options["properties"] as? [String: Any] ?? [:]
        run { $0.track(name, properties: props) }
    }

    @objc public static func identify(_ options: NSDictionary) {
        guard let userId = options["userId"] as? String else { return }
        let traits = options["traits"] as? [String: Any] ?? [:]
        run { $0.identify(userId, traits: traits) }
    }

    @objc public static func screen(_ options: NSDictionary) {
        guard let name = options["screenName"] as? String else { return }
        run { $0.screenView(name) }
    }

    @objc public static func recordException(_ options: NSDictionary) {
        let type = options["type"] as? String ?? "Error"
        let message = options["message"] as? String ?? ""
        let stack = options["stack"] as? String
        let fatal = options["fatal"] as? Bool ?? false
        guard let e = current() else { return }
        if fatal {
            // React Native ends the process right after a fatal JS error, so
            // persist synchronously (bounded) instead of going through the queue.
            e.queue.sync { e.recordError(type: type, message: message, stack: stack, fatal: true, platform: "js") }
        } else {
            e.queue.async { e.recordError(type: type, message: message, stack: stack, fatal: false, platform: "js") }
        }
    }

    @objc public static func addBreadcrumb(_ options: NSDictionary) {
        let message = options["message"] as? String ?? ""
        let category = options["category"] as? String
        run { $0.addBreadcrumb(message, category: category) }
    }

    @objc public static func setConsent(_ options: NSDictionary) {
        guard let value = (options["value"] as? String).flatMap(UnilitixConsent.init(rawValue:)) else { return }
        run { $0.setConsent(value) }
    }

    @objc public static func startSession() { run { $0.startSession() } }
    @objc public static func endSession() { run { $0.endSession() } }
    @objc public static func flush() { run { $0.flush() } }
    @objc public static func reset() { run { $0.reset() } }

    private static func current() -> Engine? {
        lock.lock()
        defer { lock.unlock() }
        return engine
    }

    private static func run(_ call: @escaping (Engine) -> Void) {
        guard let e = current() else { return }
        e.queue.async { call(e) }
    }
}
