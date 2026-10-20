import Foundation

/// A job's downloads, from Comet's own events (`Browser.setDownloadBehavior {behavior: "default", eventsEnabled: true}`):
/// Comet keeps its own folder and its own " (1)" naming, and Dot reads the saved path. Only the job's frames count, so
/// his own downloads at the same moment are never taken for the job's. Never `allowAndName` on his Comet.
public struct DownloadWatch {
    public struct Item: Equatable, Sendable {
        public var guid: String
        public var suggested: String
        public var url: String
        public var frameId: String
        public var state: String
        public var filePath: String?
        public var receivedBytes: Int
    }

    public var frames: Set<String>
    public private(set) var items: [String: Item] = [:]

    public init(frames: Set<String> = []) { self.frames = frames }

    /// Folds one CDP event (Browser.* or Page.*). Returns the item when it changed.
    @discardableResult
    public mutating func fold(method: String, params: [String: Any]) -> Item? {
        let name = method.split(separator: ".").last.map(String.init) ?? method
        guard let guid = params["guid"] as? String else { return nil }
        if name == "downloadWillBegin" {
            let frame = params["frameId"] as? String ?? ""
            guard frames.isEmpty || frames.contains(frame) else { return nil }
            if items[guid] != nil { return nil }   // Page.* repeats the Browser.* event
            let item = Item(guid: guid, suggested: params["suggestedFilename"] as? String ?? "", url: params["url"] as? String ?? "",
                            frameId: frame, state: "inProgress", filePath: nil, receivedBytes: 0)
            items[guid] = item
            return item
        }
        if name == "downloadProgress", var item = items[guid] {
            let state = params["state"] as? String ?? item.state
            let path = params["filePath"] as? String
            let bytes = (params["receivedBytes"] as? NSNumber)?.intValue ?? item.receivedBytes
            if state == item.state, path == nil || path == item.filePath { item.receivedBytes = bytes; items[guid] = item; return nil }
            item.state = state
            if let path { item.filePath = path }
            item.receivedBytes = bytes
            items[guid] = item
            return item
        }
        return nil
    }

    public var completed: [Item] { items.values.filter { $0.state == "completed" }.sorted { $0.guid < $1.guid } }

    /// "x.pdf", then "x (1).pdf", "x (2).pdf"... never over a file that's there.
    public static func uniquePath(in dir: String, name: String, exists: (String) -> Bool = { FileManager.default.fileExists(atPath: $0) }) -> String {
        let safe = name.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
        let base = (safe as NSString).deletingPathExtension
        let ext = (safe as NSString).pathExtension
        func path(_ n: Int) -> String {
            let file = n == 0 ? safe : (ext.isEmpty ? "\(base) (\(n))" : "\(base) (\(n)).\(ext)")
            return (dir as NSString).appendingPathComponent(file)
        }
        var n = 0
        while exists(path(n)) { n += 1 }
        return path(n)
    }
}
