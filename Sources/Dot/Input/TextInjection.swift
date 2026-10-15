import AppKit
import ApplicationServices

/// Puts dictated or prepared text where he is typing: straight into the focused field through
/// accessibility when the app allows it, else a paste, else the clipboard with a note.
@MainActor
enum TextInjection {
    enum Method: String { case accessibility, paste, clipboard }

    static func insert(_ text: String) -> Method {
        guard !text.isEmpty else { return .clipboard }
        if insertViaAccessibility(text) { return .accessibility }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        if Driver.paste() { return .paste }
        return .clipboard
    }

    private static func insertViaAccessibility(_ text: String) -> Bool {
        let system = AXUIElementCreateSystemWide()
        var focused: AnyObject?
        guard AXUIElementCopyAttributeValue(system, kAXFocusedUIElementAttribute as CFString, &focused) == .success,
              let value = focused, CFGetTypeID(value) == AXUIElementGetTypeID() else { return false }
        let element = value as! AXUIElement
        var role: AnyObject?
        AXUIElementCopyAttributeValue(element, kAXRoleAttribute as CFString, &role)
        let roleName = (role as? String) ?? ""
        let textRoles = ["AXTextField", "AXTextArea", "AXComboBox", "AXSearchField"]
        guard textRoles.contains(roleName) || roleName.hasSuffix("TextArea") || roleName.hasSuffix("TextField") else { return false }
        var settable: DarwinBoolean = false
        guard AXUIElementIsAttributeSettable(element, kAXSelectedTextAttribute as CFString, &settable) == .success, settable.boolValue else { return false }
        return AXUIElementSetAttributeValue(element, kAXSelectedTextAttribute as CFString, text as CFTypeRef) == .success
    }
}
