import AppKit
import DotKit
import Foundation

/// `Dot --job-run --comet-port 9471 [--url U] [--placement front|behind] [--seconds 180] "<ask>"`: one real bench job,
/// headless, without the running Dot: its own control socket, its own log file (never his dot.log), the bench Comet only
/// (9222 is refused), no voice and no orb. For checking the job engine at night before an install.
enum JobHarness {
    static func run(_ arguments: [String]) -> Never {
        var rest = arguments
        var port = 0
        var url = "http://127.0.0.1:8766/index.html"
        var placementWord: String?
        var seconds: Double = 180
        // --then pause-resume | pause-drop | stop: what "he" does after the job's first action (J7, J8, J9 headless)
        var then: String?
        while let flag = rest.first, flag.hasPrefix("--") {
            rest.removeFirst()
            guard let value = rest.first else { break }
            switch flag {
            case "--comet-port": port = Int(value) ?? 0
            case "--url": url = value
            case "--placement": placementWord = value
            case "--seconds": seconds = Double(value) ?? seconds
            case "--then": then = value
            default: break
            }
            rest.removeFirst()
        }
        let ask = rest.joined(separator: " ")
        guard port > 0, port != 9222, !ask.isEmpty else {
            print("usage: Dot --job-run --comet-port <bench port, never 9222> [--url U] [--placement front|behind] [--seconds N] \"<ask>\"")
            exit(2)
        }
        let stamp: String = { let f = DateFormatter(); f.dateFormat = "yyyyMMdd-HHmmss"; return f.string(from: Date()) }()
        try? FileManager.default.createDirectory(atPath: "/tmp/dot-bench", withIntermediateDirectories: true)
        let logPath = "/tmp/dot-bench/job-run-\(stamp).log"
        setenv("DOT_LOG_FILE", logPath, 1)
        // The bench Comet starts each run clean: earlier runs' fixture tabs closed (one held by a leave dialog answers
        // nothing), and a front run's tab opened and brought forward, as his tab would be.
        func endpoint(_ path: String, method: String = "GET") -> Data? {
            guard let u = URL(string: "http://127.0.0.1:\(port)\(path)") else { return nil }
            var request = URLRequest(url: u, timeoutInterval: 3)
            request.httpMethod = method
            let done = DispatchSemaphore(value: 0)
            var out: Data?
            URLSession.shared.dataTask(with: request) { data, _, _ in out = data; done.signal() }.resume()
            _ = done.wait(timeout: .now() + 4)
            return out
        }
        if let data = endpoint("/json/list"), let tabs = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] {
            for tab in tabs where (tab["type"] as? String) == "page" && ((tab["url"] as? String) ?? "").hasPrefix("http://127.0.0.1:") {
                if let id = tab["id"] as? String { _ = endpoint("/json/close/\(id)") }
            }
        }
        if placementWord != "behind", let encoded = url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
           let data = endpoint("/json/new?\(encoded)", method: "PUT"),
           let tab = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let id = tab["id"] as? String {
            _ = endpoint("/json/activate/\(id)")
            Thread.sleep(forTimeInterval: 1.0)
        }
        let app = NSApplication.shared
        app.setActivationPolicy(.prohibited)
        let socket = "/tmp/dot-bench/control-\(ProcessInfo.processInfo.processIdentifier).sock"
        var jobs: JobManager?
        var control: ControlServer?
        MainActor.assumeIsolated {
            var config = DotConfig.load(save: false)
            config.jobSpare = false
            let manager = JobManager(config: config, overlay: nil, speaker: nil, ledger: nil)
            let server = ControlServer(path: socket)
            server.register("hands") { request, reply in manager.hands(request, reply) }
            _ = server.start()
            manager.socketPath = socket
            var context = ScreenContext()
            context.appName = "Comet"
            context.bundleIdentifier = Hands.cometBundle
            context.windowTitle = "Dot bench"
            context.url = url
            let placement = placementWord.flatMap(JobPlacement.init(rawValue:)) ?? JobPlacementRule.decide(text: ask, frontApp: "Comet").placement
            Log.info("job-run: \(placement.rawValue) on port \(port): \(ask)")
            let line = manager.start(goal: ask, placement: placement, context: context, askedAt: Date(), bench: true, benchPort: port, hisWords: ask)
            print("job-run: \(line ?? "did not start") (log \(logPath))")
            jobs = manager
            control = server
        }
        let deadline = Date().addingTimeInterval(seconds)
        var finished = false
        var stage = 0
        var pausedAt: Date?
        while Date() < deadline {
            RunLoop.main.run(until: Date().addingTimeInterval(0.2))
            let live = MainActor.assumeIsolated { jobs?.running.isEmpty == false }
            if !live { finished = true; break }
            guard let then else { continue }
            MainActor.assumeIsolated {
                guard let manager = jobs, let job = manager.running.last else { return }
                switch stage {
                case 0 where job.steps.count >= 2:
                    if then == "stop" {
                        Log.info("harness: stop after step \(job.steps.count)")
                        manager.stop(job, reason: "his stop")
                        stage = 9
                    } else {
                        Log.info("harness: his click after step \(job.steps.count)")
                        _ = manager.simulateInput(.click)
                        stage = 1
                    }
                case 1 where job.phase == .paused:
                    if pausedAt == nil { pausedAt = Date() }
                    if Date().timeIntervalSince(pausedAt!) > 1.5 {
                        if then == "pause-drop" {
                            Log.info("harness: he moved on")
                            manager.drop(job, reason: "he asked something else")
                        } else {
                            Log.info("harness: go on")
                            manager.resume(job)
                        }
                        stage = 9
                    }
                default: break
                }
            }
        }
        MainActor.assumeIsolated {
            if !finished { jobs?.stopAll(reason: "harness timeout") }
            print(jobs?.statusLine() ?? "")
            control?.stop()
        }
        RunLoop.main.run(until: Date().addingTimeInterval(1.5))
        Log.flush()
        try? FileManager.default.removeItem(atPath: socket)
        print("job-run: \(finished ? "finished" : "timed out"); log \(logPath)")
        exit(finished ? 0 : 1)
    }
}
