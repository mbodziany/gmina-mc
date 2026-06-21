import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: ServerStore
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            Group {
                if !store.isConfigured {
                    ContentUnavailableView(
                        "Skonfiguruj serwer",
                        systemImage: "server.rack",
                        description: Text("Podaj adres backendu w ustawieniach, aby zobaczyć kto gra.")
                    )
                } else {
                    statusList
                }
            }
            .navigationTitle("Gmina MC")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { serverIndicator }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showSettings = true } label: { Image(systemName: "gearshape") }
                }
            }
            .sheet(isPresented: $showSettings) { SettingsView().environmentObject(store) }
            .refreshable { await store.refresh() }
        }
        .onAppear { store.startAutoRefresh() }
    }

    private var serverIndicator: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(store.status.serverReachable ? .green : .red)
                .frame(width: 9, height: 9)
            Text(store.status.serverReachable ? "Serwer online" : "Serwer offline")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var statusList: some View {
        List {
            Section("Teraz online (\(store.status.online.count))") {
                if store.status.online.isEmpty {
                    Text("Nikt teraz nie gra")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(store.status.online) { PlayerRow(player: $0) }
                }
            }

            let recent = store.status.roster.filter { !$0.online }
            Section("Ostatnie \(store.status.rosterDays) dni") {
                if recent.isEmpty {
                    Text("Brak innych graczy w tym okresie")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(recent) { PlayerRow(player: $0) }
                }
            }

            if let err = store.errorMessage {
                Section { Label(err, systemImage: "exclamationmark.triangle").foregroundStyle(.orange) }
            }
        }
    }
}

struct PlayerRow: View {
    let player: Player

    var body: some View {
        HStack(spacing: 12) {
            AvatarView(name: player.name)
            VStack(alignment: .leading, spacing: 2) {
                Text(player.name).font(.headline)
                Text(subtitle).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Circle()
                .fill(player.online ? .green : .gray.opacity(0.5))
                .frame(width: 10, height: 10)
        }
        .padding(.vertical, 2)
    }

    private var subtitle: String {
        if player.online, let start = player.currentSessionStartDate {
            return "Gra od \(Format.relative(start))"
        }
        return "Ostatnio \(Format.relative(player.lastSeenDate)) · \(Format.duration(player.totalPlaytime)) łącznie"
    }
}

/// Minecraft head avatar via the public Crafatar service, falling back to initials.
struct AvatarView: View {
    let name: String

    var body: some View {
        AsyncImage(url: URL(string: "https://mc-heads.net/avatar/\(name)/64")) { phase in
            switch phase {
            case .success(let image): image.resizable()
            default:
                Text(String(name.prefix(1)).uppercased())
                    .font(.headline)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.accentColor.opacity(0.2))
            }
        }
        .frame(width: 36, height: 36)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}
