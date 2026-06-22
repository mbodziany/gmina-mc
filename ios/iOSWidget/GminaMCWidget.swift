import WidgetKit
import SwiftUI

@main
struct GminaMCWidgetBundle: WidgetBundle {
    var body: some Widget { GminaMCWidget() }
}

struct GminaMCWidget: Widget {
    let kind = "GminaMCWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StatusProvider()) { entry in
            GminaMCWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Gmina MC")
        .description("Kto teraz gra na serwerze.")
        .supportedFamilies([
            .systemSmall, .systemMedium,
            .accessoryCircular, .accessoryInline, .accessoryRectangular,
        ])
    }
}

struct GminaMCWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: StatusEntry

    var body: some View {
        content
            .containerBackground(for: .widget) {
                switch family {
                case .systemSmall, .systemMedium:
                    LinearGradient(
                        colors: [Color(red: 0.10, green: 0.22, blue: 0.13), .black],
                        startPoint: .top, endPoint: .bottom)
                default:
                    Color.clear
                }
            }
    }

    @ViewBuilder private var content: some View {
        switch family {
        case .systemSmall: SystemSmallView(entry: entry)
        case .systemMedium: SystemMediumView(entry: entry)
        case .accessoryCircular: AccessoryCircularView(entry: entry)
        case .accessoryInline: AccessoryInlineView(entry: entry)
        case .accessoryRectangular: AccessoryRectangularView(entry: entry)
        default: SystemSmallView(entry: entry)
        }
    }
}

private struct SystemSmallView: View {
    let entry: StatusEntry
    var body: some View {
        VStack(alignment: .leading) {
            HStack(spacing: 5) {
                Image(systemName: "gamecontroller.fill")
                Text("Gmina MC").font(.caption.weight(.semibold))
                Spacer()
                SourceDot(entry: entry)
            }
            .foregroundStyle(.white.opacity(0.85))
            Spacer()
            Text("\(entry.onlineCount)")
                .font(.system(size: 44, weight: .bold))
                .foregroundStyle(.white)
            Text(label).font(.caption).foregroundStyle(.white.opacity(0.8))
        }
    }
    private var label: String {
        if !entry.reachable { return "Serwer offline" }
        return entry.onlineCount == 0 ? "nikt nie gra" : "gra teraz"
    }
}

private struct SystemMediumView: View {
    let entry: StatusEntry
    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            VStack(alignment: .leading) {
                HStack(spacing: 5) {
                    Image(systemName: "gamecontroller.fill")
                    Text("Gmina MC").font(.caption.weight(.semibold))
                }
                .foregroundStyle(.white.opacity(0.85))
                Spacer()
                Text("\(entry.onlineCount)")
                    .font(.system(size: 40, weight: .bold))
                    .foregroundStyle(.white)
                Text(entry.reachable ? "online" : "offline")
                    .font(.caption).foregroundStyle(.white.opacity(0.8))
            }
            Divider().overlay(.white.opacity(0.2))
            VStack(alignment: .leading, spacing: 4) {
                if entry.onlineCount > 0 {
                    ForEach(entry.names.prefix(4), id: \.self) { name in
                        HStack(spacing: 6) {
                            Circle().fill(.green).frame(width: 7, height: 7)
                            Text(name).font(.subheadline).foregroundStyle(.white)
                        }
                    }
                } else {
                    Text(entry.reachable ? "Nikt teraz nie gra" : "Serwer niedostępny")
                        .font(.subheadline).foregroundStyle(.white.opacity(0.7))
                }
                Spacer()
            }
            Spacer()
        }
    }
}

private struct SourceDot: View {
    let entry: StatusEntry
    var body: some View {
        Circle()
            .fill(entry.reachable ? (entry.source == .plugin ? .green : .orange) : .red)
            .frame(width: 8, height: 8)
    }
}
