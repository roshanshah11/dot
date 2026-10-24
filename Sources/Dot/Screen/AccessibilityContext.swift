import AppKit
import ApplicationServices
import DotKit

/// A clickable or readable element of the frontmost window, with its frame in AppKit
/// screen coordinates. Exact frames are what make pointing land on the element.
struct AXElementInfo: Equatable {
    let role: String
    let title: String
    let frame: CGRect
}

struct ScreenContext {
    var appName: String?
    var bundleIdentifier: String?
    var windowTitle: String?
    var selectedText: String?
    var url: String?
    /// The file the window shows (Preview, Skim, TextEdit, Pages expose it as AXDocument), as a path.
    var documentPath: String?
    /// The frontmost window's frame in AppKit screen coordinates, when known.
    var windowFrame: CGRect?
    var elements: [AXElementInfo] = []

    static let empty = ScreenContext()
}

/// Reads the frontmost app through the Accessibility API, bounded in nodes and time so a
/// browser with two hundred tabs cannot stall a voice turn.
enum AccessibilityContext {
    static let interestingRoles: Set<String> = [
        "AXButton", "AXMenuButton", "AXPopUpButton", "AXCheckBox", "AXRadioButton", "AXTab", "AXTabButton",
        "AXTextField", "AXTextArea", "AXSearchField", "AXComboBox", "AXLink", "AXMenuItem", "AXMenuBarItem",
        "AXSlider", "AXIncrementor", "AXDisclosureTriangle", "AXColorWell", "AXImage", "AXCell", "AXRow",
        "AXHeading", "AXStaticText", "AXToolbar", "AXSegmentedControl", "AXSwitch", "AXToggle",
    ]

    static let containerRoles: Set<String> = [
        "AXWindow", "AXGroup", "AXScrollArea", "AXSplitGroup", "AXTabGroup", "AXToolbar", "AXList", "AXTable", "AXOutline",
        "AXWebArea", "AXGenericElement", "AXLayoutArea", "AXLayoutItem", "AXRow", "AXCell", "AXColumn", "AXSheet",
        "AXDrawer", "AXPopover", "AXMenuBar", "AXMenu", "AXSection", "AXLandmarkMain", "AXLandmarkNavigation",
        "AXLandmarkBanner", "AXLandmarkContentInfo", "AXArticle", "AXDocument", "AXApplication", "AXBrowser",
        "AXRadioGroup", "AXUnknown", "AXGrid", "AXBusyIndicator",
    ]

    /// The last app other than Dot that was active; set by the AppDelegate's workspace observer.
    /// When Dot's own HUD has the keyboard, this is the app the user is really looking at.
    static var lastForegroundApp: NSRunningApplication?

