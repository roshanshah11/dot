import AppKit
import ApplicationServices
import DotKit

/// A circled region into the app he was in (parity HA-01). The app, its front window and its focused field are read
/// before Dot's bar opens; right before pasting all of them are checked again, the field is focused, and Command-V
/// goes once, only when that field holds the keyboard within a second. Pasted or refused, the clip stays on his
/// clipboard; Dot never retries.
@MainActor
enum RegionPaste {
    struct Captured {
        let target: PasteTarget
        let element: AXUIElement
    }

    enum Outcome: Equatable { case pasted, refused(String) }

    /// The app in front and its focused field, before Dot shows anything; nil when Dot is in front or nothing has focus.
    static func capture() -> Captured? {
        guard let app = NSWorkspace.shared.frontmostApplication, app.processIdentifier != ProcessInfo.processInfo.processIdentifier else { return nil }
        let axApp = AXUIElementCreateApplication(app.processIdentifier)
        AXUIElementSetMessagingTimeout(axApp, 0.3)
        var focused: AnyObject?
        guard AXUIElementCopyAttributeValue(axApp, kAXFocusedUIElementAttribute as CFString, &focused) == .success,
              let value = focused, CFGetTypeID(value) == AXUIElementGetTypeID() else { return nil }
        let element = value as! AXUIElement
        let target = PasteTarget(appName: app.localizedName ?? "the app", bundleID: app.bundleIdentifier ?? "", pid: app.processIdentifier,
                                 windowID: windows(of: app.processIdentifier, onScreen: true).first,
                                 role: DictationContext.string(element, kAXRoleAttribute) ?? "")
        return Captured(target: target, element: element)
    }

    /// The process's layer-0 windows, front to back.
    static func windows(of pid: Int32, onScreen: Bool) -> [UInt32] {
        let options: CGWindowListOption = onScreen ? [.optionOnScreenOnly, .excludeDesktopElements] : [.optionAll]
        let list = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] ?? []
        return list.filter { ($0[kCGWindowOwnerPID as String] as? Int32) == pid && ($0[kCGWindowLayer as String] as? Int) == 0 }
            .compactMap { ($0[kCGWindowNumber as String] as? NSNumber)?.uint32Value }
    }

    /// The region and his note onto a clipboard as one item: PNG and TIFF for anything that takes a picture, RTFD (the
    /// note, then the picture) for Cocoa text views, HTML for web editors, the note as plain text.
    @discardableResult
    static func copy(jpeg: Data, note: String, to board: NSPasteboard = .general) -> Bool {
        guard let rep = NSBitmapImageRep(data: jpeg), let png = rep.representation(using: .png, properties: [:]) else { return false }
        let item = NSPasteboardItem()
        for (type, data) in RegionClip.payload(png: png, note: note) { item.setData(data, forType: NSPasteboard.PasteboardType(type)) }
        if let tiff = rep.tiffRepresentation { item.setData(tiff, forType: .tiff) }
        if let rtfd = rtfd(png: png, note: note) { item.setData(rtfd, forType: .rtfd) }
        board.clearContents()
        return board.writeObjects([item])
    }

    static func rtfd(png: Data, note: String) -> Data? {
        let text = NSMutableAttributedString()
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { text.append(NSAttributedString(string: trimmed + "\n")) }
        let wrapper = FileWrapper(regularFileWithContents: png)
        wrapper.preferredFilename = "circled.png"
        text.append(NSAttributedString(attachment: NSTextAttachment(fileWrapper: wrapper)))
        return text.rtfd(from: NSRange(location: 0, length: text.length), documentAttributes: [:])
    }

    /// Check the app, window and field again, give the field the keyboard, wait up to a second, then Command-V once.
    static func paste(into captured: Captured) async -> Outcome {
        let target = captured.target
        let running = NSRunningApplication(processIdentifier: target.pid)
        let role = DictationContext.string(captured.element, kAXRoleAttribute)
        let now = PasteState(bundleID: running.flatMap { $0.isTerminated ? nil : $0.bundleIdentifier },
                             windowIDs: windows(of: target.pid, onScreen: false), elementAlive: role != nil, role: role)
        if let why = PasteCheck.refusal(target, now) { return .refused(why) }
        if NSWorkspace.shared.frontmostApplication?.processIdentifier != target.pid { running?.activate() }
        AXUIElementSetAttributeValue(captured.element, kAXFocusedAttribute as CFString, kCFBooleanTrue)
        let until = Date().addingTimeInterval(1)
        while !landed(captured) {
            if Date() >= until { return .refused("\(target.appName) didn't give that field the keyboard back") }
            try? await Task.sleep(nanoseconds: 50_000_000)
        }
        return Driver.paste() ? .pasted : .refused("macOS didn't take the keystroke")
    }

    private static func landed(_ captured: Captured) -> Bool {
        let axApp = AXUIElementCreateApplication(captured.target.pid)
        AXUIElementSetMessagingTimeout(axApp, 0.3)
        var focused: AnyObject?
        let same = AXUIElementCopyAttributeValue(axApp, kAXFocusedUIElementAttribute as CFString, &focused) == .success
            && focused.map { CFEqual($0, captured.element) } == true
        return PasteCheck.focusLanded(frontPid: NSWorkspace.shared.frontmostApplication?.processIdentifier, targetPid: captured.target.pid,
                                      capturedFocused: same, dotHasKeyWindow: NSApp.keyWindow != nil)
    }
}
