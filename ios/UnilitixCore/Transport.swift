// VENDORED from UnilitixCore 0.2.0 (Transport.swift) by scripts/sync-ios-core.sh.
// Do not edit here; change UnilitixCore and re-run the script.

import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// One HTTP exchange. A protocol so tests can script responses.
protocol Transport {
    /// `status` is nil when no response arrived (DNS, TLS, timeout, offline).
    func post(_ path: String, body: Data,
              completion: @escaping (_ status: Int?, _ headers: [String: String]) -> Void)
}

final class URLSessionTransport: Transport {
    private let baseURL: String
    private let apiKey: String
    private let session: URLSession

    init(baseURL: String, apiKey: String) {
        self.baseURL = baseURL.hasSuffix("/") ? String(baseURL.dropLast()) : baseURL
        self.apiKey = apiKey
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = TimeInterval(SdkContract.requestTimeoutSeconds)
        cfg.timeoutIntervalForResource = TimeInterval(SdkContract.requestTimeoutSeconds)
        cfg.waitsForConnectivity = false
        session = URLSession(configuration: cfg)
    }

    func post(_ path: String, body: Data,
              completion: @escaping (Int?, [String: String]) -> Void) {
        guard let url = URL(string: baseURL + path) else {
            completion(400, [:])  // a malformed apiUrl can never succeed
            return
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.httpBody = body
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue(apiKey, forHTTPHeaderField: SdkContract.apiKeyHeader)
        req.setValue("Unilitix-\(UnilitixVersion.userAgentPlatform)/\(UnilitixVersion.reported)",
                     forHTTPHeaderField: "User-Agent")
        session.dataTask(with: req) { _, response, _ in
            guard let http = response as? HTTPURLResponse else {
                completion(nil, [:])
                return
            }
            var headers: [String: String] = [:]
            for (k, v) in http.allHeaderFields {
                if let k = k as? String { headers[k] = "\(v)" }
            }
            completion(http.statusCode, headers)
        }.resume()
    }
}

public enum UnilitixVersion {
    /// This package's version.
    public static let current = "0.2.0"
    /// What the SDK reports to the API (session `sdkVersion`, User-Agent).
    /// Wrappers that embed UnilitixCore, such as React Native, set their own.
    static var reported = current
    static var userAgentPlatform = "iOS"
}

/// Static facts about the device and app for the session record.
struct DeviceInfo {
    var os = "iOS"
    var osVersion = ProcessInfo.processInfo.operatingSystemVersionString
    var deviceModel = DeviceInfo.machine()
    var deviceType = "phone"
    var appVersion = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
    var buildNumber = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
    var packageName = Bundle.main.bundleIdentifier ?? ""
    /// Screen size in points (the unit tap coordinates use) and its scale.
    var screenWidth: Int?
    var screenHeight: Int?
    var screenDensity: Double?
    var locale = Locale.current.identifier
    var timezone = TimeZone.current.identifier

    static func current() -> DeviceInfo {
        var info = DeviceInfo()
        #if canImport(UIKit) && !os(watchOS)
        let device = UIDevice.current
        info.os = device.systemName
        info.osVersion = device.systemVersion
        info.deviceType = device.userInterfaceIdiom == .pad ? "tablet" : "phone"
        let screen = UIScreen.main
        info.screenWidth = Int(screen.bounds.width)
        info.screenHeight = Int(screen.bounds.height)
        info.screenDensity = Double(screen.scale)
        #elseif os(macOS)
        info.os = "macOS"
        info.deviceType = "desktop"
        #endif
        return info
    }

    /// Hardware identifier such as "iPhone15,2".
    static func machine() -> String {
        var sys = utsname()
        uname(&sys)
        let mirror = Mirror(reflecting: sys.machine)
        return mirror.children.reduce(into: "") { s, child in
            if let byte = child.value as? Int8, byte != 0 { s.append(Character(UnicodeScalar(UInt8(byte)))) }
        }
    }
}
