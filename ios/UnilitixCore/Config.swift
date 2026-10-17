// VENDORED from UnilitixCore 0.1.1 (Config.swift) by scripts/sync-ios-core.sh.
// Do not edit here; change UnilitixCore and re-run the script.

import Foundation

/// SDK configuration. Every default is the shared SDK contract's
/// (`SdkContract.defaults`); `SdkContractTests` fails if one drifts.
///
/// UnilitixCore 0.1 covers events, sessions, errors and crashes. Auto-capture
/// (screens, taps, rage taps) and replay arrive in 0.2; their options are
/// listed as iOS divergences in the contract until then.
public struct UnilitixConfig {
    /// Ingest API base URL.
    public var apiUrl: String = "https://api.unilitix.com"
    /// Verbose logging to the console.
    public var debug: Bool = false
    /// Report uncaught Objective-C exceptions as CRASH events.
    public var autoTrackCrashes: Bool = true
    /// Upload queued events at least this often, in seconds.
    public var flushIntervalSeconds: Int = 30
    /// Upload early once this many events are queued; also the most events
    /// sent in one request.
    public var flushBatchSize: Int = 100
    /// Events kept on the device while offline; the oldest are dropped first.
    public var maxOfflineEvents: Int = 1000
    /// Time in the background, in seconds, after which returning to the app
    /// starts a new session.
    public var sessionTimeoutSeconds: Int = 1800

    public init() {}
}

/// Whether the SDK may collect and upload.
public enum UnilitixConsent: String, CaseIterable {
    /// Capture and upload normally. Granting after `pending` uploads what was held.
    case granted
    /// Capture to the on-device queue but upload nothing until `setConsent`
    /// decides. For apps that must ask first (NDPR, GDPR).
    case pending
    /// Stop capture and delete everything queued on the device.
    case denied
}

/// Persists the consent decision and the device identity across launches.
final class Preferences {
    private let defaults: UserDefaults
    private enum Key {
        static let consent = "unilitix_consent"
        static let anonymousId = "unilitix_anonymous_id"
        static let installId = "unilitix_install_id"
        static let customUserId = "unilitix_custom_user_id"
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    /// The decision the user made on a previous launch, if any. It always
    /// wins over the value the app passes to `start`.
    var consent: UnilitixConsent? {
        get { defaults.string(forKey: Key.consent).flatMap(UnilitixConsent.init(rawValue:)) }
        set { defaults.set(newValue?.rawValue, forKey: Key.consent) }
    }

    var anonymousId: String {
        get { stableId(Key.anonymousId) }
        set { defaults.set(newValue, forKey: Key.anonymousId) }
    }

    var installId: String { stableId(Key.installId) }

    var customUserId: String? {
        get { defaults.string(forKey: Key.customUserId) }
        set { defaults.set(newValue, forKey: Key.customUserId) }
    }

    private func stableId(_ key: String) -> String {
        if let id = defaults.string(forKey: key) { return id }
        let id = UUID().uuidString.lowercased()
        defaults.set(id, forKey: key)
        return id
    }
}
