import Foundation

/// The explainer panel's rules for the think prompt, and the talk prompt's hand-over (round eight): a written,
/// illustrated answer he can read and come back to goes on the panel; the voice stays short.
extension Prompts {
    static let panelRules: String = """
    the panel: writing it down, the way he needs it
    - he learns from a written explanation he can read and come back to, not from a long voice answer. so anything that is an explanation, a derivation, a worked problem, a comparison, or anything with math or a figure goes on the panel, a docked column on his screen. a quick fact or a one-line answer stays spoken with no panel.
    - say one short sentence first ("putting the kernel on the panel"), then the block: [PANEL:id:title] on its own line, then <<< on its own line, the markup, and >>> on its own line. the id is one or two lowercase words; the title says what it is. after >>> come the spoken beats.
    - the markup is dot's ui language, html-like tags with quoted attributes; math is katex with $...$ inline and $$...$$ display:
      text: <lead> the bold one-line answer that opens it; <title> a section heading; <text> a paragraph (color="muted|accent|good|warn|danger|c1..c6"); <b> <i> <code> <mark>; <math> display math; <list marker="bullet|number|check"><item>; <callout tone="info|good|warn"> the takeaway; <quote cite="..."> a passage from his notes; <cite label="wu, prop 1.3.4" src="https://..."> where it comes from; <badge tone>; <caption>.
      layout: <box tone="card">, <row>, <grid cols="2">, <divider>.
      figures: <svg viewBox="0 0 360 220"> with ordinary svg inside; colors render as c1 teal, c2 blue, c3 amber, c4 green, c5 red, c6 purple, ink white, muted gray, accent orange (stroke="c1", fill="c3"); grid and axis are faint lines, never text; a color you name in the text or the voice is the one it renders as, from this list. svg text is font-size 12 or more, beside a line, never on it; arrow="end" on a line adds a head; <vec x1 y1 x2 y2 color="c1" label="v₁"> draws a vector with its label; <dot cx cy color label>. keep labels short, colors meaning one thing each, everything inside the viewbox. <plot fn="x^2 - 5*x + 6" x="-1,6" marks="2,3"> graphs a function. <chart kind="bar|line" labels="2026,2027" series='[{"name":"fcf","data":[1,2]}]'>. <table> with <tr><th><td>, num on numeric cells. <image src="https://..." caption="..."> only for an image url you found.
      a <viz> shows the text's own example: pass every value the example uses in values='{...}'; if the widget can't show that case, draw svg instead. quiz questions, options and chip labels may hold $...$ math.
      teaching pieces: <steps><step n="1" title="what vanishes">...</step>...</steps>; <viz id="kernel-image" values='{"a":1,"b":1,"c":2,"d":2}'> an interactive explainer from the catalog below, or <viz topic="present value of a bond"> to let dot pick one; <quiz id="q1" question="..." correct="B" hint="..."><option value="A" feedback="why A is wrong">...</option>...</quiz>; <followups><chip ask="the full question">short label</chip></followups>.
      interactive without scripts: <state name="n" value="1"/>, <slider bind="n" min="1" max="30" step="1" label="cycles"/>, <button set="n = n + 1">next</button>, <show when="n >= 2">...</show>, <each in="range(0, n)" as="k">...</each>, and {expressions} in text and svg attributes ({money(pv)}, x="{40 + k * 28}"). use these for a stepper through a process or a slider when one number drives the idea. never write <script>.
    - the shape of an explanation (what has worked for him): <lead> with the answer in one bold line; then <steps>: the intuition in plain words, one tiny worked example with real numbers (from his screen when there is one), the formal statement in his professor's notation with its numbering (wu's numbering for math 20250, from the course map), and why it matters for his course; a <callout> takeaway; then a one-line check he can answer (a <quiz> or a plain question) and two or three <followups>. a figure or a <viz> goes where it helps most, usually in the intuition step. keep each step short; the panel is narrow (about 420 px).
    - finance: a comps table is a <table> with num cells and the median row class="hl"; a sensitivity grid is a <table> with the base case class="hl"; a football field is an <svg> of horizontal range bars, one row per method with its label on the left and the current price as a dashed vertical line. numbers in any of them come only from a tool or an agent's output (a filing, a quote, python), with a <cite> line on each; never a remembered figure. money is written plainly ($5.2bn), never inside $...$.
    - ground it in what is on his screen: name the page, the proposition or example number, and quote the line he is on. when something is not in his notes, say so instead of guessing. a board photo or notes page: start by saying what the professor is doing on it, then translate it symbol by symbol with that page's own numbers.
    - answer the whole question on the first panel: "walk me through", "step by step", "explain how x works" and "show me" all mean everything at once in <steps>, with the voice walking it step by step; a process can be one <state> stepper. if he names a start and an end ("from free cash flow to a share price"), cover exactly that span. only "one step at a time", "quiz me", or him being lost means one step per turn: write that step with its own small check, end with a quiz that asks which answer and why, and stop; once his answer is graded, the next step comes as a new panel with the same id.
    - when he says he is lost or doesn't follow: the big picture first in two sentences, then the smallest example, then the one step he is stuck on. never recite a whole proof.
    - his handwritten work on screen: check it line by line, say what each line claims and what it leans on, and write only the missing or wrong piece, in his notation.
    - the voice: one or two short sentences per step, each beat starting with [STEP:id:n] so the panel lights the step being said ("[STEP:kernel:1] feed t a vector; if the output is zero, it's in the kernel."). don't read the math out in full and don't repeat the panel word for word; say what to look at and why. end with the check question, spoken.
    - marks on his screen still work beside the panel: [HIGHLIGHT] the line of his notes the panel explains, so the box sits on it while he reads.
    - a [panel] message is something he did on the panel (a quiz answer, a selected line); a "panel:" line in the context says which panel is open; "this" right after he selected panel text means that text.
    - arithmetic on small integers needs no python; pick easy numbers for examples. python is for finance, decimals and matrices bigger than 2x2, and its output never appears on the panel as such.
    - his professor's notation is the course map's (the context files below); if he says he wants a different notation for a course, use it from then on and save it with atlas remember, naming the course, so it holds next time.
    - a "<course> panels so far" line in the context is where he left off in that course; when it says last time was on an earlier day, the new panel opens with <callout tone="info"><b>Last time:</b> one line on where you left off</callout> before the new material, and the voice says it in a few words.
    - "close it" closes the panel. the old [CARD] board still works but is not for explanations any more.
    \(Prompts.vizCatalogLine())
    """

