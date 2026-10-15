import AppKit
import CoreGraphics
import Foundation

/// System-wide push-to-talk on a listen-only CGEvent tap, after Clicky's
/// GlobalPushToTalkShortcutMonitor (MIT, Farza Majeed). Needs Accessibility.
///
///   hold control+option          talk to Dot
///   hold control+option+shift    hand the request to an agent
///   tap control+option           typed question (released within `tapWindow`, said nothing)
///   drag while holding           draw a box to ask about
///   escape                       stop speaking / interrupt
///
/// Mouse clicks are also reported (listen-only, never swallowed) so a walkthrough can see
/// the user click the ringed control.
final class HotkeyMonitor {
    enum Mode: Equatable { case talk, agent, dictate }

    enum Event: Equatable {
        case pressed(Mode)
        case modeChanged(Mode)
        case released(Mode, heldFor: TimeInterval)
        case escape
        /// AppKit screen coordinates (bottom-left origin). `own` is true for a click Dot posted itself.
        case mouseDown(CGPoint, own: Bool)
        case dragChanged(CGRect)
        /// The stroke so far while he draws with the key held, in AppKit coordinates.
        case dragPath([CGPoint])
        case dragEnded(CGRect)
    }

    var onEvent: ((Event) -> Void)?

    private var tap: CFMachPort?
    private var runLoopSource: CFRunLoopSource?
    private var held = false
    private var mode: Mode = .talk
    private var pressedAt = Date.distantPast
    private var dragStart: CGPoint?
    private var dragging = false
    private var dragPoints: [CGPoint] = []

    var isRunning: Bool { tap != nil }
    var isHeld: Bool { held }

    deinit { stop() }

    @discardableResult
    func start() -> Bool {
        guard tap == nil else { return true }
        let types: [CGEventType] = [.flagsChanged, .keyDown, .keyUp, .leftMouseDown, .leftMouseDragged, .leftMouseUp]
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

    /// CGEvent locations have the origin at the top left of the primary display; AppKit's is bottom left.
    private static func appKitPoint(_ cg: CGPoint) -> CGPoint {
        let primaryHeight = NSScreen.screens.first?.frame.height ?? 0
        return CGPoint(x: cg.x, y: primaryHeight - cg.y)
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
        let fn = flags.contains(.maskSecondaryFn)

        switch type {
        case .flagsChanged:
            let talkChord = control && option && !command
            let dictateChord = control && fn && !option && !command
            let chord = talkChord || dictateChord
            if !held && chord {
                held = true
                mode = dictateChord ? .dictate : (shift ? .agent : .talk)
                pressedAt = Date()
                dragStart = nil
                dragging = false
                emit(.pressed(mode))
            } else if held && !chord {
                held = false
                if dragging, let start = dragStart {
                    dragging = false
                    emit(.dragEnded(Self.rect(from: start, to: Self.appKitPoint(event.location))))
                }
                emit(.released(mode, heldFor: Date().timeIntervalSince(pressedAt)))
            } else if held && chord, mode != .dictate {
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
        case .leftMouseDown:
            let point = Self.appKitPoint(event.location)
            if held {
                dragStart = point
                dragPoints = [point]
                dragging = false
            } else {
                emit(.mouseDown(point, own: Driver.isOwn(event)))
            }
        case .leftMouseDragged:
            guard held, let start = dragStart else { return }
            let point = Self.appKitPoint(event.location)
            let rect = Self.rect(from: start, to: point)
            if let last = dragPoints.last, hypot(point.x - last.x, point.y - last.y) >= 2 { dragPoints.append(point) }
            if rect.width > 6 || rect.height > 6 {
                dragging = true
                emit(.dragChanged(Self.bounds(of: dragPoints)))
                emit(.dragPath(dragPoints))
            }
        case .leftMouseUp:
            guard held, dragStart != nil else { return }
            dragPoints.append(Self.appKitPoint(event.location))
            let rect = Self.bounds(of: dragPoints)
            dragStart = nil
            if dragging {
                dragging = false
                if rect.width > 12 || rect.height > 12 { emit(.dragEnded(rect)) } else { emit(.dragChanged(.null)) }
            }
        default:
            break
        }
    }

    /// The box around a stroke, padded a little so a circled thing is inside it.
    private static func bounds(of points: [CGPoint]) -> CGRect {
        guard let first = points.first else { return .null }
        var minX = first.x, maxX = first.x, minY = first.y, maxY = first.y
        for p in points { minX = min(minX, p.x); maxX = max(maxX, p.x); minY = min(minY, p.y); maxY = max(maxY, p.y) }
        return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY).insetBy(dx: -6, dy: -6)
    }

    private static func rect(from a: CGPoint, to b: CGPoint) -> CGRect {
        CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(a.x - b.x), height: abs(a.y - b.y))
    }

    private func emit(_ event: Event) {
        let handler = onEvent
        DispatchQueue.main.async { handler?(event) }
    }
}
