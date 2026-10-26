import AppKit
import ApplicationServices
import DotKit

/// The field dictation is about to land in (parity DI-01): app, page, label and the text around the cursor, read
/// through accessibility in one pass. A password field gives its role and nothing else.
@MainActor
struct DictationContext {
    var field: DictationField
    let element: AXUIElement?
    /// Where the inserted text starts (the cursor, or the start of the selection it replaces), in UTF-16.
    var location: Int?

    static func read() -> DictationContext {
        let front = NSWorkspace.shared.frontmostApplication
        var field = DictationField(app: front?.localizedName ?? "", bundleID: front?.bundleIdentifier ?? "")
        let system = AXUIElementCreateSystemWide()
        AXUIElementSetMessagingTimeout(system, 0.3)
        var focused: AnyObject?
        guard AXUIElementCopyAttributeValue(system, kAXFocusedUIElementAttribute as CFString, &focused) == .success,
              let value = focused, CFGetTypeID(value) == AXUIElementGetTypeID() else { return DictationContext(field: field, element: nil) }
        let element = value as! AXUIElement
        field.role = string(element, kAXRoleAttribute) ?? ""
        guard field.role != "AXSecureTextField" else { return DictationContext(field: field, element: nil) }
        field.label = label(element)
        field.url = pageURL(element)
        var location: Int?
        if let text = string(element, kAXValueAttribute), let range = selection(element) {
            let whole = text as NSString
            let start = min(max(range.location, 0), whole.length)
            let from = max(0, start - DictationField.beforeLimit)
            field.before = whole.substring(with: NSRange(location: from, length: start - from))
            let end = min(start + max(range.length, 0), whole.length)
            field.after = whole.substring(with: NSRange(location: end, length: min(20, whole.length - end)))
            location = start
        }
        return DictationContext(field: field, element: element, location: location)
    }

    static func string(_ element: AXUIElement, _ attribute: String) -> String? {
        var value: AnyObject?
        guard AXUIElementCopyAttributeValue(element, attribute as CFString, &value) == .success else { return nil }
        return value as? String
    }

    static func selection(_ element: AXUIElement) -> CFRange? {
        var value: AnyObject?
        guard AXUIElementCopyAttributeValue(element, kAXSelectedTextRangeAttribute as CFString, &value) == .success, let value,
              CFGetTypeID(value) == AXValueGetTypeID() else { return nil }
        var range = CFRange()
        return AXValueGetValue(value as! AXValue, .cfRange, &range) ? range : nil
    }

    /// The title, the label element's text, the description or the placeholder, whichever the app gives first.
    private static func label(_ element: AXUIElement) -> String {
        if let title = string(element, kAXTitleAttribute), !title.isEmpty { return title }
        var labelElement: AnyObject?
        if AXUIElementCopyAttributeValue(element, kAXTitleUIElementAttribute as CFString, &labelElement) == .success, let labelElement,
           CFGetTypeID(labelElement) == AXUIElementGetTypeID() {
            let owner = labelElement as! AXUIElement
            if let text = string(owner, kAXValueAttribute) ?? string(owner, kAXTitleAttribute), !text.isEmpty { return text }
        }
        for attribute in [kAXDescriptionAttribute, kAXPlaceholderValueAttribute as String, kAXHelpAttribute] {
            if let text = string(element, attribute), !text.isEmpty { return text }
        }
        return ""
    }

    /// The page a browser field is on: the nearest web area's address.
    private static func pageURL(_ element: AXUIElement) -> String? {
        var current: AXUIElement? = element
        for _ in 0..<40 {
            guard let node = current else { return nil }
            if string(node, kAXRoleAttribute) == "AXWebArea" {
                var url: AnyObject?
                if AXUIElementCopyAttributeValue(node, "AXURL" as CFString, &url) == .success {
                    if let url = url as? URL { return url.absoluteString }
                    if let url = url as? String { return url }
                }
                return nil
            }
            var parent: AnyObject?
            guard AXUIElementCopyAttributeValue(node, kAXParentAttribute as CFString, &parent) == .success, let parent,
                  CFGetTypeID(parent) == AXUIElementGetTypeID() else { return nil }
            current = (parent as! AXUIElement)
        }
        return nil
    }
}

