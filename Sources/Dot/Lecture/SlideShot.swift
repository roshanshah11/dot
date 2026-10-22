import AppKit
import DotKit
import Foundation
import ScreenCaptureKit

/// The slide in front, as a picture for the notes (lecture mode, 2026-10-22). Otter grabs slides only from Zoom, Meet or
/// Teams; in a lecture hall the deck is on his own screen, so Dot takes the front window when it shows a slide
/// (LectureSlides), never his other windows and never its own.
enum SlideShot {
    @MainActor
    static func capture(maxWidth: Int = 1000) async -> (jpeg: Data, title: String)? {
        guard let front = NSWorkspace.shared.frontmostApplication, front.processIdentifier != ProcessInfo.processInfo.processIdentifier else { return nil }
        let context = AccessibilityContext.capture(maxElements: 0, timeBudget: 0.12)
        guard LectureSlides.looksLikeSlides(bundle: front.bundleIdentifier, title: context.windowTitle, url: context.url),
              let content = try? await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: true) else { return nil }
        let windows = content.windows.filter { $0.owningApplication?.processID == front.processIdentifier && $0.windowLayer == 0 && $0.frame.width > 300 }
        guard let window = windows.max(by: { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }) else { return nil }
        let configuration = SCStreamConfiguration()
        let scale = min(1, Double(maxWidth) / Double(max(window.frame.width, 1)))
        configuration.width = max(Int(window.frame.width * scale), 1)
        configuration.height = max(Int(window.frame.height * scale), 1)
        configuration.showsCursor = false
        guard let image = try? await SCScreenshotManager.captureImage(contentFilter: SCContentFilter(desktopIndependentWindow: window), configuration: configuration) else { return nil }
        let rep = NSBitmapImageRep(cgImage: image)
        guard let jpeg = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.75]) else { return nil }
        let title = await TextRecognizer.lines(jpeg: jpeg).map(\.text).first { $0.trimmingCharacters(in: .whitespaces).count >= 3 } ?? ""
        return (jpeg, title)
    }
}
