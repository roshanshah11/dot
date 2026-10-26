import AppKit
import DotKit
import ScreenCaptureKit

/// One captured display: downscaled JPEG plus the mapping back to screen points.
struct ScreenShot {
    let jpeg: Data
    let label: String
    let isCursorScreen: Bool
    let frame: CaptureFrame
    let displayID: CGDirectDisplayID

    var pixelDimensions: String { "\(frame.pixelWidth)x\(frame.pixelHeight)" }
}

/// Every display as JPEG, cursor display first, Dot's own windows excluded.
/// After Clicky's CompanionScreenCaptureUtility (MIT, Farza Majeed).
@MainActor
enum ScreenCapture {
    /// The last capture's health (ON-02): denied, the wallpaper alone, or flat, the marks of a grant macOS reset.
    private(set) static var health = CaptureHealth.Verdict.ok

    /// Captures, and judges the result for a broken Screen Recording grant (`health`).
    static func captureAll(maxDimension: Int, includeOtherScreens: Bool) async throws -> [ScreenShot] {
        do {
            let (shots, shareable, luma) = try await capture(maxDimension: maxDimension, includeOtherScreens: includeOtherScreens)
            health = CaptureHealth.verdict(preflight: CGPreflightScreenCaptureAccess(), errorCode: nil, shareableWindows: shareable,
                                           listedWindows: otherAppWindows(), luma: luma)
            return shots
        } catch {
            health = CaptureHealth.verdict(preflight: CGPreflightScreenCaptureAccess(), errorCode: (error as NSError).code,
                                           shareableWindows: 0, listedWindows: 0, luma: [])
            throw error
        }
    }

    /// Other apps' ordinary windows on screen, from the window server (no grant needed for this count).
    static func otherAppWindows() -> Int {
        let own = ProcessInfo.processInfo.processIdentifier
        let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
        return list.filter { ($0[kCGWindowLayer as String] as? Int) == 0 && ($0[kCGWindowOwnerPID as String] as? Int32) != own
            && ($0[kCGWindowAlpha as String] as? Double ?? 1) > 0.05 }.count
    }

    /// A 16 x 16 grey thumbnail of the image, averaged, for the black-image check.
    static func luma(_ image: CGImage) -> [UInt8] {
        var pixels = [UInt8](repeating: 0, count: 256)
        guard let context = CGContext(data: &pixels, width: 16, height: 16, bitsPerComponent: 8, bytesPerRow: 16, space: CGColorSpaceCreateDeviceGray(),
                                      bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return [] }
        context.interpolationQuality = .medium
        context.draw(image, in: CGRect(x: 0, y: 0, width: 16, height: 16))
        return pixels
    }

    private static func capture(maxDimension: Int, includeOtherScreens: Bool) async throws -> ([ScreenShot], Int, [UInt8]) {
        let content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
        guard !content.displays.isEmpty else {
            throw NSError(domain: "Dot.ScreenCapture", code: 1, userInfo: [NSLocalizedDescriptionKey: "No display to capture"])
        }
        let mouse = NSEvent.mouseLocation
        let ownBundle = Bundle.main.bundleIdentifier
        let ownPid = ProcessInfo.processInfo.processIdentifier
        let ownWindows = content.windows.filter {
            $0.owningApplication?.processID == ownPid || ($0.owningApplication?.bundleIdentifier == ownBundle && ownBundle != nil)
        }

        var screensByID: [CGDirectDisplayID: NSScreen] = [:]
        for screen in NSScreen.screens {
            if let number = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID {
                screensByID[number] = screen
            }
        }

        let displays = content.displays.sorted { a, b in
            let fa = screensByID[a.displayID]?.frame ?? a.frame
            let fb = screensByID[b.displayID]?.frame ?? b.frame
            let ca = fa.contains(mouse), cb = fb.contains(mouse)
            if ca != cb { return ca }
            return a.displayID < b.displayID
        }

        var shots: [ScreenShot] = []
        var luma: [UInt8] = []
        let shareable = content.windows.filter { $0.windowLayer == 0 && $0.owningApplication?.processID != ownPid && $0.isOnScreen }.count
        for (index, display) in displays.enumerated() {
            let frame = screensByID[display.displayID]?.frame
                ?? CGRect(x: display.frame.origin.x, y: display.frame.origin.y, width: CGFloat(display.width), height: CGFloat(display.height))
            let isCursor = frame.contains(mouse)
            if !isCursor && !includeOtherScreens { continue }

            let filter = SCContentFilter(display: display, excludingWindows: ownWindows)
            let configuration = SCStreamConfiguration()
            let aspect = CGFloat(display.width) / CGFloat(max(display.height, 1))
            if display.width >= display.height {
                configuration.width = maxDimension
                configuration.height = Int(CGFloat(maxDimension) / aspect)
            } else {
                configuration.height = maxDimension
                configuration.width = Int(CGFloat(maxDimension) * aspect)
            }
            configuration.showsCursor = true

            let image = try await SCScreenshotManager.captureImage(contentFilter: filter, configuration: configuration)
            if isCursor { luma = Self.luma(image) }
            guard let jpeg = NSBitmapImageRep(cgImage: image).representation(using: .jpeg, properties: [.compressionFactor: 0.8]) else {
                continue
            }
            let label: String
            if displays.count == 1 {
                label = "the user's screen (cursor is here)"
            } else if isCursor {
                label = "screen \(index + 1) of \(displays.count), the cursor is on this one (primary focus)"
            } else {
                label = "screen \(index + 1) of \(displays.count), secondary"
            }
            shots.append(ScreenShot(jpeg: jpeg, label: label, isCursorScreen: isCursor,
                                    frame: CaptureFrame(displayFrame: frame, pixelWidth: image.width, pixelHeight: image.height),
                                    displayID: display.displayID))
        }
        guard !shots.isEmpty else {
            throw NSError(domain: "Dot.ScreenCapture", code: 2, userInfo: [NSLocalizedDescriptionKey: "Capture produced no image"])
        }
        return (shots, shareable, luma)
    }
}
