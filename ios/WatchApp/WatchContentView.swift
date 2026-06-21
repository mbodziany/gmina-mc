import SwiftUI

struct WatchContentView: View {
    @EnvironmentObject var store: ServerStore

    var body: some View {
        NavigationStack {
            Group {
                if !store.isConfigured {
                    Text("Skonfiguruj adres serwera w aplikacji na iPhone.")
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                } else {
                    list
                }
            }
            .navigationTitle("Gmina MC")
        }
        .onAppear { store.startAutoRefresh(every: 30) }
    }

    private var list: some View {
        List {
            Section("Online (\(store.status.online.count))") {
                if store.status.online.isEmpty {
                    Text("Nikt nie gra").foregroundStyle(.secondary)
                } else {
                    ForEach(store.status.online) { WatchRow(player: $0) }
                }
            }
            let recent = store.status.roster.filter { !$0.online }
            if !recent.isEmpty {
                Section("Ostatnie \(store.status.rosterDays) dni") {
                    ForEach(recent) { WatchRow(player: $0) }
                }
            }
        }
    }
}

struct WatchRow: View {
    let player: Player
    var body: some View {
        HStack {
            Circle()
                .fill(player.online ? .green : .gray.opacity(0.5))
                .frame(width: 8, height: 8)
            Text(player.name)
            Spacer()
        }
    }
}
