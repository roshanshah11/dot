import AppKit
import DotKit
import SwiftUI

/// Home in the notch (parity HO-01): a click on the notch while it shows nothing drops Home down from it, the same
/// views and state as the window in a narrower layout (agents and the open thread). "Open as window", Esc or a click
/// anywhere else puts it away. Nothing shows while idle, so `notchTalkOnly` is kept.
@MainActor
final class NotchHomeController: NSObject, NSWindowDelegate {
    private let model: HomeModel
    private let openWindow: () -> Void
    private var panel: KeyablePanel?
    private var keyMonitor: Any?
    private(set) var isShowing = false
    /// A click on the notch while it's open first takes its key away (closing it) and then arrives as a click on the
    /// notch: that click must not open it again.
    private var closedAt = Date.distantPast

    init(model: HomeModel, openWindow: @escaping () -> Void) {
        self.model = model
        self.openWindow = openWindow
    }

    func toggle() {
        if isShowing { close(); return }
        guard Date().timeIntervalSince(closedAt) > 0.35 else { return }
        show()
    }

    func show() {
        model.reload()
        let panel = ensurePanel()
        let place = Self.placement()
        panel.contentView = NSHostingView(rootView: NotchHomeView(model: model, topInset: place.inset,
                                                                  openWindow: { [weak self] in self?.close(); self?.openWindow() },
                                                                  close: { [weak self] in self?.close() }))
        panel.alphaValue = 1
        panel.setFrame(place.start, display: false)
        panel.orderFrontRegardless()
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.24
            context.timingFunction = CAMediaTimingFunction(name: .easeOut)
            panel.animator().setFrame(place.frame, display: true)
        }
        panel.makeKey()
        isShowing = true
        Log.info("home: dropped down from the notch")
        if keyMonitor == nil {
            keyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
                guard let self, self.isShowing, event.window === self.panel, event.keyCode == 53 else { return event }
                self.close()
                return nil
            }
        }
    }

    func close() {
        guard isShowing, let panel else { return }
        isShowing = false
        closedAt = Date()
        model.saveThreadState()
        if let keyMonitor { NSEvent.removeMonitor(keyMonitor); self.keyMonitor = nil }
        NSAnimationContext.runAnimationGroup({ context in
            context.duration = 0.18
            context.timingFunction = CAMediaTimingFunction(name: .easeIn)
            panel.animator().setFrame(Self.placement().start, display: true)
            panel.animator().alphaValue = 0
        }, completionHandler: { [weak self] in
            Task { @MainActor in
                guard let self, !self.isShowing else { return }
                panel.orderOut(nil)
                panel.contentView = nil
            }
        })
    }

    /// A click anywhere else puts it away, like the file viewer. A sheet of its own (new agent, rename) keeps it.
    func windowDidResignKey(_ notification: Notification) {
        guard panel?.attachedSheet == nil else { return }
        close()
    }

    private func ensurePanel() -> KeyablePanel {
        if let panel { return panel }
        let panel = KeyablePanel(contentRect: .zero, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.isFloatingPanel = true
        panel.level = NSWindow.Level(rawValue: NSWindow.Level.statusBar.rawValue + 1)
        panel.becomesKeyOnlyIfNeeded = false
        panel.hidesOnDeactivate = false
        panel.isReleasedWhenClosed = false
        panel.delegate = self
        self.panel = panel
        return panel
    }

    /// Centered under the notch with its top flush with the screen's (its black top joins the notch); `start` is the
    /// notch itself, which it grows out of and folds back into.
    static func placement() -> (frame: CGRect, start: CGRect, inset: CGFloat) {
        let screen = NSScreen.screens.first(where: { $0.safeAreaInsets.top > 0 }) ?? NSScreen.main ?? NSScreen.screens.first
        let full = screen?.frame ?? CGRect(x: 0, y: 0, width: 1440, height: 900)
        let visible = screen?.visibleFrame ?? full
        let inset = max(screen?.safeAreaInsets.top ?? 0, full.maxY - visible.maxY, 24)
        let notch = screen.map { NotchGeometry.measure(frame: $0.frame, safeAreaTop: $0.safeAreaInsets.top,
                                                        auxLeft: $0.auxiliaryTopLeftArea, auxRight: $0.auxiliaryTopRightArea) }
        let centerX = notch?.centerX ?? full.midX
        let width = min(960, full.width - 160)
        let height = min(600, full.height * 0.72)
        let frame = CGRect(x: centerX - width / 2, y: full.maxY - height, width: width, height: height)
        let notchWidth = notch?.notchWidth ?? NotchGeometry.fallbackNotchWidth
        return (frame, CGRect(x: centerX - notchWidth / 2, y: full.maxY - inset, width: notchWidth, height: inset), inset)
    }
}

/// The dropdown: a black band the height of the menu bar (the notch's own colour) with Home's name and its buttons,
/// then Home's agents and thread.
struct NotchHomeView: View {
    @ObservedObject var model: HomeModel
    let topInset: CGFloat
    let openWindow: () -> Void
    let close: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 10) {
                Text("Home").font(.system(size: 12, weight: .semibold)).foregroundStyle(.white.opacity(0.85))
                Spacer()
                Button(action: openWindow) {
                    Label("Open as window", systemImage: "macwindow").font(.system(size: 11, weight: .medium))
                }
                .buttonStyle(.plain).foregroundStyle(.white.opacity(0.8))
                Button(action: close) { Image(systemName: "xmark").font(.system(size: 10, weight: .bold)) }
                    .buttonStyle(.plain).foregroundStyle(.white.opacity(0.6)).help("Close (Esc)")
            }
            .padding(.horizontal, 16)
            .frame(height: topInset)
            .background(Color.black)
            HomeView(model: model, compact: true)
        }
        .background(Color(nsColor: .windowBackgroundColor))
        .clipShape(UnevenRoundedRectangle(cornerRadii: .init(topLeading: 0, bottomLeading: 16, bottomTrailing: 16, topTrailing: 0)))
    }
}
