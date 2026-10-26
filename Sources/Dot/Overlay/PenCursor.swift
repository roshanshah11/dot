import AppKit
import Darwin

/// Dot's cursor while another app is in front (parity SH-02). macOS only lets the frontmost app set the cursor unless
/// its connection carries the window server's "SetsCursorInBackground" property; that call is private, so it is looked
/// up at run time and everything here quietly does nothing when the symbol is missing.
enum BackgroundCursor {
    private typealias DefaultConnection = @convention(c) () -> Int32
    private typealias SetProperty = @convention(c) (Int32, Int32, CFString, CFTypeRef) -> Int32

    /// Whether Dot may set the cursor while another app is frontmost (asked once; logged).
    static let available: Bool = {
        guard let handle = dlopen(nil, RTLD_NOW),
              let connection = dlsym(handle, "_CGSDefaultConnection") ?? dlsym(handle, "CGSMainConnectionID"),
              let setter = dlsym(handle, "CGSSetConnectionProperty") else {
            Log.info("cursor: the background-cursor call is missing on this macOS; the pen cursor is off")
            return false
        }
        let cid = unsafeBitCast(connection, to: DefaultConnection.self)()
        let error = unsafeBitCast(setter, to: SetProperty.self)(cid, cid, "SetsCursorInBackground" as CFString, kCFBooleanTrue)
        Log.info("cursor: background cursor \(error == 0 ? "on" : "refused (\(error))")")
        return error == 0
    }()
}

/// While ink draws and his mouse is still, the pointer is Dot's pen; it is handed back the moment he moves the mouse,
/// when the drawing settles, or when he talks over Dot. The pointer never moves.
@MainActor
final class PenCursor {
    static let shared = PenCursor()

    private var timer: Timer?
    private var until: Date = .distantPast
    private var startedAt = CGPoint.zero
    private var accentHex = ""
    private var cursor: NSCursor?
    private(set) var holding = false

    /// The pen in Dot's accent with a dark outline, its hotspot at the nib (SF Symbols' pencil already leans with the
    /// nib at the lower left).
    static func pen(accentHex: String) -> NSCursor? {
        let size = NSSize(width: 28, height: 28)
        guard let symbol = NSImage(systemSymbolName: "pencil", accessibilityDescription: "Dot's pen")?
            .withSymbolConfiguration(.init(pointSize: 20, weight: .bold)) else { return nil }
        let color = NSColor(hex: accentHex) ?? .systemOrange
        func tinted(_ c: NSColor) -> NSImage {
            NSImage(size: symbol.size, flipped: false) { r in
                symbol.draw(in: r)
                c.set()
                r.fill(using: .sourceAtop)
                return true
            }
        }
        let fill = tinted(color), edge = tinted(NSColor.black.withAlphaComponent(0.7))
        let s = symbol.size
        let image = NSImage(size: size, flipped: false) { rect in
            let origin = CGPoint(x: 2, y: 2)
            // a one-point dark edge all round, so the pen shows on any background
            for (dx, dy) in [(-1.0, 0.0), (1, 0), (0, -1), (0, 1)] {
                edge.draw(in: CGRect(x: origin.x + dx, y: origin.y + dy, width: s.width, height: s.height))
            }
            fill.draw(in: CGRect(origin: origin, size: s))
            return true
        }
        // hotSpot is in flipped (top-left) coordinates: the nib sits at the lower left
        return NSCursor(image: image, hotSpot: NSPoint(x: 3, y: size.height - 3))
    }

    /// Hold the pen for `seconds` from now (a later call extends it).
    func draw(for seconds: TimeInterval, accentHex: String) {
        guard seconds > 0.05, BackgroundCursor.available else { return }
        if cursor == nil || accentHex != self.accentHex { cursor = Self.pen(accentHex: accentHex); self.accentHex = accentHex }
        guard let cursor else { return }
        until = max(until, Date().addingTimeInterval(seconds))
        if !holding {
            holding = true
            startedAt = NSEvent.mouseLocation
            cursor.set()
        }
        guard timer == nil else { return }
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.tick() }
        }
    }

    private func tick() {
        let moved = hypot(NSEvent.mouseLocation.x - startedAt.x, NSEvent.mouseLocation.y - startedAt.y) > 3
        if moved || Date() >= until { handBack(); return }
        // an app under the pointer may have set its own cursor; the pen stays while the mouse is still
        cursor?.set()
    }

    func handBack() {
        timer?.invalidate()
        timer = nil
        until = .distantPast
        guard holding else { return }
        holding = false
        NSCursor.arrow.set()
    }
}
