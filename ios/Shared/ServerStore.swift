import Foundation
import SwiftUI
import WidgetKit

/// Observable state shared by the iOS and Watch UIs.
///
/// Two update paths while the app is active:
/// - WebSocket (`/ws`): the backend pushes every join/leave instantly.
/// - REST polling: fallback + self-healing — each timer tick refreshes and
///   reconnects the socket if it dropped.
@MainActor
final class ServerStore: ObservableObject {
    @Published var status: ServerStatus = .empty
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var lastUpdated: Date?

    @AppStorage("baseURL", store: Settings.suite) var baseURL: String = ""
    @AppStorage("apiToken", store: Settings.suite) var apiToken: String = ""

    private var timer: Timer?
    private var wsTask: URLSessionWebSocketTask?
    private var lastWidgetSignature = ""
    var isConfigured: Bool { !baseURL.isEmpty }

    func startAutoRefresh(every seconds: TimeInterval = 15) {
        timer?.invalidate()
        Task { await self.tick() }
        timer = Timer.scheduledTimer(withTimeInterval: seconds, repeats: true) { [weak self] _ in
            Task { await self?.tick() }
        }
    }

    func stopAutoRefresh() {
        timer?.invalidate()
        timer = nil
        disconnectLive()
    }

    private func tick() async {
        await refresh()
        connectLive() // no-op while connected; reconnects after drops
    }

    func refresh() async {
        guard isConfigured else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let client = APIClient(baseURL: baseURL, token: apiToken)
            apply(try await client.fetchStatus())
        } catch {
            errorMessage = "Brak połączenia z serwerem statusów"
        }
    }

    private func apply(_ newStatus: ServerStatus) {
        status = newStatus
        errorMessage = nil
        lastUpdated = Date()
        // Keep widgets and complications in sync — but only reload when
        // something visible changed, to spare the widget refresh budget.
        SharedCache.save(newStatus)
        let signature = "\(newStatus.dataSource.rawValue)|\(newStatus.serverReachable)|"
            + newStatus.online.map(\.name).sorted().joined(separator: ",")
        if signature != lastWidgetSignature {
            lastWidgetSignature = signature
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    // MARK: - Live updates over WebSocket

    private func connectLive() {
        guard isConfigured, wsTask == nil else { return }
        guard var comps = URLComponents(string: baseURL) else { return }
        comps.scheme = comps.scheme == "http" ? "ws" : "wss"
        comps.path = "/ws"
        if !apiToken.isEmpty {
            comps.queryItems = [URLQueryItem(name: "token", value: apiToken)]
        }
        guard let url = comps.url else { return }
        let task = URLSession.shared.webSocketTask(with: url)
        wsTask = task
        task.resume()
        receiveLoop(task)
    }

    private func disconnectLive() {
        wsTask?.cancel(with: .normalClosure, reason: nil)
        wsTask = nil
    }

    private func receiveLoop(_ task: URLSessionWebSocketTask) {
        task.receive { [weak self] result in
            Task { @MainActor [weak self] in
                guard let self, self.wsTask === task else { return }
                switch result {
                case .success(let message):
                    if case .string(let text) = message { self.handleLive(text) }
                    self.receiveLoop(task)
                case .failure:
                    // Server gone or unauthorized — polling keeps working and
                    // the next tick retries the connection.
                    self.wsTask = nil
                }
            }
        }
    }

    /// Both server frames — {type:"status",data} and {type:"event",…,data} —
    /// carry a full status snapshot in `data`.
    private func handleLive(_ text: String) {
        struct Envelope: Codable { let data: ServerStatus? }
        guard
            let raw = text.data(using: .utf8),
            let envelope = try? JSONDecoder().decode(Envelope.self, from: raw),
            let newStatus = envelope.data
        else { return }
        apply(newStatus)
    }
}
