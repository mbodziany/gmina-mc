import SwiftUI
import WidgetKit

/// Lock Screen (iOS) and complication (watchOS) renderings. The `accessory*`
/// widget families exist on both platforms, so these views are shared.

struct AccessoryCircularView: View {
    let entry: StatusEntry
    var body: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: -1) {
                Image(systemName: "gamecontroller.fill").font(.system(size: 11))
                Text("\(entry.onlineCount)").font(.system(size: 22, weight: .bold))
            }
        }
        .widgetAccentable()
    }
}

struct AccessoryInlineView: View {
    let entry: StatusEntry
    var body: some View {
        if entry.onlineCount > 0 {
            Label(
                "\(entry.onlineCount) online · \(entry.names.prefix(2).joined(separator: ", "))",
                systemImage: "gamecontroller.fill")
        } else {
            Label(entry.reachable ? "Nikt nie gra" : "Serwer offline",
                  systemImage: "gamecontroller")
        }
    }
}

struct AccessoryRectangularView: View {
    let entry: StatusEntry
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Image(systemName: "gamecontroller.fill")
                Text("Gmina MC · \(entry.onlineCount)")
                    .font(.headline)
                    .widgetAccentable()
            }
            if entry.onlineCount > 0 {
                Text(entry.names.prefix(3).joined(separator: ", "))
                    .font(.caption)
                    .lineLimit(1)
            } else {
                Text(entry.reachable ? "Nikt teraz nie gra" : "Serwer offline")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
