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

    static func capture(maxElements: Int, timeBudget: TimeInterval = 0.6) -> ScreenContext {
        var context = ScreenContext()
        guard AXIsProcessTrusted() else { return context }
        var candidate = NSWorkspace.shared.frontmostApplication
        if candidate?.processIdentifier == ProcessInfo.processInfo.processIdentifier { candidate = lastForegroundApp }
        guard let app = candidate else { return context }
        context.appName = app.localizedName
        context.bundleIdentifier = app.bundleIdentifier
        let appElement = AXUIElementCreateApplication(app.processIdentifier)

        if let focused = attribute(appElement, kAXFocusedUIElementAttribute) {
            if let selected = string(focused, kAXSelectedTextAttribute), !selected.isEmpty {
                context.selectedText = String(selected.prefix(1_000))
            }
        }

        guard let window = attribute(appElement, kAXFocusedWindowAttribute) ?? firstChildWindow(appElement) else { return context }
        context.windowTitle = string(window, kAXTitleAttribute)
        if let document = string(window, kAXDocumentAttribute), document.hasPrefix("http") { context.url = document }

        let primaryHeight = NSScreen.screens.first?.frame.height ?? 0
        let windowFrame = frame(of: window).map { Coordinates.appKitRect(fromCG: $0, primaryHeight: primaryHeight) }
        context.windowFrame = windowFrame
        let deadline = Date().addingTimeInterval(timeBudget)
        var queue: [(AXUIElement, Int)] = [(window, 0)]
        var visited = 0
        var elements: [AXElementInfo] = []
        var seenFrames: Set<String> = []

        while !queue.isEmpty, elements.count < maxElements, visited < 2_500, Date() < deadline {
            let (element, depth) = queue.removeFirst()
            visited += 1
            let role = string(element, kAXRoleAttribute) ?? ""

            if role == "AXWebArea", context.url == nil, let url = string(element, "AXURL") { context.url = url }

            if interestingRoles.contains(role), let cgFrame = frame(of: element), cgFrame.width >= 4, cgFrame.height >= 4 {
                let title = bestTitle(element, role: role)
                if !title.isEmpty || role == "AXTextField" || role == "AXSearchField" || role == "AXTextArea" {
                    let akFrame = Coordinates.appKitRect(fromCG: cgFrame, primaryHeight: primaryHeight)
                    let visible = windowFrame.map { $0.intersects(akFrame) } ?? true
                    let key = "\(Int(akFrame.minX)),\(Int(akFrame.minY)),\(Int(akFrame.width)),\(Int(akFrame.height))"
                    if visible, !seenFrames.contains(key) {
                        seenFrames.insert(key)
                        elements.append(AXElementInfo(role: role, title: String(title.prefix(60)), frame: akFrame))
                    }
                }
            }
            if depth < 14, containerRoles.contains(role) || interestingRoles.contains(role) {
                if let children = children(of: element) {
                    for child in children.prefix(200) { queue.append((child, depth + 1)) }
                }
            }
        }
        context.elements = elements
        return context
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
