import AppKit
import DotKit
import Foundation

/// A job's live page, his taps on it, Retry and the how-tos (parity J1-J5). Jobs.swift owns the sessions; this file
/// owns what he sees of a job besides its chip.
extension JobManager {
    // MARK: The page (J1)

    /// Reads page.md for every live job and every job whose page window is open, twice a second; stops itself when
    /// there is nothing to watch. A stat per job per tick: a rename by the job's editor lands like any write.
    func watchPages() {
        guard pageTimer == nil else { return }
        pageTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.pageTick() }
        }
    }

    private func pageTick() {
        let watched = jobs.filter { $0.phase.isLive || ($0.pageWindow?.isOpen ?? false) }
        if watched.isEmpty { pageTimer?.invalidate(); pageTimer = nil; return }
        watched.forEach { refreshPage($0) }
    }

    /// page.md in the job's folder (the [job] message names it); one saved in output/ by habit is read too.
    func pageFile(_ job: Job) -> URL {
        let page = job.folder.appendingPathComponent("page.md")
        let saved = job.folder.appendingPathComponent("output/page.md")
        return !FileManager.default.fileExists(atPath: page.path) && FileManager.default.fileExists(atPath: saved.path) ? saved : page
    }

    /// Read page.md if it changed: the window shows the new version, the chip its run line or headline, and a page Dot
    /// can't show goes back to the job once per problem.
    func refreshPage(_ job: Job) {
        let url = pageFile(job)
        guard let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
              let modified = attributes[.modificationDate] as? Date, let size = (attributes[.size] as? NSNumber)?.intValue else { return }
        if let stamp = job.pageStamp, stamp.0 == modified, stamp.1 == size { return }
        job.pageStamp = (modified, size)
        let parsed: Result<JobPage, JobPage.Problem>
        if size > JobPage.maxBytes { parsed = .failure(.tooBig(size)) }
        else if let text = try? String(contentsOf: url, encoding: .utf8) { parsed = JobPage.parse(text) }
        else { return }
        switch parsed {
        case .success(let page):
            guard page.version != job.livePage?.version else { return }
            let first = job.livePage == nil
            let lettersChanged = job.livePage?.objects.filter { $0.kind == .letter } != page.objects.filter { $0.kind == .letter }
            job.livePage = page
            job.pageProblem = nil
            if first { Log.info("job[\(job.id)] page: \(page.objects.count) controls, \"\(Log.short(page.headline, 80))\"") }
            job.pageWindow?.update(markup: page.markup, title: pageTitle(job), version: page.version)
            if lettersChanged { fillLetters(job) }
            publish(job)
        case .failure(let problem):
            guard job.pageProblem != problem.description else { return }
            job.pageProblem = problem.description
            Log.warn("job[\(job.id)] page refused: \(problem)")
            if job.phase.isLive { job.session?.send(text: "[dot] page.md can't be shown: \(problem). fix it (each control's id once; keep it under \(JobPage.maxBytes / 1024) KB).") }
        }
    }

    func pageTitle(_ job: Job) -> String {
        Log.short(job.hisWords.components(separatedBy: .newlines).first ?? job.goal, 60)
    }

    /// The chip's Page button: the job's page in its own window (made once, kept until the job is forgotten).
    func openPage(_ job: Job) {
        job.pageStamp = nil
        refreshPage(job)
        guard let page = job.livePage else {
            Log.info("job[\(job.id)] page: none yet")
            overlay?.greet(job.pageProblem.map { "its page can't be shown: \($0)" } ?? "no page yet.", for: 3)
            return
        }
        if job.pageWindow == nil {
            guard let window = JobPageWindow(jobID: job.id, accentHex: config.pointerColorHex) else { Log.warn("job[\(job.id)] page: no panel renderer found"); return }
            window.onMessage = { [weak self, weak job] message in
                guard let self, let job else { return }
                self.pageMessage(message, job: job)
            }
            job.pageWindow = window
        }
        job.pageWindow?.show(markup: page.markup, title: pageTitle(job), version: page.version)
        fillLetters(job)
        watchPages()
        Log.info("job[\(job.id)] page window open")
    }

    // MARK: His taps (J2)

    /// A tap from the job's page. Checked against the page as it is now (an object he tapped must still be there),
    /// deduped per page version, and only then a `[page]` line in the job's own session; a letter's Send goes through
    /// its proposal card, never through the job.
    func pageMessage(_ message: PanelMessage, job: Job) {
        let tap: (event: String, version: String)
        switch message {
        case .pageTick(_, _, _, _, let e, let v), .pageForm(_, _, _, let e, let v), .pageReview(_, _, _, let e, let v), .pageLetter(_, _, _, _, let e, let v):
            tap = (e, v)
        default:
            Log.info("job[\(job.id)] page: \(message) (not a page control)")
            return
        }
        guard let page = job.livePage else { return }
        guard job.pageTaps.admit(event: tap.event, version: tap.version) else { Log.info("job[\(job.id)] page tap \(tap.event) again; dropped"); return }
        if case .pageLetter(_, let object, let proposal, let send, _, _) = message {
            letterTap(job, page: page, object: object, proposal: proposal, send: send)
            return
        }
        guard let line = PageTurn.message(message, page: page) else {
            Log.warn("job[\(job.id)] page tap names nothing on the page: \(Log.short("\(message)", 160))")
            return
        }
        deliver(line, to: job)
    }

    /// A line from his page into the job: a live job reads it now (a paused one carries on, since the page is his own
    /// answer); an ended job picks its own session back up with it.
    func deliver(_ line: String, to job: Job) {
        Log.info("job[\(job.id)] page tap -> session \(job.session?.sessionId ?? "?"): \(Log.short(line, 140))")
        if job.phase == .paused { resume(job, why: "he answered on the job's page") }
        if job.phase.isLive { job.session?.send(text: line); return }
        // a tap on a failed or stopped job is his ask to go on: it carries the retry note too (J3)
        let text = (job.phase == .failed || job.phase == .stopped) ? JobRetry.message + "\n" + line : line
        resumeJob(job, with: text)
    }

    /// His Send or Edit on a `<letter>`: the proposal must be this job's own and still pending. Send shows the same
    /// card (exact recipients and words) and only its Allow sends; Edit withdraws it and asks the job for a new draft.
    private func letterTap(_ job: Job, page: JobPage, object: String, proposal: String, send: Bool) {
        guard let o = page.object(object), o.kind == .letter, o.attributes["proposal"] == proposal, proposal.count >= 8 else {
            Log.warn("job[\(job.id)] letter tap: \(object) with proposal \(proposal) isn't on the page; dropped")
            return
        }
        let session = JobConfigFile.sendSession(jobId: job.id, stamp: job.stamp)
        runApprove(["list", "--session", session]) { [weak self, weak job] code, json in
            guard let self, let job else { return }
            let cards = (code == 0 ? (json as? [[String: Any]]) ?? [] : []).compactMap(ProposalCard.init(json:))
            let matches = cards.filter { $0.proposal.hasPrefix(proposal) }
            guard matches.count == 1, let card = matches.first else {
                Log.warn("job[\(job.id)] letter \(object): proposal \(proposal) is not pending for this job (\(matches.count) matches, list \(code))")
                job.letterStates[proposal] = job.letterStates[proposal] ?? "expired"
                self.fillLetters(job)
                return
            }
            if send {
                Log.info("job[\(job.id)] letter \(object): Send on \(proposal); its card shows")
                self.present(card, job: job, session: session)
                return
            }
            self.runApprove(["deny", "--session", session, "--proposal", card.proposal, "--digest", card.digest]) { code, _ in
                Log.info("job[\(job.id)] letter \(object): Edit on \(proposal); withdrawn (\(code))")
                job.letterStates[card.proposal] = "withdrawn"
                self.fillLetters(job)
                let tap = PanelMessage.pageLetter(panel: "job-\(job.id)", object: object, proposal: proposal, send: false, event: "", version: page.version)
                if let line = PageTurn.message(tap, page: page) { self.deliver(line, to: job) }
            }
        }
    }

    /// Every `<letter>` on the open page gets its words from the proposal store (never from page.md) and its state.
    func fillLetters(_ job: Job) {
        guard let window = job.pageWindow, let page = job.livePage else { return }
        let letters = page.objects.filter { $0.kind == .letter }
        guard !letters.isEmpty else { return }
        let session = JobConfigFile.sendSession(jobId: job.id, stamp: job.stamp)
        runApprove(["list", "--session", session]) { [weak job] code, json in
            guard let job else { return }
            let pending = (code == 0 ? (json as? [[String: Any]]) ?? [] : []).compactMap(ProposalCard.init(json:))
            for card in pending { job.letterWords[card.proposal] = card }
            for letter in letters {
                guard let pid = letter.attributes["proposal"], pid.count >= 8 else {
                    window.letter(letter.id, to: "", subject: "", body: "", state: "unknown"); continue
                }
                let known = job.letterWords.filter { $0.key.hasPrefix(pid) }
                guard known.count == 1, let (full, card) = known.first else {
                    window.letter(letter.id, to: "", subject: "", body: "", state: job.letterStates[pid] ?? "unknown"); continue
                }
                let state = job.letterStates[full] ?? (pending.contains { $0.proposal == full } ? "pending" : "expired")
                window.letter(letter.id, to: card.people, subject: card.subject, body: card.body, state: state)
            }
        }
    }

    // MARK: Retry and picking a job back up (J3)

    /// An ended job carries on in its own session and folder with `text` (Retry, a tap on its page, Continue); a live
    /// one just reads it.
    func resumeJob(_ job: Job, with text: String) {
        if job.phase.isLive { job.session?.send(text: text); return }
        guard let old = job.session else { continueJob(job, with: text); return }
        let sessionId = old.sessionId
        let port = job.page.port
        guard let made = makeSession(model: job.model, bench: job.bench, benchPort: job.bench ? port : nil,
                                     resume: (job.id, job.stamp, job.folder, sessionId)) else {
            say("i couldn't pick that job back up.", job: job, start: false, short: true)
            return
        }
        job.session = made.session
        let page = PageDriver(port: port, bench: job.bench)
        page.log = { line in Log.info("job[\(job.id)] \(line)") }
        job.page = page
        job.phase = .running
        job.endedAt = nil
        job.endLine = ""
        job.rung = nil
        job.repeatNudged = false
        job.pendingDone = nil
        job.lastEventAt = Date()
        if !jobs.contains(where: { $0 === job }) { adopt(job) }
        Log.info("job[\(job.id)] picked up again in session \(sessionId): \(Log.short(text, 100))")
        made.session.send(text: text)
        watchPages()
        publish(job)
    }

    /// Retry on the chip, the window or Home: the same session, told to keep what is done.
    func retry(_ job: Job) {
        guard JobRetry.canRetry(job.phase, endLine: job.endLine) else { Log.info("job[\(job.id)] retry: nothing to retry (\(job.phase))"); return }
        say("picking it back up.", job: job, start: false, short: true)
        resumeJob(job, with: JobRetry.message)
    }

    // MARK: How-tos (J4)

    static var howtoRoot: URL { URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Dot/howtos", isDirectory: true) }

    private func howtoFolder(bench: Bool) -> URL {
        bench ? URL(fileURLWithPath: "/tmp/dot-bench/howtos", isDirectory: true) : Self.howtoRoot
    }

    private func howtos(_ key: String, bench: Bool) -> [HowTo] {
        let file = howtoFolder(bench: bench).appendingPathComponent("\(key).md")
        return (try? String(contentsOf: file, encoding: .utf8)).map(HowToBook.parse) ?? []
    }

    private func writeHowtos(_ key: String, _ entries: [HowTo], bench: Bool) {
        let folder = howtoFolder(bench: bench)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let file = folder.appendingPathComponent("\(key).md")
        do { try HowToBook.render(key: key, entries).write(to: file, atomically: true, encoding: .utf8) }
        catch { Log.warn("howto: couldn't write \(file.path): \(error.localizedDescription)") }
    }

    /// The how-tos a new job's words, page or app point at, as the lines its first message gets.
    func howtoBrief(words: String, url: String?, app: String?, bench: Bool = false) -> (String, [(key: String, task: String)])? {
        let folder = howtoFolder(bench: bench)
        guard let files = try? FileManager.default.contentsOfDirectory(atPath: folder.path) else { return nil }
        let known = files.filter { $0.hasSuffix(".md") }.map { String($0.dropLast(3)) }
        let keys = HowToBook.keys(for: words, url: url, app: app, among: known)
        let book = keys.compactMap { k -> (key: String, entries: [HowTo])? in
            let live = HowToBook.live(howtos(k, bench: bench))
            return live.isEmpty ? nil : (k, live)
        }
        guard let brief = HowToBook.brief(book) else { return nil }
        let given = book.flatMap { k, entries in entries.prefix(5).map { (key: k, task: $0.task) } }
        Log.info("job: how-tos from \(book.map(\.key).joined(separator: ", ")) (\(given.count))")
        return (brief, given)
    }

    /// The job failed or was stopped: each how-to it was given counts a failure (two and it is no longer handed out).
    func howtosFailed(_ job: Job) {
        for (key, given) in Dictionary(grouping: job.howtos, by: \.key) {
            let entries = howtos(key, bench: job.bench)
            writeHowtos(key, HowToBook.failed(Set(given.map(\.task)), in: entries), bench: job.bench)
        }
        Log.info("job[\(job.id)] how-tos counted a failure: \(job.howtos.map { "\($0.key): \($0.task)" }.joined(separator: "; "))")
    }

    /// The howto_save tool.
    func howtoSave(_ job: Job, args: [String: Any]) -> (String, Bool, String?) {
        let site = (args["site"] as? String) ?? "", task = (args["task"] as? String) ?? "", steps = (args["steps"] as? String) ?? ""
        guard let key = HowToBook.key(site: site) else { return ("error: which site or app? (a host like wyzant.com, or the app's name)", true, nil) }
        let entries = howtos(key, bench: job.bench)
        let saved = HowToBook.saving(HowTo(task: task, steps: steps, saved: Date(), job: job.id), into: entries)
        guard saved != entries else { return ("error: a how-to needs a task and its steps", true, nil) }
        writeHowtos(key, saved, bench: job.bench)
        Log.info("job[\(job.id)] how-to saved for \(key): \(Log.short(task, 60))")
        return ("saved: the next job on \(key) starts with it", false, nil)
    }

    // MARK: One step on his screen (J5)

    static let frontStepSeconds: TimeInterval = 120

    /// ask_front_step: a card asks him; on his yes the job's look, click, type and key act in that app for two minutes.
    /// The call waits for his answer (up to five minutes, then it is a no).
    func askFrontStep(_ job: Job, what: String, app: String?) async -> (String, Bool, String?) {
        guard !what.isEmpty else { return ("error: say what the step is", true, nil) }
        if job.bench { return ("bench: he would be asked \"\(what)\"; carry on without it", false, nil) }
        guard let presentCard else { return ("error: dot can't ask him right now; end with blocked: and name the step", true, nil) }
        let answer: Bool = await withCheckedContinuation { continuation in
            var answered = false
            func finish(_ yes: Bool) {
                guard !answered else { return }
                answered = true
                continuation.resume(returning: yes)
            }
            let card = ConsentCard(agentId: "job-\(job.id)", agent: "dot", title: "one step on your screen",
                                   detail: what + (app.map { "\n(in \($0))" } ?? ""), guarded: false,
                                   onAllow: { finish(true) }, onDeny: { finish(false) })
            Log.info("job[\(job.id)] asks for a step on his screen: \(Log.short(what, 100))")
            presentCard(card)
            DispatchQueue.main.asyncAfter(deadline: .now() + 300) { finish(false) }
        }
        guard answer else { return ("he said no (or didn't answer): don't do that step; carry on without it or end with blocked: and name it", false, nil) }
        let me = Bundle.main.bundleIdentifier
        var target = NSWorkspace.shared.frontmostApplication.flatMap { $0.bundleIdentifier == me ? nil : $0 }
        if let app, let named = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName?.localizedCaseInsensitiveCompare(app) == .orderedSame }) {
            named.activate()
            target = named
        }
        guard let target, let bundle = target.bundleIdentifier else { return ("error: no app is in front to do it in", true, nil) }
        job.frontStep = (bundle, target.localizedName ?? bundle, Date().addingTimeInterval(Self.frontStepSeconds))
        Log.info("job[\(job.id)] front step in \(bundle) for \(Int(Self.frontStepSeconds)) s")
        return ("he said yes. \(target.localizedName ?? "the app") is in front: look, then do that one step with click, type or key. after two minutes your tools are your own window's again.", false, nil)
    }
}
