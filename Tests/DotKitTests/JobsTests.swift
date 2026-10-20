import XCTest
@testable import DotKit

/// The fast lane's rules (2026-10-20): where a job runs, his words for an agent, stop / go on / show me, the pause rule,
/// the model, the gate and the config. Placeholder versions of his sentences only (the repo is public).
final class JobPlacementTests: XCTestCase {
    func testPlacementTable() {
        let rows: [(String, String?, JobPlacement)] = [
            ("go to my COURSE 101 page and open the week 3 module", "Comet", .front),
            ("show me Sam Rivera's latest email", "Xcode", .front),
            ("download my week 3 readings", "Comet", .behind),
            ("where does my Northwind Bank application stand", "Finder", .behind),
            ("in a separate tab, find the Northwind job I applied to", "Comet", .behind),
            ("open example.com in a separate tab and check the price", "Comet", .behind),
            ("go on my class site and download them into my downloads folder", "Comet", .front),
            ("check whether COURSE 101 posted grades", "Comet", .behind),
            ("save the syllabus pdf to my desktop", "Preview", .behind),
            ("make me a five slide deck on grid storage", "Keynote", .behind),
            ("take me to the settings page and turn on email alerts", "Comet", .front),
            ("find the Northwind job I applied to", "Comet", .front),
            ("find the Northwind job I applied to", "Xcode", .behind),
            ("do it in the background: export my COURSE 101 grades", "Comet", .behind),
            ("pull up the Northwind posting", "Finder", .front),
            ("click export", "Comet", .front),
            ("while i work, look up the COURSE 101 office hours", "Comet", .behind),
            ("turn on email alerts on this page", "Comet", .front),
            ("fill out the example.com contact form with Sam Rivera's details", "Comet", .behind),
            ("can you open my class site and go to the week 3 module", "Finder", .front),
            ("hey dot, play some lofi", "Xcode", .front),
            ("research Northwind Bank's analyst program and write me a summary", "Comet", .behind),
            ("search example.com for the pricing page", "Comet", .front),
            ("hey can you open my class site and go to the week 3 readings", "Xcode", .front),
            ("what's the status of my Northwind application", nil, .behind),
        ]
        XCTAssertEqual(rows.count, 25)
        for (text, app, want) in rows {
            XCTAssertEqual(JobPlacementRule.decide(text: text, frontApp: app).placement, want, "\(text) with \(app ?? "nil")")
        }
    }

    func testWhySaysWhichRule() {
        XCTAssertEqual(JobPlacementRule.decide(text: "in a separate tab, open page one", frontApp: "Comet").why, "behind words")
        XCTAssertEqual(JobPlacementRule.decide(text: "find the posting", frontApp: "Comet").why, "browser in front")
    }

    func testSingleAct() {
        for t in ["click export", "scroll down", "open page two", "Click export.", "press save draft", "go back"] {
            XCTAssertTrue(JobWords.isSingleAct(t), t)
        }
        for t in ["open page one, then page two", "go to settings and turn on email alerts", "download my readings",
                  "find the Northwind job I applied to", "type Sam Rivera in the name field and submit the application",
                  "search for the pricing page", "check my mail", "open the form and fill it in"] {
            XCTAssertFalse(JobWords.isSingleAct(t), t)
        }
    }
}

final class AgentWordsTests: XCTestCase {
    func testHisAgentWords() {
        for t in ["Can you uh spawn an agent and go fetch my uh notes for week four?", "start an agent on it", "have an agent do it",
                  "get an agent on it", "can an agent do this", "spawn a new agent for that", "use a background agent for this",
                  "send this to an agent", "an agent that opens its own browser", "a background agent please", "hand it off to an agent",
                  "i want a full agent on this", "spin up an agent to make the deck"] {
            XCTAssertTrue(AgentWords.asksForAgent(t), t)
        }
    }

