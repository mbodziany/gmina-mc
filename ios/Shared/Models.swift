import Foundation

/// One player in the roster — mirrors the backend's RosterEntry.
struct Player: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let online: Bool
    let firstSeen: Int64
    let lastSeen: Int64
    let sessionsCount: Int
    let totalPlaytimeMs: Int64
    let currentSessionStart: Int64?

    var lastSeenDate: Date { Date(timeIntervalSince1970: Double(lastSeen) / 1000) }
    var currentSessionStartDate: Date? {
        currentSessionStart.map { Date(timeIntervalSince1970: Double($0) / 1000) }
    }
    var totalPlaytime: TimeInterval { Double(totalPlaytimeMs) / 1000 }
}

/// Which backend source produced the data.
enum DataSource: String {
    case plugin   // in-game plugin: accurate, full list, instant
    case slp      // Server List Ping fallback: capped sample, ~poll latency
    case none     // server unreachable

    var label: String {
        switch self {
        case .plugin: return "Wtyczka"
        case .slp: return "Ping"
        case .none: return "Offline"
        }
    }
}

/// Full snapshot returned by GET /api/status.
struct ServerStatus: Codable {
    let serverReachable: Bool
    let source: String?
    let onlineCount: Int
    let rosterDays: Int
    let online: [Player]
    let roster: [Player]
    let updatedAt: Int64

    var dataSource: DataSource { DataSource(rawValue: source ?? "none") ?? .none }

    static let empty = ServerStatus(
        serverReachable: false, source: "none", onlineCount: 0, rosterDays: 7,
        online: [], roster: [], updatedAt: 0
    )
}

enum Format {
    /// "2 h 13 min", "13 min", "<1 min"
    static func duration(_ seconds: TimeInterval) -> String {
        let total = Int(seconds)
        let h = total / 3600
        let m = (total % 3600) / 60
        if h > 0 { return "\(h) h \(m) min" }
        if m > 0 { return "\(m) min" }
        return "<1 min"
    }

    static func relative(_ date: Date) -> String {
        let f = RelativeDateTimeFormatter()
        f.locale = Locale(identifier: "pl_PL")
        f.unitsStyle = .abbreviated
        return f.localizedString(for: date, relativeTo: Date())
    }
}
