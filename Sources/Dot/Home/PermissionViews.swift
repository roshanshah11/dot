import AppKit
import DotKit
import SwiftUI

/// One executable macOS holds responsible and what it was given (parity ON-01, ON-03): a row per grant with its
/// state, why Dot wants it, Open for the Settings pane, and the app to drag in where Settings needs a drag.
struct PermissionHolderView: View {
    let holder: PermissionHolder
    /// The Agents page's summary: state words only, no Open buttons.
    var compact = false
    var refresh: () -> Void = {}

    private var appURL: URL? {
        guard let range = holder.executable.range(of: ".app") else { return nil }
        return URL(fileURLWithPath: String(holder.executable[..<range.upperBound]))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: compact ? 4 : 8) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(holder.name).font(.system(size: 13, weight: .semibold))
                    Text(holder.runs).font(.caption).foregroundStyle(.secondary)
                }
                if !compact {
                    Text(holder.executable.replacingOccurrences(of: NSHomeDirectory(), with: "~")).font(.caption2.monospaced()).foregroundStyle(.tertiary)
                        .lineLimit(1).truncationMode(.middle)
                }
                if let note = holder.note { Text(note).font(.caption).foregroundStyle(.orange) }
            }
            if compact {
                Text(summary).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
            } else {
                ForEach(holder.rows) { row in line(row) }
            }
        }
    }

    /// "allowed: Microphone, Accessibility · not allowed: Full Disk Access · unknown: ..."
    private var summary: String {
        let groups: [(String, [PermissionRow])] = [
            ("allowed", holder.rows.filter { $0.state == .granted }),
            ("not allowed", holder.rows.filter { $0.state == .missing || $0.state == .notAsked }),
            ("partly", holder.rows.filter { $0.state == .partial }),
            ("unknown", holder.rows.filter { $0.state == .unknown }),
        ]
        return groups.filter { !$0.1.isEmpty }.map { "\($0.0): \($0.1.map(\.title).joined(separator: ", "))" }.joined(separator: " · ")
    }

    private func line(_ row: PermissionRow) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: Self.symbol(row.state)).foregroundStyle(Self.tint(row.state)).frame(width: 16)
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 6) {
                    Text(row.title).font(.callout)
                    Text(row.state.word).font(.caption).foregroundStyle(Self.tint(row.state))
                }
                Text(row.why).font(.caption).foregroundStyle(.secondary)
                if let note = row.note { Text(note).font(.caption2).foregroundStyle(.tertiary) }
                if row.drag, row.state != .granted, let appURL {
                    HStack(spacing: 6) {
                        Image(nsImage: NSWorkspace.shared.icon(forFile: appURL.path)).resizable().frame(width: 20, height: 20)
                            .onDrag { NSItemProvider(object: appURL as NSURL) }
                            .help("Drag into the list in Settings")
                        Text("Not in the list? Drag \(appURL.deletingPathExtension().lastPathComponent) into it, then switch it on.")
                            .font(.caption2).foregroundStyle(.secondary)
                    }
                    .padding(.top, 2)
                }
            }
            Spacer()
            if row.state != .granted, let pane = row.pane {
                Button("Open") { open(row, pane: pane) }.controlSize(.small)
            }
        }
    }

    /// For Dot's own microphone, screen and Accessibility rows the first ask shows macOS's prompt; the pane opens too.
    private func open(_ row: PermissionRow, pane: String) {
        if holder.id == "dot" {
            switch row.id {
            case "microphone" where row.state == .notAsked:
                Permissions.requestMicrophone { _ in refresh() }
                return
            case "screen": Permissions.requestScreenRecording()
            case "accessibility": Permissions.requestAccessibility()
            default: break
            }
        }
        PermissionProbe.openPane(pane)
    }

    static func symbol(_ state: PermissionState) -> String {
        switch state {
        case .granted: return "checkmark.circle.fill"
        case .missing, .notAsked: return "exclamationmark.circle"
        case .partial: return "circle.lefthalf.filled"
        case .unknown: return "questionmark.circle"
        }
    }

    static func tint(_ state: PermissionState) -> Color {
        switch state {
        case .granted: return .green
        case .missing, .notAsked: return .orange
        case .partial: return .yellow
        case .unknown: return .secondary
        }
    }
}
