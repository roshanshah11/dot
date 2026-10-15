import AppKit
import CoreGraphics
import Foundation

/// System-wide push-to-talk on a listen-only CGEvent tap, after Clicky's
/// GlobalPushToTalkShortcutMonitor (MIT, Farza Majeed). Needs Accessibility.
///
///   hold control+option          talk to Dot
///   hold control+option+shift    hand the request to an agent
///   tap control+option           typed question (released within `tapWindow`, said nothing)
///   escape                       stop speaking / interrupt
final class HotkeyMonitor {
    enum Mode: Equatable { case talk, agent }

    enum Event: Equatable {
        case pressed(Mode)
        case modeChanged(Mode)
        case released(Mode, heldFor: TimeInterval)
        case escape
    }

    var onEvent: ((Event) -> Void)?

    private var tap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?
    private var held = false
    private var mode: Mode = .talk
    private var pressedAt = Date.distantPast

    var isRunning: Bool { tap != nil }
    var isHeld: Bool { held }

    deinit { stop() }

    @discardableResult
    func start() -> Bool {
        guard tap == nil else { return true }
        let types: [CGEventType] = [.flagsChanged, .keyDown, .keyUp]
        let mask = types.reduce(CGEventMask(0)) { $0 | (CGEventMask(1) << $1.rawValue) }

        let callback: CGEventTapCallBack = { _, type, event, userInfo in
            guard let userInfo else { return Unmanaged.passUnretained(event) }
            let monitor = Unmanaged<HotkeyMonitor>.fromOpaque(userInfo).takeUnretainedValue()
            monitor.handle(type: type, event: event)
            return Unmanaged.passUnretained(event)
        }

        guard let tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .listenOnly,
                                          eventsOfInterest: mask, callback: callback,
                                          userInfo: Unmanaged.passUnretained(self).toOpaque()) else {
            Log.warn("hotkey: could not create the event tap (Accessibility not granted?)")
            return false
        }
        guard let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0) else {
            CFMachPortInvalidate(tap)
            return false
        }
        self.tap = tap
        self.runLoopSource = source
        CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
        Log.info("hotkey: tap running")
        return true
    }

    func stop() {
        held = false
        if let runLoopSource { CFRunLoopRemoveSource(CFRunLoopGetMain(), runLoopSource, .commonModes) }
        runLoopSource = nil
        if let tap { CFMachPortInvalidate(tap) }
        tap = nil
    }

    private func handle(type: CGEventType, event: CGEvent) {
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            if let tap { CGEvent.tapEnable(tap: tap, enable: true) }
            return
        }
        let flags = event.flags
        let control = flags.contains(.maskControl)
        let option = flags.contains(.maskAlternate)
        let shift = flags.contains(.maskShift)
        let command = flags.contains(.maskCommand)

        switch type {
        case .flagsChanged:
            let chord = control && option && !command
            if !held && chord {
                held = true
                mode = shift ? .agent : .talk
                pressedAt = Date()
                emit(.pressed(mode))
            } else if held && !chord {
                held = false
                emit(.released(mode, heldFor: Date().timeIntervalSince(pressedAt)))
            } else if held && chord {
                let newMode: Mode = shift ? .agent : .talk
                if newMode != mode {
                    mode = newMode
                    emit(.modeChanged(mode))
                }
            }
        case .keyDown:
            let keyCode = UInt16(event.getIntegerValueField(.keyboardEventKeycode))
            if keyCode == 53, !held { // escape
                emit(.escape)
            }
        default:
            break
        }
    }

    private func emit(_ event: Event) {
        let handler = onEvent
        DispatchQueue.main.async { handler?(event) }
    }
}
