import AppKit
import CoreGraphics
import DotKit
import Foundation

/// System-wide push-to-talk on a CGEvent tap, after Clicky's
/// GlobalPushToTalkShortcutMonitor (MIT, Farza Majeed). Needs Accessibility.
///
///   hold the conversation chord          talk to Dot (control+option unless he recorded another, SE-01)
///   hold it with shift                   hand the request to an agent
///   tap it                               typed question (released within `tapWindow`, said nothing)
///   drag while holding                   draw a box to ask about
///   hold the dictation chord             dictate (control+fn unless recorded, SE-02)
///   escape                               stop speaking / interrupt
///
/// The tap only listens, except when a recorded chord has a key: then it is an active tap that keeps that key (and
/// nothing else) from reaching the app in front.
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
        /// One finished stroke (he can draw several while the key stays held): its box and its points.
        case dragEnded(CGRect, points: [CGPoint])
        /// A right click or any key but Escape, for a job's pause rule (no key codes, only the fact). AppKit coordinates.
        case input(JobInput, CGPoint, own: Bool)
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
    private(set) var conversation = Chord.conversationDefault
    private(set) var dictation = Chord.dictationDefault
    /// The key of a keyed chord being held, swallowed until it comes up.
    private var holdKey: UInt16?
    /// A keyed chord's key, kept from the app in front until its own key-up, even when a modifier came up first and
    /// ended the hold (else its repeats and key-up would reach an app that never saw it go down).
    private var swallowKey: UInt16?
    private var activeTap = false
    /// While he records a new chord in Settings nothing fires.
    var paused = false

    var isRunning: Bool { tap != nil }

    /// New chords (already checked by ChordRules). A keyed chord needs the active tap; switching restarts the tap.
    /// False when the tap can't be made, so the caller can fall back to the defaults.
    @discardableResult
    func configure(conversation: Chord, dictation: Chord, testing: Bool = false) -> Bool {
        self.conversation = conversation
        self.dictation = dictation
        let wantsActive = conversation.keyed || dictation.keyed
        if testing { activeTap = wantsActive; return true }
        guard tap != nil, wantsActive != activeTap else { return true }
        stop()
        return start()
    }
    var isHeld: Bool { held }

    deinit { stop() }

    @discardableResult
    func start() -> Bool {
        guard tap == nil else { return true }
        let types: [CGEventType] = [.flagsChanged, .keyDown, .keyUp, .leftMouseDown, .leftMouseDragged, .leftMouseUp, .rightMouseDown]
        let mask = types.reduce(CGEventMask(0)) { $0 | (CGEventMask(1) << $1.rawValue) }

        let callback: CGEventTapCallBack = { _, type, event, userInfo in
            guard let userInfo else { return Unmanaged.passUnretained(event) }
            let monitor = Unmanaged<HotkeyMonitor>.fromOpaque(userInfo).takeUnretainedValue()
            return monitor.handle(type: type, event: event) ? nil : Unmanaged.passUnretained(event)
        }

        let wantsActive = conversation.keyed || dictation.keyed
        guard let tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: wantsActive ? .defaultTap : .listenOnly,
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
        activeTap = wantsActive
        CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
        Log.info("hotkey: tap running (\(wantsActive ? "active, a keyed chord" : "listen only")): talk \(conversation.caps.joined(separator: "+")), dictate \(dictation.caps.joined(separator: "+"))")
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

    static func modifiers(_ flags: CGEventFlags) -> Set<ChordModifier> {
        var out = Set<ChordModifier>()
        if flags.contains(.maskControl) { out.insert(.control) }
        if flags.contains(.maskAlternate) { out.insert(.option) }
        if flags.contains(.maskShift) { out.insert(.shift) }
        if flags.contains(.maskCommand) { out.insert(.command) }
        if flags.contains(.maskSecondaryFn) { out.insert(.fn) }
        return out
    }

    private var hit: ChordMatch.Hit { mode == .dictate ? .dictate : (mode == .agent ? .agent : .talk) }

    private func press(_ hit: ChordMatch.Hit, key: UInt16?) {
        held = true
        holdKey = key
        if let key { swallowKey = key }
        mode = hit == .dictate ? .dictate : (hit == .agent ? .agent : .talk)
        pressedAt = Date()
        dragStart = nil
        dragging = false
        emit(.pressed(mode))
    }

    private func release(at location: CGPoint) {
        held = false
        holdKey = nil
        if dragging, dragStart != nil {
            dragging = false
            dragPoints.append(Self.appKitPoint(location))
            emit(.dragEnded(Self.bounds(of: dragPoints), points: dragPoints))
        }
        dragStart = nil
        emit(.released(mode, heldFor: Date().timeIntervalSince(pressedAt)))
    }

    /// True to keep the event from the app in front (only a keyed chord's own key, on the active tap). Internal for
    /// the self-test, which feeds it events it makes and never posts.
    func handle(type: CGEventType, event: CGEvent) -> Bool {
        if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
            if let tap { CGEvent.tapEnable(tap: tap, enable: true) }
            return false
        }
        if paused { return false }
        let active = Self.modifiers(event.flags)

        switch type {
        case .flagsChanged:
            if !held, let hit = ChordMatch.pressed(active, conversation: conversation, dictation: dictation) {
                press(hit, key: nil)
            } else if held && !ChordMatch.held(hit, active, conversation: conversation, dictation: dictation) {
                release(at: event.location)
            } else if held, mode != .dictate {
                let newMode: Mode = active.contains(.shift) ? .agent : .talk
                if newMode != mode {
                    mode = newMode
                    emit(.modeChanged(mode))
                }
            }
        case .keyUp:
            let keyCode = UInt16(event.getIntegerValueField(.keyboardEventKeycode))
            if let swallowKey, keyCode == swallowKey {
                self.swallowKey = nil
                if held, holdKey == keyCode { release(at: event.location) }
                return true
            }
        case .keyDown:
            let keyCode = UInt16(event.getIntegerValueField(.keyboardEventKeycode))
            if let swallowKey, keyCode == swallowKey {
                if held || event.getIntegerValueField(.keyboardEventAutorepeat) != 0 { return true }   // its repeats, held or not
                self.swallowKey = nil   // a fresh press: its key-up came while the tap was off
            }
            if !held, activeTap, event.getIntegerValueField(.keyboardEventAutorepeat) == 0,
               let hit = ChordMatch.pressed(key: keyCode, active, conversation: conversation, dictation: dictation) {
                press(hit, key: keyCode)
                return true
            }
            let own = Driver.isOwn(event)
            // Dot's own Escape (a job's key, tagged by Navigator.chord) never stops anything.
            if KeyTapRule.emitsEscape(keyCode: keyCode, held: held, own: own) {
                emit(.escape)
            } else if KeyTapRule.emitsInput(keyCode: keyCode, held: held) {
                emit(.input(.key, Self.appKitPoint(event.location), own: own))
            }
        case .rightMouseDown:
            if !held { emit(.input(.click, Self.appKitPoint(event.location), own: Driver.isOwn(event))) }
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
            guard held, let start = dragStart else { return false }
            let point = Self.appKitPoint(event.location)
            let rect = Self.rect(from: start, to: point)
            if let last = dragPoints.last, hypot(point.x - last.x, point.y - last.y) >= 2 { dragPoints.append(point) }
            if rect.width > 6 || rect.height > 6 {
                dragging = true
                emit(.dragChanged(Self.bounds(of: dragPoints)))
                emit(.dragPath(dragPoints))
            }
        case .leftMouseUp:
            guard held, dragStart != nil else { return false }
            dragPoints.append(Self.appKitPoint(event.location))
            let rect = Self.bounds(of: dragPoints)
            dragStart = nil
            if dragging {
                dragging = false
                if rect.width > 12 || rect.height > 12 { emit(.dragEnded(rect, points: dragPoints)) } else { emit(.dragChanged(.null)) }
            }
        default:
            break
        }
        return false
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
