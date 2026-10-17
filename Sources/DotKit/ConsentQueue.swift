import Foundation

/// The permission questions waiting for him, one per request, oldest first. Round seven (F1): the
/// notch had one slot, so a second agent's card replaced the first one's and that agent waited
/// until he stopped it (2026-10-16, 78 minutes with no card on screen). Now every question stays
/// answerable: the oldest shows, the rest wait their turn ("+N waiting"), answering one removes
/// only that one, and tapping an agent's "waiting for you" row brings its question forward.
public struct ConsentQueue<Item> {
    public struct Entry {
        public let id: UUID
        /// The asking agent's slug.
        public let agent: String
        public let item: Item
        public let since: Date
    }

    public private(set) var entries: [Entry] = []
    private var pinned: UUID?

    public init() {}

    /// The question on show: the one he brought forward, else the oldest.
    public var current: Entry? {
        if let pinned, let entry = entries.first(where: { $0.id == pinned }) { return entry }
        return entries.first
    }

    /// How many wait behind the one on show.
    public var waitingBehind: Int { max(entries.count - 1, 0) }
    public var isEmpty: Bool { entries.isEmpty }
    public var count: Int { entries.count }

    public mutating func add(id: UUID, agent: String, item: Item, since: Date = Date()) {
        guard !entries.contains(where: { $0.id == id }) else { return }
        entries.append(Entry(id: id, agent: agent, item: item, since: since))
    }

    /// Removes one question (answered or withdrawn) and returns it; the next in line shows.
    @discardableResult
    public mutating func remove(id: UUID) -> Entry? {
        guard let index = entries.firstIndex(where: { $0.id == id }) else { return nil }
        if pinned == id { pinned = nil }
        return entries.remove(at: index)
    }

    /// Removes every question one agent asked (it was stopped, or its session ended) and returns them.
    @discardableResult
    public mutating func removeAll(agent: String) -> [Entry] {
        let gone = entries.filter { $0.agent == agent }
        entries.removeAll { $0.agent == agent }
        if let pinned, !entries.contains(where: { $0.id == pinned }) { self.pinned = nil }
        return gone
    }

    /// Shows this agent's oldest question next; false when it has none.
    @discardableResult
    public mutating func bringForward(agent: String) -> Bool {
        guard let entry = entries.first(where: { $0.agent == agent }) else { return false }
        pinned = entry.id
        return true
    }

    public func isWaiting(agent: String) -> Bool { entries.contains { $0.agent == agent } }
}
