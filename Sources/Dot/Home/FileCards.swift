import AppKit
import DotKit
import QuickLookThumbnailing
import SwiftUI

/// A file a job or agent made, as a card (parity HO-03): its QuickLook thumbnail, name, size and age, then View (the
/// notch viewer or the reader) or Open, and Reveal. Drag it out like the file. A job's page.md shows as its headline.
/// `large` puts the thumbnail on top at full width (the first file of a turn); otherwise it sits on the left.
struct FileCard: View {
    enum Style { case home, notch }
    let url: URL
    var style: Style = .home
    var large = false
    var accent: Color = HomeStyle.accent
    /// Replaces View (a live job's page opens its page window, not the file).
    var view: (() -> Void)? = nil
    @State private var thumb: NSImage?
    @State private var info = FileCardInfo.empty

    private var ink: Color { style == .notch ? .white : .primary }
    private var thumbSize: CGSize { large ? CGSize(width: 300, height: 170) : CGSize(width: style == .notch ? 40 : 48, height: style == .notch ? 40 : 48) }

    var body: some View {
        Group {
            if large {
                VStack(alignment: .leading, spacing: 0) {
                    picture.frame(width: thumbSize.width, height: thumbSize.height).clipped()
                    Divider().opacity(0.5)
                    HStack(spacing: 8) { words; Spacer(minLength: 4); actions }.padding(.horizontal, 10).padding(.vertical, 8)
                }
                .frame(width: thumbSize.width)
            } else {
                HStack(spacing: 10) {
                    picture.frame(width: thumbSize.width, height: thumbSize.height)
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(ink.opacity(0.08), lineWidth: 1))
                    words
                    Spacer(minLength: 4)
                    actions
                }
                .padding(7)
                .frame(maxWidth: style == .notch ? .infinity : 380, alignment: .leading)
            }
        }
        .background(ink.opacity(style == .notch ? 0.06 : 0.04), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(ink.opacity(0.08), lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .opacity(info.missing ? 0.55 : 1)
        .contentShape(Rectangle())
        .onTapGesture(count: 2) { if !info.missing { (view ?? { FileViewer.show(url) })() } }
        .onDrag { NSItemProvider(object: url as NSURL) }
        .help(url.isFileURL ? url.path : url.absoluteString)
        .task(id: url) {
            info = await Task.detached { FileCardInfo.read(url) }.value
            guard !info.missing, !info.page, url.isFileURL else { return }
            thumb = await FileThumbnails.shared.image(for: url, size: thumbSize)
        }
    }

    @ViewBuilder private var picture: some View {
        ZStack {
            ink.opacity(0.05)
            if let thumb {
                Image(nsImage: thumb).resizable().aspectRatio(contentMode: large ? .fit : .fill)
            } else {
                Image(systemName: info.page ? "doc.richtext" : FileCard.symbol(url))
                    .font(.system(size: large ? 30 : 17)).foregroundStyle(Theme.fileColor(url) ?? accent)
            }
        }
    }

    private var words: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(info.title.isEmpty ? FileCard.name(url) : info.title)
                .font(.system(size: 12, weight: .medium)).foregroundStyle(ink.opacity(0.9)).lineLimit(info.page ? 2 : 1).truncationMode(info.page ? .tail : .middle)
            Text(info.meta).font(.system(size: 10.5)).foregroundStyle(ink.opacity(0.5)).lineLimit(1)
        }
    }

    @ViewBuilder private var actions: some View {
        if !info.missing {
            HStack(spacing: 4) {
                let viewable = view != nil || FileViewer.canShow(url)
                pill(viewable ? "View" : "Open", symbol: viewable ? "eye" : "arrow.up.forward.app") { (view ?? { FileViewer.show(url) })() }
                if url.isFileURL {
                    pill(nil, symbol: "magnifyingglass") { NSWorkspace.shared.activateFileViewerSelecting([url]) }.help("Show in Finder")
                }
            }
        }
    }

    private func pill(_ title: String?, symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 3) {
                Image(systemName: symbol).font(.system(size: 9, weight: .semibold))
                if let title { Text(title).font(.system(size: 10.5, weight: .medium)) }
            }
            .foregroundStyle(style == .notch ? ink.opacity(0.85) : accent)
            .padding(.horizontal, title == nil ? 6 : 8).padding(.vertical, 4)
            .background((style == .notch ? ink : accent).opacity(0.12), in: Capsule())
        }
        .buttonStyle(.plain)
    }

    static func symbol(_ url: URL) -> String { url.isFileURL ? HomeView.fileIcon(url) : "globe" }

    static func name(_ url: URL) -> String { url.isFileURL ? url.lastPathComponent : (url.host ?? url.absoluteString) }
}

