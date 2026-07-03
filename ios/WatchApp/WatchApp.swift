import SwiftUI

@main
struct GminaMCWatchApp: App {
    @StateObject private var store = ServerStore()

    init() {
        WatchSync.shared.activate() // receive settings mirrored from the iPhone
    }

    var body: some Scene {
        WindowGroup {
            WatchContentView()
                .environmentObject(store)
        }
    }
}
