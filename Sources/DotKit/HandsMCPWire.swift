import Foundation

/// JSON-RPC for `Dot --hands-mcp --job <id>`, the stdio MCP server a job sees as `dot`. The server answers initialize,
/// tools/list and ping itself and relays tools/call to the running Dot. 13 tools; no eval, no tab switching, no port
/// or session arguments, so a job can't leave its tab or its rules.
public enum HandsMCPWire {
    public struct Request {
        /// The id exactly as sent (a number or a string); nil for a notification, which gets no reply.
        public let id: Any?
        public let method: String
        public let params: [String: Any]
    }

    public static func parse(_ line: String) -> Request? {
        guard let data = line.data(using: .utf8), let object = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let method = object["method"] as? String else { return nil }
        let id = object["id"].flatMap { $0 is NSNull ? nil : $0 }
        return Request(id: id, method: method, params: object["params"] as? [String: Any] ?? [:])
    }

    public static let protocolVersion = "2025-06-18"

    public static func initializeResult(requestedVersion: String?) -> [String: Any] {
        ["protocolVersion": requestedVersion ?? protocolVersion,
         "capabilities": ["tools": [String: Any]()],
         "serverInfo": ["name": "dot", "version": "1"]]
    }

    static func schema(_ props: [String: [String: Any]], required: [String] = []) -> [String: Any] {
        var s: [String: Any] = ["type": "object", "properties": props, "additionalProperties": false]
        if !required.isEmpty { s["required"] = required }
        return s
    }

    static let str: [String: Any] = ["type": "string"]
    static let bool: [String: Any] = ["type": "boolean"]

    /// name, description, input schema.
    public static let tools: [(String, String, [String: Any])] = [
        ("look", "The page or window now: url, title, headings and controls with refs (e3). all: off-screen too; text: the page's words; shot: a picture of the window.",
         schema(["text": bool, "all": bool, "shot": bool])),
        ("open", "Open a url, a bookmark name (\"canvas\"), an app, a folder, a file or a spotify: uri. where: \"same\" navigates your tab, \"tab\" opens a new tab beside it. Behind jobs: the first url makes your window.",
         schema(["target": str, "where": ["type": "string", "enum": ["tab", "same"]]], required: ["target"])),
        ("click", "Click a control by ref (from the latest result) or by its label. Dot checks it first: sends, submits, buys, bookings and prints are his.",
         schema(["ref": str, "label": str])),
        ("type", "Type into a field by ref or label. replace (default true) clears it first; enter presses Enter only in a search box.",
         schema(["ref": str, "label": str, "text": str, "replace": bool, "enter": bool], required: ["text"])),
        ("select", "Pick an option in a select by ref.", schema(["ref": str, "option": str], required: ["ref", "option"])),
        ("key", "Press keys: Tab, Escape, arrows, PageDown, Enter (search boxes only), or a chord like cmd+f in an app.",
         schema(["keys": str], required: ["keys"])),
        ("scroll", "Scroll: down, up, top, bottom, or to some text on the page.", schema(["to": str], required: ["to"])),
        ("back", "Go back one page.", schema([:])),
        ("wait", "Wait up to 10 s for some text to show, or ms milliseconds, or the page to load.",
         schema(["for": str, "ms": ["type": "integer"]])),
        ("download", "Click a download link or button by ref and wait for the file; returns where it was saved (his Downloads).",
         schema(["ref": str], required: ["ref"])),
        ("upload", "Put a file into a file input by ref: only a file he named, one you made in your output folder, or one you downloaded in this job.",
         schema(["ref": str, "path": str], required: ["ref", "path"])),
        ("show", "Bring your window in front of him (what \"show me\" does).", schema([:])),
        ("play", "Play music in Spotify: kind playlist, track, album or artist, and the words to find it.",
         schema(["kind": ["type": "string", "enum": ["playlist", "track", "album", "artist"]], "words": str], required: ["words"])),
    ]

    public static var toolNames: [String] { tools.map(\.0) }

    public static func toolsList() -> [String: Any] {
        ["tools": tools.map { name, description, schema -> [String: Any] in
            ["name": name, "description": description, "inputSchema": schema, "_meta": ["anthropic/alwaysLoad": true]]
        }]
    }

    public static func callResult(text: String, isError: Bool, imageBase64: String? = nil) -> [String: Any] {
        var content: [[String: Any]] = [["type": "text", "text": text]]
        if let imageBase64 { content.append(["type": "image", "data": imageBase64, "mimeType": "image/jpeg"]) }
        return ["content": content, "isError": isError]
    }

    public static func response(id: Any, result: [String: Any]) -> String {
        line(["jsonrpc": "2.0", "id": id, "result": result])
    }

    public static func error(id: Any, code: Int, message: String) -> String {
        line(["jsonrpc": "2.0", "id": id, "error": ["code": code, "message": message]])
    }

    static func line(_ object: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.withoutEscapingSlashes]),
              let s = String(data: data, encoding: .utf8) else { return "{}" }
        return s
    }

    /// The reply to one request, or nil (a notification, or a tools/call the caller relays).
    public static func localReply(_ request: Request) -> String? {
        guard let id = request.id else { return nil }
        switch request.method {
        case "initialize": return response(id: id, result: initializeResult(requestedVersion: request.params["protocolVersion"] as? String))
        case "tools/list": return response(id: id, result: toolsList())
        case "ping": return response(id: id, result: [:])
        case "tools/call": return nil
        default: return error(id: id, code: -32601, message: "method not found: \(request.method)")
        }
    }
}