/// What a card says about its file, read off the main thread.
struct FileCardInfo: Equatable {
    var title = ""
    var meta = ""
    var page = false
    var missing = false

    static let empty = FileCardInfo()

    static func read(_ url: URL) -> FileCardInfo {
        guard url.isFileURL else { return FileCardInfo(title: url.host ?? url.absoluteString, meta: "link") }
        let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey, .isDirectoryKey])
        guard let values else { return FileCardInfo(meta: "not there any more", missing: true) }
        let size = values.isDirectory == true ? "folder" : values.fileSize.map { ByteCountFormatter.string(fromByteCount: Int64($0), countStyle: .file) } ?? ""
        let when = values.contentModificationDate.map { HomeView.relative($0) } ?? ""
        // A job's page (parity J1) reads as its headline.
        if url.lastPathComponent == "page.md", (values.fileSize ?? 0) <= JobPage.maxBytes,
           let text = try? String(contentsOf: url, encoding: .utf8), case .success(let page) = JobPage.parse(text), !page.headline.isEmpty {
            return FileCardInfo(title: page.headline, meta: ["page", when].filter { !$0.isEmpty }.joined(separator: " · "), page: true)
        }
        return FileCardInfo(meta: [size, when].filter { !$0.isEmpty }.joined(separator: " · "))
    }
}

/// QuickLook thumbnails, kept while the file is unchanged (path, size and date), so scrolling a long thread does not
/// ask QuickLook again.
@MainActor final class FileThumbnails {
    static let shared = FileThumbnails()
    private let cache = NSCache<NSString, NSImage>()

    init() { cache.countLimit = 300 }

    func image(for url: URL, size: CGSize) async -> NSImage? {
        let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey])
        let key = "\(url.path)|\(values?.fileSize ?? 0)|\(values?.contentModificationDate?.timeIntervalSince1970 ?? 0)|\(Int(size.width))x\(Int(size.height))" as NSString
        if let hit = cache.object(forKey: key) { return hit }
        let scale = NSScreen.main?.backingScaleFactor ?? 2
        let request = QLThumbnailGenerator.Request(fileAt: url, size: size, scale: scale, representationTypes: .all)
        guard let found = try? await QLThumbnailGenerator.shared.generateBestRepresentation(for: request) else { return nil }
        let image = found.nsImage
        cache.setObject(image, forKey: key)
        return image
    }
}

/// A job's live page as a card in the notch: its headline; a tap opens the page window.
struct PageCard: View {
    let headline: String
    var accent: Color
    let open: () -> Void

    var body: some View {
        Button(action: open) {
            HStack(spacing: 10) {
                Image(systemName: "doc.richtext").font(.system(size: 16)).foregroundStyle(accent)
                    .frame(width: 40, height: 40).background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 6))
                VStack(alignment: .leading, spacing: 2) {
                    Text(headline).font(.system(size: 12, weight: .medium)).foregroundStyle(.white.opacity(0.9)).lineLimit(2)
                    Text("page").font(.system(size: 10.5)).foregroundStyle(.white.opacity(0.5))
                }
                Spacer(minLength: 4)
                Image(systemName: "chevron.right").font(.system(size: 9, weight: .bold)).foregroundStyle(.white.opacity(0.4))
            }
            .padding(7)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.white.opacity(0.08), lineWidth: 1))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
