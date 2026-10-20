// Dot's explainer panel: renders Dot's UI language (docs/ui-language.md) into one scrolling column, as it streams.
// Plain DOM, classic script (WKWebView cannot import modules from file://). The page talks to Dot through the
// `dot` message handler; Dot drives it through window.panel.
(function () {
  "use strict";
  var SVGNS = "http://www.w3.org/2000/svg";

  // ---- the expression language (no eval, no property access) --------------------------------------------------
  var FUNCS = {
    min: Math.min, max: Math.max, abs: Math.abs, round: function (x, d) { var f = Math.pow(10, d || 0); return Math.round(x * f) / f; },
    floor: Math.floor, ceil: Math.ceil, sqrt: Math.sqrt, pow: Math.pow, log: Math.log, ln: Math.log, log10: Math.log10, exp: Math.exp,
    sin: Math.sin, cos: Math.cos, tan: Math.tan, atan2: Math.atan2,
    range: function (a, b, s) { var out = [], st = s || 1; if (b === undefined) { b = a; a = 0; } for (var x = a; st > 0 ? x < b : x > b; x += st) { out.push(x); if (out.length > 2000) break; } return out; },
    fmt: function (x, d) { return window.Viz ? Viz.fmt(x, d) : String(x); },
    money: function (x, d) { return window.Viz ? Viz.money(x, d) : "$" + x; },
    pct: function (x, d) { return window.Viz ? Viz.pct(x, d) : (x * 100) + "%"; }
  };
  var CONSTS = {PI: Math.PI, E: Math.E, true: true, false: false};
  function tokenize(src) {
    var out = [], i = 0, m;
    var re = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|([A-Za-z_][A-Za-z0-9_]*)|(\*\*|==|!=|<=|>=|&&|\|\||[-+*\/%^<>!?:(),=;]))/y;
    while (i < src.length) {
      re.lastIndex = i;
      if (!(m = re.exec(src))) { if (/^\s*$/.test(src.slice(i))) break; throw new Error("bad expression near " + src.slice(i, i + 8)); }
      i = re.lastIndex;
      if (m[1] !== undefined) out.push({t: "num", v: parseFloat(m[1])});
      else if (m[2] !== undefined) out.push({t: "str", v: m[2].slice(1, -1).replace(/\\(.)/g, "$1")});
      else if (m[3] !== undefined) out.push({t: "id", v: m[3]});
      else out.push({t: "op", v: m[4] === "**" ? "^" : m[4]});
    }
    return out;
  }
  var BP = {"?": 1, "||": 2, "&&": 3, "==": 4, "!=": 4, "<": 5, ">": 5, "<=": 5, ">=": 5, "+": 6, "-": 6, "*": 7, "/": 7, "%": 7, "^": 9};
  function parse(tokens) {
    var p = 0;
    function peek() { return tokens[p]; }
    function next() { return tokens[p++]; }
    function expect(v) { var t = next(); if (!t || t.v !== v) throw new Error("expected " + v); }
    function prefix() {
      var t = next();
      if (!t) throw new Error("unexpected end");
      if (t.t === "num" || t.t === "str") return {k: "lit", v: t.v};
      if (t.t === "id") {
        if (peek() && peek().v === "(") {
          next(); var args = [];
          if (peek() && peek().v !== ")") { do { args.push(expr(0)); } while (peek() && peek().v === "," && next()); }
          expect(")");
          return {k: "call", f: t.v, a: args};
        }
        return {k: "var", n: t.v};
      }
      if (t.v === "(") { var e = expr(0); expect(")"); return e; }
      if (t.v === "-") return {k: "neg", e: expr(8)};
      if (t.v === "!") return {k: "not", e: expr(8)};
      if (t.v === "+") return expr(8);
      throw new Error("unexpected " + t.v);
    }
    function expr(rbp) {
      var left = prefix();
      while (peek() && peek().t === "op" && BP[peek().v] !== undefined && BP[peek().v] > rbp) {
        var op = next().v;
        if (op === "?") { var a = expr(0); expect(":"); var b = expr(0); left = {k: "tern", c: left, a: a, b: b}; continue; }
        var right = expr(op === "^" ? BP[op] - 1 : BP[op]);   // ^ is right-associative
        left = {k: "bin", op: op, l: left, r: right};
      }
      return left;
    }
    var e = expr(0);
    if (p < tokens.length) throw new Error("extra input");
    return e;
  }
  function run(e, scope) {
    switch (e.k) {
      case "lit": return e.v;
      case "var":
        if (Object.prototype.hasOwnProperty.call(scope, e.n)) return scope[e.n];
        if (Object.prototype.hasOwnProperty.call(CONSTS, e.n)) return CONSTS[e.n];
        throw new Error("unknown " + e.n);
      case "neg": return -run(e.e, scope);
      case "not": return !run(e.e, scope);
      case "tern": return run(e.c, scope) ? run(e.a, scope) : run(e.b, scope);
      case "call":
        if (!Object.prototype.hasOwnProperty.call(FUNCS, e.f)) throw new Error("unknown function " + e.f);
        return FUNCS[e.f].apply(null, e.a.map(function (a) { return run(a, scope); }));
      case "bin":
        var l = run(e.l, scope);
        if (e.op === "&&") return l && run(e.r, scope);
        if (e.op === "||") return l || run(e.r, scope);
        var r = run(e.r, scope);
        switch (e.op) {
          case "+": return l + r; case "-": return l - r; case "*": return l * r; case "/": return l / r; case "%": return l % r;
          case "^": return Math.pow(l, r); case "==": return l == r; case "!=": return l != r;   // eslint-disable-line eqeqeq
          case "<": return l < r; case ">": return l > r; case "<=": return l <= r; case ">=": return l >= r;
        }
    }
    throw new Error("bad expression");
  }
  var astCache = {};
  function evaluate(src, scope) {
    var ast = astCache[src] || (astCache[src] = parse(tokenize(src)));
    return run(ast, scope);
  }
  function show(v) {
    if (typeof v === "number") return window.Viz ? Viz.fmt(v, 4) : String(Math.round(v * 1e4) / 1e4);
    return v == null ? "" : String(v);
  }
  // "{a + 1} apples": text outside math, where the braces hold an expression that parses and evaluates.
  // Anything else stays exactly as written, so set notation like {(1,0), (2,0)} and LaTeX are never touched.
  // Math spans, Pandoc's rule for single dollars: an opening $ is not followed by a space, and a closing $ is not
  // preceded by a space nor followed by a digit, so "$5 today and $7" and "$5-$7" stay money.
  var MATH_SPAN = /(\$\$[\s\S]+?\$\$|\$(?!\s)[^$\n]*?[^\s\\]\$(?!\d)|\$[^$\s\\]\$(?!\d)|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])/;
  function hasExpr(s) { return /\{[^{}]+\}/.test(s.split(MATH_SPAN).filter(function (_, i) { return i % 2 === 0; }).join(" ")); }
  function interpolate(s, scope) {
    return s.split(MATH_SPAN).map(function (part, i) {
      if (i % 2 === 1) return part;
      return part.replace(/\{([^{}]+)\}/g, function (whole, src) { try { return show(evaluate(src, scope)); } catch (e) { return whole; } });
    }).join("");
  }
  // attributes need machine numbers (an ASCII minus, no thousands separators)
  function interpolateAttr(s, scope) {
    return s.replace(/\{([^{}]+)\}/g, function (_, src) {
      try { var v = evaluate(src, scope); return typeof v === "number" ? String(Math.round(v * 1e4) / 1e4) : String(v); } catch (e) { return "0"; }
    });
  }
  function assign(src, vars, scope) {   // "a = a + 1; b = 2"
    src.split(";").forEach(function (part) {
      var m = part.match(/^\s*([A-Za-z_]\w*)\s*=(?!=)\s*(.+)$/);
      if (!m) return;
      try { vars[m[1]] = evaluate(m[2], Object.assign({}, scope, vars)); } catch (e) { console.error("set failed: " + part); }
    });
  }

  // ---- state for the panel ---------------------------------------------------------------------------------------
  var panel = {id: "", title: "", markup: "", blocks: [], vars: {}, quiz: {}, bindings: [], step: null, userScrolledAt: 0, loaded: {}};
  var content, titleEl;

  function post(msg) {
    msg.panel = panel.id;
    try { window.webkit.messageHandlers.dot.postMessage(msg); } catch (e) { (window.__posted = window.__posted || []).push(msg); }
  }
  window.addEventListener("error", function (e) { post({type: "log", text: String(e.message || e) }); });

  // ---- markup in --------------------------------------------------------------------------------------------------
  var SELF = "state|viz|slider|divider|spacer|image|cite|plot|chart|vec|dot|badge|chip|br|hr";
  var VOID = "state|viz|slider|divider|spacer|image|plot|chart|vec|dot";
  function preprocess(markup) {
    var escapeMath = function (m) { return m.replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
    var mathAll = new RegExp(MATH_SPAN.source, "g");
    return markup
      .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
      .replace(mathAll, escapeMath)
      // <title> is RCDATA and <math> is MathML to the HTML parser: give them neutral names
      .replace(/<(\/?)(title|math|caption)\b/gi, "<$1dot-$2")
      .replace(new RegExp("<(" + SELF + ")(?=[\\s/>])([^<>]*?)\\/>", "gi"), "<$1$2></$1>")
      // these never hold content: written without the slash (<state name="m" value="5">) they would swallow the rest
      .replace(new RegExp("<(" + VOID + ")(?=[\\s>])([^<>]*?)>(?!\\s*</\\1>)", "gi"), "<$1$2></$1>");
  }
  var INLINE = /^(b|strong|i|em|span|code|mark|small|sup|sub|a)$/i;
  var BLOCKISH = /^(lead|dot-title|text|p|steps|step|quiz|followups|box|row|grid|callout|quote|table|svg|viz|chart|plot|list|ul|ol|dot-math|dot-caption|divider|hr|image|img|cite|state|slider|show|hide|each|h1|h2|h3|h4)$/i;
  function hoist(n, out) {
    // an unclosed <b> wraps everything after it: keep its inline part, lift the blocks it swallowed back to the top
    if (n.nodeType === 1 && INLINE.test(n.tagName) && Array.from(n.children).some(function (c) { return BLOCKISH.test(c.tagName); })) {
      var shell = n.cloneNode(false), lifted = [];
      Array.from(n.childNodes).forEach(function (c) { if (c.nodeType === 1 && BLOCKISH.test(c.tagName)) lifted.push(c); else if (!lifted.length) shell.appendChild(c); else lifted.push(c); });
      if (shell.textContent.trim()) out.push(shell);
      lifted.forEach(function (c) { hoist(c, out); });
      return;
    }
    if (n.nodeType === 3) { if (n.textContent.trim()) out.push(n); }
    else if (n.nodeType === 1) out.push(n);
  }
  function parseBlocks(markup) {
    var doc = new DOMParser().parseFromString("<!doctype html><body>" + preprocess(markup) + "</body>", "text/html");
    var out = [];
    Array.from(doc.body.childNodes).forEach(function (n) { hoist(n, out); });
    return out;
  }
  function blockKey(n) { return n.nodeType === 3 ? "#" + n.textContent : n.outerHTML; }

  // ---- rendering --------------------------------------------------------------------------------------------------
  function h(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function scopeOf(ctx) { return Object.assign({}, panel.vars, ctx.loop || {}); }

  // A binding re-evaluates something when state changes.
  function bind(ctx, fn) { fn(); ctx.bindings.push(fn); }

  function renderChildren(src, out, ctx) {
    Array.from(src.childNodes).forEach(function (c) { var r = renderNode(c, ctx); if (r) out.appendChild(r); });
    return out;
  }

  var TONES = ["info", "good", "warn", "danger", "accent", "card", "plain"];
  var COLORS = ["default", "secondary", "muted", "accent", "good", "warn", "danger", "c1", "c2", "c3", "c4", "c5", "c6"];
  function textNode(src, ctx) {
    var raw = src.textContent;
    if (!hasExpr(raw)) return document.createTextNode(raw);
    if (src.parentNode && src.parentNode.namespaceURI === SVGNS) {
      var t = document.createTextNode("");
      bind(ctx, function () { t.textContent = interpolate(raw, scopeOf(ctx)); });
      return t;
    }
    // a span keeps the binding alive when math inside it is typeset
    var span = document.createElement("span");
    bind(ctx, function () { span.textContent = interpolate(raw, scopeOf(ctx)); typeset(span); });
    return span;
  }

  function renderNode(src, ctx) {
    if (src.nodeType === 3) return textNode(src, ctx);
    if (src.nodeType !== 1) return null;
    var tag = src.tagName.toLowerCase(), a = function (n) { return src.getAttribute(n); }, e;
    switch (tag) {
      case "lead": return renderChildren(src, h("p", "lead"), ctx);
      case "title": case "dot-title": e = h("h3", "title " + (a("size") || "md")); return renderChildren(src, e, ctx);
      case "text": case "p":
        e = h("p", "text");
        if (a("size")) e.classList.add("size-" + a("size"));
        if (COLORS.indexOf(a("color")) >= 0) e.classList.add("color-" + a("color"));
        if (a("weight")) e.classList.add("weight-" + a("weight"));
        if (a("align")) e.style.textAlign = a("align");
        return renderChildren(src, e, ctx);
      case "b": case "strong": return renderChildren(src, h("strong"), ctx);
      case "i": case "em": return renderChildren(src, h("em"), ctx);
      case "code": return renderChildren(src, h("code"), ctx);
      case "mark": return renderChildren(src, h("mark"), ctx);
      case "sup": case "sub": case "small": case "span": return renderChildren(src, h(tag), ctx);
      case "br": return h("br");
      case "math": case "dot-math":
        // the tag is the delimiter; a model often adds its own $$ or \[ \] inside anyway
        var tex = src.textContent.trim().replace(/^\$\$([\s\S]*)\$\$$/, "$1").replace(/^\\\[([\s\S]*)\\\]$/, "$1").replace(/^\$([\s\S]*)\$$/, "$1");
        e = h("div", "math"); e.textContent = "$$" + tex + "$$"; return e;
      case "list": case "ul": case "ol":
        var marker = a("marker") || (tag === "ol" ? "number" : "bullet");
        e = h(marker === "number" ? "ol" : "ul", "list marker-" + marker);
        return renderChildren(src, e, ctx);
      case "item": case "li": return renderChildren(src, h("li"), ctx);
      case "callout": e = h("div", "callout tone-" + (TONES.indexOf(a("tone")) >= 0 ? a("tone") : "info")); return renderChildren(src, e, ctx);
      case "quote": case "blockquote":
        e = h("blockquote", "quote"); renderChildren(src, e, ctx);
        if (a("cite")) { var c = h("div", "quote-cite", e); c.textContent = a("cite"); }
        return e;
      case "badge": e = h("span", "badge tone-" + (a("tone") || "info")); return renderChildren(src, e, ctx);
      case "caption": case "dot-caption": return renderChildren(src, h("p", "caption"), ctx);
      case "cite": return citeNode(src);
      case "box": case "col": case "cell":
        e = h("div", "box" + (tag === "box" && a("tone") ? " tone-" + a("tone") : "") + (tag === "box" && a("border") !== null && a("border") !== undefined ? " bordered" : ""));
        if (a("gap")) e.style.gap = (4 * +a("gap")) + "px";
        if (a("pad")) e.style.padding = (4 * +a("pad")) + "px";
        return renderChildren(src, e, ctx);
      case "row":
        e = h("div", "row" + (a("wrap") !== null ? " wrap" : ""));
        if (a("gap")) e.style.gap = (4 * +a("gap")) + "px";
        if (a("align")) e.style.alignItems = a("align") === "start" ? "flex-start" : a("align") === "end" ? "flex-end" : a("align");
        return renderChildren(src, e, ctx);
      case "grid":
        // the panel is narrow: columns fall to fewer rows rather than squeezing their contents
        var cols = Math.max(1, Math.min(2, +a("cols") || 2));
        e = h("div", "grid"); e.style.gridTemplateColumns = "repeat(" + cols + ", minmax(0, 1fr))";
        if (a("gap")) e.style.gap = (4 * +a("gap")) + "px";
        return renderChildren(src, e, ctx);
      case "divider": case "hr": return h("hr", "divider");
      case "spacer": return h("div", "spacer");
      case "table": return tableNode(src, ctx);
      case "svg": return svgNode(src, ctx);
      case "chart": return chartNode(src);
      case "plot": return plotNode(src, ctx);
      case "image": case "img": return imageNode(src);
      case "steps": return renderChildren(src, h("div", "steps"), ctx);
      case "step": return stepNode(src, ctx);
      case "viz": return vizNode(src);
      case "quiz": return quizNode(src, ctx);
      case "followups": return followupsNode(src);
      case "state":
        var name = a("name");
        if (name && !Object.prototype.hasOwnProperty.call(panel.vars, name)) {
          var raw = a("value"), v;
          try { v = JSON.parse(raw); } catch (err) { try { v = evaluate(raw, panel.vars); } catch (err2) { v = raw; } }
          panel.vars[name] = v;
        }
        return null;
      case "slider": return sliderNode(src, ctx);
      case "button": return buttonNode(src, ctx);
      case "show": case "hide": return showNode(src, ctx, tag === "hide");
      case "each": return eachNode(src, ctx);
      case "a":
        var href = a("href") || "";
        e = h(/^https:\/\//.test(href) ? "a" : "span");
        if (e.tagName === "A") { e.href = href; e.target = "_blank"; }
        return renderChildren(src, e, ctx);
      case "h1": case "h2": case "h3": case "h4": e = h("h3", "title " + (tag === "h4" ? "sm" : "md")); return renderChildren(src, e, ctx);
      case "pre": e = h("pre"); e.textContent = src.textContent; return e;
      default:
        // anything unknown renders what is inside it, never a blank box
        var frag = document.createDocumentFragment();
        renderChildren(src, frag, ctx);
        return frag;
    }
  }

  function citeNode(src) {
    var e = h("p", "cite"), src_ = src.getAttribute("src") || "", label = src.getAttribute("label") || src.textContent.trim() || src_;
    e.appendChild(document.createTextNode("Source: "));
    if (/^https:\/\//.test(src_)) { var l = h("a", null, e); l.href = src_; l.target = "_blank"; l.textContent = label; }
    else e.appendChild(document.createTextNode(label));
    return e;
  }

  function tableNode(src, ctx) {
    var wrap = h("div", "table-wrap"), t = h("table", null, wrap);
    var rows = Array.from(src.querySelectorAll("tr"));
    rows.forEach(function (r) {
      var tr = h("tr", r.getAttribute("class") === "hl" ? "hl" : null, t);
      Array.from(r.children).forEach(function (cell) {
        var tag = cell.tagName.toLowerCase() === "th" ? "th" : "td";
        var c = h(tag, cell.hasAttribute("num") ? "num" : null, tr);
        renderChildren(cell, c, ctx);
      });
    });
    return wrap;
  }

  function imageNode(src) {
    var url = src.getAttribute("src") || "";
    if (!/^https:\/\//.test(url)) return null;
    var f = h("figure", "image"), img = h("img", null, f);
    img.src = url; img.alt = src.getAttribute("alt") || "";
    if (src.getAttribute("caption")) { var c = h("figcaption", "caption", f); c.textContent = src.getAttribute("caption"); }
    return f;
  }

  function stepNode(src, ctx) {
    // an explicit n is kept as written (a model may start at 0 and say [STEP:id:0]); a missing one counts on
    var given = src.getAttribute("n"), n = given !== null && given.trim() !== "" && isFinite(+given) ? +given : (ctx.stepCount = (ctx.stepCount || 0) + 1);
    var sec = h("section", "step"); sec.dataset.n = n;
    var head = h("div", "step-head", sec), num = h("span", "step-n", head), t = h("span", "step-title", head);
    num.textContent = n; t.textContent = src.getAttribute("title") || "";
    renderChildren(src, h("div", "step-body", sec), ctx);
    if (panel.step === n) sec.classList.add("current");
    return sec;
  }

  // ---- svg with the house style ----------------------------------------------------------------------------------
  function palette() {
    var cs = getComputedStyle(document.documentElement), g = function (n, f) { return (cs.getPropertyValue(n) || "").trim() || f; };
    return {c1: g("--viz-c1", "#2dd4bf"), c2: g("--viz-c2", "#60a5fa"), c3: g("--viz-c3", "#fbbf24"), c4: g("--viz-c4", "#4ade80"),
            c5: g("--viz-c5", "#f87171"), c6: g("--viz-c6", "#c084fc"), ink: g("--viz-ink", "#f0ebe3"), muted: g("--viz-muted", "#a39b90"),
            accent: g("--viz-accent", "#ff6b2c"), grid: g("--viz-grid", "rgba(255,255,255,0.07)"), axis: g("--viz-axis", "rgba(255,255,255,0.36)"),
            card: g("--viz-card", "#151311"),
            // the callout tones work as figure colors too
            good: g("--viz-c4", "#4ade80"), warn: g("--viz-c3", "#fbbf24"), danger: g("--viz-c5", "#f87171"), info: g("--viz-c2", "#60a5fa"),
            teal: g("--viz-c1", "#2dd4bf"), blue: g("--viz-c2", "#60a5fa"), amber: g("--viz-c3", "#fbbf24"), green: g("--viz-c4", "#4ade80"),
            red: g("--viz-c5", "#f87171"), purple: g("--viz-c6", "#c084fc"), white: g("--viz-ink", "#f0ebe3"), gray: g("--viz-muted", "#a39b90")};
  }
  var markerSeq = 0;
  var SVG_ALLOWED = /^(svg|g|line|path|rect|circle|ellipse|polygon|polyline|text|tspan|defs|marker|pattern|lineargradient|radialgradient|stop|clippath|title|use|vec|dot|each|show|hide)$/i;
  function svgNode(src, ctx) {
    var pal = palette();
    var svg = document.createElementNS(SVGNS, "svg");
    var defs = document.createElementNS(SVGNS, "defs"); svg.appendChild(defs);
    var markers = {};
    function marker(color) {
      if (markers[color]) return markers[color];
      var id = "pm" + (++markerSeq), m = document.createElementNS(SVGNS, "marker");
      [["id", id], ["viewBox", "0 0 10 10"], ["refX", "8.5"], ["refY", "5"], ["markerWidth", "8"], ["markerHeight", "8"], ["orient", "auto-start-reverse"]].forEach(function (kv) { m.setAttribute(kv[0], kv[1]); });
      var p = document.createElementNS(SVGNS, "path"); p.setAttribute("d", "M0 0.8 L10 5 L0 9.2 Z"); p.setAttribute("fill", color); m.appendChild(p);
      defs.appendChild(m); markers[color] = "url(#" + id + ")"; return markers[color];
    }
    function color(v) { return pal[v] || v; }
    function copyAttrs(from, to, cctx) {
      Array.from(from.attributes).forEach(function (at) {
        var n = at.name, v = at.value, lower = n.toLowerCase();
        // a name setAttribute rejects ("c<" from a half-written tag) would throw and stop the whole figure
        if (!/^[a-z_][\w:.-]*$/i.test(n)) return;
        if (/^on/.test(lower) || lower === "style" && /url\(|expression/i.test(v)) return;
        if ((lower === "href" || lower === "xlink:href") && !/^#/.test(v)) return;
        if (lower === "color" || lower === "arrow" || lower === "label") return;
        var setter = function (val) {
          if (lower === "stroke" || lower === "fill") val = color(val);
          to.setAttribute(n, val);
        };
        if (hasExpr(v)) bind(cctx, function () { setter(interpolateAttr(v, scopeOf(cctx))); });
        else setter(v);
      });
      var c = from.getAttribute("color");
      if (c) {
        var tagl = from.tagName.toLowerCase();
        if (tagl === "text" || tagl === "tspan") { if (!from.hasAttribute("fill")) to.setAttribute("fill", color(c)); }
        else { if (!from.hasAttribute("stroke")) to.setAttribute("stroke", color(c)); if ((tagl === "circle" || tagl === "polygon") && !from.hasAttribute("fill")) to.setAttribute("fill", color(c)); }
      }
      var arrow = from.getAttribute("arrow");
      if (arrow) {
        var mk = marker(color(to.getAttribute("stroke") || (c && color(c)) || pal.ink));
        if (arrow === "end" || arrow === "both") to.setAttribute("marker-end", mk);
        if (arrow === "start" || arrow === "both") to.setAttribute("marker-start", mk);
      }
    }
    function svgEl(tag) { return document.createElementNS(SVGNS, tag); }
    function walk(s, out, cctx) {
      Array.from(s.childNodes).forEach(function (c) {
        if (c.nodeType === 3) { if (c.textContent.trim() || out.tagName === "text" || out.tagName === "tspan") out.appendChild(textNode(c, cctx)); return; }
        if (c.nodeType !== 1) return;
        var tag = c.tagName.toLowerCase();
        if (!SVG_ALLOWED.test(tag)) return;   // scripts, foreignObject, images: dropped
        var num = function (n, d) { var v = c.getAttribute(n) || ""; if (hasExpr(v)) v = interpolateAttr(v, scopeOf(cctx)); var x = parseFloat(v); return isNaN(x) ? (d || 0) : x; };
        if (tag === "vec") {
          var g = svgEl("g"); out.appendChild(g);
          var draw = function () {
            while (g.firstChild) g.removeChild(g.firstChild);
            var x1 = num("x1"), y1 = num("y1"), x2 = num("x2"), y2 = num("y2"), col = color(c.getAttribute("color") || "c1"), len = Math.hypot(x2 - x1, y2 - y1);
            if (len < 1) return;
            var ux = (x2 - x1) / len, uy = (y2 - y1) / len;
            var halo = svgEl("line"); [["x1", x1], ["y1", y1], ["x2", x2], ["y2", y2], ["stroke", col], ["stroke-width", 9], ["opacity", 0.16], ["stroke-linecap", "round"]].forEach(function (kv) { halo.setAttribute(kv[0], kv[1]); }); g.appendChild(halo);
            var ln = svgEl("line"); [["x1", x1], ["y1", y1], ["x2", x2 - ux * 8], ["y2", y2 - uy * 8], ["stroke", col], ["stroke-width", 3], ["stroke-linecap", "round"]].forEach(function (kv) { ln.setAttribute(kv[0], kv[1]); }); g.appendChild(ln);
            var px = -uy, py = ux, s = 11, hd = svgEl("path");
            hd.setAttribute("d", "M" + x2 + " " + y2 + " L" + (x2 - ux * s + px * s * 0.45) + " " + (y2 - uy * s + py * s * 0.45) + " L" + (x2 - ux * s - px * s * 0.45) + " " + (y2 - uy * s - py * s * 0.45) + " Z");
            hd.setAttribute("fill", col); g.appendChild(hd);
            var label = c.getAttribute("label");
            if (label) { var t = svgEl("text"); t.setAttribute("x", x2 + ux * 10 + px * 10); t.setAttribute("y", y2 + uy * 10 + py * 10 + 4); t.setAttribute("fill", col); t.setAttribute("font-size", "16"); t.setAttribute("font-weight", "700"); t.setAttribute("font-style", "italic"); t.setAttribute("text-anchor", "middle"); t.textContent = hasExpr(label) ? interpolate(label, scopeOf(cctx)) : label; g.appendChild(t); }
          };
          bind(cctx, draw);
          return;
        }
        if (tag === "dot") {
          var gd = svgEl("g"); out.appendChild(gd);
          bind(cctx, function () {
            while (gd.firstChild) gd.removeChild(gd.firstChild);
            var col = color(c.getAttribute("color") || "ink"), cx = num("cx"), cy = num("cy");
            var ci = svgEl("circle"); ci.setAttribute("cx", cx); ci.setAttribute("cy", cy); ci.setAttribute("r", num("r", 4.5)); ci.setAttribute("fill", col); gd.appendChild(ci);
            var label = c.getAttribute("label");
            if (label) { var t = svgEl("text"); t.setAttribute("x", cx + 8); t.setAttribute("y", cy - 8); t.setAttribute("fill", col); t.setAttribute("font-size", "14"); t.setAttribute("font-weight", "600"); t.textContent = hasExpr(label) ? interpolate(label, scopeOf(cctx)) : label; gd.appendChild(t); }
          });
          return;
        }
        if (tag === "each") { out.appendChild(eachNode(c, Object.assign({}, cctx, {svgWalk: walk}), true)); return; }
        if (tag === "show" || tag === "hide") { out.appendChild(showNode(c, Object.assign({}, cctx, {svgWalk: walk}), tag === "hide", true)); return; }
        var el = svgEl(tag === "lineargradient" ? "linearGradient" : tag === "radialgradient" ? "radialGradient" : tag === "clippath" ? "clipPath" : tag);
        copyAttrs(c, el, cctx);
        if ((tag === "text" || tag === "tspan") && !c.hasAttribute("font-size")) el.setAttribute("font-size", "13");
        if (tag === "text" && !c.hasAttribute("fill") && !c.hasAttribute("color")) el.setAttribute("fill", pal.ink);
        out.appendChild(el);
        walk(c, el, cctx);
      });
    }
    var root = svgEl("g");
    copyAttrs(src, svg, ctx);
    if (!src.getAttribute("viewBox")) svg.setAttribute("viewBox", "0 0 360 220");
    svg.removeAttribute("width"); svg.removeAttribute("height");
    svg.setAttribute("class", "figure");
    svg.appendChild(root);
    walk(src, root, ctx);
    var fig = h("div", "svg-figure"); fig.appendChild(svg);
    return fig;
  }

  // ---- charts and plots ------------------------------------------------------------------------------------------
  function chartNode(src) {
    var wrap = h("div", "chart"), canvas = h("canvas", null, wrap);
    var labels = (src.getAttribute("labels") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var series = [];
    try { series = JSON.parse(src.getAttribute("series") || "[]"); } catch (e) { console.error("chart series not JSON"); }
    var kind = src.getAttribute("kind") || "bar", pal = palette(), cols = [pal.c2, pal.c3, pal.c1, pal.c4, pal.c5, pal.c6];
    var draw = function () {
      if (!window.Chart) return;
      new window.Chart(canvas, {
        type: kind === "area" ? "line" : kind,
        data: {labels: labels, datasets: series.map(function (s, i) { return {label: s.name || "", data: s.data || [], backgroundColor: cols[i % 6] + (kind === "line" ? "" : "cc"), borderColor: cols[i % 6], fill: kind === "area", tension: 0.25}; })},
        options: {animation: false, responsive: true, maintainAspectRatio: true, aspectRatio: 1.6,
                  plugins: {legend: {display: series.length > 1, labels: {color: pal.ink}}},
                  scales: {x: {ticks: {color: pal.muted}, grid: {color: pal.grid}}, y: {ticks: {color: pal.muted, callback: function (v) { var u = src.getAttribute("unit") || ""; return u === "%" ? v + "%" : u.charAt(0) === "$" ? "$" + v + u.slice(1) : u ? v + " " + u : v; }}, grid: {color: pal.grid}}}}
      });
    };
    if (window.Chart) setTimeout(draw, 0); else need("../vendor/chart.umd.min.js").then(draw);
    if (src.getAttribute("caption")) { var c = h("p", "caption", wrap); c.textContent = src.getAttribute("caption"); }
    return wrap;
  }
  function plotNode(src, ctx) {
    var pal = palette(), W = 360, H = 220, pad = 26;
    var fns = (src.getAttribute("fn") || "x").split("|").map(function (s) { return s.trim(); });
    var xr = (src.getAttribute("x") || "-5,5").split(",").map(Number), cols = [pal.c2, pal.c3, pal.c1, pal.c4];
    var svg = document.createElementNS(SVGNS, "svg"); svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("class", "figure");
    var fig = h("div", "svg-figure"); fig.appendChild(svg);
    bind(ctx, function () {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var samples = fns.map(function (f) { var pts = []; for (var i = 0; i <= 200; i++) { var x = xr[0] + (xr[1] - xr[0]) * i / 200, y; try { y = evaluate(f, Object.assign(scopeOf(ctx), {x: x})); } catch (e) { y = NaN; } if (isFinite(y)) pts.push([x, y]); } return pts; });
      var yr = src.getAttribute("y") ? src.getAttribute("y").split(",").map(Number) : (function () {
        var ys = [].concat.apply([], samples).map(function (p) { return p[1]; }).sort(function (a, b) { return a - b; });
        if (!ys.length) return [-1, 1];
        // trim the tails so a steep end does not flatten the part that matters (roots, a minimum)
        var lo = ys[Math.floor(ys.length * 0.02)], hi = ys[Math.ceil(ys.length * 0.85) - 1];
        lo = Math.min(lo, 0); hi = Math.max(hi, 0);
        var m = (hi - lo) * 0.1 || 1; return [lo - m, hi + m];
      })();
      var X = function (x) { return pad + (x - xr[0]) / (xr[1] - xr[0]) * (W - 2 * pad); }, Y = function (y) { return H - pad - (y - yr[0]) / (yr[1] - yr[0]) * (H - 2 * pad); };
      var line = function (x1, y1, x2, y2, col, w) { var l = document.createElementNS(SVGNS, "line"); l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2); l.setAttribute("stroke", col); l.setAttribute("stroke-width", w || 1); svg.appendChild(l); };
      var niceStep = function (span) { var raw = span / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * mag; };
      var tick = function (x, y, text, anchor) { var t = document.createElementNS(SVGNS, "text"); t.setAttribute("x", x); t.setAttribute("y", y); t.setAttribute("fill", pal.muted); t.setAttribute("font-size", "11.5"); t.setAttribute("text-anchor", anchor); t.textContent = text; svg.appendChild(t); };
      var sx = niceStep(xr[1] - xr[0]), sy = niceStep(yr[1] - yr[0]);
      var y0 = yr[0] <= 0 && yr[1] >= 0 ? Y(0) : H - pad, x0 = xr[0] <= 0 && xr[1] >= 0 ? X(0) : pad;
      for (var gx = Math.ceil(xr[0] / sx) * sx; gx <= xr[1] + 1e-9; gx += sx) { line(X(gx), pad - 6, X(gx), H - pad, pal.grid, 1); if (Math.abs(gx) > 1e-9) tick(X(gx), Math.min(H - 6, y0 + 14), show(gx), "middle"); }
      for (var gy = Math.ceil(yr[0] / sy) * sy; gy <= yr[1] + 1e-9; gy += sy) { line(pad, Y(gy), W - pad, Y(gy), pal.grid, 1); if (Math.abs(gy) > 1e-9) tick(Math.max(16, x0 - 5), Y(gy) + 4, show(gy), "end"); }
      if (yr[0] <= 0 && yr[1] >= 0) line(X(xr[0]), Y(0), X(xr[1]), Y(0), pal.axis, 1.3);
      if (xr[0] <= 0 && xr[1] >= 0) line(X(0), Y(yr[0]), X(0), Y(yr[1]), pal.axis, 1.3);
      samples.forEach(function (pts, i) {
        var p = document.createElementNS(SVGNS, "path");
        p.setAttribute("d", pts.map(function (q, j) { return (j ? "L" : "M") + X(q[0]).toFixed(1) + " " + Y(Math.max(yr[0], Math.min(yr[1], q[1]))).toFixed(1); }).join(" "));
        p.setAttribute("fill", "none"); p.setAttribute("stroke", cols[i % 4]); p.setAttribute("stroke-width", 2.5); svg.appendChild(p);
        var t = document.createElementNS(SVGNS, "text"); var last = pts[pts.length - 1] || [xr[1], 0];
        t.setAttribute("x", Math.min(W - 4, X(last[0]))); t.setAttribute("y", Math.max(12, Y(Math.max(yr[0], Math.min(yr[1], last[1]))) - 6)); t.setAttribute("fill", cols[i % 4]); t.setAttribute("font-size", "13"); t.setAttribute("text-anchor", "end");
        var labels = (src.getAttribute("label") || "").split("|");
        t.textContent = labels[i] ? labels[i].trim() : "y = " + fns[i].replace(/\*\*/g, "^").replace(/\s*\*\s*/g, ""); svg.appendChild(t);
      });
      var marksSrc = src.getAttribute("marks") || "";
      (hasExpr(marksSrc) ? interpolateAttr(marksSrc, scopeOf(ctx)) : marksSrc).split(",").filter(Boolean).forEach(function (m) {
        var x = +m; if (!isFinite(x)) return;
        var c = document.createElementNS(SVGNS, "circle"); c.setAttribute("cx", X(x)); c.setAttribute("cy", Y(0)); c.setAttribute("r", 4.5); c.setAttribute("fill", pal.accent); svg.appendChild(c);
        var t = document.createElementNS(SVGNS, "text"); t.setAttribute("x", X(x)); t.setAttribute("y", Y(0) + 17); t.setAttribute("fill", pal.ink); t.setAttribute("font-size", "12.5"); t.setAttribute("text-anchor", "middle"); t.textContent = show(x); svg.appendChild(t);
      });
    });
    return fig;
  }

  // ---- catalog widgets -------------------------------------------------------------------------------------------
  function need(path) {
    if (panel.loaded[path]) return panel.loaded[path];
    panel.loaded[path] = new Promise(function (ok, bad) {
      var s = document.createElement("script"); s.src = path; s.onload = ok; s.onerror = function () { bad(new Error("could not load " + path)); };
      document.head.appendChild(s);
    });
    return panel.loaded[path];
  }
  function matchTopic(topic) {
    var idx = window.VIZ_INDEX || [], words = (topic || "").toLowerCase().match(/[a-z0-9]+/g) || [];
    var best = null, bestScore = 0;
    idx.forEach(function (it) {
      var head = (it.id.replace(/-/g, " ") + " " + it.title).toLowerCase(), body = (it.shows || "").toLowerCase(), score = 0;
      words.forEach(function (w) { if (w.length < 3) return; if (head.indexOf(w) >= 0) score += 3; else if (body.indexOf(w) >= 0) score += 1; });
      if (score > bestScore) { bestScore = score; best = it.id; }
    });
    return bestScore >= 3 ? best : null;
  }
  function vizNode(src) {
    var id = src.getAttribute("id") || matchTopic(src.getAttribute("topic"));
    if (id && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) id = null;   // only a catalog id names a file to load
    if (!id) { post({type: "log", text: "no explainer matches topic \"" + (src.getAttribute("topic") || "") + "\""}); return null; }
    var host = h("div", "viz-host"), values = {};
    try { values = JSON.parse(src.getAttribute("values") || "{}"); } catch (e) { console.error("viz values not JSON"); }
    need("../viz/widgets/" + id + ".js").then(function () { Viz.mount(host, id, values, {title: src.getAttribute("title")}); typeset(host); })
      .catch(function () { host.remove(); post({type: "log", text: "no explainer named " + id}); });
    return host;
  }

  // ---- quiz and follow-ups ---------------------------------------------------------------------------------------
  function quizNode(src, ctx) {
    var id = src.getAttribute("id") || ("q" + Object.keys(panel.quiz).length);
    var multi = src.getAttribute("type") === "multi", correct = (src.getAttribute("correct") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var box = h("div", "quiz" + (multi ? " multi" : "")), q = h("p", "quiz-q", box);
    q.textContent = src.getAttribute("question") || "";
    var opts = Array.from(src.querySelectorAll("option")), list = h("div", "quiz-options", box), fb = h("p", "quiz-feedback", box);
    var state = panel.quiz[id] || (panel.quiz[id] = {chosen: [], done: false, tries: 0, missed: []});
    var letters = "ABCDEFGH";
    var paint = function () {
      Array.from(list.children).forEach(function (b) {
        var v = b.dataset.value, picked = state.chosen.indexOf(v) >= 0;
        b.classList.toggle("picked", picked);
        b.classList.toggle("right", state.done && correct.indexOf(v) >= 0);
        b.classList.toggle("wrong", (state.done && picked && correct.length && correct.indexOf(v) < 0) || state.missed.indexOf(v) >= 0);
      });
    };
    opts.forEach(function (o, i) {
      var v = o.getAttribute("value") || letters[i], b = h("button", "quiz-option", list);
      b.type = "button"; b.dataset.value = v;
      var l = h("span", "quiz-letter", b); l.textContent = letters[i] || v;
      var t = h("span", "quiz-text", b); renderChildren(o, t, ctx);
      b.addEventListener("click", function () {
        if (state.done && !multi) return;
        if (multi) { var k = state.chosen.indexOf(v); if (k >= 0) state.chosen.splice(k, 1); else state.chosen.push(v); paint(); return; }
        if (state.missed.indexOf(v) >= 0) return;
        var right = correct.length ? correct.indexOf(v) >= 0 : null;
        state.tries += 1;
        state.chosen = [v];
        // a first wrong pick gets its feedback and one more try before the answer shows
        if (right === false && state.tries === 1) { state.missed.push(v); paint(); fb.textContent = (o.getAttribute("feedback") || "Not quite.") + " Try another."; return; }
        state.done = true; paint();
        fb.textContent = o.getAttribute("feedback") || "";
        post({type: "quiz", id: id, choice: v, correct: right, tries: state.tries, question: q.textContent, text: t.textContent.trim()});
      });
    });
    var bar = h("div", "quiz-bar", box);
    if (multi) {
      var check = h("button", "quiz-check", bar); check.type = "button"; check.textContent = "check";
      check.addEventListener("click", function () {
        state.done = true; paint();
        var ok = correct.length ? state.chosen.slice().sort().join(",") === correct.slice().sort().join(",") : null;
        fb.textContent = ok === true ? "Right." : ok === false ? "Not quite: the right set is " + correct.join(", ") + "." : "";
        post({type: "quiz", id: id, choice: state.chosen.join(","), correct: ok, question: q.textContent,
              text: Array.from(list.children).filter(function (b) { return state.chosen.indexOf(b.dataset.value) >= 0; }).map(function (b) { return b.querySelector(".quiz-text").textContent.trim(); }).join("; ")});
      });
    }
    var hint = src.getAttribute("hint");
    if (hint) { var hb = h("button", "quiz-hint", bar); hb.type = "button"; hb.textContent = "hint"; hb.addEventListener("click", function () { fb.textContent = hint; }); }
    if (!bar.children.length) bar.remove();
    paint();
    return box;
  }
  function followupsNode(src) {
    var row = h("div", "followups");
    Array.from(src.querySelectorAll("chip")).forEach(function (c) {
      var b = h("button", "chip", row); b.type = "button"; b.textContent = c.textContent.trim() || c.getAttribute("ask");
      if (c.getAttribute("ask")) b.title = c.getAttribute("ask");   // what tapping it asks, on hover
      b.addEventListener("click", function () { post({type: "ask", text: c.getAttribute("ask") || c.textContent.trim()}); b.classList.add("sent"); });
    });
    return row;
  }

  // ---- the reactive pieces ---------------------------------------------------------------------------------------
  function refresh() { panel.blocks.forEach(function (b) { b.bindings.forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }); }
  function sliderNode(src, ctx) {
    var name = src.getAttribute("bind"), row = h("div", "slider-row");
    var lab = h("label", null, row); lab.textContent = src.getAttribute("label") || name;
    var val = h("span", "slider-val", row);
    var r = h("input", null, row); r.type = "range"; r.min = src.getAttribute("min") || 0; r.max = src.getAttribute("max") || 10; r.step = src.getAttribute("step") || "any";
    if (!Object.prototype.hasOwnProperty.call(panel.vars, name)) panel.vars[name] = +r.min;
    r.value = panel.vars[name];
    r.addEventListener("input", function () { panel.vars[name] = +r.value; refresh(); });
    var format = src.getAttribute("format");
    bind(ctx, function () {
      var v = panel.vars[name];
      val.textContent = format === "pct" ? FUNCS.pct(v) : format === "money" ? FUNCS.money(v, 0) : show(v);
      if (+r.value !== v) r.value = v;
    });
    return row;
  }
  function buttonNode(src, ctx) {
    var b = h("button", "btn"); b.type = "button"; renderChildren(src, b, ctx);
    var set = src.getAttribute("set"), ask = src.getAttribute("ask"), when = src.getAttribute("disabled-when");
    b.addEventListener("click", function () {
      if (set) { assign(set, panel.vars, ctx.loop || {}); refresh(); }
      if (ask) post({type: "ask", text: ask});
    });
    if (when) bind(ctx, function () { try { b.disabled = !!evaluate(when, scopeOf(ctx)); } catch (e) {} });
    return b;
  }
  function showNode(src, ctx, invert, inSvg) {
    var wrap = inSvg ? document.createElementNS(SVGNS, "g") : h("div", "show");
    var cond = src.getAttribute("when") || "false";
    if (inSvg) ctx.svgWalk(src, wrap, ctx); else renderChildren(src, wrap, ctx);
    bind(ctx, function () {
      var on; try { on = !!evaluate(cond, scopeOf(ctx)); } catch (e) { on = false; }
      if (invert) on = !on;
      if (inSvg) wrap.setAttribute("display", on ? "inline" : "none"); else wrap.style.display = on ? "" : "none";
    });
    return wrap;
  }
  function eachNode(src, ctx, inSvg) {
    var wrap = inSvg ? document.createElementNS(SVGNS, "g") : h("div", "each");
    var listSrc = src.getAttribute("in") || "range(0)", as = src.getAttribute("as") || "i";
    var own = [];
    var build = function () {
      while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
      var items; try { items = evaluate(listSrc, scopeOf(ctx)); } catch (e) { items = []; }
      if (!Array.isArray(items)) items = [];
      own.length = 0;
      items.slice(0, 400).forEach(function (it, k) {
        var loop = Object.assign({}, ctx.loop || {}); loop[as] = it; loop[as + "_index"] = k;
        var sub = {bindings: own, loop: loop, svgWalk: ctx.svgWalk};
        if (inSvg) ctx.svgWalk(src, wrap, sub); else renderChildren(src, wrap, sub);
      });
    };
    // the list itself is re-evaluated on every change; the bindings inside follow
    bind(ctx, build);
    return wrap;
  }

  // ---- blocks, streaming, steps ----------------------------------------------------------------------------------
  function typeset(el) {
    if (!window.katex) return;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {acceptNode: function (n) {
      var p = n.parentNode; if (!p || !p.closest) return NodeFilter.FILTER_REJECT;
      if (p.closest("svg, code, pre, .katex, textarea, script, style")) return NodeFilter.FILTER_REJECT;
      return MATH_SPAN.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    }});
    var nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      var parts = n.nodeValue.split(MATH_SPAN), frag = document.createDocumentFragment();
      parts.forEach(function (part, i) {
        if (i % 2 === 0) { if (part) frag.appendChild(document.createTextNode(part)); return; }
        var display = /^\$\$|^\\\[/.test(part);
        var tex = part.replace(/^\$\$|\$\$$/g, "").replace(/^\\\[|\\\]$/g, "").replace(/^\\\(|\\\)$/g, "");
        if (!display && part.charAt(0) === "$") tex = part.slice(1, -1);
        var span = document.createElement(display ? "div" : "span");
        try { katex.render(tex, span, {displayMode: display, throwOnError: false, strict: "ignore"}); } catch (e) { span.textContent = part; }
        frag.appendChild(span);
      });
      n.parentNode.replaceChild(frag, n);
    });
  }
  // A chunk can end inside a tag ("<ellipse c", "cy=\""): parsed as it stands, the tag's name or value swallows the
  // closing </body> and setAttribute throws (214 warnings in dot.log, 2026-10-17 to 10-19). Mid-stream, wait for its ">".
  function settled(markup) { return markup.replace(/<[^<>]*$/, ""); }
  function renderAll(streaming) {
    var nodes = parseBlocks(streaming ? settled(panel.markup) : panel.markup);
    var keep = [];
    nodes.forEach(function (n, i) {
      var key = blockKey(n), old = panel.blocks[i];
      if (old && old.key === key) { keep.push(old); return; }
      var ctx = {bindings: []};
      var dom = h("div", "block");
      var r = renderNode(n, ctx);
      if (r) dom.appendChild(r);
      if (old) content.replaceChild(dom, old.dom); else content.appendChild(dom);
      typeset(dom);
      keep.push({key: key, dom: dom, bindings: ctx.bindings});
    });
    for (var j = nodes.length; j < panel.blocks.length; j++) panel.blocks[j].dom.remove();
    panel.blocks = keep;
    if (panel.step !== null) setStep(panel.step, true);
  }
  var pending = 0;
  function schedule() { if (pending) return; pending = requestAnimationFrame(function () { pending = 0; renderAll(true); }); }

  function setStep(n, quiet) {
    panel.step = n;
    var target = null;
    Array.from(content.querySelectorAll(".step")).forEach(function (s) { var on = +s.dataset.n === n; s.classList.toggle("current", on); if (on) target = s; });
    if (target && !quiet && Date.now() - panel.userScrolledAt > 4000) target.scrollIntoView({behavior: "smooth", block: "nearest"});
  }

  function load(markup, opts) {
    opts = opts || {};
    panel.id = opts.id || panel.id || "panel";
    panel.title = opts.title || "";
    if (opts.reset !== false) { panel.blocks.forEach(function (b) { b.dom.remove(); }); panel.blocks = []; panel.vars = {}; panel.quiz = {}; panel.step = null; }
    titleEl.textContent = panel.title;
    panel.markup = markup || "";
    renderAll();
  }

  document.addEventListener("DOMContentLoaded", function () {
    content = document.getElementById("content");
    titleEl = document.getElementById("title");
    document.getElementById("close").addEventListener("click", function () { post({type: "close"}); });
    var scroller = document.getElementById("scroller");
    scroller.addEventListener("wheel", function () { panel.userScrolledAt = Date.now(); }, {passive: true});
    document.addEventListener("mouseup", function () {
      var sel = window.getSelection(), text = sel ? sel.toString().trim() : "";
      if (!text || text.length < 2) return;
      var node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
      var step = node && node.closest ? node.closest(".step") : null;
      post({type: "selection", text: text.slice(0, 600), step: step ? +step.dataset.n : 0});
    });
    document.addEventListener("viz:change", function (e) { post({type: "event", kind: "viz", data: e.detail, card: panel.id}); });
    post({type: "ready"});
    if (window.__pendingLoad) { load(window.__pendingLoad.markup, window.__pendingLoad.opts); }
  });

  window.panel = {
    load: function (markup, opts) { if (!content) { window.__pendingLoad = {markup: markup, opts: opts}; return; } load(markup, opts); },
    append: function (chunk) { panel.markup += chunk; schedule(); },
    finish: function () { renderAll(); },
    setStep: function (n) { setStep(+n); },
    vars: function () { return Object.assign({}, panel.vars); },
    markup: function () { return panel.markup; },
    _evaluate: evaluate
  };
})();
