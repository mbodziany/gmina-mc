import Foundation
import WatchConnectivity
#if os(watchOS)
import WidgetKit
#endif

/// Mirrors backend settings (URL + token) from the iPhone to the paired Watch.
///
/// App Groups do NOT span devices — the Watch has its own container — so
/// without this the Watch app and its complications would never learn the
/// backend address entered on the iPhone.
///
/// Only the apps call this; widget extensions must not use WCSession.
final class WatchSync: NSObject, WCSessionDelegate {
    static let shared = WatchSync()

    func activate() {
        guard WCSession.isSupported() else { return }
        WCSession.default.delegate = self
        WCSession.default.activate()
    }

    #if os(iOS)
    /// Push the current settings to the Watch. Call after the user edits them;
    /// applicationContext is delivered even if the Watch app is not running.
    func pushSettings() {
        guard WCSession.default.activationState == .activated else { return }
        try? WCSession.default.updateApplicationContext([
            "baseURL": Settings.baseURL,
            "apiToken": Settings.apiToken,
        ])
    }

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        pushSettings()
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) { session.activate() }
    #endif

    #if os(watchOS)
    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        apply(session.receivedApplicationContext)
    }

    func session(_ session: WCSession, didReceiveApplicationContext context: [String: Any]) {
        apply(context)
    }

    private func apply(_ context: [String: Any]) {
        if let url = context["baseURL"] as? String, !url.isEmpty { Settings.baseURL = url }
        if let token = context["apiToken"] as? String { Settings.apiToken = token }
        // New settings mean the complication can finally fetch real data.
        DispatchQueue.main.async { WidgetCenter.shared.reloadAllTimelines() }
    }
    #endif
}
