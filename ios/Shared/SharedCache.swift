import Foundation

/// Last known status cached in the App Group so widgets render instantly
/// (and still show something when their network fetch is throttled).
enum SharedCache {
    private static let key = "cachedStatus"

    static func save(_ status: ServerStatus) {
        if let data = try? JSONEncoder().encode(status) {
            Settings.suite.set(data, forKey: key)
        }
    }

    static func load() -> ServerStatus? {
        guard let data = Settings.suite.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(ServerStatus.self, from: data)
    }
}