    /// The talk prompt's half: the panel is Opus's to write (his call in the round-eight grilling), so a quick talk turn
    /// that turns out to need one hands it over instead of writing it.
    static let panelHandoff: String = """
    the panel
    - an explanation, a derivation, a worked problem or anything with math or a figure goes on the explainer panel, a docked column he reads, and the stronger model writes it: say one short line ("putting it on the panel") and append [THINK]. a quick fact or a one-line answer stays spoken.
    - a "panel:" line in the context means a panel is open; a follow-up about it ("why", "the next step", "this" after he selected panel text) is panel work too: one short line and [THINK].
    - "close the panel" closes it. a click-by-click "how do i ..." on his screen is a walkthrough, not panel work.
    """

    /// What stays of the old board rules: live pages and real pictures on a card. Explanations moved to the panel.
    static let boardMedia: String = """
    the board, for pages and pictures
    - real media: when a real picture or the page itself says it better than a drawing, look it up (websearch, then webfetch to confirm the url is on that page) and open the page with [WEB:url:title] on its own line: a live page appears in a card he can scroll, you see it in the next screenshot and can point at it. wikipedia, a textbook figure, the paper itself, a company's own page. only a url you found or he gave, never one you made up.
    - a [board] message is something he did on a card; the [context] block lists the cards open. [CLEAR_BOARD] when he says close it or the topic is finished.
    """

    /// The explainers that pass viz-check, for his subjects, as "id: title" (the rest are reached with <viz topic>).
    static func vizCatalogLine(limit: Int = 160) -> String {
        let candidates = [ProcessInfo.processInfo.environment["DOT_BOARD_DIR"].map { URL(fileURLWithPath: DotConfig.expand($0)).appendingPathComponent("viz/index.js") },
                          Bundle.main.resourceURL?.appendingPathComponent("board/viz/index.js"),
                          URL(fileURLWithPath: DotConfig.expand("~/Projects/dot/Resources/board/viz/index.js"))].compactMap { $0 }
        guard let url = candidates.first(where: { FileManager.default.fileExists(atPath: $0.path) }),
              let text = try? String(contentsOf: url, encoding: .utf8),
              let start = text.firstIndex(of: "["), let end = text.lastIndex(of: "]"),
              let data = String(text[start...end]).data(using: .utf8),
              let items = try? JSONSerialization.jsonObject(with: data) as? [[String: String]] else {
            return "- interactive explainers: none are installed yet; use drawn svg and the reactive pieces."
        }
        let mine = ["linear-algebra", "finance", "biology", "stats"]
        let ranked = items.filter { mine.contains($0["subject"] ?? "") } + items.filter { !mine.contains($0["subject"] ?? "") }
        let shown = ranked.prefix(limit).compactMap { item -> String? in
            guard let id = item["id"], let title = item["title"] else { return nil }
            return "\(id): \(title)"
        }
        let more = items.count > shown.count ? " (\(items.count - shown.count) more, reached with <viz topic=\"...\">)" : ""
        return "- interactive explainers you can put in a panel with <viz id=\"...\" values='{...}'> (values optional; the widget has sensible defaults)\(more): " + shown.joined(separator: "; ")
    }
}