    static func observeForegroundApp() {
        lastForegroundApp = NSWorkspace.shared.frontmostApplication
        NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didActivateApplicationNotification, object: nil, queue: .main) { note in
            guard let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
                  app.processIdentifier != ProcessInfo.processInfo.processIdentifier else { return }
            lastForegroundApp = app
        }
    }

    static func frontmostAppName() -> String? { NSWorkspace.shared.frontmostApplication?.localizedName }

    static func capture(maxElements: Int, timeBudget: TimeInterval = 0.6) -> ScreenContext {
        var context = ScreenContext()
        guard AXIsProcessTrusted() else { return context }
        var candidate = NSWorkspace.shared.frontmostApplication
        if candidate?.processIdentifier == ProcessInfo.processInfo.processIdentifier { candidate = lastForegroundApp }
        guard var app = candidate else { return context }
        var appElement = AXUIElementCreateApplication(app.processIdentifier)
        var found = attribute(appElement, kAXFocusedWindowAttribute) ?? firstChildWindow(appElement)
        // An app in front with no window (Messages after its window closed) isn't what he sees: the window under it is.
        // On 10-22 "fill this out for me" over his application tab read as Messages with no window, and the job ran behind.
        if found == nil, let under = appUnderWindowless(app) {
            Log.info("context: \(app.localizedName ?? "the app in front") has no window; reading \(under.app.localizedName ?? "the app") under it")
            (app, appElement, found) = (under.app, under.element, under.window)
        }
        context.appName = app.localizedName
        context.bundleIdentifier = app.bundleIdentifier

        if let focused = attribute(appElement, kAXFocusedUIElementAttribute) {
            if let selected = string(focused, kAXSelectedTextAttribute), !selected.isEmpty {
                context.selectedText = String(selected.prefix(1_000))
            }
        }

        guard let window = found else { return context }
        context.windowTitle = string(window, kAXTitleAttribute)
        let windowDocument = string(window, kAXDocumentAttribute)
        if let document = windowDocument {
            if document.hasPrefix("http") { context.url = document }
            else if document.hasPrefix("file://"), let fileURL = URL(string: document) { context.documentPath = fileURL.path }
            else if document.hasPrefix("/") { context.documentPath = document }
        }

        let primaryHeight = NSScreen.screens.first?.frame.height ?? 0
        let windowFrame = frame(of: window).map { Coordinates.appKitRect(fromCG: $0, primaryHeight: primaryHeight) }
        context.windowFrame = windowFrame
        let deadline = Date().addingTimeInterval(timeBudget)
        // The page first. Breadth-first over the whole window spent the list on a browser's tabs, toolbar and
        // bookmarks: 85% of Comet's elements in his turns to 10-19 were chrome, and on a chat page the walk returned
        // 47 chrome and 0 page elements (the page starts at depth 8, and the walk stopped at 14). Inside a web area
        // the walk goes 40 levels down and comes before the chrome, which keeps a quarter of the list in a browser or once
        // a page is seen.
        var chromeQueue: [(AXUIElement, Int)] = [(window, 0)]
        var webQueue: [(AXUIElement, Int)] = []
        var visited = 0
        var elements: [AXElementInfo] = []
        var seenFrames: Set<String> = []
        var chromeCount = 0
        var sawPage = false
        let chromeCap = max(12, maxElements / 4)
        let browser = Hands.browsers.contains(app.bundleIdentifier ?? "")

        while !chromeQueue.isEmpty || !webQueue.isEmpty, elements.count < maxElements, visited < 2_500, Date() < deadline {
            let inPage = !webQueue.isEmpty
            let (element, depth) = inPage ? webQueue.removeFirst() : chromeQueue.removeFirst()
            visited += 1
            let role = string(element, kAXRoleAttribute) ?? ""
            let opensPage = role == "AXWebArea"
            if opensPage { sawPage = true }

            // A browser window's AXDocument names its active tab. The first web area can be Comet's assistant sidecar
            // or the other half of a split view: on 10-24 15:19 "Notes - Right view" (a PDF) carried the sidecar's url,
            // so no tab matched and "go to that part of my notes" did nothing.
            if opensPage, context.url == nil {
                if let document = windowDocument, document.hasPrefix("file://") { context.url = document }
                else if let url = string(element, "AXURL"), !Self.isSidecar(url) { context.url = url }
            }

            if interestingRoles.contains(role), let cgFrame = frame(of: element), cgFrame.width >= 4, cgFrame.height >= 4 {
                let title = bestTitle(element, role: role)
                if !title.isEmpty || role == "AXTextField" || role == "AXSearchField" || role == "AXTextArea" {
                    let akFrame = Coordinates.appKitRect(fromCG: cgFrame, primaryHeight: primaryHeight)
                    let visible = windowFrame.map { $0.intersects(akFrame) } ?? true
                    let key = "\(Int(akFrame.minX)),\(Int(akFrame.minY)),\(Int(akFrame.width)),\(Int(akFrame.height))"
                    let chromeFull = !inPage && (sawPage || browser) && chromeCount >= chromeCap
                    if visible, !chromeFull, !seenFrames.contains(key), !Self.repeatsLabel(role: role, title: title, frame: akFrame, in: elements) {
                        seenFrames.insert(key)
                        elements.append(AXElementInfo(role: role, title: String(title.prefix(60)), frame: akFrame))
                        if !inPage { chromeCount += 1 }
                    }
                }
            }
            let deeper = inPage || opensPage ? depth < 40 : depth < 14
            if deeper, containerRoles.contains(role) || interestingRoles.contains(role) {
                if let children = children(of: element) {
                    for child in children.prefix(200) {
                        if inPage || opensPage { webQueue.append((child, inPage ? depth + 1 : 1)) } else { chromeQueue.append((child, depth + 1)) }
                    }
                }
            }
        }
        context.elements = elements
        return context
    }

    /// Comet's assistant panel, a web area beside the page that is never the page he means.
    static func isSidecar(_ url: String) -> Bool { url.contains("perplexity.ai/sidecar") }

    /// A page's heading or link also lists its own text as a static text in the same place: one entry is enough.
    static func repeatsLabel(role: String, title: String, frame: CGRect, in elements: [AXElementInfo]) -> Bool {
        guard role == "AXStaticText" else { return false }
        let center = CGPoint(x: frame.midX, y: frame.midY)
        return elements.contains { $0.title == String(title.prefix(60)) && $0.frame.insetBy(dx: -4, dy: -4).contains(center) }
    }

    /// The element whose frame contains the point, or the nearest labelled match within reach.
    static func element(near point: CGPoint, label: String, in elements: [AXElementInfo], maxDistance: CGFloat = 140) -> AXElementInfo? {
        let needle = label.lowercased().trimmingCharacters(in: .whitespaces)
        let byLabel = elements.filter { !needle.isEmpty && ($0.title.lowercased().contains(needle) || needle.contains($0.title.lowercased()) && $0.title.count > 2) }
        let candidates = byLabel.isEmpty ? elements : byLabel
        var best: (AXElementInfo, CGFloat)?
        for element in candidates {
            let center = CGPoint(x: element.frame.midX, y: element.frame.midY)
            let inside = element.frame.insetBy(dx: -6, dy: -6).contains(point)
            let distance = inside ? 0 : hypot(center.x - point.x, center.y - point.y)
            if distance <= maxDistance, best == nil || distance < best!.1 {
                best = (element, distance)
            }
        }
        if best == nil, !byLabel.isEmpty, byLabel.count == 1 { return byLabel[0] }
        return best?.0
    }

    /// The app owning the topmost ordinary window on screen, past the windowless app in front and Dot itself, with a window
    /// the accessibility API can read (Cua Driver's invisible full-screen window has none, so it is passed over).
    private static func appUnderWindowless(_ front: NSRunningApplication) -> (app: NSRunningApplication, element: AXUIElement, window: AXUIElement)? {
        guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] else { return nil }
        let own = ProcessInfo.processInfo.processIdentifier
        var tried: Set<pid_t> = [own, front.processIdentifier]
        for info in list {
            guard let layer = info[kCGWindowLayer as String] as? Int, layer == 0,
                  let pid = info[kCGWindowOwnerPID as String] as? pid_t, !tried.contains(pid),
                  let alpha = info[kCGWindowAlpha as String] as? Double, alpha > 0.05,
                  let bounds = info[kCGWindowBounds as String] as? [String: Any],
                  let w = bounds["Width"] as? Double, let h = bounds["Height"] as? Double, w >= 200, h >= 150 else { continue }
            tried.insert(pid)
            guard let app = NSRunningApplication(processIdentifier: pid), app.activationPolicy == .regular else { continue }
            let element = AXUIElementCreateApplication(pid)
            if let window = attribute(element, kAXFocusedWindowAttribute) ?? firstChildWindow(element) { return (app, element, window) }
        }
        return nil
    }

    // MARK: AX helpers

    private static func attribute(_ element: AXUIElement, _ name: String) -> AXUIElement? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success, let value else { return nil }
        guard CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
        return unsafeBitCast(value, to: AXUIElement.self)
    }

    private static func firstChildWindow(_ app: AXUIElement) -> AXUIElement? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(app, kAXWindowsAttribute as CFString, &value) == .success,
              let windows = value as? [AXUIElement] else { return nil }
        return windows.first
    }

    private static func children(of element: AXUIElement) -> [AXUIElement]? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXChildrenAttribute as CFString, &value) == .success else { return nil }
        return value as? [AXUIElement]
    }

    private static func string(_ element: AXUIElement, _ name: String) -> String? {
        var value: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success, let value else { return nil }
        if let s = value as? String { return s }
        if let url = value as? URL { return url.absoluteString }
        if let n = value as? NSNumber { return n.stringValue }
        return nil
    }

    private static func frame(of element: AXUIElement) -> CGRect? {
        var positionValue: CFTypeRef?
        var sizeValue: CFTypeRef?
        guard AXUIElementCopyAttributeValue(element, kAXPositionAttribute as CFString, &positionValue) == .success,
              AXUIElementCopyAttributeValue(element, kAXSizeAttribute as CFString, &sizeValue) == .success,
              let positionValue, let sizeValue else { return nil }
        var point = CGPoint.zero
        var size = CGSize.zero
        guard AXValueGetValue(unsafeBitCast(positionValue, to: AXValue.self), .cgPoint, &point),
              AXValueGetValue(unsafeBitCast(sizeValue, to: AXValue.self), .cgSize, &size) else { return nil }
        return CGRect(origin: point, size: size)
    }

    private static func bestTitle(_ element: AXUIElement, role: String) -> String {
        for name in [kAXTitleAttribute, kAXDescriptionAttribute, kAXValueAttribute, kAXHelpAttribute, "AXLabel", kAXPlaceholderValueAttribute] {
            if let s = string(element, name)?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty {
                if (name == kAXValueAttribute) && (role == "AXTextField" || role == "AXTextArea" || role == "AXSearchField") && s.count > 40 { continue }
                return s.replacingOccurrences(of: "\n", with: " ")
            }
        }
        return ""
    }
}
