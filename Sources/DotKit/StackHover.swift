import Foundation

/// Which stack chip his pointer holds open, from one place: the chip under the pointer, sampled by the stack window.
/// A card opens once the pointer has rested on a chip for `openDelay`, and closes only after the pointer has been off it
/// for `closeDelay`, and never while the stack is still laying out. On 2026-10-21 10:22 SwiftUI's hover and the window's
/// own check disagreed while an avatar grew into its card, and the card opened and shut four times in 1.5 s.
public struct StackHover: Equatable, Sendable {
    /// Resting this long on a chip opens it (a pass across the stack opens nothing).
    public static let openDelay: TimeInterval = 0.08
    /// Off the open chip this long closes it (an avatar growing into its card moves the frames under a still pointer).
    public static let closeDelay: TimeInterval = 0.3
    /// A timer that fires a hair early still counts (a date difference of 0.3 can come out as 0.29999...).
    static let slack: TimeInterval = 0.001

    public private(set) var hovering: String?
    private var candidate: String?
    private var candidateSince: Date?
    private var outsideSince: Date?

    public init(hovering: String? = nil) { self.hovering = hovering }

    /// The chip under the pointer now (nil: none), and whether the stack's size changed a moment ago. Returns how long
    /// until a pending open or close is due, so the caller can look again then; nil when nothing is pending.
    @discardableResult
    public mutating func update(under: String?, now: Date, layoutSettling: Bool) -> TimeInterval? {
        if let under, under == hovering {
            candidate = nil
            candidateSince = nil
            outsideSince = nil
            return nil
        }
        if let under {
            outsideSince = nil
            if candidate != under {
                candidate = under
                candidateSince = now
            }
            let rested = now.timeIntervalSince(candidateSince ?? now)
            if rested >= Self.openDelay - Self.slack {
                hovering = under
                candidate = nil
                candidateSince = nil
                return nil
            }
            return Self.openDelay - rested
        }
        candidate = nil
        candidateSince = nil
        guard hovering != nil else { outsideSince = nil; return nil }
        if layoutSettling {
            outsideSince = nil
            return Self.closeDelay
        }
        if outsideSince == nil { outsideSince = now }
        let away = now.timeIntervalSince(outsideSince ?? now)
        if away >= Self.closeDelay - Self.slack {
            hovering = nil
            outsideSince = nil
            return nil
        }
        return Self.closeDelay - away
    }

    /// Escape, a fold, or the hovered chip left the stack.
    public mutating func clear() {
        hovering = nil
        candidate = nil
        candidateSince = nil
        outsideSince = nil
    }

    /// A chip left the stack: forget it if it was open or about to open.
    public mutating func forget(_ id: String) {
        if hovering == id || candidate == id { clear() }
    }
}