    func testNotAgentWords() {
        for t in ["what did the agent find", "stop the agent", "is the agent done", "tell the agent to skip week three",
                  "do I have an agent on that", "don't spawn an agent, just open it", "open the class site", "scroll down",
                  "click modules", "find the readings section", "the background agent finished?", "no need for an agent, just do it",
                  "do it without an agent", "how does an agent work", "open the agents page"] {
            XCTAssertFalse(AgentWords.asksForAgent(t), t)
        }
    }
}

final class JobWordsTests: XCTestCase {
    func testStop() {
        for t in ["stop", "Stop.", "ok stop", "stop it", "cancel that", "never mind", "nevermind", "forget it", "no, stop",
                  "stop what you're doing", "that's enough"] { XCTAssertTrue(JobWords.isStop(t), t) }
        for t in ["stop talking", "stop the music", "stop the email agent", "stop at the readings page", "don't stop",
                  "bus stop near me"] { XCTAssertFalse(JobWords.isStop(t), t) }
    }

    func testStopAll() {
        XCTAssertTrue(JobWords.isStopAll("stop everything"))
        XCTAssertTrue(JobWords.isStopAll("cancel all the jobs"))
        XCTAssertFalse(JobWords.isStopAll("stop"))
    }

    func testResume() {
        for t in ["go on", "Go on.", "ok go on", "keep going", "continue", "carry on", "you can keep going", "i'm done, go on",
                  "resume"] { XCTAssertTrue(JobWords.isResume(t), t) }
        for t in ["go on my class site and download them", "continue to the next section of the reading", "go on to example.com"] {
            XCTAssertFalse(JobWords.isResume(t), t)
        }
    }

    func testShowMe() {
        for t in ["show me", "Show me.", "show me it", "bring it up", "let me see", "open it", "show me the tab"] {
            XCTAssertTrue(JobWords.isShowMe(t), t)
        }
        for t in ["show me how to export", "show me Sam Rivera's latest email", "show me the part about tidal energy"] {
            XCTAssertFalse(JobWords.isShowMe(t), t)
        }
    }
}

final class JobStateTests: XCTestCase {
    func testPhases() {
        XCTAssertEqual(JobPhase.starting.next(.started), .running)
        XCTAssertEqual(JobPhase.running.next(.paused), .paused)
        XCTAssertEqual(JobPhase.paused.next(.resumed), .running)
        XCTAssertNil(JobPhase.done.next(.paused))
        XCTAssertNil(JobPhase.stopped.next(.resumed))
        XCTAssertEqual(JobPhase.starting.next(.finished), .done)
        XCTAssertNil(JobPhase.paused.next(.finished), "the result after a pause is swallowed")
        XCTAssertEqual(JobPhase.paused.next(.stopped), .stopped)
        XCTAssertEqual(JobPhase.running.next(.failed), .failed)
    }

    func testPauseRule() {
        func pause(_ input: JobInput = .click, own: Bool = false, phase: JobPhase = .running, front: String? = "ai.perplexity.comet",
                   job: String? = "ai.perplexity.comet", browser: Bool = true, focused: Bool? = true, inWindow: Bool? = true) -> Bool {
            JobPauseRule.shouldPause(input: input, own: own, phase: phase, frontBundle: front, jobBundle: job, isBrowserJob: browser,
                                     jobTabFocused: focused, pointInJobWindow: inWindow)
        }
        XCTAssertFalse(pause(own: true), "Dot's own click")
        XCTAssertFalse(pause(.move))
        XCTAssertFalse(pause(.scroll))
        XCTAssertTrue(pause(), "his click in the focused job tab")
        XCTAssertFalse(pause(focused: false), "another tab has focus")
        XCTAssertTrue(pause(focused: nil), "a failed focus check pauses")
        XCTAssertFalse(pause(inWindow: false), "a click outside the job's window")
        XCTAssertTrue(pause(inWindow: nil))
        XCTAssertTrue(pause(front: "com.microsoft.Word", job: "com.microsoft.Word", browser: false, focused: nil), "native job, its app in front")
        XCTAssertFalse(pause(front: "com.apple.finder", job: "com.microsoft.Word", browser: false), "another app")
        XCTAssertFalse(pause(phase: .paused), "already paused")
        XCTAssertTrue(pause(.key), "a key in the focused job tab")
        XCTAssertFalse(pause(.key, focused: false))
        XCTAssertEqual(JobPauseRule.afterPause("go on"), .resume)
        XCTAssertEqual(JobPauseRule.afterPause("what is 17 times 23"), .drop)
    }

