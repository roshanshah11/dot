import DotKit
import Foundation

/// After a call (call mode, 2026-10-28): both recordings transcribed again whole (the live stream's words are rougher),
/// split into turns where each side went quiet, interleaved by time with his mic's echoes of them dropped; the
/// transcript saved in his vault (Networking for a chat, Interview Prep for an interview); the recordings deleted; and
/// the brief for the agent that writes the recap or the debrief, the lessons, the tracker and a thank-you draft, the way
/// he has done it by hand from a pasted transcript. Nothing in it sends: the draft stops in Outlook Drafts.
@MainActor
enum CallAfter {
    struct Result {
        let transcript: URL?
        let lines: [CallLine]
        let line: String
        let brief: String?
    }

    static func run(event: CallEvent, heading: String, ear: CallEar, prep: URL?, transcriber: Transcriber, folder: URL, deleteAudio: Bool,
                    missed: [String], helps: [CallHelp]) async -> Result {
        var lines = CallTranscript.merged(ear.lines)
        var source = "live"
        if let me = ear.meAudio, let them = ear.themAudio {
            do {
                let mine = CallTranscript.turns(try await transcriber.transcribeTokens(url: me.url))
                let theirs = CallTranscript.turns(try await transcriber.transcribeTokens(url: them.url))
                let fresh = CallTranscript.interleave(me: mine, meOffset: me.offset, them: theirs, themOffset: them.offset)
                // the whole-file pass wins unless it came back with much less than the live one heard
                let words = { (l: [CallLine]) in l.reduce(0) { $0 + $1.text.split(separator: " ").count } }
                if words(fresh) >= words(lines) / 2 { lines = CallTranscript.filling(fresh, from: ear.lines); source = "whole recordings" }
            } catch {
                Log.warn("call: after: the recordings didn't transcribe again (\(error)); the live transcript stands")
            }
        }
        let words = lines.reduce(0) { $0 + $1.text.split(separator: " ").count }
        guard words >= 20 else {
            Log.warn("call: after: only \(words) words heard; no transcript or recap")
            return Result(transcript: nil, lines: lines, line: "call over: too little was heard for a transcript", brief: nil)
        }
        let f = DateFormatter(); f.dateFormat = "EEE MMM d, h:mm a"; f.locale = Locale(identifier: "en_US_POSIX")
        let title = "\(event.kind == .chat ? "Coffee chat" : "Interview"): \(heading), \(f.string(from: ear.began))"
        let them = event.person.isEmpty ? (event.firm.isEmpty ? "Them" : event.firm) : event.person
        var text = CallTranscript.markdown(heading: title, lines: lines, them: them)
        text += "\n---\nTranscribed on this Mac from Dot's call mode (\(source)); his side from his microphone, theirs from the Mac's audio.\n"
        let url = folder.appendingPathComponent(CallFiles.transcriptName(event))
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            try text.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            Log.error("call: after: couldn't save the transcript: \(error)")
            return Result(transcript: nil, lines: lines, line: "call over: the transcript couldn't be saved", brief: nil)
        }
        // the recordings go only once the transcript is safe; every return above keeps them (swept after three days)
        if deleteAudio {
            for url in [ear.meAudio?.url, ear.themAudio?.url].compactMap({ $0 }) { try? FileManager.default.removeItem(at: url) }
        }
        Log.info("call: after: transcript saved, \(lines.count) turns, \(words) words (\(source)) -> \(url.lastPathComponent)")
        let brief = event.kind == .chat ? chatBrief(event: event, transcript: url, prep: prep, minutes: ear.minutes, missed: missed, helps: helps)
                                        : interviewBrief(event: event, transcript: url, prep: prep, minutes: ear.minutes)
        return Result(transcript: url, lines: lines, line: "transcript saved; an agent is writing the \(event.kind == .chat ? "recap and the thank-you draft" : "debrief")", brief: brief)
    }

    static func chatBrief(event: CallEvent, transcript: URL, prep: URL?, minutes: Int, missed: [String], helps: [CallHelp]) -> String {
        let networking = DotConfig.expand("~/roshan/Career/Networking")
        let firm = event.firm.isEmpty ? "" : " (\(event.firm))"
        let shown = helps.compactMap { h in [h.fact, h.ask.map { "ask: \($0)" }].compactMap { $0 }.joined(separator: "; ") }.filter { !$0.isEmpty }
        return """
        Coffee chat with \(event.who)\(firm) just ended (\(minutes) min). Call mode saved the whole call, both sides labeled: \(transcript.path)\(prep.map { "\nHis prep for it: \($0.path)" } ?? "")
        Prep items he didn't get to: \(missed.isEmpty ? "none" : missed.joined(separator: "; "))
        What Dot showed him during the call: \(shown.isEmpty ? "nothing" : shown.joined(separator: " | "))

        Do the after-call work the networking skill describes (thank-yous, step 3), the way his recaps in \(networking) are written:
        1. The recap at \(networking)/\(CallFiles.recapName(event)), in the shape of the newest *_coffee_chat_recap.md there: a heading with the call, how it happened, the source (this transcript); "What \(event.person.split(separator: " ").first.map(String.init) ?? "they") said" (everything substantive, their path, their firm, their advice, deals and companies named); "How it went" (good and missed, judged against the During rules in Coffee chat lessons.md: small talk, follow-ups on their words, a researched deal used, the story they asked for, the close ask, questions running long); "Next".
        2. New lessons into \(networking)/Coffee chat lessons.md under the right headings, each tagged with who said it and the date; skip what is already there; update its "Last updated" line.
        3. The tracker: `python3 ~/.claude/skills/networking/scripts/nw.py call "\(event.who)" --at <the call's ISO time> --status done`, a one-line `set ... notes=`, and `add ... --referred-by "\(event.who)"` for each person they offered or named.
        4. The thank-you, written with the roshan-email skill: one specific thing they said, and the ask for someone else to talk to (unless they already gave names: then thank them for those). Save it as an Outlook draft on their thread the way the networking skill saves reply drafts. Never send it, and never schedule it.
        5. If Atlas has nothing on \(event.who), remember who they are and what they do.
        Reply with one line per file written, the draft's subject, and anything you couldn't do.
        """
    }

    static func interviewBrief(event: CallEvent, transcript: URL, prep: URL?, minutes: Int) -> String {
        let folder = DotConfig.expand("~/roshan/Career/Interview Prep")
        let who = event.person.isEmpty ? "" : " with \(event.person)"
        return """
        Interview at \(event.firm.isEmpty ? event.who : event.firm)\(who) just ended (\(minutes) min; calendar: "\(event.title)"). Call mode saved the whole interview, both sides labeled: \(transcript.path)\(prep.map { "\nHis prep for it: \($0.path)" } ?? "")

        1. The debrief at \(folder)/\(CallFiles.recapName(event)): who interviewed him and the round; every question asked, in order, each with his answer in a line; what landed; what to fix, each with the better answer in two lines from his own material (\(folder)/roshan_interview_data_pack_merged.md and his stories there; never invent experience); any technical he missed, with the right answer; next steps and timing they named.
        2. In the interview data pack, update an open gap only where this interview answered it.
        3. A thank-you note to the interviewer with the roshan-email skill, if their email is in Atlas or his Outlook: saved as an Outlook draft, never sent.
        4. Remember the interview in Atlas: firm, round, date, interviewer, how it went in one line, the next step.
        Reply with one line per file written, the draft's subject if any, and anything you couldn't do.
        """
    }
}
