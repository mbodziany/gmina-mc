import Foundation
import SwiftUI
import WidgetKit

/// Observable state shared by the iOS and Watch UIs. Refreshes on a timer
/// (simple and works identically on watchOS); push wakes the user separately.
@MainActor
final class ServerStore: ObservableObject {
    @Published var status: ServerStatus = .empty
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var lastUpdated: Date?

    @AppStorage("baseURL", store: Settings.suite) var baseURL: String = ""
    @AppStorage("apiToken", store: Settings.suite) var apiToken: String = ""

    private var timer: Timer?
    private var lastWidgetSignature = ""
    var isConfigured: Bool { !baseURL.isEmpty }

    func startAutoRefresh(every seconds: TimeInterval = 15) {
        timer?.invalidate()
        Task { await refresh() }
        timer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: true) { [weak self] _ in
            Task { await self?.refresh() }
        }
    }

    func stopAutoRefresh() {
        timer?.invalidate()
        timer = nil
    }

    func refresh() async {
        guard isConfigured else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let client = APIClient(baseURL: baseURL, token: apiToken)
            status = try await client.fetchStatus()
            errorMessage = nil
            lastUpdated = Date()
            // Keep widgets and complications in sync with the live app — but
            // only reload when something visible changed, to spare the
            // system's widget refresh budget (we poll every 15 s).
            SharedCache.save(status)
            let signature = "\(status.dataSource.rawValue)|\(status.serverReachable)|"
                + status.online.map(\.name).sorted().joined(separator: ",")
            if signature != lastWidgetSignature {
                lastWidgetSignature = signature
                WidgetCenter.shared.reloadAllTimelines()
            }
        } catch {
            errorMessage = "Brak połączenia z serwerem statusów"
        }
    }
}
