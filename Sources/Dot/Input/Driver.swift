import AppKit
import CoreGraphics
import Foundation

/// Dot's own hand on the mouse, for a walkthrough he asked Dot to click through while he
/// watches ("do it", "you click", "take over"). The real cursor glides to each ringed control
/// along an arc and clicks it; a hover step only parks there. Every event Dot posts carries a
/// tag so the hotkey tap can tell it from his, and the first real mouse move, click or key
/// from him ends the drive on the spot. Controls whose label reads like a send, a purchase or
/// a delete are never clicked by Dot: they stay ringed for his own hand.
@MainActor
final class Driver {
    nonisolated static let eventTag: Int64 = 0xD07
    private(set) var active = false
    private var tap: CFMachPort?
    private var source: CFRunLoopSource?
    private var pending: [DispatchWorkItem] = []
    /// Main thread; the argument says what he did.
    var onAbort: ((String) -> Void)?

    nonisolated static func isOwn(_ event: CGEvent) -> Bool { event.getIntegerValueField(.eventSourceUserData) == eventTag }

    /// Labels Dot will not click for him, whatever he said: they commit something outward.
    static let commitWords = try! NSRegularExpression(
        pattern: #"\b(send|submit|pay|buy|purchase|checkout|check out|place order|order|delete|remove|erase|trash|post|publish|tweet|share|confirm|transfer|sign|apply|agree|accept|reply|forward|unsubscribe|cancel|shut down|restart|log out|sign out|format|overwrite|replace all)\b"#,
        options: .caseInsensitive)

    static func isCommitLabel(_ label: String) -> Bool {
        let range = NSRange(location: 0, length: (label as NSString).length)
        return commitWords.firstMatch(in: label, range: range) != nil
    }

    /// Start a drive: from now on his own input ends it.
    func begin() {
        guard !active else { return }
        active = true
        installAbortTap()
        Log.info("drive: on")
    }

    func end() {
        guard active else { return }
        active = false
        pending.forEach { $0.cancel() }
        pending = []
        removeAbortTap()
        Log.info("drive: off")
    }

    /// Glide the real cursor to `target` (AppKit coordinates) and click it, or only rest there.
    func go(to target: CGPoint, click: Bool, completion: @escaping (Bool) -> Void) {
        guard active else { completion(false); return }
        pending.forEach { $0.cancel() }
        pending = []
        let start = NSEvent.mouseLocation
        let distance = hypot(target.x - start.x, target.y - start.y)
        let duration = min(max(Double(distance) / 700.0, 0.5), 1.2)
        let frames = max(Int(duration * 60), 1)
        let mid = CGPoint(x: (start.x + target.x) / 2, y: (start.y + target.y) / 2)
        let arc = min(distance * 0.18, 70)
        let control = CGPoint(x: mid.x, y: mid.y + arc)
        for frame in 1...frames {
            let linear = Double(frame) / Double(frames)
            let t = linear * linear * (3 - 2 * linear)
            let u = 1 - t
            let p = CGPoint(x: u * u * start.x + 2 * u * t * control.x + t * t * target.x,
                            y: u * u * start.y + 2 * u * t * control.y + t * t * target.y)
            let work = DispatchWorkItem { [weak self] in self?.post(.mouseMoved, at: p) }
            pending.append(work)
            DispatchQueue.main.asyncAfter(deadline: .now() + Double(frame) / 60.0, execute: work)
        }
        let finish = DispatchWorkItem { [weak self] in
            guard let self, self.active else { completion(false); return }
            if click {
                self.post(.leftMouseDown, at: target)
                let up = DispatchWorkItem { [weak self] in
                    guard let self, self.active else { completion(false); return }
                    self.post(.leftMouseUp, at: target)
                    completion(true)
                }
                self.pending.append(up)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.07, execute: up)
            } else {
                completion(true)
            }
        }
        pending.append(finish)
        DispatchQueue.main.asyncAfter(deadline: .now() + duration + 0.12, execute: finish)
    }

    private func post(_ type: CGEventType, at point: CGPoint) {
        let primaryHeight = NSScreen.screens.first?.frame.height ?? 0
        let cg = CGPoint(x: point.x, y: primaryHeight - point.y)
        guard let event = CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: cg, mouseButton: .left) else { return }
        event.setIntegerValueField(.eventSourceUserData, value: Self.eventTag)
        event.post(tap: .cghidEventTap)
    }

    // MARK: His input ends the drive

    private func installAbortTap() {
        let types: [CGEventType] = [.mouseMoved, .leftMouseDown, .rightMouseDown, .keyDown, .scrollWheel, .leftMouseDragged]
        let mask = types.reduce(CGEventMask(0)) { $0 | (CGEventMask(1) << $1.rawValue) }
        let callback: CGEventTapCallBack = { _, type, event, userInfo in
            guard let userInfo, !Driver.isOwn(event) else { return Unmanaged.passUnretained(event) }
            let driver = Unmanaged<Driver>.fromOpaque(userInfo).takeUnretainedValue()
            let what: String
            switch type {
            case .mouseMoved, .leftMouseDragged: what = "moved the mouse"
            case .leftMouseDown, .rightMouseDown: what = "clicked"
            case .scrollWheel: what = "scrolled"
            default: what = "pressed a key"
            }
            DispatchQueue.main.async { driver.abort(what) }
            return Unmanaged.passUnretained(event)
        }
        guard let tap = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .headInsertEventTap, options: .listenOnly,
                                          eventsOfInterest: mask, callback: callback,
                                          userInfo: Unmanaged.passUnretained(self).toOpaque()),
              let source = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0) else {
            Log.warn("drive: could not watch for his input; driving without an abort tap")
            return
        }
        self.tap = tap
        self.source = source
        CFRunLoopAddSource(CFRunLoopGetMain(), source, .commonModes)
        CGEvent.tapEnable(tap: tap, enable: true)
    }

    private func removeAbortTap() {
        if let source { CFRunLoopRemoveSource(CFRunLoopGetMain(), source, .commonModes) }
        if let tap { CFMachPortInvalidate(tap) }
        tap = nil
        source = nil
    }

    private func abort(_ what: String) {
        guard active else { return }
        Log.info("drive: he \(what); stopping")
        end()
        onAbort?(what)
    }
}
