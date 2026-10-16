import DotKit
import Foundation

/// A picture strip ([IMAGES:artemis ii launch]): a few photos from Wikimedia Commons in a gallery
/// card, each linking to its page for the credit. HeyClicky's images widget comes from its
/// backend; Commons is open, keyless and well labelled, which suits a study companion.
enum Images {
    struct Item: Equatable {
        let title: String
        let thumb: URL
        let page: URL
        let width: Int
        let height: Int
        let credit: String
    }

    private static let okExtensions: Set<String> = ["jpg", "jpeg", "png", "webp", "gif"]

    static func search(_ query: String, count: Int = 6) async -> [Item] {
        var components = URLComponents(string: "https://commons.wikimedia.org/w/api.php")!
        components.queryItems = [
            URLQueryItem(name: "action", value: "query"), URLQueryItem(name: "format", value: "json"),
            URLQueryItem(name: "generator", value: "search"), URLQueryItem(name: "gsrsearch", value: query),
            URLQueryItem(name: "gsrnamespace", value: "6"), URLQueryItem(name: "gsrlimit", value: "14"),
            URLQueryItem(name: "prop", value: "imageinfo"), URLQueryItem(name: "iiprop", value: "url|size|extmetadata"),
            URLQueryItem(name: "iiurlwidth", value: "480"), URLQueryItem(name: "iiextmetadatafilter", value: "Artist|LicenseShortName"),
        ]
        guard let url = components.url else { return [] }
        var request = URLRequest(url: url)
        request.timeoutInterval = 8
        request.setValue("Dot/0.5 (https://github.com/roshanshah11/dot)", forHTTPHeaderField: "User-Agent")
        guard let (data, _) = try? await URLSession.shared.data(for: request),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let pages = (object["query"] as? [String: Any])?["pages"] as? [String: Any] else {
            Log.warn("images: no results for \"\(query)\"")
            return []
        }
        var items: [(index: Int, item: Item)] = []
        for (_, value) in pages {
            guard let page = value as? [String: Any], let info = (page["imageinfo"] as? [[String: Any]])?.first,
                  let thumbText = info["thumburl"] as? String, let thumb = URL(string: thumbText),
                  let pageText = info["descriptionurl"] as? String, let pageURL = URL(string: pageText) else { continue }
            let title = (page["title"] as? String ?? "").replacingOccurrences(of: "File:", with: "")
            guard okExtensions.contains((title as NSString).pathExtension.lowercased()) else { continue }
            let width = (info["thumbwidth"] as? Int) ?? 480, height = (info["thumbheight"] as? Int) ?? 320
            guard height >= 120 else { continue }
            let meta = info["extmetadata"] as? [String: Any]
            let artist = ((meta?["Artist"] as? [String: Any])?["value"] as? String).map(stripTags) ?? ""
            let license = ((meta?["LicenseShortName"] as? [String: Any])?["value"] as? String) ?? ""
            let credit = [artist, license].filter { !$0.isEmpty }.joined(separator: ", ")
            let index = (page["index"] as? Int) ?? 99
            items.append((index, Item(title: (title as NSString).deletingPathExtension.replacingOccurrences(of: "_", with: " "), thumb: thumb, page: pageURL, width: width, height: height, credit: credit)))
        }
        return items.sorted { $0.index < $1.index }.prefix(count).map(\.item)
    }

    private static func stripTags(_ html: String) -> String {
        html.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// The gallery strip: thumbnails that open their Commons page, the credit under each on hover.
    static func cardHTML(query: String, items: [Item]) -> String {
        func esc(_ s: String) -> String { s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;").replacingOccurrences(of: "\"", with: "&quot;") }
        var html = "<div class=\"gallery\"><div class=\"strip\">"
        for item in items {
            html += "<a class=\"pic\" href=\"\(esc(item.page.absoluteString))\" title=\"\(esc(item.title))\(item.credit.isEmpty ? "" : " (" + esc(item.credit) + ")")\"><img src=\"\(esc(item.thumb.absoluteString))\" alt=\"\(esc(item.title))\" loading=\"lazy\"><span class=\"cap\">\(esc(String(item.title.prefix(48))))</span></a>"
        }
        html += "</div><div class=\"source\">wikimedia commons: \"\(esc(query))\"; click a picture for its page and credit</div></div>"
        return html
    }

    /// Nil unless the words ask for pictures of something.
    static func parseAsk(_ text: String) -> String? { CardAsks.images(text) }
}