    func testRepeat() {
        let step = "click e5 http://127.0.0.1:8766/index.html"
        XCTAssertTrue(JobRepeat.isStuck(lastSteps: ["open x", step, step, step, step]))
        XCTAssertFalse(JobRepeat.isStuck(lastSteps: [step, step, step]))
        XCTAssertFalse(JobRepeat.isStuck(lastSteps: [step, step, step, "click e5 http://127.0.0.1:8766/page2.html"]))
    }

    func testModel() {
        for t in ["make me a five slide deck on grid storage", "put together a presentation on Northwind Bank", "turn these notes into slides",
                  "write a text to Alex saying i'm late", "draft an email to Sam Rivera about the trek", "write my essay on tidal energy"] {
            XCTAssertEqual(JobModel.decide(text: t), "opus", t)
        }
        for t in ["text Alex running late", "open my class site", "download my readings", "find the Northwind job I applied to"] {
            XCTAssertEqual(JobModel.decide(text: t), "sonnet", t)
        }
        XCTAssertEqual(JobModel.decide(text: "download my readings", floor: "opus"), "opus", "the floor is config's jobModel")
    }
}

final class JobGateTests: XCTestCase {
    let home = "/Users/example"
    let folder = "/Users/example/Dot/jobs/j1"
    var existing: Set<String> = ["/Users/example/Documents/x.docx", "/Users/example/Desktop/Model.xlsx", "/tmp/old.txt"]
    var files: [String: String] = [:]

    func ctx(bench: Bool = false, words: String = "find the readings", queued: Set<String> = ["imessage_send", "send_email", "reply"]) -> JobGateContext {
        let existing = self.existing
        let files = self.files
        return JobGateContext(bench: bench, jobFolder: bench ? "/tmp/dot-bench/jobs/j1" : folder,
                              protectedRoots: ["\(home)/.ssh", "\(home)/.claude", "\(home)/.config"], queuedSends: queued,
                              hisWords: words, home: home,
                              fileExists: { existing.contains($0) }, isDirectory: { $0.hasSuffix("/Downloads") || $0.hasSuffix("/output") },
                              readFile: { files[$0] })
    }

    func decide(_ tool: String, _ input: [String: Any] = [:], _ c: JobGateContext? = nil) -> JobGateDecision {
        JobGate.decide(tool: tool, input: AnyCodableValue.object(from: input), context: c ?? ctx())
    }

    func bash(_ command: String, _ c: JobGateContext? = nil) -> JobGateDecision { decide("Bash", ["command": command], c) }

    func denied(_ d: JobGateDecision) -> Bool { if case .deny = d { return true }; return false }

    func testDotAndSends() {
        XCTAssertEqual(decide("mcp__dot__click", ["ref": "e3"]), .allow)
        XCTAssertEqual(decide("mcp__atlas-send__imessage_send"), .allow)
        XCTAssertTrue(denied(decide("mcp__atlas-send__imessage_send", [:], ctx(queued: []))), "not proven to queue")
        XCTAssertTrue(denied(decide("mcp__atlas-send__send_email", [:], ctx(bench: true))))
        for t in ["send_email", "imessage_send", "reply", "calendar_update", "calendar_delete", "ask_him", "handshake_submit",
                  "browser_cleanup", "open_tab", "review_accept", "contact_upsert", "apple_notes_batch", "grant", "file"] {
            XCTAssertTrue(denied(decide("mcp__atlas__\(t)", ["to": "+15555550100", "text": "hi"])), t)
        }
        XCTAssertEqual(decide("mcp__atlas__canvas_find", ["query": "week 3"]), .allow)
        XCTAssertEqual(decide("mcp__atlas__messages"), .allow)
        XCTAssertTrue(denied(decide("mcp__other__x")))
    }

