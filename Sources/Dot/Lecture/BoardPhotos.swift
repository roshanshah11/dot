import AppKit
import Foundation
import ImageIO
import UniformTypeIdentifiers

/// A photo of the board, AirDropped from his phone during class, goes into that class's notes (he photographs the math
/// board every class). His Photos library doesn't sync from the phone (checked 2026-10-22: newest asset three days old,
/// none from iCloud), and AirDrop lands in Downloads, so that's what is watched: images that arrive after class starts.
@MainActor
final class BoardPhotos {
    private let since: Date
    private let folder: URL
    private var seen: Set<String> = []
    private var timer: Timer?
    /// A new photo as a JPEG (at most 2000 px a side), and when it arrived.
    var onPhoto: ((Data, Date, String) -> Void)?

    static let kinds: Set<String> = ["jpg", "jpeg", "heic", "png"]

    init(since: Date, folder: URL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Downloads")) {
        self.since = since
        self.folder = folder
    }

    func start() {
        timer = Timer.scheduledTimer(withTimeInterval: 8, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.poll() }
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
    }

    func poll() {
        guard let names = try? FileManager.default.contentsOfDirectory(atPath: folder.path) else { return }
        for name in names where !seen.contains(name) {
            let url = folder.appendingPathComponent(name)
            guard Self.kinds.contains(url.pathExtension.lowercased()), !name.lowercased().hasPrefix("screenshot"), !name.hasPrefix("."),
                  let values = try? url.resourceValues(forKeys: [.addedToDirectoryDateKey, .creationDateKey]),
                  let arrived = values.addedToDirectoryDate ?? values.creationDate, arrived > since else { continue }
            seen.insert(name)
            guard let jpeg = Self.jpeg(url) else { Log.warn("lecture: photo \(name) couldn't be read"); continue }
            Log.info("lecture: board photo \(name) (\(jpeg.count / 1024) KB)")
            onPhoto?(jpeg, arrived, name)
        }
    }

    /// Any image (HEIC from the phone too) as a JPEG no bigger than 2000 px on its long side.
    static func jpeg(_ url: URL, maxPixels: Int = 2000) -> Data? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let options: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true,
                                        kCGImageSourceThumbnailMaxPixelSize: maxPixels]
        guard let image = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else { return nil }
        let data = NSMutableData()
        guard let dest = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil) else { return nil }
        CGImageDestinationAddImage(dest, image, [kCGImageDestinationLossyCompressionQuality: 0.8] as CFDictionary)
        return CGImageDestinationFinalize(dest) ? data as Data : nil
    }
}
