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
        // --then pause-resume | pause-drop | stop: what "he" does after the job's first action (J7, J8, J9 headless).
        // --then tick | click-tick | stop-wait: what he does while a login waits on the robot box (10-22): ticks it; clicks
        // first (which must not pause it), then ticks; or stops the job (which must never press log in).
        // --then page-tick | retry (parity J2, J3): he ticks the first open todo item on the job's page (live or ended),
        // and the page must show it; or he stops the job after its second step and presses Retry, which must carry on
        // in the same session and folder.
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
            JobManager.installPageGuide()
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
        var waitSeenAt: Date?
        var clickedAt: Date?
        let waitStages = ["tick", "click-tick", "stop-wait"]
        var tapped: (todo: String, item: String, version: String)?
        var stoppedSession: String?
        var retried = false
        /// The page's first todo item not yet done, by id.
        func openItem(_ page: JobPage) -> (String, String)? {
            for todo in page.objects where todo.kind == .todo {
                for row in todo.rows where !itemDone(page.markup, row.id) { return (todo.id, row.id) }
            }
            return nil
        }
        func itemDone(_ markup: String, _ item: String) -> Bool {
            markup.range(of: #"<item\b[^>]*\bid="\#(NSRegularExpression.escapedPattern(for: item))"[^>]*\bdone="true""#, options: .regularExpression) != nil
                || markup.range(of: #"<item\b[^>]*\bdone="true"[^>]*\bid="\#(NSRegularExpression.escapedPattern(for: item))""#, options: .regularExpression) != nil
        }
        func tick(_ job: JobManager.Job) {
            Log.info("harness: he ticks the robot box")
            Task { @MainActor in
                _ = await job.page.evaluate("(function(){const f=document.querySelector('iframe[title=dot-bench-robot]'); const b=f&&f.contentDocument.getElementById('tick'); if(b){b.click(); return true} return false})()")
            }
        }
        while Date() < deadline {
            RunLoop.main.run(until: Date().addingTimeInterval(0.2))
            let live = MainActor.assumeIsolated { jobs?.running.isEmpty == false }
            // A page tick or a Retry picks an ended job back up: one more turn of the loop for those.
            let more: Bool = MainActor.assumeIsolated {
                guard !live, let then, let manager = jobs, let job = manager.jobs.last else { return false }
                switch then {
                case "page-tick" where tapped == nil:
                    manager.refreshPage(job)
                    guard let page = job.livePage, let (todo, item) = openItem(page) else {
                        Log.info("harness: the job ended with no open todo item on its page (\(job.pageProblem ?? (job.livePage == nil ? "no page.md" : "all done")))")
                        return false
                    }
                    Log.info("harness: he ticks \(todo) \(item) on the ended job's page (version \(page.version))")
                    tapped = (todo, item, page.version)
                    manager.pageMessage(.pageTick(panel: "job-\(job.id)", object: todo, item: item, done: true, event: "bench-tick", version: page.version), job: job)
                    return true
                case "retry" where stoppedSession != nil && !retried:
                    retried = true
                    Log.info("harness: Retry on the stopped job (session \(stoppedSession!))")
                    manager.retry(job)
                    Log.info("harness: Retry runs in session \(job.session?.sessionId ?? "?"), \(job.session?.sessionId == stoppedSession ? "the same" : "a NEW one")")
                    return job.phase.isLive
                default:
                    return false
                }
            }
            if more { continue }
            if !live { finished = true; break }
            guard let then else { continue }
            MainActor.assumeIsolated {
                guard let manager = jobs, let job = manager.running.last else { return }
                switch stage {
                case 0 where waitStages.contains(then) && job.waitingOnHim:
                    if waitSeenAt == nil { waitSeenAt = Date() }
                    guard Date().timeIntervalSince(waitSeenAt!) > 2 else { break }
                    if then == "stop-wait" {
                        Log.info("harness: stop while the login waits on his tick")
                        manager.stop(job, reason: "his stop")
                        stage = 9
                    } else if then == "click-tick" {
                        Log.info("harness: his click while the login waits on his tick")
                        _ = manager.simulateInput(.click)
                        clickedAt = Date()
                        stage = 2
                    } else {
                        tick(job)
                        stage = 9
                    }
                case 2 where clickedAt.map({ Date().timeIntervalSince($0) > 1.5 }) == true:
                    Log.info("harness: after his click the job is \(job.phase.rawValue)")
                    tick(job)
                    stage = 9
                case 0 where then == "page-tick":
                    manager.refreshPage(job)
                    guard let page = job.livePage, let (todo, item) = openItem(page) else { break }
                    Log.info("harness: he ticks \(todo) \(item) on the live page (version \(page.version))")
                    tapped = (todo, item, page.version)
                    manager.pageMessage(.pageTick(panel: "job-\(job.id)", object: todo, item: item, done: true, event: "bench-tick", version: page.version), job: job)
                    // the same tap again (a double click) must be dropped
                    manager.pageMessage(.pageTick(panel: "job-\(job.id)", object: todo, item: item, done: true, event: "bench-tick", version: page.version), job: job)
                    stage = 9
                case 0 where then == "retry" && job.steps.count >= 2:
                    stoppedSession = job.session?.sessionId
                    Log.info("harness: stop after step \(job.steps.count) (session \(stoppedSession ?? "?"))")
                    manager.stop(job, reason: "his stop")
                    stage = 9
                case 0 where !waitStages.contains(then) && job.steps.count >= 2:
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
            if let tapped, let job = jobs?.jobs.last {
                jobs?.refreshPage(job)
                let shows = job.livePage.map { itemDone($0.markup, tapped.item) } ?? false
                Log.info("harness: after the tick the page \(shows ? "shows" : "does NOT show") \(tapped.todo) \(tapped.item) done (version \(job.livePage?.version ?? "-"))")
                print("page-tick: \(shows ? "the page shows the tick" : "the page does not show the tick")")
            }
            if retried, let job = jobs?.jobs.last {
                let same = job.session?.sessionId == stoppedSession
                print("retry: \(same ? "same session" : "NEW session") \(job.session?.sessionId ?? "?"), folder \(job.folder.path), \(job.phase.rawValue): \(job.endLine)")
            }
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