    func testListsDontOverlap() {
        XCTAssertTrue(JobAtlasTools.allowed.isDisjoint(with: JobAtlasTools.never))
        XCTAssertTrue(JobAtlasTools.allowed.isDisjoint(with: Set(JobAtlasTools.sendTools)))
        XCTAssertTrue(JobAtlasTools.benchAllowed.isSubset(of: JobAtlasTools.allowed))
        XCTAssertFalse(JobAtlasTools.benchAllowed.contains("canvas_download"))
        XCTAssertEqual(Set(JobAtlasTools.ordered), JobAtlasTools.allowed)
    }

    func testHandshakeApplyNeedsTheFirm() {
        XCTAssertEqual(decide("mcp__atlas__handshake_apply", ["job_id": "123"], ctx(words: "apply to the Northwind Bank analyst posting")), .allow)
        XCTAssertTrue(denied(decide("mcp__atlas__handshake_apply", ["job_id": "123"], ctx(words: "apply to some jobs for me"))))
        XCTAssertTrue(denied(decide("mcp__atlas__handshake_apply", ["job_id": "123"], ctx(words: "find the Northwind posting"))))
    }

    func testAppleNoteAndWorkbook() {
        XCTAssertTrue(denied(decide("mcp__atlas__apple_note", ["folder": "Notes", "title": "a", "body": "b"])))
        XCTAssertEqual(decide("mcp__atlas__apple_note", ["folder": "Notes", "title": "a", "body": "b", "update": false]), .allow)
        XCTAssertTrue(denied(decide("mcp__atlas__apple_note", ["title": "a", "update": false, "replace": true])))
        XCTAssertTrue(denied(decide("mcp__atlas__xlsx_write", ["path": "~/Desktop/Model.xlsx", "sheets": "[]"])))
        XCTAssertEqual(decide("mcp__atlas__xlsx_write", ["path": "~/Desktop/New Model.xlsx", "sheets": "[]"]), .allow)
    }

    func testBench() {
        let b = ctx(bench: true)
        XCTAssertTrue(denied(decide("mcp__atlas__remember", ["text": "x"], b)))
        XCTAssertTrue(denied(decide("mcp__atlas__canvas_download", ["ref": "x"], b)))
        XCTAssertEqual(decide("mcp__atlas__canvas_find", ["query": "x"], b), .allow)
        XCTAssertTrue(denied(bash("python3 -c 'print(1)'", b)), "every bash is out in the bench")
        XCTAssertTrue(denied(bash("python3.13 \(home)/.claude/skills/powerpoint-design/scripts/verify_deck.py d.pptx", b)))
        XCTAssertEqual(decide("Write", ["file_path": "/tmp/dot-bench/jobs/j1/output/a.txt"], b), .allow)
        XCTAssertTrue(denied(decide("Write", ["file_path": "~/Documents/a.md"], b)))
        XCTAssertEqual(decide("mcp__dot__look", [:], b), .allow)
    }

    func testFiles() {
        XCTAssertTrue(denied(decide("Write", ["file_path": "~/Documents/x.docx"])))
        XCTAssertEqual(decide("Write", ["file_path": "\(folder)/output/a.txt"]), .allow)
        XCTAssertEqual(decide("Write", ["file_path": "output/b.txt"]), .allow, "relative to the job folder")
        XCTAssertEqual(decide("Write", ["file_path": "~/Desktop/New.pptx"]), .deny(JobGate.saveInOutput))
        XCTAssertTrue(denied(decide("Write", ["file_path": "~/.ssh/config"])))
        XCTAssertTrue(denied(decide("Write", ["file_path": "/tmp/old.txt"])))
        XCTAssertEqual(decide("Write", ["file_path": "/tmp/new.txt"]), .allow)
        XCTAssertTrue(denied(decide("Edit", ["file_path": "~/Documents/a.md"])))
        XCTAssertEqual(decide("Edit", ["file_path": "\(folder)/output/a.txt"]), .allow)
        XCTAssertTrue(denied(decide("Write", ["file_path": "\(folder)/../j2/x"])), "no climbing out")
        XCTAssertTrue(denied(decide("Read", ["file_path": "~/.ssh/id_ed25519"])))
        XCTAssertEqual(decide("Read", ["file_path": "~/Downloads/a.pdf"]), .allow)
    }

