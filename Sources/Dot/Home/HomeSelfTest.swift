import DotKit
import Foundation
import SQLite3

/// `Dot --home-selftest`: Home's state store (batch 6) on a temp database: drafts, scroll places, reactions, prompt
/// cards and the schema version; then the storage contract over a copy of the real talk log (read only).
@MainActor
enum HomeSelfTest {
    static var failures = 0
    static func check(_ ok: Bool, _ what: String) {
        print("\(ok ? "PASS" : "FAIL") \(what)")
        if !ok { failures += 1 }
    }

    static func run() -> Never {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("dot-home-\(UUID().uuidString)")
        defer { try? FileManager.default.removeItem(at: dir) }
        let url = dir.appendingPathComponent("home-state.sqlite")
        do {
            let s = HomeState(url: url)
            check(s.version == HomeState.schemaVersion, "schema version \(s.version)")
            let file = dir.appendingPathComponent("a.txt")
            try? "x".write(to: file, atomically: true, encoding: .utf8)
            s.saveDraft(thread: "agent:scout", text: "half a thought", attachments: [file, dir.appendingPathComponent("gone.txt")])
            let d = s.draft(thread: "agent:scout")
            check(d.text == "half a thought" && d.attachments == [file], "a draft comes back with the files that still exist")
            s.saveDraft(thread: "agent:scout", text: "  ", attachments: [])
            check(s.draft(thread: "agent:scout").text.isEmpty && s.threadsWithDrafts().isEmpty, "an empty draft is removed")
            s.saveScroll(thread: "agent:scout", anchor: "k2", newest: "k9")
            let sc = s.scroll(thread: "agent:scout")
            check(sc.anchor == "k2" && sc.newest == "k9", "the scroll place comes back")
            s.react(turn: "t1", thread: "agent:scout", emoji: "👍", text: "found 4 hackathons")
            s.react(turn: "t2", thread: "agent:scout", emoji: "❤️", text: "the deck")
            s.react(turn: "t2", thread: "agent:scout", emoji: nil, text: "")
            check(s.reactions(thread: "agent:scout") == ["t1": "👍"], "a reaction is kept, and taking one back removes it")
            let told = s.takeUntold(thread: "agent:scout")
            check(told.count == 1 && told[0].emoji == "👍" && s.takeUntold(thread: "agent:scout").isEmpty, "the agent is told once")
            s.savePromptCard(.init(id: "b", title: "Second", text: "y", color: "green", ord: 2))
            s.savePromptCard(.init(id: "a", title: "First", text: "x", color: "blue", ord: 1))
            check(s.promptCards().map(\.id) == ["a", "b"], "prompt cards in their order")
            s.deletePromptCard("a")
            check(s.promptCards().map(\.id) == ["b"], "a card deletes")
            s.setAgentIcon("scout", "calendar")
            s.setAgentIcon("option", "cart")
            s.setAgentIcon("option", nil)
            check(s.agentIcons() == ["scout": "calendar"], "an icon pick is kept; Automatic takes it back")
        }
        // reopening keeps everything and doesn't migrate twice
        let again = HomeState(url: url)
        check(again.scroll(thread: "agent:scout").anchor == "k2" && again.version == HomeState.schemaVersion, "a reopened store keeps its rows and version")
        // a schema 1 file (before agent icons) upgrades in place and keeps its rows
        let old = dir.appendingPathComponent("v1.sqlite")
        var raw: OpaquePointer?
        if sqlite3_open(old.path, &raw) == SQLITE_OK {
            sqlite3_exec(raw, """
            CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT);
            CREATE TABLE drafts(thread TEXT PRIMARY KEY, text TEXT NOT NULL, attachments TEXT NOT NULL DEFAULT '[]', updated REAL NOT NULL);
            CREATE TABLE scroll(thread TEXT PRIMARY KEY, anchor TEXT, newest TEXT, updated REAL NOT NULL);
            CREATE TABLE reactions(turn TEXT PRIMARY KEY, thread TEXT NOT NULL, emoji TEXT NOT NULL, text TEXT NOT NULL DEFAULT '', at REAL NOT NULL, told INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE prompt_cards(id TEXT PRIMARY KEY, title TEXT NOT NULL, text TEXT NOT NULL, color TEXT NOT NULL, ord INTEGER NOT NULL);
            INSERT INTO meta VALUES('schema', '1');
            INSERT INTO drafts VALUES('agent:option', 'kept across the upgrade', '[]', 0);
            """, nil, nil, nil)
            sqlite3_close(raw)
        }
        let upgraded = HomeState(url: old)
        upgraded.setAgentIcon("option", "cart")
        check(upgraded.version == 2 && upgraded.draft(thread: "agent:option").text == "kept across the upgrade" && upgraded.agentIcons() == ["option": "cart"],
              "a schema 1 store upgrades to 2 and keeps its drafts")
        // the storage contract on the real log: every row gets an id, nothing written
        let log = TranscriptLog.directory.appendingPathComponent("transcripts.jsonl")
        if let before = try? Data(contentsOf: log) {
            let rows = TranscriptLog.rows()
            check(!rows.isEmpty && Set(rows.map(\.id)).count == rows.count, "\(rows.count) talk-log rows, each with its own id")
            check((try? Data(contentsOf: log)) == before, "reading the talk log changes nothing")
        }
        print(failures == 0 ? "home selftest: all passed" : "home selftest: \(failures) failed")
        exit(failures == 0 ? 0 : 1)
    }
}
