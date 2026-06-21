import SwiftUI

@main
struct GminaMCWatchApp: App {
    @StateObject private var store = ServerStore()

    var body: some Scene {
        WindowGroup {
            WatchContentView()
                .environmentObject(store)
        }
    }
}