/// Watches the field after a dictation for his own correction (parity DI-05): the inserted range is tracked at four
/// reads a second while the field keeps focus; five quiet seconds after an edit, or the field losing focus, ends the
/// watch and a clean correction becomes a candidate. Ninety seconds is the most it watches. Nothing becomes a rule
/// here: candidates wait in Home > Dictation for his Add.
@MainActor
final class DictationWatch {
    struct Read { var focused: Bool; var value: String? }

    static let quietSeconds: TimeInterval = 5
    static let maxSeconds: TimeInterval = 90
    /// Larger fields are not watched (a whole document read four times a second).
    static let maxLength = 50_000

    private(set) var tracker: DictationEditTracker
    private let read: () -> Read
    private let started: Date
    private var lastEdit: Date?
    private var timer: Timer?
    private(set) var finished = false
    let app: String
    var dictionary: DictationDictionary
    var onCandidate: (DictationCandidate) -> Void = { _ in }

    init(tracker: DictationEditTracker, app: String, dictionary: DictationDictionary, now: Date = Date(), read: @escaping () -> Read) {
        self.tracker = tracker
        self.app = app
        self.dictionary = dictionary
        self.read = read
        started = now
    }

    /// The live watch on an accessibility element, or nil when the insert can't be found where Dot put it.
    static func live(_ context: DictationContext, inserted: String, dictionary: DictationDictionary) -> DictationWatch? {
        guard let element = context.element, let location = context.location,
              let value = DictationContext.string(element, kAXValueAttribute), (value as NSString).length <= maxLength,
              let tracker = DictationEditTracker(value: value, start: location, inserted: inserted) else { return nil }
        return DictationWatch(tracker: tracker, app: context.field.app, dictionary: dictionary) {
            let system = AXUIElementCreateSystemWide()
            var focused: AnyObject?
            let still = AXUIElementCopyAttributeValue(system, kAXFocusedUIElementAttribute as CFString, &focused) == .success
                && focused.map { CFEqual($0, element) } == true
            guard still else { return Read(focused: false, value: nil) }
            let text = DictationContext.string(element, kAXValueAttribute)
            return Read(focused: true, value: text.flatMap { ($0 as NSString).length <= maxLength ? $0 : nil })
        }
    }

    func start() {
        timer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.tick() }
        }
    }

    /// One read. Returns false once the watch is over.
    @discardableResult
    func tick(now: Date = Date()) -> Bool {
        guard !finished else { return false }
        let read = read()
        if !read.focused { return finish("the field lost focus") }
        let before = tracker.current
        tracker.observe(read.value)
        if tracker.tainted { return finish("the text around it changed") }
        if tracker.current != before { lastEdit = now }
        if let lastEdit, now.timeIntervalSince(lastEdit) >= Self.quietSeconds { return finish("quiet after an edit") }
        if now.timeIntervalSince(started) >= Self.maxSeconds { return finish("time") }
        return true
    }

    /// Ends the watch (a new dictation, his focus elsewhere, time) and hands over a clean correction.
    @discardableResult
    func finish(_ why: String) -> Bool {
        guard !finished else { return false }
        finished = true
        timer?.invalidate()
        timer = nil
        if let candidate = tracker.candidate(dictionary: dictionary) {
            Log.info("dictation: candidate \(candidate.heard) => \(candidate.correct) (\(why))")
            onCandidate(candidate)
        } else if tracker.edited {
            Log.info("dictation: an edit, no candidate (\(tracker.tainted ? "tainted" : why))")
        }
        return false
    }
}
