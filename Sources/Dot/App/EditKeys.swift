import AppKit

/// Dot runs without a menu bar, and the menu bar's Edit menu is what normally turns ⌘V into a paste, so in the
/// notch's "type a question", an agent's reply field and the panels, ⌘X ⌘C ⌘V ⌘A ⌘Z did nothing (his ask
/// 2026-10-22: "why cant i copy text into the type a question"). Each of Dot's own windows sends them on here.
enum EditKeys {
    /// The edit action ⌘ plus this key stands for, or nil.
    static func action(for event: NSEvent) -> Selector? {
        guard event.type == .keyDown, let key = event.charactersIgnoringModifiers?.lowercased() else { return nil }
        let flags = event.modifierFlags.intersection([.command, .shift, .option, .control])
        switch (key, flags) {
        case ("x", .command): return #selector(NSText.cut(_:))
        case ("c", .command): return #selector(NSText.copy(_:))
        case ("v", .command): return #selector(NSText.paste(_:))
        case ("a", .command): return #selector(NSText.selectAll(_:))
        case ("z", .command): return Selector(("undo:"))
        case ("z", [.command, .shift]): return Selector(("redo:"))
        default: return nil
        }
    }

    /// Sends the edit action to whatever has focus in `window`; false when nothing there takes it.
    @MainActor
    static func perform(_ event: NSEvent, in window: NSWindow) -> Bool {
        guard let action = action(for: event), window.isKeyWindow else { return false }
        return NSApp.sendAction(action, to: nil, from: window)
    }

    /// The menu bar Dot never shows still answers key equivalents while Dot is the active app (Home, the
    /// Markdown viewer), so it carries the standard Edit menu too.
    @MainActor
    static func installMenu() {
        let main = NSApp.mainMenu ?? NSMenu()
        guard main.item(withTitle: "Edit") == nil else { return }
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        let item = NSMenuItem(title: "Edit", action: nil, keyEquivalent: "")
        item.submenu = edit
        main.addItem(item)
        NSApp.mainMenu = main
    }
}
