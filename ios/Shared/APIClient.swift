import Foundation

/// Where the app keeps the backend URL + optional token, shared via App Group
/// so the iOS app, the Watch app and any extension read the same settings.
enum Settings {
    static let suite = UserDefaults(suiteName: "group.xyz.mikebravo.gminamc") ?? .standard

    static var baseURL: String {
        get { suite.string(forKey: "baseURL") ?? "" }
        set { suite.set(newValue, forKey: "baseURL") }
    }
    static var apiToken: String {
        get { suite.string(forKey: "apiToken") ?? "" }
        set { suite.set(newValue, forKey: "apiToken") }
    }
}

enum APIError: Error { case notConfigured, badResponse }

struct APIClient {
    var baseURL: String = Settings.baseURL
    var token: String = Settings.apiToken

    private func request(_ path: String, method: String = "GET", body: Data? = nil) throws
        -> URLRequest
    {
        guard !baseURL.isEmpty, let url = URL(string: baseURL + path) else {
            throw APIError.notConfigured
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = 10
        if !token.isEmpty { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            req.httpBody = body
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return req
    }

    func fetchStatus() async throws -> ServerStatus {
        let (data, resp) = try await URLSession.shared.data(for: request("/api/status"))
        guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw APIError.badResponse }
        return try JSONDecoder().decode(ServerStatus.self, from: data)
    }

    /// Registers this device's APNs token so the backend can push "X joined".
    func registerDevice(token deviceToken: String) async throws {
        let body = try JSONSerialization.data(withJSONObject: ["token": deviceToken])
        let (_, resp) = try await URLSession.shared.data(
            for: request("/api/devices", method: "POST", body: body))
        guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw APIError.badResponse }
    }
}
