// Dot's notes window (protocol.md section 4): one class's notes as an outline that Dot appends to while he types in
// the same lines. Plain DOM, classic script. Dot drives it through window.notes; the page answers through the `notes`
// message handler. Every line is its own contenteditable, so Dot can add lines around the one he is in without
// touching his caret.
(function () {
  "use strict";

  // Pandoc's rule for single dollars, as the panel uses it: "$5 and $7" stays money.
  var MATH_SPAN = /(\$\$[\s\S]+?\$\$|\$(?!\s)[^$\n]*?[^\s\\]\$(?!\d)|\$[^$\s\\]\$(?!\d)|\\\([\s\S]*?\\\))/;
  var AUTHORS = {dot: 1, him: 1, added: 1};
  var DEBOUNCE = 700;

  var state = {focused: null, focusPosted: undefined, hisCounter: 0, heading: "", title: "", base: "", mode: "live",
               endArmed: 0, recallEnds: 0, recallTimer: 0, marks: {}, sourceFor: null};
  var els = {};

  function post(msg) {
    try { window.webkit.messageHandlers.notes.postMessage(msg); } catch (e) { (window.__posted = window.__posted || []).push(msg); }
  }
  window.addEventListener("error", function (e) { post({type: "log", text: String(e.message || e)}); });

  function h(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    return el;
  }

  // ---- one line of Markdown: **bold**, *italic*, `code`, $math$; everything else is text ---------------------------
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function inline(raw) {
    var keep = [];
    function stash(html) { keep.push(html); return "\u0000" + (keep.length - 1) + "\u0000"; }
    var s = String(raw || "").replace(/<!--[\s\S]*?-->/g, "").replace(/\u0000/g, "").replace(/`([^`\n]+)`/g, function (_, c) { return stash("<code>" + esc(c) + "</code>"); });
    s = s.split(MATH_SPAN).map(function (part, i) {
      if (i % 2 === 0 || !window.katex) return part;
      var tex = part.charAt(0) === "$" ? part.replace(/^\$\$?|\$\$?$/g, "") : part.slice(2, -2);
      try { return stash(katex.renderToString(tex, {displayMode: false, throwOnError: false, strict: "ignore"})); } catch (e) { return part; }
    }).join("");
    s = esc(s)
      .replace(/\*\*(?=\S)(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^\w*])\*(?=\S)([^*\n]+?)\*(?![\w*])/g, "$1<em>$2</em>");
    return s.replace(/\u0000(\d+)\u0000/g, function (_, n) { return keep[+n]; });
  }

  // Image paths in a course file are relative to its folder (Dot passes it as `base`); absolute and file: paths are
  // served through the same dotnotes: scheme.
  function resolve(src) {
    if (!src) return "";
    if (/^(data:|dotnotes:)/i.test(src)) return src;
    if (/^file:\/\//i.test(src)) { try { return "dotnotes://local" + new URL(src).pathname; } catch (e) { return ""; } }
    if (src.charAt(0) === "/") return "dotnotes://local" + encodeURI(src);
    try { return state.base ? new URL(src, state.base).href : src; } catch (e) { return src; }
  }

  // ---- lines ----------------------------------------------------------------------------------------------------------
  // A line: {id, depth, text, author, kind, src, at, sent, dirty, timer, el, textEl}. `kind` is bullet, image (a board
  // photo) or slide; `at` is the clock time the line came from. `sent` is false only for his new lines that Dot has not
  // been told about yet (the empty line at the bottom, a line Enter just made).
  function lines() { return Array.prototype.map.call(els.lines.children, function (el) { return el._line; }); }
  function find(id) { var all = lines(); for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i]; return null; }
  function prevLine(l) { var p = l.el.previousElementSibling; return p ? p._line : null; }
  function nextLine(l) { var n = l.el.nextElementSibling; return n ? n._line : null; }
  function isLast(l) { return !l.el.nextElementSibling; }
  function editable(l) { return l && l.kind === "bullet"; }
  function kindOf(k) { return k === "image" || k === "slide" ? k : "bullet"; }
  // A line's text never carries an HTML comment; a timestamp left at its end ("<!--@11:42:10-->") becomes its `at`.
  function cleanText(text, at) {
    text = String(text == null ? "" : text);
    var m = /\s*<!--@([^>]*?)-->\s*$/.exec(text);
    if (m) { text = text.slice(0, m.index); if (!at) at = m[1].trim(); }
    return {text: text.replace(/<!--[\s\S]*?-->/g, ""), at: at || ""};
  }
  function clock(at) { var m = /^(\d{1,2}:\d{2})/.exec(at); return m ? m[1] : at; }
  function blankNew(l) { return !l.sent && !l.text; }
  function clampDepth(d) { d = parseInt(d, 10); return isNaN(d) ? 0 : Math.max(0, Math.min(3, d)); }
  function bumpCounter(id) { var m = /^h(\d+)$/.exec(id || ""); if (m) state.hisCounter = Math.max(state.hisCounter, +m[1]); }

  function makeLine(b, sent) {
    var c = cleanText(b.text, b.at);
    var l = {id: String(b.id || ""), depth: clampDepth(b.depth), text: c.text, at: c.at, author: AUTHORS[b.author] ? b.author : "dot",
             kind: kindOf(b.kind), src: b.src || "", sent: sent, dirty: false, timer: 0};
    var el = h("div", "line");
    el._line = l; l.el = el;
    el.appendChild(h("span", "bullet"));
    if (l.kind !== "bullet") {
      el.appendChild(h("figure"));
    } else {
      var t = h("div", "text");
      t.setAttribute("contenteditable", "plaintext-only");
      // his shorthand (u, ur, b/c, rlly) must never be autocorrected; spellcheck off turns that off in WebKit too
      t.setAttribute("spellcheck", "false");
      t.setAttribute("autocorrect", "off");
      t.setAttribute("autocapitalize", "off");
      l.textEl = t;
      el.appendChild(t);
    }
    bumpCounter(l.id);
    paint(l);
    return l;
  }

  function newHisLine(depth, text) {
    var n = state.hisCounter + 1;
    while (find("h" + n)) n++;
    state.hisCounter = n;
    var l = makeLine({id: "h" + n, depth: depth, text: text || "", author: "him"}, false);
    if (text) l.dirty = true;
    return l;
  }

  function paintClasses(l) {
    var c = l.el.classList;
    ["d0", "d1", "d2", "d3", "dot", "him", "added"].forEach(function (k) { c.remove(k); });
    c.add("d" + l.depth); c.add(l.author);
    c.toggle("image", l.kind === "image");
    c.toggle("slide", l.kind === "slide");
    c.toggle("unsent", !l.sent);
    l.el.dataset.id = l.id;
  }
  function shown(l) { return l.author === "added" ? l.text.replace(/^⁺\s*/, "") : l.text; }
  function paintText(l) {
    if (l.kind !== "bullet") {
      var fig = l.el.querySelector("figure");
      fig.textContent = "";
      var img = h("img"); img.alt = l.text; img.src = resolve(l.src);
      fig.appendChild(img);
      if (l.text) fig.appendChild(h("figcaption", null, l.text));
      return;
    }
    if (l === state.focused) return;   // he is in it: his raw text stays exactly as he left it
    l.textEl.innerHTML = inline(shown(l));
  }
  // On hover: the time chip (what was said then) and the explain button.
  function paintTools(l) {
    var tools = l.el.querySelector(".tools");
    if (!tools) { tools = h("span", "tools"); l.el.appendChild(tools); }
    tools.textContent = "";
    if (l.at) {
      var chip = h("button", "at", clock(l.at));
      chip.type = "button"; chip.title = "what was said at " + l.at; chip.tabIndex = -1;
      tools.appendChild(chip);
    }
    var x = h("button", "explain", "?");
    x.type = "button"; x.title = "explain this"; x.tabIndex = -1;
    tools.appendChild(x);
  }
  // The explainer marker in the right margin: queued (hollow), ready (filled; a click shows it), shown (faint).
  function paintMark(l) {
    var s = state.marks[l.id], dot = l.el.querySelector(".xdot");
    if (!s) { if (dot) dot.parentNode.removeChild(dot); return; }
    if (!dot) { dot = h("button"); dot.type = "button"; dot.tabIndex = -1; l.el.appendChild(dot); }
    dot.className = "xdot " + s;
    dot.title = s === "ready" ? "an explanation is ready: show it" : s === "queued" ? "an explanation is coming" : "explained";
  }
  function paint(l) { paintClasses(l); paintText(l); paintTools(l); paintMark(l); }
  function fresh(l) {
    l.el.classList.add("fresh");
    setTimeout(function () { l.el.classList.remove("fresh"); }, 700);
  }

  // There is always an empty line of his at the bottom to type into (unless he is typing in the last line now).
  function ensureTail() {
    var all = lines(), last = all[all.length - 1];
    all.forEach(function (l) { l.el.classList.remove("tail"); });
    if (last && (blankNew(last) || last === state.focused)) {
      if (blankNew(last)) markTail(last);
      return;
    }
    var t = newHisLine(0, "");
    els.lines.appendChild(t.el);
    markTail(t);
  }
  function markTail(l) { l.el.classList.add("tail"); if (l.textEl) l.textEl.setAttribute("data-placeholder", "type a note"); }

  // ---- what he does -----------------------------------------------------------------------------------------------------
  function postFocus(id) {
    if (state.focusPosted === id) return;
    state.focusPosted = id;
    post({type: "focus", id: id});
  }

  // Dot hears about his line once it has words: a new line as `add`, a change as `edit` (and the line becomes his).
  function flush(l) {
    clearTimeout(l.timer); l.timer = 0;
    if (!l.dirty) return;
    l.dirty = false;
    if (!l.sent) {
      if (!l.text.trim()) return;
      l.sent = true;
      var p = prevLine(l);
      while (p && !p.sent) p = prevLine(p);
      post({type: "add", id: l.id, after: p ? p.id : null, depth: l.depth, text: l.text});
    } else {
      l.author = "him";
      post({type: "edit", id: l.id, text: l.text});
    }
    paintClasses(l);
  }
  function flushAll() { lines().forEach(flush); }
  function schedule(l) {
    clearTimeout(l.timer);
    l.timer = setTimeout(function () { flush(l); }, DEBOUNCE);
  }

  function startEditing(l) {
    if (state.focused === l) return;
    if (state.focused && state.focused !== l) stopEditing(state.focused);
    state.focused = l;
    l.el.classList.add("editing");
    // rendered math or bold goes back to the raw text he can edit; plain text is left alone so the click's caret stays
    if (l.textEl.textContent !== l.text) { l.textEl.textContent = l.text; setCaret(l, null); }
    postFocus(l.id);
  }
  function stopEditing(l) {
    if (state.focused === l) state.focused = null;
    l.el.classList.remove("editing");
    flush(l);
    if (!l.text.trim() && !isLast(l) && l.el.parentNode) {
      // an empty line he walked away from is not a note
      removeLine(l, true);
    } else {
      paintText(l);
    }
    ensureTail();
    setTimeout(function () { if (!state.focused) postFocus(null); }, 0);
  }

  function removeLine(l, tell) {
    clearTimeout(l.timer);
    if (state.focused === l) { state.focused = null; l.el.classList.remove("editing"); }
    if (l.el.parentNode) l.el.parentNode.removeChild(l.el);
    if (tell && l.sent) post({type: "remove", id: l.id});
  }

  function setCaret(l, offset) {
    var t = l.textEl, node = t.firstChild, sel = window.getSelection(), r = document.createRange();
    if (node && node.nodeType === 3) {
      var len = node.nodeValue.length;
      r.setStart(node, offset == null ? len : Math.min(offset, len));
    } else {
      r.selectNodeContents(t); r.collapse(offset === 0);
    }
    r.collapse(true);
    sel.removeAllRanges(); sel.addRange(r);
  }
  function caretOffset(l) {
    var sel = window.getSelection();
    if (!sel.rangeCount || !l.textEl.contains(sel.anchorNode)) return l.text.length;
    var r = sel.getRangeAt(0), pre = document.createRange();
    pre.selectNodeContents(l.textEl);
    pre.setEnd(r.startContainer, r.startOffset);
    return pre.toString().length;
  }
  function caretRect() {
    var sel = window.getSelection();
    if (!sel.rangeCount) return null;
    var rects = sel.getRangeAt(0).getClientRects();
    return rects.length ? rects[0] : null;
  }
  function focusLine(l, offset) {
    if (!editable(l)) return;
    l.textEl.focus();
    if (state.focused !== l) startEditing(l);   // focus() does not always fire focusin when the window is not key
    setCaret(l, offset);
  }

  function setDepth(l, d) {
    if (d === l.depth) return;
    l.depth = d;
    paintClasses(l);
    if (l.sent) { flush(l); post({type: "indent", id: l.id, depth: d}); }
  }

  function onEnter(l) {
    var at = caretOffset(l);
    if (!l.text.trim()) { if (l.depth > 0) setDepth(l, l.depth - 1); return; }
    if (at === 0) {
      // at the start of a line: a new empty line above it, as outliners do
      var above = newHisLine(l.depth, "");
      els.lines.insertBefore(above.el, l.el);
      return;
    }
    var rest = l.text.slice(at);
    if (rest) { l.text = l.text.slice(0, at); l.textEl.textContent = l.text; l.dirty = true; }
    flush(l);
    var next = nextLine(l), target;
    if (next && blankNew(next) && next.kind === "bullet" && !rest) {
      target = next;
      target.depth = l.depth; paintClasses(target);
    } else {
      target = newHisLine(l.depth, rest);
      els.lines.insertBefore(target.el, l.el.nextElementSibling);
    }
    focusLine(target, 0);
    if (rest) schedule(target);
    follow();
  }

  function onTab(l, out) {
    var prev = prevLine(l);
    var max = prev ? Math.min(3, prev.depth + 1) : 0;
    var d = out ? Math.max(0, l.depth - 1) : (l.depth + 1 <= max ? l.depth + 1 : l.depth);
    setDepth(l, d);
  }

  function onBackspace(l, e) {
    if (l.text.length) {
      // at the very start of an indented line, Backspace outdents first
      var sel = window.getSelection();
      if (l.depth > 0 && sel.isCollapsed && caretOffset(l) === 0) { e.preventDefault(); setDepth(l, l.depth - 1); }
      return;
    }
    e.preventDefault();
    var p = prevLine(l);
    while (p && !editable(p)) p = prevLine(p);
    if (isLast(l) && !l.sent) { if (p) focusLine(p, null); return; }   // the bottom line stays
    var n = nextLine(l);
    removeLine(l, true);
    if (p) focusLine(p, null); else if (editable(n)) focusLine(n, 0);
    ensureTail();
  }

  function onArrow(l, e, up) {
    var r = caretRect(), box = l.textEl.getBoundingClientRect();
    var edge = r ? (up ? r.top - box.top < 12 : box.bottom - r.bottom < 12) : (up ? caretOffset(l) === 0 : caretOffset(l) === l.text.length);
    if (!edge) return;
    var t = up ? prevLine(l) : nextLine(l);
    while (t && !editable(t)) t = up ? prevLine(t) : nextLine(t);
    if (!t) return;
    e.preventDefault();
    focusLine(t, up ? null : 0);
  }

  // A paste of several lines becomes several lines of his ("- " bullets and two-space indents keep their depth).
  function onPaste(l, e) {
    var text = e.clipboardData && e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    var rows = text.replace(/\r/g, "").split("\n").filter(function (s) { return s.trim(); });
    if (!rows.length) return;
    var parse = function (s) {
      var m = /^(\s*)(?:[-*•]\s+)?(.*)$/.exec(s.replace(/\t/g, "  "));
      return {depth: Math.floor(m[1].length / 2), text: m[2]};
    };
    // the first row joins the line at the caret; a bullet marker on it is dropped
    document.execCommand("insertText", false, rows[0].replace(/^\s*[-*\u2022]\s+/, ""));
    readText(l);
    if (rows.length === 1) return;
    flush(l);
    var at = l;
    rows.slice(1).forEach(function (row) {
      var p = parse(row);
      var nl = newHisLine(clampDepth(l.depth + p.depth), p.text);
      els.lines.insertBefore(nl.el, at.el.nextElementSibling);
      flush(nl);
      at = nl;
    });
    focusLine(at, null);
    ensureTail();
    follow();
  }

  function readText(l) {
    l.text = (l.textEl.textContent || "").replace(/\r?\n/g, " ");
    l.dirty = true;
    l.el.classList.remove("tail");
    schedule(l);
  }

  function lineOf(target) {
    var el = target && target.closest ? target.closest(".line") : null;
    return el ? el._line : null;
  }

  function bind() {
    var L = els.lines;
    L.addEventListener("focusin", function (e) { var l = lineOf(e.target); if (l && e.target === l.textEl) startEditing(l); });
    L.addEventListener("focusout", function (e) { var l = lineOf(e.target); if (l && e.target === l.textEl && state.focused === l) stopEditing(l); });
    L.addEventListener("input", function (e) { var l = lineOf(e.target); if (l && e.target === l.textEl) readText(l); });
    L.addEventListener("paste", function (e) { var l = lineOf(e.target); if (l && l.textEl) onPaste(l, e); });
    L.addEventListener("keydown", function (e) {
      var l = lineOf(e.target);
      if (!l || e.target !== l.textEl || e.isComposing) return;
      if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); onEnter(l); }
      else if (e.key === "Tab") { e.preventDefault(); onTab(l, e.shiftKey); }
      else if (e.key === "Backspace") onBackspace(l, e);
      else if (e.key === "ArrowUp" && !e.shiftKey) onArrow(l, e, true);
      else if (e.key === "ArrowDown" && !e.shiftKey) onArrow(l, e, false);
      else if (e.key === "Escape") l.textEl.blur();
    });
    // the line's buttons never take focus from the line he is in
    L.addEventListener("mousedown", function (e) { if (e.target.closest && e.target.closest(".tools, .xdot")) e.preventDefault(); });
    L.addEventListener("click", function (e) {
      var t = e.target, l = lineOf(t);
      if (!l || !t.closest) return;
      if (t.closest(".explain")) {
        if (!l.text.trim()) return;
        flush(l);
        post({type: "explain", id: l.id, text: l.text});
      } else if (t.closest(".at")) {
        openSource(l, l.at, "");
        post({type: "source", id: l.id});
      } else if (t.closest(".xdot")) {
        if (state.marks[l.id] === "ready") post({type: "showExplain", id: l.id});
      } else if (t.tagName === "IMG" && l.kind !== "bullet") {
        openLightbox(t.src, l.text);
      }
    });
    els.lightbox.addEventListener("click", closeLightbox);
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      if (!els.lightbox.hidden) { closeLightbox(); e.preventDefault(); }
      if (!els.source.hidden) { closeSource(); e.preventDefault(); }
    });
    // a click anywhere else closes the transcript popover
    document.addEventListener("mousedown", function (e) {
      if (!els.source.hidden && e.target.closest && !e.target.closest("#source, .at")) closeSource();
    });
    els.deadlineAdd.addEventListener("click", function () {
      var ids = Array.prototype.filter.call(els.deadlineList.querySelectorAll("input"), function (b) { return b.checked; })
        .map(function (b) { return b.value; });
      sendDeadlines(ids);
    });
    els.deadlineSkip.addEventListener("click", function () { sendDeadlines([]); });
    // a click in the empty space under the notes goes to the bottom line
    els.room.addEventListener("mousedown", function (e) {
      e.preventDefault();
      var all = lines(), last = all[all.length - 1];
      if (editable(last)) focusLine(last, null);
    });

    els.end.addEventListener("click", function () {
      if (els.end.disabled) return;
      if (Date.now() - state.endArmed > 3000) {
        // one stray click must not end a class: the first arms it, a second within 3 s ends it
        var armed = state.endArmed = Date.now();
        els.end.classList.add("confirm"); els.end.textContent = "End class?";
        setTimeout(function () { if (state.endArmed === armed) disarmEnd(); }, 3000);
        return;
      }
      disarmEnd();
      flushAll();
      els.end.disabled = true; els.end.textContent = "Ending";
      post({type: "end"});
    });

    els.submit.addEventListener("click", submitRecall);
    els.skip.addEventListener("click", skipRecall);
    els.recallText.addEventListener("keydown", function (e) { if (e.key === "Enter" && e.metaKey) { e.preventDefault(); submitRecall(); } });
  }
  function disarmEnd() {
    state.endArmed = 0;
    els.end.classList.remove("confirm");
    if (!els.end.disabled) els.end.textContent = "End class";
  }

  // ---- what Dot does ----------------------------------------------------------------------------------------------------
  // Dot's new line goes at the end of the notes, but before the line he is in when that line is the last one (and
  // before the empty bottom line), so the line he types in stays at the bottom and his caret never moves.
  function appendAnchor() {
    var all = lines(), f = state.focused, i;
    if (f) {
      i = all.indexOf(f);
      if (i >= 0 && all.slice(i + 1).every(blankNew)) return f;
    }
    i = all.length;
    while (i > 0 && blankNew(all[i - 1]) && all[i - 1] !== f) i--;
    return all[i] || null;
  }
  function appendBlock(b) {
    if (!b || !b.id) return;
    if (find(b.id)) { replaceBlock(b); return; }
    var l = makeLine(b, true), before = appendAnchor();
    els.lines.insertBefore(l.el, before ? before.el : null);
    fresh(l);
  }
  function insertBlockAfter(after, b) {
    if (!b || !b.id) return;
    if (find(b.id)) { replaceBlock(b); return; }
    var a = find(after);
    if (!a) { appendBlock(b); return; }
    var l = makeLine(b, true);
    els.lines.insertBefore(l.el, a.el.nextElementSibling);
    fresh(l);
  }
  // A rewrite never lands on the line he is in, on a change of his not yet sent, or (from Dot) on a line that is his.
  function replaceBlock(b) {
    var l = b && find(b.id);
    if (!l || l === state.focused || l.dirty) return;
    if (l.author === "him" && b.author !== "him") return;
    if (kindOf(b.kind) !== l.kind) {
      var fresh2 = makeLine(b, true);
      l.el.parentNode.replaceChild(fresh2.el, l.el);
      return;
    }
    var c = cleanText(b.text == null ? l.text : b.text, b.at || l.at);
    l.text = c.text;
    l.at = c.at;
    if (b.depth != null) l.depth = clampDepth(b.depth);
    if (AUTHORS[b.author]) l.author = b.author;
    l.src = b.src || l.src;
    paint(l);
  }
  function removeById(id) {
    var l = find(id);
    if (!l || l === state.focused) return;   // the line he is typing in stays until he leaves it
    removeLine(l, false);
  }

  // Newest line in view, unless he scrolled up to read, or he is editing a line further up.
  function follow() {
    var f = state.focused;
    if (f) {
      var all = lines(), i = all.indexOf(f);
      if (!all.slice(i + 1).every(blankNew)) return;
    }
    els.scroller.scrollTop = els.scroller.scrollHeight;
  }
  // read when Dot writes, not tracked from scroll events: he has scrolled up when the bottom is out of view
  function atBottom() { var s = els.scroller; return s.scrollHeight - s.scrollTop - s.clientHeight < 60; }

  function apply(ops) {
    var stuck = atBottom();
    (ops || []).forEach(function (op) {
      if (!op) return;
      if (op.op === "append") appendBlock(op.block);
      else if (op.op === "insertAfter") insertBlockAfter(op.after, op.block);
      else if (op.op === "replace") replaceBlock(op.block);
      else if (op.op === "remove") removeById(op.id);
    });
    ensureTail();
    if (stuck) follow();
    if (state.sourceFor) { var sl = find(state.sourceFor); if (sl) placeSource(sl); else closeSource(); }
  }

  function load(data) {
    data = data || {};
    var f = state.focused, keepId = f ? f.id : null;
    flushAll();
    state.focused = null;
    els.lines.textContent = "";
    state.hisCounter = 0;
    if (data.base != null) state.base = data.base;
    // review: his saved notes opened again; no End class, no hearing line, editing as live
    state.mode = data.mode === "review" ? "review" : "live";
    document.body.classList.toggle("review", state.mode === "review");
    state.marks = {};
    hearing("");
    closeSource(); closeLightbox();
    els.recallHistory.textContent = "";
    document.body.classList.remove("doc-mode");
    els.doc.hidden = true;
    els.course.textContent = data.course || "";
    state.heading = data.heading || "";
    setTitle(data.title || "");
    setStatus(data.status || "");
    (data.blocks || []).forEach(function (b) { if (b && b.id) els.lines.appendChild(makeLine(b, true).el); });
    ensureTail();
    els.end.disabled = false;
    disarmEnd();
    hideDock();
    var again = keepId && find(keepId);
    if (again) focusLine(again, null);
    follow();
  }

  function setTitle(t) {
    state.title = t || "";
    els.heading.textContent = state.heading + (state.title ? ": " + state.title : "");
  }
  function setStatus(t) { els.status.textContent = t || ""; }
  function setAccent(hex) {
    var root = document.documentElement.style, m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
    if (!m) return;
    var n = parseInt(m[1], 16);
    root.setProperty("--accent", "#" + m[1]);
    root.setProperty("--mine", "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + ",0.6)");
  }

  // ---- end of class: recall, feedback, saved ----------------------------------------------------------------------------
  // the space under the notes grows with the dock, so the last lines can still scroll above it
  function showDock() {
    els.dock.hidden = false;
    els.room.style.height = (els.dock.offsetHeight + 24) + "px";
    follow();
  }
  function hideDock() {
    clearInterval(state.recallTimer);
    els.dock.hidden = true; els.recall.hidden = true; els.saved.hidden = true; els.deadlines.hidden = true;
    els.room.style.height = "";
  }
  function dockEmpty() { return els.recall.hidden && els.deadlines.hidden && els.saved.hidden; }
  function showRecall(o) {
    o = o || {};
    flushAll();
    // a second round (one "why" question after the feedback): the first round stays above it, read-only
    if (!els.feedback.hidden && els.feedback.className !== "waiting" && els.feedback.innerHTML) {
      var past = h("div", "recall-past");
      past.appendChild(h("div", "past-prompt", els.recallPrompt.textContent));
      if (els.recallText.value.trim()) past.appendChild(h("div", "past-answer", els.recallText.value.trim()));
      var said = h("div", "past-feedback");
      said.innerHTML = els.feedback.innerHTML;
      past.appendChild(said);
      els.recallHistory.appendChild(past);
    }
    els.recall.hidden = false; els.recallNow.hidden = false; els.saved.hidden = true;
    els.feedback.hidden = true; els.feedback.textContent = "";
    els.recallPrompt.textContent = o.prompt || "what were the 3 big ideas?";
    els.recallText.value = ""; els.recallText.disabled = false;
    els.submit.disabled = false; els.skip.disabled = false; els.dockBar.hidden = false;
    els.end.disabled = true;
    state.recallEnds = Date.now() + Math.max(1, +o.seconds || 120) * 1000;
    clearInterval(state.recallTimer);
    state.recallTimer = setInterval(tick, 250);
    tick();
    showDock();
    els.recallText.focus();
  }
  function tick() {
    var left = Math.max(0, Math.ceil((state.recallEnds - Date.now()) / 1000));
    els.countdown.textContent = Math.floor(left / 60) + ":" + ("0" + (left % 60)).slice(-2);
    els.countdown.classList.toggle("low", left <= 15);
    if (left > 0) return;
    clearInterval(state.recallTimer);
    // time is up: what he wrote goes in; nothing written is a skip
    if (els.recallText.value.trim()) submitRecall(); else skipRecall();
  }
  function submitRecall() {
    var text = els.recallText.value.trim();
    if (!text || els.submit.disabled) { els.recallText.focus(); return; }
    clearInterval(state.recallTimer);
    els.recallText.disabled = true; els.submit.disabled = true; els.skip.disabled = true; els.dockBar.hidden = true;
    els.countdown.textContent = "";
    els.feedback.hidden = false; els.feedback.className = "waiting"; els.feedback.textContent = "checking against the notes";
    showDock();
    post({type: "recall", text: text});
  }
  function skipRecall() {
    if (els.skip.disabled) return;
    clearInterval(state.recallTimer);
    // a skipped second round leaves the first round's feedback in view
    if (els.recallHistory.children.length) els.recallNow.hidden = true; else els.recall.hidden = true;
    if (dockEmpty()) hideDock(); else showDock();
    post({type: "skipRecall"});
  }
  // Dot sends feedback a line at a time: the first replaces "checking", the rest stack under it.
  function recallFeedback(text) {
    var html = String(text || "").split("\n").map(inline).join("\n");
    var first = els.feedback.hidden || els.feedback.className === "waiting";
    els.recall.hidden = false;
    els.feedback.hidden = false; els.feedback.className = "";
    els.feedback.innerHTML = first ? html : els.feedback.innerHTML + "\n" + html;
    showDock();
  }
  function shortPath(p) { return String(p).replace(/^\/Users\/[^/]+\//, "~/"); }
  function finished(o) {
    o = o || {};
    clearInterval(state.recallTimer);
    els.saved.textContent = "";
    var head = h("div", "saved-head");
    head.appendChild(h("span", null, "saved"));
    var close = h("button", null, "close"); close.type = "button";
    close.addEventListener("click", function () {
      // closes what the class ended with; deadlines he has not answered stay
      els.recall.hidden = true; els.saved.hidden = true;
      if (!els.deadlineBar.hidden && !els.deadlines.hidden) showDock(); else hideDock();
    });
    head.appendChild(close);
    els.saved.appendChild(head);
    [o.file, o.pdf].forEach(function (p) {
      if (!p) return;
      var a = h("a", null, shortPath(p));
      a.href = "file://" + encodeURI(p);
      a.title = p;
      els.saved.appendChild(a);
    });
    els.saved.hidden = false;
    showDock();
  }

  // ---- while class runs: what the ear hears, what was said at a line, explainer markers, slides --------------------------
  // The last ten or so words, cut from the left, so he can see the ear working.
  function hearing(text) {
    var words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    els.hearingText.textContent = (words.length > 10 ? "\u2026 " : "") + words.slice(-10).join(" ");
    els.hearing.hidden = !words.length || state.mode === "review";
    els.hearing.classList.toggle("clipped", !els.hearing.hidden && els.hearingText.offsetWidth > els.hearing.clientWidth - 40);
  }

  function placeSource(l) { els.source.style.top = (l.el.offsetTop + l.el.offsetHeight + 2) + "px"; }
  function openSource(l, time, text) {
    var pop = els.source;
    state.sourceFor = l.id;
    pop.textContent = "";
    if (time) pop.appendChild(h("div", "source-time", time));
    pop.appendChild(text ? h("div", "source-text", "\u201C" + text + "\u201D") : h("div", "source-text waiting", "finding what was said"));
    pop.hidden = false;
    placeSource(l);
  }
  // Dot's answer to a time chip: the transcript around that moment, under the line.
  function showSource(id, o) {
    var l = find(id);
    if (!l) return;
    o = o || {};
    openSource(l, o.time || l.at, o.text || "nothing was heard there");
  }
  function closeSource() { els.source.hidden = true; state.sourceFor = null; }

  function markExplain(id, s) {
    if (s === "queued" || s === "ready" || s === "shown") state.marks[id] = s; else delete state.marks[id];
    var l = find(id);
    if (l) paintMark(l);
  }

  function openLightbox(src, caption) {
    els.lightbox.querySelector("img").src = src;
    els.lightbox.querySelector("figcaption").textContent = caption || "";
    els.lightbox.hidden = false;
  }
  function closeLightbox() { els.lightbox.hidden = true; }

  // ---- deadlines heard in class, offered for Atlas after it -------------------------------------------------------------
  function offerDeadlines(items) {
    items = items || [];
    els.deadlineList.textContent = "";
    items.forEach(function (it) {
      var row = h("label", "deadline"), box = h("input"), body = h("span", "deadline-body"), top = h("span", "deadline-top");
      box.type = "checkbox"; box.checked = true; box.value = String(it.id);
      top.appendChild(h("span", "deadline-title", it.title || ""));
      if (it.due) top.appendChild(h("span", "deadline-due", it.due));
      body.appendChild(top);
      if (it.line) body.appendChild(h("span", "deadline-line", it.line));
      row.appendChild(box); row.appendChild(body);
      els.deadlineList.appendChild(row);
    });
    els.deadlineAdd.disabled = false; els.deadlineSkip.disabled = false; els.deadlineBar.hidden = false;
    els.deadlineResult.hidden = true;
    els.deadlines.hidden = !items.length;
    if (items.length) showDock();
  }
  function sendDeadlines(ids) {
    if (els.deadlineAdd.disabled) return;
    els.deadlineAdd.disabled = true; els.deadlineSkip.disabled = true;
    Array.prototype.forEach.call(els.deadlineList.querySelectorAll("input"), function (b) { b.disabled = true; });
    if (ids.length) {
      els.deadlineBar.hidden = true;
      els.deadlineResult.hidden = false; els.deadlineResult.className = "waiting"; els.deadlineResult.textContent = "adding to Atlas";
      showDock();
    } else {
      els.deadlines.hidden = true;
      if (dockEmpty()) hideDock(); else showDock();
    }
    post({type: "addDeadlines", ids: ids});
  }
  function deadlinesAdded(text) {
    els.deadlines.hidden = false; els.deadlineBar.hidden = true;
    els.deadlineResult.hidden = false; els.deadlineResult.className = ""; els.deadlineResult.textContent = text || "";
    showDock();
  }

  // ---- the print view of a whole course file (protocol.md section 1) ---------------------------------------------------
  var IMAGE = /^\s*!\[([^\]]*)\]\(\s*<?([^)>]+?)>?(?:\s+"[^"]*")?\s*\)\s*$/;
  // ![slide: title](notes-images/slide-....jpg) is a slide, set smaller than a board photo
  function figure(alt, src) {
    var slide = /^slide:\s*/i.test(alt), fig = h("figure", slide ? "slide" : null), img = h("img");
    img.alt = alt; img.src = resolve(src);
    fig.appendChild(img);
    if (alt) fig.appendChild(h("figcaption", null, slide ? "Slide: " + alt.replace(/^slide:\s*/i, "") : alt));
    return fig;
  }
  function renderDocument(markdown, opts) {
    opts = opts || {};
    if (opts.base != null) state.base = opts.base;
    var doc = els.doc;
    doc.textContent = "";
    document.body.classList.add("doc-mode");
    doc.hidden = false;
    var card = null, stack = [];
    function host() {
      if (!card) { card = h("section", "card"); doc.appendChild(card); stack = []; }
      return card;
    }
    // HTML comments (a line's "<!--@11:42:10-->" timestamp) never print
    String(markdown || "").replace(/<!--[\s\S]*?-->/g, "").replace(/\r/g, "").split("\n").forEach(function (raw) {
      if (!raw.trim()) return;
      var m;
      if ((m = /^#\s+(.*)$/.exec(raw))) { var t = h("h1"); t.innerHTML = inline(m[1]); doc.appendChild(t); card = null; return; }
      if ((m = /^##\s+(.*)$/.exec(raw))) {
        card = h("section", "card"); stack = [];
        var hd = h("h2"); hd.innerHTML = inline(m[1]); card.appendChild(hd);
        doc.appendChild(card);
        return;
      }
      if ((m = IMAGE.exec(raw))) { host().appendChild(figure(m[1], m[2])); stack = []; return; }
      if ((m = /^(\s*)[-*]\s+(.*)$/.exec(raw))) { item(host(), Math.min(3, Math.floor(m[1].replace(/\t/g, "  ").length / 2)), m[2]); return; }
      var p = h("p"); p.innerHTML = inline(raw.trim()); host().appendChild(p); stack = [];
    });
    function item(parent, depth, text) {
      while (stack.length > depth + 1) stack.pop();
      if (!stack.length) { var ul = h("ul"); parent.appendChild(ul); stack.push(ul); }
      while (stack.length < depth + 1) {
        // a jump of more than one level hangs off the last item above (or a bare one)
        var up = stack[stack.length - 1], li0 = up.lastElementChild;
        if (!li0) { li0 = h("li"); li0.style.listStyle = "none"; up.appendChild(li0); }
        var sub = h("ul"); li0.appendChild(sub); stack.push(sub);
      }
      var li = h("li"), im = IMAGE.exec(text);
      if (im) { li.className = "figure-item"; li.appendChild(figure(im[1], im[2])); }
      else {
        if (/^⁺\s*/.test(text)) { li.className = "added"; text = text.replace(/^⁺\s*/, ""); }
        var span = h("span", "t"); span.innerHTML = inline(text); li.appendChild(span);
      }
      stack[depth].appendChild(li);
    }
    // a card shorter than most of a Letter page is never split across two (9.8 in of content at 96 px an inch)
    var cards = doc.querySelectorAll(".card");
    Array.prototype.forEach.call(cards, function (c) { c.classList.toggle("short", c.offsetHeight < 0.8 * 9.8 * 96); });
    var images = Array.prototype.map.call(doc.querySelectorAll("img"), function (img) {
      return img.complete ? null : new Promise(function (done) { img.onload = img.onerror = done; });
    }).filter(Boolean);
    return Promise.all(images).then(function () { return document.fonts ? document.fonts.ready : null; })
      .then(function () { return {cards: cards.length, height: doc.scrollHeight}; });
  }

  // The notes as he sees them now, in order (his pending changes are sent first).
  function snapshot() {
    flushAll();
    return lines().filter(function (l) { return l.sent; }).map(function (l) {
      return {id: l.id, depth: l.depth, text: l.text, author: l.author, kind: l.kind, src: l.src || null, at: l.at || null};
    });
  }

  // Hooks for `Dot --notes-selftest`: the same handlers his keys and clicks reach, driven without a key window.
  var test = {
    focus: function (id) {
      var all = lines(), l = id === "tail" ? all[all.length - 1] : find(id);
      if (!l) return null;
      focusLine(l, null);
      return l.id;
    },
    type: function (id, text) {
      var l = id ? find(id) : state.focused;
      if (!l || !l.textEl) return null;
      if (state.focused !== l) focusLine(l, null);
      l.textEl.textContent = text;
      setCaret(l, null);
      l.textEl.dispatchEvent(new Event("input", {bubbles: true}));
      return l.id;
    },
    key: function (id, key, shift) {
      var l = id ? find(id) : state.focused;
      if (!l || !l.textEl) return false;
      if (state.focused !== l) focusLine(l, null);
      var e = new KeyboardEvent("keydown", {key: key, shiftKey: !!shift, bubbles: true, cancelable: true});
      l.textEl.dispatchEvent(e);
      return e.defaultPrevented;
    },
    blur: function () {
      var l = state.focused;
      if (!l) return;
      l.textEl.blur();
      if (state.focused === l) stopEditing(l);
    },
    focused: function () { return state.focused ? state.focused.id : null; }
  };

  window.notes = {
    load: load, apply: apply, setTitle: setTitle, status: setStatus, setStatus: setStatus, setAccent: setAccent,
    showRecall: showRecall, recallFeedback: recallFeedback, finished: finished, renderDocument: renderDocument,
    hearing: hearing, showSource: showSource, markExplain: markExplain, offerDeadlines: offerDeadlines, deadlinesAdded: deadlinesAdded,
    snapshot: snapshot, flush: flushAll, inline: inline, _test: test
  };

  document.addEventListener("DOMContentLoaded", function () {
    ["lines", "room", "scroller", "course", "heading", "status", "end", "dock", "recall", "countdown", "submit", "skip", "feedback",
     "saved", "doc", "hearing", "source", "lightbox", "deadlines"].forEach(function (id) { els[id] = document.getElementById(id); });
    els.hearingText = document.getElementById("hearing-text");
    els.recallHistory = document.getElementById("recall-history");
    els.recallNow = document.getElementById("recall-now");
    els.deadlineList = document.getElementById("deadline-list");
    els.deadlineBar = document.getElementById("deadline-bar");
    els.deadlineAdd = document.getElementById("deadline-add");
    els.deadlineSkip = document.getElementById("deadline-skip");
    els.deadlineResult = document.getElementById("deadline-result");
    els.recallPrompt = document.getElementById("recall-prompt");
    els.recallText = document.getElementById("recall-text");
    els.dockBar = document.querySelector("#recall .dock-bar");
    bind();
    ensureTail();
    post({type: "ready"});
  });
})();
