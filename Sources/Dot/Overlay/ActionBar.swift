import AppKit
import SwiftUI

/// The small bar that appears under a circled region when he lets go without speaking:
/// ask Dot, hand it to an agent, copy its text, look it up. After HeyClicky's post-drag bar.
@MainActor
final class ActionBarPanel: NSPanel {
    struct Action { let title: String; let icon: String; let run: () -> Void }

    private var hideWork: DispatchWorkItem?
    private static var current: ActionBarPanel?

    static func show(near rect: CGRect, accent: Color, actions: [Action], onDismiss: @escaping () -> Void) {
        dismiss()
        let panel = ActionBarPanel(actions: actions, accent: accent, onDismiss: onDismiss)
        let size = panel.frame.size
        let screen = NSScreen.screens.first { $0.frame.intersects(rect) } ?? NSScreen.main
        let bounds = screen?.visibleFrame ?? CGRect(x: 0, y: 0, width: 1440, height: 900)
        var origin = CGPoint(x: rect.minX, y: rect.minY - size.height - 8)
        if origin.y < bounds.minY { origin.y = rect.maxY + 8 }
        origin.x = min(max(origin.x, bounds.minX + 8), bounds.maxX - size.width - 8)
        panel.setFrameOrigin(origin)
        panel.orderFrontRegardless()
        current = panel
        let work = DispatchWorkItem { [weak panel] in panel?.close(); if current === panel { current = nil }; onDismiss() }
        panel.hideWork = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 25, execute: work)
    }

    static func dismiss() {
        current?.hideWork?.cancel()
        current?.close()
        current = nil
    }

    private init(actions: [Action], accent: Color, onDismiss: @escaping () -> Void) {
        super.init(contentRect: CGRect(x: 0, y: 0, width: 10, height: 10), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        isFloatingPanel = true
        level = .screenSaver
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        hidesOnDeactivate = false
        isReleasedWhenClosed = false
        let view = ActionBarView(actions: actions, accent: accent) { [weak self] in
            ActionBarPanel.dismiss()
            _ = self
            onDismiss()
        }
        let host = NSHostingView(rootView: view)
        host.frame = CGRect(origin: .zero, size: host.fittingSize)
        contentView = host
        setContentSize(host.fittingSize)
    }
}

struct ActionBarView: View {
    let actions: [ActionBarPanel.Action]
    let accent: Color
    let onClose: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(actions.enumerated()), id: \.offset) { _, action in
                Button {
                    action.run()
                } label: {
                    HStack(spacing: 5) {
                        Image(systemName: action.icon).font(.system(size: 11, weight: .semibold))
                        Text(action.title).font(.system(size: 12, weight: .semibold))
                    }
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(Color.white.opacity(0.08), in: Capsule())
                    .foregroundStyle(Color(red: 0.925, green: 0.91, blue: 0.882))
                }
                .buttonStyle(.plain)
            }
            Button(action: onClose) { Image(systemName: "xmark").font(.system(size: 10, weight: .bold)).padding(6) }
                .buttonStyle(.plain).foregroundStyle(Color.white.opacity(0.5))
        }
        .padding(6)
        .background(Color(red: 0.051, green: 0.047, blue: 0.043).opacity(0.96), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(accent.opacity(0.5), lineWidth: 1))
    }
}
