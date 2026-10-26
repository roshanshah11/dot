# Dot's UI language

Dot writes an explanation the way ChatGPT does: prose, math and figures in one column, with interactive pieces
inline. The talk model writes this markup between `<<<` and `>>>` after a `[PANEL:id:title]` tag; the explainer panel
(`Resources/board/panel/`) renders it with Dot's own look, as it streams. Anything the renderer does not know renders
its children (or nothing), never a blank box. Attributes are plain quoted HTML attributes; object values are JSON in
single quotes (`values='{"a":1}'`). Math is KaTeX: `$...$` inline, `$$...$$` display, anywhere text goes. Single
dollars pair by Pandoc's rule (an opening `$` has no space after it; a closing `$` has no space before it and no digit
after it), so money like "$5 today and $7" stays text. Attributes hold plain text only: markup inside `question="..."`
shows literally, and a `"` inside one ends it.

## Text
| tag | what it is | attributes |
|---|---|---|
| `<lead>` | the bold one-line thesis that opens an answer | |
| `<title>` | a section heading | `size="sm|md|lg"` |
| `<text>` | a paragraph (plain text between tags is also a paragraph) | `size="xs|sm|md|lg"`, `color`, `weight="regular|medium|bold"`, `align` |
| `<b> <i> <code> <mark>` | inline emphasis, code, highlight | |
| `<math>` | display math without the `$$` | |
| `<list>` / `<item>` | a list | `marker="bullet|number|check"` |
| `<callout>` | a boxed aside | `tone="info|good|warn|danger"` |
| `<quote>` | a quoted passage (from his notes, a paper) | `cite="where it is from"` |
| `<badge>` | a small tag | `tone` |
| `<caption>` | a muted line under a figure | |
| `<cite>` | where a fact comes from | `src="https://..."`, `label="Wu 1.3.4"` |

Colors: `default secondary muted accent good warn danger c1..c6` (c1 teal, c2 blue, c3 amber, c4 green, c5 red,
c6 purple; the same palette as the explainer widgets).

## Layout
`<box>` (a group; `tone="card|plain|accent|good|warn"`, `gap`, `pad`), `<row>` (side by side; `gap`, `align`, `wrap`),
`<grid cols="2">` (at most 2 columns: the column is about 400 px wide), `<divider>`, `<spacer>`.

## Figures and data
- `<svg viewBox="0 0 360 220">` with ordinary SVG inside. House style is automatic: text is 13 px, `color="c1"` (or
  `stroke="c2"`, `fill="c3"`) uses the palette, `arrow="end|start|both"` on a `line`/`path` adds arrowheads, and two
  shorthand shapes expand: `<vec x1 y1 x2 y2 color label>` (an arrow with a halo and a label in its color) and
  `<dot cx cy color label>`. Scripts, event attributes, foreignObject and non-https links are removed.
- `<table>` with `<tr> <th> <td>`; `num` on a cell right-aligns it in tabular numerals; `class="hl"` on a row highlights it.
- `<chart kind="bar|line|area" labels="2024,2025,2026" series='[{"name":"FCF","data":[1,2,3]}]' unit="$m">`.
- `<plot fn="x^2 - 5*x + 6" x="-1,6" y="-1,8" marks="2,3" label="y = x² − 5x + 6">`: a function graph with ticks
  (several fns and labels separated by `|`). Without `y` the range fits the curve, trimming a steep tail. `marks` may hold
  `{expressions}`, so a marked point can follow a slider.
- `<image src="https://..." alt="..." caption="...">`.

## Teaching pieces
- `<steps>` holding `<step n="1" title="what vanishes">...</step>`: numbered sections. Dot highlights the step it is
  saying (`[STEP:id:n]`); he can read ahead.
- `<viz id="kernel-image" values='{"a":1,"b":1,"c":2,"d":2}'>`: one of the catalog's interactive explainers
  (`Resources/board/viz/widgets`, found with `scripts/viz-find.py`). `<viz topic="kernel of a linear map">` lets Dot
  pick the closest one; with no match it renders nothing.
- `<quiz id="q1" question="Which set is a basis for R²?" type="single|multi" correct="C" hint="...">` holding
  `<option value="A" feedback="why A is right or wrong">{(1,0),(2,0)}</option>`: answering shows the feedback and
  tells Dot (`{type:"quiz"}`), which grades it out loud in one line and moves on.
- `<followups>` holding `<chip ask="why must a basis be independent?">why independent?</chip>`: tapping one asks it.

