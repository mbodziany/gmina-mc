import WidgetKit
import SwiftUI

@main
struct GminaMCWatchWidgetBundle: WidgetBundle {
    var body: some Widget { GminaMCWatchComplication() }
}

struct GminaMCWatchComplication: Widget {
    let kind = "GminaMCWatchComplication"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StatusProvider()) { entry in
            WatchComplicationView(entry: entry)
                .containerBackground(for: .widget) { Color.clear }
        }
        .configurationDisplayName("Gmina MC")
        .description("Ilu kolegów gra teraz na serwerze.")
        .supportedFamilies([
            .accessoryCircular, .accessoryInline, .accessoryRectangular, .accessoryCorner,
        ])
    }
}

struct WatchComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let entry: StatusEntry

    var body: some View {
        switch family {
        case .accessoryCircular: AccessoryCircularView(entry: entry)
        case .accessoryInline: AccessoryInlineView(entry: entry)
        case .accessoryRectangular: AccessoryRectangularView(entry: entry)
        case .accessoryCorner: CornerView(entry: entry)
        default: AccessoryCircularView(entry: entry)
        }
    }
}

/// watchOS-only corner complication: number hugging the bezel.
private struct CornerView: View {
    let entry: StatusEntry
    var body: some View {
        Text("\(entry.onlineCount)")
            .font(.title.bold())
            .widgetAccentable()
            .widgetLabel {
                Text(entry.onlineCount > 0 ? "\(entry.onlineCount) online" : "MC")
            }
    }
}
