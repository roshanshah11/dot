import Carbon
import Foundation

/// A system-wide shortcut Dot owns (Carbon's RegisterEventHotKey): the key goes to Dot and never reaches the app in
/// front, unlike HotkeyMonitor's listen-only tap. Needs no Accessibility grant. First use: Control+Command+T, the
/// transcript (2026-10-21; not Control+Option, which is talk).
@MainActor
final class GlobalShortcut {
    private var ref: EventHotKeyRef?
    private let id: UInt32
    private static var actions: [UInt32: () -> Void] = [:]
    private static var handlerInstalled = false

    /// `keyCode` is a virtual key (kVK_ANSI_T); `modifiers` Carbon's (controlKey | cmdKey). Nil when the system refuses
    /// it (another app holds the same shortcut).
    init?(keyCode: Int, modifiers: Int, id: UInt32, action: @escaping () -> Void) {
        self.id = id
        Self.installHandler()
        var hotKey: EventHotKeyRef?
        let status = RegisterEventHotKey(UInt32(keyCode), UInt32(modifiers), EventHotKeyID(signature: Self.signature, id: id),
                                         GetApplicationEventTarget(), 0, &hotKey)
        guard status == noErr, let hotKey else {
            Log.warn("shortcut: could not register id \(id) (status \(status))")
            return nil
        }
        ref = hotKey
        Self.actions[id] = action
    }

    deinit {
        if let ref { UnregisterEventHotKey(ref) }
    }

    /// "DotK".
    private static let signature: OSType = 0x446F_744B

    private static func installHandler() {
        guard !handlerInstalled else { return }
        handlerInstalled = true
        var spec = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))
        InstallEventHandler(GetApplicationEventTarget(), { _, event, _ in
            var hotKey = EventHotKeyID()
            let status = GetEventParameter(event, EventParamName(kEventParamDirectObject), EventParamType(typeEventHotKeyID), nil,
                                           MemoryLayout<EventHotKeyID>.size, nil, &hotKey)
            guard status == noErr, hotKey.signature == GlobalShortcut.signature else { return OSStatus(eventNotHandledErr) }
            let id = hotKey.id
            DispatchQueue.main.async { MainActor.assumeIsolated { GlobalShortcut.actions[id]?() } }
            return noErr
        }, 1, &spec, nil, nil)
    }
}
