import AppKit
import ApplicationServices
import AVFoundation
import CoreGraphics

/// The three grants Dot needs. Reads are cheap; requests pop the system prompt once.
enum Permissions {
    struct Status: Equatable {
        var microphone: Bool
        var screenRecording: Bool
        var accessibility: Bool
        var allGranted: Bool { microphone && screenRecording && accessibility }
    }

    static func status() -> Status {
        Status(microphone: AVCaptureDevice.authorizationStatus(for: .audio) == .authorized,
               screenRecording: CGPreflightScreenCaptureAccess(),
               accessibility: AXIsProcessTrusted())
    }

    static func requestMicrophone(_ completion: @escaping (Bool) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: completion(true)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .audio) { granted in DispatchQueue.main.async { completion(granted) } }
        default: completion(false)
        }
    }

    /// Returns true when already granted. Otherwise shows the system prompt (first time)
    /// or does nothing (later), so the caller should also offer the Settings pane.
    @discardableResult
    static func requestScreenRecording() -> Bool {
        if CGPreflightScreenCaptureAccess() { return true }
        return CGRequestScreenCaptureAccess()
    }

    @discardableResult
    static func requestAccessibility() -> Bool {
        if AXIsProcessTrusted() { return true }
        let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }

    enum Pane: String {
        case microphone = "Privacy_Microphone"
        case screenRecording = "Privacy_ScreenCapture"
        case accessibility = "Privacy_Accessibility"
    }

    static func openSettings(_ pane: Pane) {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?\(pane.rawValue)") {
            NSWorkspace.shared.open(url)
        }
    }
}
