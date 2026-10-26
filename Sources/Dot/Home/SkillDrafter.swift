import DotKit
import Foundation

/// A new skill from links (parity SK-02): one Claude Code pass (the think model, web tools only, no MCP, no hooks)
/// reads the links and replies with a SKILL.md. Nothing is written: Home shows the draft and saves it on his Save.
@MainActor
enum SkillDrafter {
    static func draft(links: [URL], purpose: String, existing: [String], config: DotConfig) async -> Result<String, SkillDraftFailure> {
        var options = ClaudeSession.Options(cwd: FileManager.default.temporaryDirectory, model: config.thinkModel)
        options.systemPrompt = "You draft Claude Code skills from source links. You read; you never write files or run commands."
        options.tools = ["WebFetch", "WebSearch"]
        options.allowedTools = ["WebFetch", "WebSearch"]
        options.maxTurns = 30
        options.settingSources = ""
        options.permissionPromptOverStdio = false
        options.includePartialMessages = false
        options.extraArguments = ["--no-session-persistence"]
        let session = ClaudeSession(label: "skill-draft", claudePath: config.claudeExecutable, options: options)
        let started = Date()
        let reply: String? = await withCheckedContinuation { done in
            var text = ""
            var finished = false
            func finish(_ value: String?) {
                guard !finished else { return }
                finished = true
                session.stop()
                done.resume(returning: value)
            }
            session.onEvent = { event in
                switch event {
                case .assistantText(let piece): text += piece
                case .result(let info): finish(info.isError ? nil : (info.resultText ?? text))
                default: break
                }
            }
            session.onExit = { _ in finish(nil) }
            do { try session.start() } catch { finish(nil); return }
            session.send(text: SkillDraft.prompt(links: links, purpose: purpose, existing: existing))
            DispatchQueue.main.asyncAfter(deadline: .now() + 600) { finish(nil) }
        }
        Log.info(String(format: "skills: draft from %d link(s) in %.0f s (%d chars)", links.count, Date().timeIntervalSince(started), reply?.count ?? 0))
        guard let reply else { return .failure(.init(why: "the drafting pass didn't finish; try again")) }
        guard let text = SkillDraft.extract(reply) else { return .failure(.init(why: "no SKILL.md came back: \(Log.short(reply, 160))")) }
        return .success(text)
    }

    /// Saves a checked draft as ~/.claude/skills/<name>/SKILL.md; never over an existing skill.
    static func save(_ text: String, root: URL) -> Result<URL, SkillDraftFailure> {
        let existing = Set(((try? FileManager.default.contentsOfDirectory(atPath: root.path)) ?? []))
        let problems = SkillDraft.problems(text, existing: existing)
        guard problems.isEmpty, let name = SkillDraft.frontmatter(text)["name"] else {
            return .failure(.init(why: problems.joined(separator: "; ")))
        }
        let folder = root.appendingPathComponent(name, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
            try text.write(to: folder.appendingPathComponent("SKILL.md"), atomically: true, encoding: .utf8)
        } catch {
            return .failure(.init(why: "couldn't save: \(error.localizedDescription)"))
        }
        Log.info("skills: saved \(name) from links")
        return .success(folder)
    }
}

struct SkillDraftFailure: Error { let why: String }