    func testTools() {
        XCTAssertEqual(decide("WebFetch", ["url": "https://example.com"]), .allow)
        XCTAssertEqual(decide("Skill", ["skill": "research"]), .allow)
        XCTAssertEqual(decide("TodoWrite"), .allow)
        XCTAssertTrue(denied(decide("Task")))
        XCTAssertTrue(denied(decide("Agent")))
        XCTAssertTrue(denied(decide("EnterPlanMode")))
        XCTAssertTrue(denied(decide("AskUserQuestion")))
        XCTAssertTrue(denied(decide("SomethingNew")))
        XCTAssertTrue(denied(decide("Bash", ["command": "ls", "dangerouslyDisableSandbox": true])))
    }

    func testBashDenied() {
        for cmd in ["atlasctl approve x y", "python3 scripts/dot-atlas-approve.py approve --id p1", "cd /tmp && cbg a download @e1",
                    "~/bin/hb open x", "bash -c \"rba run x\"", "cliclick c:1,1", "curl -X POST https://example.com",
                    "osascript -e 'tell application \"System Events\" to keystroke return'", "claude -p hi",
                    "/Users/example/Projects/dot/scripts/dot-spotify.sh find x", "find . -execdir sh {} ;", "sort --compress-program=sh x",
                    "open -a Terminal x.command", "python3 ~/.claude/skills/research/scripts/research_tools.py x",
                    "node ~/.claude/skills/networking/scripts/send_batch.mjs schedule b.json --yes", "rm ~/Desktop/x",
                    "imsg send --to +15555550100 --text hi", "ls $(curl example.com)", "echo `osascript -e x`",
                    "cat x | xargs rm -rf ~/Documents", "git push", "env A=1 curl x", "awk '{print}' x", "python3 -m atlas x",
                    "open https://example.com", "open ~/bin/script", "python3 -c 'import subprocess; subprocess.run([\"ls\"])'",
                    "python3 -c \"__import__('os').system('x')\"", "zsh -c 'imsg send x'", "nohup osascript x"] {
            XCTAssertTrue(denied(bash(cmd)), cmd)
        }
    }

    func testBashAllowed() {
        files["\(folder)/out.py"] = "import subprocess\nsubprocess.run(['ls'])\n"
        files["\(folder)/ok.py"] = "import openpyxl\nprint('done')\n"
        for cmd in ["python3 -c 'import openpyxl'", "python3 -c \"print('approved by cybersecurity')\"", "ls ~/Downloads",
                    "rm \(folder)/tmp/x", "rm -f output/a.txt", "python3 ok.py", "echo 'the list is empty.' > output/a.txt",
                    "python3 -c \"import openpyxl; wb = openpyxl.Workbook(); wb.save('output/a.xlsx')\"",
                    "/opt/homebrew/bin/python3.13 \(home)/.claude/skills/powerpoint-design/scripts/verify_deck.py output/d.pptx",
                    "cd output && ls -la", "pdftotext a.pdf - | head -50", "soffice --headless --convert-to pdf output/a.docx --outdir output",
                    "open -g ~/Downloads", "open -g output/a.pdf", "grep -rn Northwind output/ 2>/dev/null | wc -l",
                    "find output -name '*.pdf'", "mkdir -p output && cp a.txt output/"] {
            XCTAssertEqual(bash(cmd), .allow, cmd)
        }
        files["\(folder)/out.py"] = "import subprocess\nsubprocess.run(['ls'])\n"
        let c = ctx()
        XCTAssertTrue(denied(JobGate.bash("python3 out.py", context: c)), "a script file is read and checked")
        XCTAssertTrue(denied(bash("python3 missing.py")), "an unreadable script is refused")
        XCTAssertTrue(denied(bash("cd /tmp && rm x")), "rm after cd needs a full path")
    }
}

