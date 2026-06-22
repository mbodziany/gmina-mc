import WidgetKit
import SwiftUI

/// One rendered moment for the widget/complication.
struct StatusEntry: TimelineEntry {
    let date: Date
    let reachable: Bool
    let source: DataSource
    let onlineCount: Int
    let names: [String]

    init(date: Date = .now, reachable: Bool, source: DataSource, onlineCount: Int, names: [String]) {
        self.date = date
        self.reachable = reachable
        self.source = source
        self.onlineCount = onlineCount
        self.names = names
    }

    init(from s: ServerStatus) {
        self.init(
            reachable: s.serverReachable,
            source: s.dataSource,
            onlineCount: s.online.count,
            names: s.online.map(\.name)
        )
    }

    static let placeholder = StatusEntry(
        reachable: true, source: .plugin, onlineCount: 2, names: ["Steve", "Alex"])
    static let offline = StatusEntry(reachable: false, source: .none, onlineCount: 0, names: [])
}

/// Shared timeline provider used by both the iOS widget and the Watch complication.
/// Fetches live status, falls back to the App Group cache, refreshes every 15 min.
struct StatusProvider: TimelineProvider {
    func placeholder(in context: Context) -> StatusEntry { .placeholder }

    func getSnapshot(in context: Context, completion: @escaping (StatusEntry) -> Void) {
        if context.isPreview { completion(.placeholder); return }
        Task { completion(await fetchEntry()) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StatusEntry>) -> Void) {
        Task {
            let entry = await fetchEntry()
            let next = Calendar.current.date(byAdding: .minute, value: 15, to: .now)
                ?? Date().addingTimeInterval(900)
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    private func fetchEntry() async -> StatusEntry {
        if let status = try? await APIClient().fetchStatus() {
            SharedCache.save(status)
            return StatusEntry(from: status)
        }
        if let cached = SharedCache.load() {
            return StatusEntry(from: cached)
        }
        return .offline
    }
}
