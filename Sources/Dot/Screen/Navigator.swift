import AppKit
import CoreGraphics
import DotKit
import Foundation

/// Moves the app in front to a passage: the app's own find box (command F, the phrase, return,
/// escape) works in Preview, every browser's pdf viewer, Word, Pages and most readers; Preview and
/// Skim also take a page number (command option G). Every key Dot posts carries the driver tag,
/// so the hotkey tap and the drive-abort tap ignore them. Nothing is typed into a text field:
/// the find box opens first, and if no window of that app is in front, nothing is sent.
@MainActor
enum Navigator {
    private static let keyCodes: [Character: CGKeyCode] = [
        "a": 0, "s": 1, "d": 2, "f": 3, "h": 4, "g": 5, "z": 6, "x": 7, "c": 8, "v": 9, "b": 11, "q": 12, "w": 13, "e": 14, "r": 15,
        "y": 16, "t": 17, "1": 18, "2": 19, "3": 20, "4": 21, "6": 22, "5": 23, "=": 24, "9": 25, "7": 26, "-": 27, "8": 28, "0": 29,
        "]": 30, "o": 31, "u": 32, "[": 33, "i": 34, "p": 35, "l": 37, "j": 38, "'": 39, "k": 40, ";": 41, "\\": 42, ",": 43, "/": 44,
        "n": 45, "m": 46, ".": 47, " ": 49, "`": 50,
    ]
    static let returnKey: CGKeyCode = 36
    static let escapeKey: CGKeyCode = 53
    static let tabKey: CGKeyCode = 48

    /// Apps whose find box selects and scrolls to a pdf passage.
    static let pdfApps: Set<String> = ["com.apple.Preview", "net.sourceforge.skim-app.skim", "com.adobe.Reader", "com.adobe.Acrobat.Pro"]

    /// Find the phrase in the frontmost app with its own find box. Returns false when the app
    /// changed under Dot or the phrase is empty. The caller re-captures the screen afterwards.
    static func find(_ phrase: String, in bundle: String?) async -> Bool {
        let text = phrase.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, frontmostMatches(bundle) else { return false }
        Log.info("navigate: find \"\(Log.short(text, 60))\" in \(bundle ?? "the app in front")")
        chord(key: keyCodes["f"]!, flags: .maskCommand)
        try? await Task.sleep(nanoseconds: 260_000_000)
        guard frontmostMatches(bundle) else { return false }
        // Select whatever the box held, then type the phrase so the search is fresh.
        chord(key: keyCodes["a"]!, flags: .maskCommand)
        try? await Task.sleep(nanoseconds: 60_000_000)
        type(text)
        try? await Task.sleep(nanoseconds: 160_000_000)
        chord(key: returnKey, flags: [])
        try? await Task.sleep(nanoseconds: 420_000_000)
        chord(key: escapeKey, flags: [])
        return true
    }

    /// Jump Preview or Skim to a page.
    static func goToPage(_ page: Int, in bundle: String?) async -> Bool {
        guard page >= 1, let bundle, pdfApps.contains(bundle), frontmostMatches(bundle) else { return false }
        Log.info("navigate: page \(page) in \(bundle)")
        chord(key: keyCodes["g"]!, flags: [.maskCommand, .maskAlternate])
        try? await Task.sleep(nanoseconds: 300_000_000)
        chord(key: keyCodes["a"]!, flags: .maskCommand)
        type(String(page))
        try? await Task.sleep(nanoseconds: 80_000_000)
        chord(key: returnKey, flags: [])
        try? await Task.sleep(nanoseconds: 350_000_000)
        return true
    }

    static func frontmostMatches(_ bundle: String?) -> Bool {
        guard let bundle else { return true }
        return NSWorkspace.shared.frontmostApplication?.bundleIdentifier == bundle
    }

    // MARK: Keys

    static func chord(key: CGKeyCode, flags: CGEventFlags) {
        guard let down = CGEvent(keyboardEventSource: nil, virtualKey: key, keyDown: true),
              let up = CGEvent(keyboardEventSource: nil, virtualKey: key, keyDown: false) else { return }
        for event in [down, up] {
            event.flags = flags
            event.setIntegerValueField(.eventSourceUserData, value: Driver.eventTag)
        }
        down.post(tap: .cghidEventTap)
        up.post(tap: .cghidEventTap)
    }

    /// Types text as unicode key events (no layout lookup needed), a few characters per event.
    static func type(_ text: String) {
        let scalars = Array(text.utf16)
        var index = 0
        while index < scalars.count {
            let chunk = Array(scalars[index..<min(index + 12, scalars.count)])
            guard let down = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: true),
                  let up = CGEvent(keyboardEventSource: nil, virtualKey: 0, keyDown: false) else { return }
            chunk.withUnsafeBufferPointer { pointer in
                down.keyboardSetUnicodeString(stringLength: chunk.count, unicodeString: pointer.baseAddress)
                up.keyboardSetUnicodeString(stringLength: chunk.count, unicodeString: pointer.baseAddress)
            }
            for event in [down, up] { event.setIntegerValueField(.eventSourceUserData, value: Driver.eventTag) }
            down.post(tap: .cghidEventTap)
            up.post(tap: .cghidEventTap)
            index += 12
            usleep(12_000)
        }
    }
}