## Interactive figures without scripts
A small reactive layer covers steppers, sliders and toggles (what ChatGPT's own on-the-fly widgets do):
- `<state name="cycle" value="1">` declares a variable (a number, a string in quotes, true/false).
- `<slider bind="cycle" min="1" max="30" step="1" label="cycles" format="pct|money">` edits it (`format` only changes
  how the value is shown; `pct` takes a fraction, 0.09 shows as 9%). Its `<state>` comes before it.
- `<button set="cycle = cycle + 1">next</button>`; `set` takes `a = expr; b = expr`; `ask="..."` sends a question instead.
- `<show when="cycle >= 2">...</show>` and `<hide when="...">`.
- `<each in="range(0, n)" as="k">...</each>` repeats (inside SVG too).
- `{expr}` anywhere in text or attributes: `<rect width="{40 * 2 ^ cycle / 2 ^ 30}">`, `<text>{fmt(pv)} today</text>`.
Expressions: numbers, 'strings', variables, `+ - * / % ^`, comparisons, `&& || !`, `a ? b : c`, parentheses, and
`min max abs round floor ceil sqrt pow log ln log10 exp sin cos tan atan2 range fmt money pct PI E` (`log` is the
natural log, as in JavaScript and Python; `log10` is base ten). Nothing else (no property
access, no assignment outside `set`). Braces whose contents do not parse and evaluate stay exactly as written, and math
(`$...$`) is never interpolated, so set notation like `{(1,0), (2,0)}` and LaTeX braces are safe.

## Job pages
A background job keeps a live page (`page.md`) in this same language: the blocks above plus the ones below. Dot loads
it with `panel.load(markup, {id, title, version})`; `version` (a string) rides on every message a control posts, so
Dot can drop a click made on a stale page. The controls (todo, form, review, letter) need an `id` on the block and on
each row: one without renders but is inert (dimmed, posts nothing). A control posts once, then stays off until the
next load. At most 30 rows or fields render in a block; posted strings are cut at 2000 characters.
| tag | what it is | attributes |
|---|---|---|
| `<status>` | the job's run line, a pill with a colored dot | `tone="good|warn|danger|info|muted"` (default info) |
| `<tiles>` / `<tile>` | stat tiles, 2 or 3 to a row | tile: `label`, `value`, `tone="good|warn|danger|info|accent|muted"`, `note="+3 today"` |
| `<todo id>` / `<item id done>` | a checklist; ticking a box flips it at once and tells Dot | item: `done="true|false"`, `mark` |
| `<form id submit="Save">` / `<field>` | a small form; the button sends every field | field: `name`, `label`, `type="text|textarea|number|date|choice"`, `options="a,b,c"` (choice), `value`, `required` |
| `<letter id proposal>` | a draft the job wants sent, with Send and Edit | `id`, `proposal="p_7f3a"`; always closed: `<letter id="l1" proposal="p_7f3a"></letter>` |
| `<review id>` / `<item id reason>` | rows to approve or reject, each with an optional one-line reason, then Done | item: `reason="why it is listed"`, `mark` |
| `<timeline>` / `<day>` | a vertical timeline | day: `date="Mon 27"`, `title`; the body is ordinary markup |
| `<countdown>` | "3d 4h left", "5h 12m left", "overdue by 2h"; updates each minute, amber inside a day, red once late | `to="2026-10-30T17:00:00-05:00"`, `label="due"` |
| `<progress>` | a bar with its label and percent | `value` (0 to 1, clamped), `label="3 of 8"`, `tone` (default accent) |
| `<sticky>` | a paper note stuck to the page | |

- Row marks: `mark="pick|out|new|needs|done|now"` on an `<item>` (in a list, todo or review) or a `<tr>` adds a small
  badge: pick (chosen), out (ruled out: the row is muted and struck), new, needs (needs him, amber), done (green),
  now (in progress, accent with a pulsing dot).
- A required field left empty blocks the button with a note naming it. A choice field sends the picked option.
- Letter: the page never supplies the draft's words. Anything written inside `<letter>` is ignored; the card says
  "loading the draft" until Dot calls `panel.letter("l1", {to, subject, body, state})` with
  `state="pending|sent|withdrawn|expired"`. It shows to, subject and body as plain text (the body keeps its line
  breaks), with Send and Edit only while pending; other states show a muted line. The fill is kept by letter id, so a
  re-render or reload of the same page keeps it (a fill made for another page or another proposal is not shown).
- Light look: the job blocks read only the panel's color tokens; `data-theme="light"` on `<html>` switches them.

## Messages the panel sends Dot
`{type:"quiz", panel, id, choice, correct}`, `{type:"ask", panel, text}`, `{type:"selection", panel, text, step}`,
`{type:"event", kind:"viz", data:{id, values}, card}` (a dragged widget), `{type:"close"}`, `{type:"ready"}`.

From a job page, each with `event` (a fresh 12-character id per press) and `version` (from the load):
`{type:"page_tick", panel, object:"t1", item:"i1", done:true, event, version}`,
`{type:"page_form", panel, object:"f1", fields:{"dates":"...", "who":"..."}, event, version}` (every value a string),
`{type:"page_review", panel, object:"r1", decisions:[{item:"a", approve:true, reason:"..."}], event, version}` (only the
rows he decided; `reason` may be ""), `{type:"page_letter", panel, object:"l1", proposal:"p_7f3a", choice:"send|edit", event, version}`.