final class JobConfigFileTests: XCTestCase {
    let agentMCP = """
    {"mcpServers":{"cua-driver":{"command":"/x/cua-driver","args":["mcp"]},
     "atlas":{"command":"/opt/homebrew/bin/python3.13","args":["-m","atlas.mcp","--root","/Users/example/vault"],
              "env":{"PYTHONPATH":"/Users/example/vault/Atlas/harness","ATLAS_CHAT_SESSION":"dot-agent"}}}}
    """.data(using: .utf8)!

    func servers(bench: Bool) -> [String: [String: Any]] {
        let data = JobConfigFile.make(agentMCP: agentMCP, dotExecutable: "/Apps/Dot.app/Contents/MacOS/Dot", jobId: "j1",
                                      socket: "/tmp/control.sock", bench: bench, stamp: "202610202200")!
        let root = try! JSONSerialization.jsonObject(with: data) as! [String: Any]
        return root["mcpServers"] as! [String: [String: Any]]
    }

    func testJobServers() {
        let s = servers(bench: false)
        XCTAssertEqual(Set(s.keys), ["dot", "atlas", "atlas-send"], "no cua-driver")
        XCTAssertEqual(s["dot"]?["alwaysLoad"] as? Bool, true)
        XCTAssertEqual(s["dot"]?["timeout"] as? Int, 130_000)
        XCTAssertEqual(s["dot"]?["args"] as? [String], ["--hands-mcp", "--job", "j1"])
        let readEnv = s["atlas"]?["env"] as! [String: String]
        XCTAssertEqual(readEnv["ATLAS_CHAT_SESSION"], "dot-job-j1-202610202200")
        XCTAssertEqual(readEnv["ATLAS_CANVAS_DEFAULT_DEST"], "downloads")
        XCTAssertEqual(Set(readEnv["ATLAS_MCP_TOOLS"]!.split(separator: ",").map(String.init)), JobAtlasTools.allowed)
        XCTAssertFalse(readEnv["ATLAS_MCP_TOOLS"]!.contains("imessage_send"))
        XCTAssertEqual(s["atlas"]?["timeout"] as? Int, 300_000)
        let sendEnv = s["atlas-send"]?["env"] as! [String: String]
        XCTAssertEqual(sendEnv["ATLAS_CHAT_SESSION"], "ask-dot-job-j1-202610202200")
        XCTAssertEqual(sendEnv["ATLAS_MCP_TOOLS"], "imessage_send,send_email,reply")
        XCTAssertEqual(sendEnv["PYTHONPATH"], "/Users/example/vault/Atlas/harness")
    }

    func testBenchServers() {
        let s = servers(bench: true)
        XCTAssertEqual(Set(s.keys), ["dot", "atlas"], "no send server in the bench")
        let env = s["atlas"]?["env"] as! [String: String]
        XCTAssertEqual(env["ATLAS_DOWNLOADS_DIR"], "/tmp/dot-bench/downloads")
        XCTAssertEqual(env["ATLAS_CANVAS_NO_VAULT"], "1")
        let tools = Set(env["ATLAS_MCP_TOOLS"]!.split(separator: ",").map(String.init))
        XCTAssertFalse(tools.contains("canvas_download"))
        XCTAssertFalse(tools.contains("remember"))
    }

    func testInitCarriesPermissionMode() {
        let line = #"{"type":"system","subtype":"init","session_id":"s1","model":"claude-sonnet","permissionMode":"default"}"#
        XCTAssertEqual(StreamJSON.parse(line: line), .systemInit(sessionId: "s1", model: "claude-sonnet", permissionMode: "default"))
    }
}
