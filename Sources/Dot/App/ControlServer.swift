import DotKit
import Foundation

/// Dot's control socket (AG-07): `~/Dot/control.sock`, mode 0600, one JSON object per line and one
/// reply per request (DotKit's UnixSocketServer). Each request names a verb; tonight "gate"
/// (PreToolUse, from `Dot --gate`) and "post" (PostToolUse). Verbs run on the main thread and may
/// reply later (a gate waits for his card). Unlike DotIPC's notifications it answers back.
@MainActor
final class ControlServer {
    typealias Verb = (_ request: [String: Any], _ reply: @escaping ([String: Any]) -> Void) -> Void

    /// Overrides the socket path, for Dot and for `Dot --gate` (tests point both at a temp path).
    /// Agents get it in their environment, so the gate they run finds this Dot.
    static let pathVariable = "DOT_CONTROL_SOCKET"

    static func path(dotHome: URL) -> String {
        if let path = ProcessInfo.processInfo.environment[pathVariable], !path.isEmpty { return path }
        return dotHome.appendingPathComponent("control.sock").path
    }

    let path: String
    private var verbs: [String: Verb] = [:]
    private var server: UnixSocketServer?

    init(path: String) { self.path = path }

    var isRunning: Bool { server?.isRunning ?? false }

    func register(_ verb: String, _ handler: @escaping Verb) { verbs[verb] = handler }

    @discardableResult
    func start() -> Bool {
        guard server == nil else { return true }
        let server = UnixSocketServer(path: path, handlerQueue: .main) { [weak self] request, reply in
            MainActor.assumeIsolated {
                let verb = request["verb"] as? String ?? ""
                guard let handler = self?.verbs[verb] else { reply(["error": "unknown verb \(verb)"]); return }
                handler(request, reply)
            }
        }
        do {
            try server.start()
            self.server = server
            Log.info("control: listening at \(path) (\(verbs.keys.sorted().joined(separator: ", ")))")
            return true
        } catch {
            Log.error("control: could not listen at \(path): \(error); agents run without the gate")
            return false
        }
    }

    func stop() {
        server?.stop()
        server = nil
    }
}
