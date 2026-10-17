// anime.js v4 ships as a namespace (anime.animate); cards and the runtime write the familiar
// anime({targets, ...}) call, so give them that shape and translate the option names.
(function () {
  var ns = window.anime;
  if (!ns || typeof ns === "function" || !ns.animate) return;
  function ease(name) {
    if (!name || typeof name !== "string") return name;
    var m = name.match(/^ease(In|Out|InOut)([A-Z]\w*)$/);
    return m ? m[1].charAt(0).toLowerCase() + m[1].slice(1) + m[2] : name;
  }
  function compat(opts) {
    var targets = opts.targets, params = {};
    for (var k in opts) if (k !== "targets") params[k] = opts[k];
    if (params.easing) { params.ease = ease(params.easing); delete params.easing; }
    if (params.update) { params.onUpdate = params.update; delete params.update; }
    if (params.complete) { params.onComplete = params.complete; delete params.complete; }
    if (params.begin) { params.onBegin = params.begin; delete params.begin; }
    if ("round" in params) { var r = params.round; delete params.round; if (ns.utils && ns.utils.round) params.modifier = ns.utils.round(r === true ? 0 : Math.log10(r)); }
    if (typeof params.loop === "boolean" && params.loop) params.loop = Infinity;
    return ns.animate(targets, params);
  }
  for (var key in ns) compat[key] = ns[key];
  compat.timeline = function (opts) { return ns.createTimeline(opts || {}); };
  compat.v4 = ns;
  window.anime = compat;
})();
// Dot's board runtime: step reveal, math typesetting, built-in figures, and a loader for the
// bundled libraries (three, 3Dmol, Mermaid, JSXGraph, seqviz, smiles-drawer, matter). No network
// except media the card itself asks for.
(function () {
  // ---- libraries on demand -------------------------------------------------------------
  var LIBS = {
    three: {script: "vendor/three.min.js"},
    orbit: {script: "vendor/OrbitControls.js", needs: ["three"]},
    "3dmol": {script: "vendor/3Dmol-min.js"},
    mermaid: {script: "vendor/mermaid.min.js"},
    jsxgraph: {script: "vendor/jsxgraphcore.js", css: "vendor/jsxgraph.css"},
    seqviz: {script: "vendor/seqviz.min.js"},
    smiles: {script: "vendor/smiles-drawer.min.js"},
    matter: {script: "vendor/matter.min.js"}
  };
  var loaded = {};
  // Library paths are relative to this file, so a page in a subfolder (test/) loads the same vendor copies.
  var BASE = ((document.currentScript && document.currentScript.src) || "").replace(/[^\/]*$/, "");
  function loadScript(src) {
    return new Promise(function (ok, bad) {
      var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error("could not load " + src)); };
      document.head.appendChild(s);
    });
  }
  function loadCSS(href) { var l = document.createElement("link"); l.rel = "stylesheet"; l.href = href; document.head.appendChild(l); }
  function need(names) {
    names = Array.isArray(names) ? names : [names];
    return Promise.all(names.map(function (name) {
      var lib = LIBS[name];
      if (!lib) return Promise.reject(new Error("unknown library " + name));
      if (loaded[name]) return loaded[name];
      var deps = Promise.all((lib.needs || []).map(need));
      loaded[name] = deps.then(function () {
        if (lib.css) loadCSS(BASE + lib.css);
        if (lib.module) return import(BASE + lib.module).then(function (m) { window[name === "three" ? "THREE" : name] = m; return m; });
        return loadScript(BASE + lib.script);
      });
      return loaded[name];
    })).then(function (r) { return r.length === 1 ? r[0] : r; });
  }

  // ---- tokens -------------------------------------------------------------------------
  // Colors come from the CSS variables: board.css holds the defaults, the card's {{TOKENS}} block his merged tokens.
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function glass(alpha) { return "rgba(" + cssVar("--glass-rgb", "255, 255, 255") + "," + alpha + ")"; }
  function tint(color) { return /^#[0-9a-f]{6}$/i.test(color) ? color + "cc" : color; }
  // A finance piece wears the desk look whatever the card's look; a page marked data-look-fixed keeps its own (the test pages).
  function settleLook() {
    var root = document.documentElement;
    if (!root.hasAttribute("data-look-fixed") && document.querySelector(".football, .sens, .comps")) root.dataset.look = "desk";
  }

  // ---- math ---------------------------------------------------------------------------
  function typeset(root) {
    if (window.renderMathInElement) {
      renderMathInElement(root || document.body, {
        delimiters: [{left: "$$", right: "$$", display: true}, {left: "\\[", right: "\\]", display: true},
                     {left: "$", right: "$", display: false}, {left: "\\(", right: "\\)", display: false}],
        throwOnError: false
      });
    }
  }

  // ---- the stage: one thing at a time ---------------------------------------------------
  // A lesson card is <div class="stage process|derivation|compare|concept"> holding one figure
  // whose parts carry data-step, plus one short .caption per step. Process and concept replace:
  // on step n only the parts tagged n show, untagged parts are the scaffold. Derivation and
  // compare accumulate: earlier lines stay and dim. The bar at the bottom (back, dots, next)
  // and the arrow keys talk to Dot, which keeps the words in step with the picture.
  var stage = null, stageMode = "replace", stageCurrent = 0;
  function partSteps(el) {
    return String(el.dataset.step).split(",").map(function (v) { return parseInt(v, 10); }).filter(function (v) { return !isNaN(v); });
  }
  function stageParts() { return Array.from(stage.querySelectorAll("[data-step]")); }
  function stageTotal() {
    return stageParts().reduce(function (m, el) { var st = partSteps(el); return st.length ? Math.max(m, Math.max.apply(null, st)) : m; }, 0);
  }
  function nav(action, step) {
    try { window.webkit.messageHandlers.dot.postMessage({type: "nav", action: action, step: step || 0}); } catch (e) {}
  }
  function setupStage() {
    stage = document.querySelector(".stage");
    if (!stage) return;
    document.body.classList.add("stage-page");
    document.documentElement.classList.add("stage-page");
    // The panel's strip carries the title; a heading above or inside the stage would push the bar off the card.
    Array.from(document.body.children).forEach(function (el) { if (el !== stage && /^H[1-3]$/.test(el.tagName)) el.remove(); });
    stageMode = (stage.classList.contains("derivation") || stage.classList.contains("accumulate") || stage.classList.contains("compare")) ? "accumulate" : "replace";
    var area = document.createElement("div"); area.className = "area";
    var lines = document.createElement("div"); lines.className = stage.classList.contains("compare") ? "lines sides" : "lines stack";
    var captions = document.createElement("div"); captions.className = "captions";
    var scripts = [];
    Array.from(stage.childNodes).forEach(function (node) {
      if (node.nodeType !== 1) { if (node.nodeType === 3 && node.textContent.trim()) area.appendChild(node); return; }
      if (node.matches("h1,h2,h3")) { node.remove(); return; }
      if (node.matches(".caption")) captions.appendChild(node);
      else if (node.matches(".line, .side")) lines.appendChild(node);
      else if (node.tagName === "SCRIPT") scripts.push(node);
      else area.appendChild(node);
    });
    stage.innerHTML = "";
    if (area.childElementCount) stage.appendChild(area);
    if (lines.childElementCount) stage.appendChild(lines);
    if (captions.childElementCount) stage.appendChild(captions);
    var bar = document.createElement("div"); bar.className = "stagebar";
    bar.innerHTML = '<button class="back" type="button">back</button><div class="dots"></div><span class="count"></span><button class="next" type="button">next</button>';
    stage.appendChild(bar);
    scripts.forEach(function (sc) { stage.appendChild(sc); });
    var total = stageTotal(), dots = bar.querySelector(".dots");
    for (var i = 1; i <= total; i++) {
      var d = document.createElement("i"); d.dataset.n = i;
      d.addEventListener("click", function (e) { nav("step", +e.currentTarget.dataset.n); });
      dots.appendChild(d);
    }
    bar.querySelector(".back").addEventListener("click", function () { nav("back"); });
    bar.querySelector(".next").addEventListener("click", function () { nav("next"); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") { e.preventDefault(); nav("next"); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); nav("back"); }
    });
    stageParts().forEach(function (el) { el.classList.add("off"); });
  }
  function revealStage(n) {
    var total = stageTotal();
    n = Math.max(1, Math.min(n, total || 1));
    stageCurrent = n;
    stageParts().forEach(function (el) {
      var st = partSteps(el), has = st.indexOf(n) >= 0;
      var on = stageMode === "replace" ? has : (st.length ? Math.min.apply(null, st) <= n : true);
      var was = el.classList.contains("on");
      el.classList.toggle("on", on); el.classList.toggle("off", !on);
      el.classList.toggle("focus", on && has); el.classList.toggle("dim", on && !has);
      if (on && !was) {
        drawAll(el.parentNode || el); typeset(el);
        if (el.matches("[data-animate]")) { el.dataset.animated = ""; runAnimation(el); }
        el.querySelectorAll("[data-animate]").forEach(function (a) { a.dataset.animated = ""; runAnimation(a); });
      }
    });
    var bar = stage.querySelector(".stagebar");
    if (bar) {
      bar.querySelectorAll(".dots i").forEach(function (d, i) { d.classList.toggle("cur", i + 1 === n); d.classList.toggle("done", i + 1 < n); });
      bar.querySelector(".count").textContent = n + " of " + total;
      bar.querySelector(".back").disabled = n <= 1;
      bar.querySelector(".next").textContent = n >= total ? "done" : "next";
    }
    var cap = stage.querySelector(".captions .caption.on");
    if (cap) cap.scrollIntoView({block: "nearest"});
    document.dispatchEvent(new CustomEvent("board:reveal", {detail: {step: n}}));
    return JSON.stringify({shown: n, total: total});
  }
  function setWaiting(on) { var b = stage && stage.querySelector(".stagebar .next"); if (b) b.classList.toggle("waiting", !!on); }
  function stageRect(n) {
    var el = stage.querySelector(".captions .caption.on") || stage.querySelector(".lines [data-step].focus") || stage.querySelector(".area") || stage;
    var r = el.getBoundingClientRect();
    return JSON.stringify({x: r.left, y: r.top, w: r.width, h: r.height, viewH: window.innerHeight});
  }

  // ---- steps ---------------------------------------------------------------------------
  function steps() { return Array.from(document.querySelectorAll(".step")); }
  function reveal(n) {
    if (stage) return revealStage(n);
    var all = steps();
    all.forEach(function (s, i) {
      var was = s.classList.contains("shown");
      s.classList.toggle("shown", i < n);
      s.classList.toggle("current", i === n - 1);
      if (!was && i < n) {
        drawAll(s); typeset(s);
        if (window.anime) {
          anime({targets: s, opacity: [0, 1], translateY: [10, 0], duration: 420, easing: "easeOutCubic"});
          s.querySelectorAll("[data-animate]").forEach(function (el) { runAnimation(el); });
        }
      }
    });
    // Parts of a figure tagged data-step light up with their step; the rest dims.
    var parts = Array.from(document.querySelectorAll("[data-step]"));
    var owns = function (el) { return String(el.dataset.step).split(",").map(function (s) { return +s; }).indexOf(n) >= 0; };
    var anyOn = parts.some(owns);
    parts.forEach(function (el) {
      var on = owns(el);
      el.classList.toggle("focus", on);
      el.classList.toggle("dim", anyOn && !on && parts.length > 1);
      if (on && window.anime && !el.dataset.lit) { el.dataset.lit = "1"; anime({targets: el, opacity: [0.4, 1], duration: 500, easing: "easeOutCubic"}); }
      if (on) el.querySelectorAll("[data-animate]").forEach(function (a) { a.dataset.animated = ""; runAnimation(a); });
    });
    document.dispatchEvent(new CustomEvent("board:reveal", {detail: {step: n}}));
    return JSON.stringify({shown: Math.min(n, all.length), total: all.length});
  }
  function stepRect(n) {
    if (stage) return stageRect(n);
    var cur = steps()[n - 1];
    if (!cur) return null;
    var r = cur.getBoundingClientRect();
    return JSON.stringify({x: r.left, y: r.top, w: r.width, h: r.height, viewH: window.innerHeight});
  }
  function scrollToStep(n) { var cur = steps()[n - 1]; if (cur) cur.scrollIntoView({block: "nearest"}); return stepRect(n); }
  function height() { return document.documentElement.scrollHeight; }
  function stepCount() { return stage ? stageTotal() : steps().length; }
  function shownCount() { return stage ? stageCurrent : document.querySelectorAll(".step.shown").length; }

  // ---- small animations by attribute ------------------------------------------------------
  // data-animate="fade|rise|pop|draw|count" on any element; "draw" strokes an svg path,
  // "count" counts a number up from 0 to its text.
  function runAnimation(el) {
    if (!window.anime) return;
    var kind = el.dataset.animate, delay = +(el.dataset.delay || 0);
    if (kind === "draw" && el.getTotalLength) {
      var len = el.getTotalLength(); el.style.strokeDasharray = len; el.style.strokeDashoffset = len;
      anime({targets: el, strokeDashoffset: [len, 0], duration: 900, delay: delay, easing: "easeInOutSine"});
    } else if (kind === "count") {
      var target = parseFloat(el.textContent.replace(/[^0-9.\-]/g, "")) || 0, suffix = el.textContent.replace(/^[^0-9.\-]*[0-9.\-]+/, "");
      var obj = {v: 0}; anime({targets: obj, v: target, round: target % 1 ? 100 : 1, duration: 1100, delay: delay, easing: "easeOutExpo",
        update: function () { el.textContent = (Math.round(obj.v * 100) / 100) + suffix; }});
    } else if (kind === "pop") {
      anime({targets: el, scale: [0.6, 1], opacity: [0, 1], duration: 520, delay: delay, easing: "easeOutBack"});
    } else if (kind === "rise") {
      anime({targets: el, translateY: [14, 0], opacity: [0, 1], duration: 520, delay: delay, easing: "easeOutCubic"});
    } else {
      anime({targets: el, opacity: [0, 1], duration: 520, delay: delay, easing: "easeOutCubic"});
    }
  }

  // ---- figures -------------------------------------------------------------------------
  function svgEl(tag, attrs) { var e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function drawPlot(div) {
    var fns = (div.dataset.fn || "x").split("|");
    var xr = (div.dataset.x || "-5,5").split(",").map(Number), x0 = xr[0], x1 = xr[1];
    var W = 400, H = 170, pad = 22, samples = [];
    fns.forEach(function (expr) {
      var f; try { f = new Function("x", "with (Math) { return (" + expr + "); }"); } catch (e) { return; }
      var pts = []; for (var i = 0; i <= 160; i++) { var x = x0 + (x1 - x0) * i / 160; var y = f(x); if (isFinite(y)) pts.push([x, y]); }
      samples.push(pts);
    });
    var ys = [].concat.apply([], samples).map(function (p) { return p[1]; });
    var yr = div.dataset.y ? div.dataset.y.split(",").map(Number) : null;
    var y0 = yr ? yr[0] : Math.min.apply(null, ys), y1 = yr ? yr[1] : Math.max.apply(null, ys);
    if (!isFinite(y0) || !isFinite(y1) || y0 === y1) { y0 = -1; y1 = 1; }
    var sx = function (x) { return pad + (x - x0) / (x1 - x0) * (W - 2 * pad); };
    var sy = function (y) { return H - pad - (y - y0) / (y1 - y0) * (H - 2 * pad); };
    var svg = svgEl("svg", {viewBox: "0 0 " + W + " " + H});
    for (var gx = Math.ceil(x0); gx <= x1; gx++) svg.appendChild(svgEl("line", {x1: sx(gx), y1: pad, x2: sx(gx), y2: H - pad, class: "grid"}));
    var ystep = Math.pow(10, Math.floor(Math.log10((y1 - y0) / 4))) || 1;
    for (var gy = Math.ceil(y0 / ystep) * ystep; gy <= y1; gy += ystep) svg.appendChild(svgEl("line", {x1: pad, y1: sy(gy), x2: W - pad, y2: sy(gy), class: "grid"}));
    if (y0 <= 0 && y1 >= 0) svg.appendChild(svgEl("line", {x1: pad, y1: sy(0), x2: W - pad, y2: sy(0), class: "ax"}));
    if (x0 <= 0 && x1 >= 0) svg.appendChild(svgEl("line", {x1: sx(0), y1: pad, x2: sx(0), y2: H - pad, class: "ax"}));
    [x0, x1].forEach(function (x) { var t = svgEl("text", {x: sx(x), y: H - 6, class: "tick", "text-anchor": "middle"}); t.textContent = x; svg.appendChild(t); });
    [y0, y1].forEach(function (y) { var t = svgEl("text", {x: 4, y: sy(y) + 4, class: "tick"}); t.textContent = +y.toFixed(2); svg.appendChild(t); });
    samples.forEach(function (pts, i) {
      var d = pts.map(function (p, j) { return (j ? "L" : "M") + sx(p[0]).toFixed(1) + " " + sy(Math.max(y0, Math.min(y1, p[1]))).toFixed(1); }).join(" ");
      var path = svgEl("path", {d: d, class: "curve" + (i ? " second" : ""), "data-animate": "draw"});
      svg.appendChild(path);
    });
    (div.dataset.points || "").split(";").filter(Boolean).forEach(function (pair) {
      var p = pair.split(",").map(Number); svg.appendChild(svgEl("circle", {cx: sx(p[0]), cy: sy(p[1]), r: 4, class: "pt"}));
    });
    div.innerHTML = ""; div.appendChild(svg);
  }
  function drawNumberLine(div) {
    var r = (div.dataset.range || "-5,5").split(",").map(Number), a = r[0], b = r[1];
    var W = 400, H = 60, pad = 20;
    var sx = function (x) { return pad + (x - a) / (b - a) * (W - 2 * pad); };
    var svg = svgEl("svg", {viewBox: "0 0 " + W + " " + H});
    svg.appendChild(svgEl("line", {x1: pad, y1: 30, x2: W - pad, y2: 30, class: "ax"}));
    for (var x = Math.ceil(a); x <= b; x++) {
      svg.appendChild(svgEl("line", {x1: sx(x), y1: 26, x2: sx(x), y2: 34, class: "ax"}));
      if ((b - a) <= 20 || x % 5 === 0) { var t = svgEl("text", {x: sx(x), y: 50, class: "tick", "text-anchor": "middle"}); t.textContent = x; svg.appendChild(t); }
    }
    (div.dataset.marks || "").split(",").filter(function (s) { return s.trim() !== ""; }).forEach(function (m) {
      var parts = m.split(":"), x = Number(parts[0]);
      svg.appendChild(svgEl("circle", {cx: sx(x), cy: 30, r: 5, class: "mark"}));
      if (parts[1]) { var t = svgEl("text", {x: sx(x), y: 16, class: "mark-label", "text-anchor": "middle"}); t.textContent = parts[1]; svg.appendChild(t); }
    });
    div.innerHTML = ""; div.appendChild(svg);
  }
  // <div class="chart" data-kind="bar|line|doughnut" data-labels="a,b,c" data-values="1,2,3" data-title="..."></div>
  function drawChart(div) {
    if (!window.Chart) return;
    var labels = (div.dataset.labels || "").split(",").map(function (s) { return s.trim(); });
    var series = (div.dataset.values || "").split("|").map(function (row) { return row.split(",").map(Number); });
    var names = (div.dataset.series || "").split("|");
    var canvas = document.createElement("canvas"); div.innerHTML = ""; div.appendChild(canvas);
    var palette = [cssVar("--accent", "#ff6b2c"), cssVar("--blue", "#7cc7ff"), cssVar("--green", "#9ef0b6"), cssVar("--yellow", "#ffd166"), cssVar("--purple", "#c79bff")];
    var text = cssVar("--chart-text", "#eee"), tick = cssVar("--chart-tick", "#bbb"), grid = cssVar("--chart-grid", "#333");
    new Chart(canvas, {type: div.dataset.kind || "bar", data: {labels: labels, datasets: series.map(function (vals, i) {
      return {label: names[i] || "", data: vals, backgroundColor: div.dataset.kind === "line" ? "transparent" : tint(palette[i % palette.length]),
              borderColor: palette[i % palette.length], borderWidth: 2, tension: 0.3, fill: false};
    })}, options: {animation: {duration: 900}, plugins: {legend: {display: names.length > 1 && !!names[0], labels: {color: text}},
      title: {display: !!div.dataset.title, text: div.dataset.title, color: text}}, scales: {x: {ticks: {color: tick}, grid: {color: grid}}, y: {ticks: {color: tick}, grid: {color: grid}}}}});
  }
  // <div class="mermaid">flowchart LR; A-->B</div>
  function drawMermaid(root) {
    var nodes = Array.from((root || document).querySelectorAll(".mermaid")).filter(function (el) { return !el.dataset.drawn && !hidden(el); });
    nodes.forEach(function (el) { el.dataset.drawn = "1"; });
    if (!nodes.length) return Promise.resolve();
    return need("mermaid").then(function () {
      mermaid.initialize({startOnLoad: false, theme: "dark", themeVariables: {primaryColor: cssVar("--node", "#2a2420"), primaryTextColor: cssVar("--paper", "#f0ebe3"), lineColor: cssVar("--accent", "#ff6b2c"), fontFamily: "-apple-system, Helvetica, sans-serif"}});
      return mermaid.run({nodes: nodes});
    }).catch(function (e) { console.error(e); });
  }
  // <div class="molecule" data-pdb="1BNA" data-style="cartoon|stick|sphere" data-height="260"></div>
  // A PDB id fetches from RCSB (the one network call a card may make); data-src can name a local file.
  function drawMolecule(div) {
    return need("3dmol").then(function () {
      div.style.height = (div.dataset.height || 260) + "px"; div.style.position = "relative";
      var viewer = $3Dmol.createViewer(div, {backgroundColor: cssVar("--ink", "#15120f")});
      var style = {}; style[div.dataset.style || "cartoon"] = {color: "spectrum"};
      var done = function () { viewer.setStyle({}, style); viewer.zoomTo(); viewer.render(); if (div.dataset.spin !== "no") viewer.spin("y", 0.6); };
      if (div.dataset.pdb) {
        var id = div.dataset.pdb.toLowerCase();
        $3Dmol.download("pdb:" + id, viewer, {}, done);
      } else if (div.dataset.src) {
        fetch(div.dataset.src).then(function (r) { return r.text(); }).then(function (text) { viewer.addModel(text, div.dataset.format || "pdb"); done(); });
      }
    }).catch(function (e) { div.textContent = "molecule viewer: " + e.message; });
  }
  // <div class="sequence" data-seq="ATGC..." data-name="..." data-view="linear|circular" data-annotations="name:start:end:color;..."></div>
  // <div class="sequence" data-seq="ATGC..." data-annotations="name:start:end:color;..." data-complement="yes" data-codons="yes"></div>
  function drawSequence(div) {
    var seq = (div.dataset.seq || "").toUpperCase().replace(/[^ACGTUN]/g, "");
    var comp = {A: "T", T: "A", U: "A", G: "C", C: "G", N: "N"};
    var colors = {A: "#7cc7ff", T: "#ffd166", U: "#ffd166", G: "#9ef0b6", C: "#ff6b2c", N: "#888"};
    var perRow = +(div.dataset.perRow || 30), cell = 18, rowH = (div.dataset.complement === "no" ? 1 : 2) * cell + 30;
    var rows = Math.ceil(seq.length / perRow), W = perRow * cell + 40, H = rows * rowH + 10;
    var svg = svgEl("svg", {viewBox: "0 0 " + W + " " + H}); svg.style.width = "100%";
    var ann = (div.dataset.annotations || "").split(";").filter(Boolean).map(function (a) { var p = a.split(":"); return {name: p[0], start: +p[1], end: +p[2], color: p[3] || "#ff6b2c"}; });
    for (var i = 0; i < seq.length; i++) {
      var r = Math.floor(i / perRow), c = i % perRow, x = 30 + c * cell, y = 24 + r * rowH;
      var a = ann.filter(function (q) { return i + 1 >= q.start && i + 1 <= q.end; })[0];
      if (a) svg.appendChild(svgEl("rect", {x: x - 1, y: y - 16, width: cell, height: cell + 2, fill: a.color, opacity: 0.22, rx: 3}));
      if (div.dataset.codons === "yes" && i % 3 === 0) svg.appendChild(svgEl("line", {x1: x - 1, y1: y - 18, x2: x - 1, y2: y + 4 + (div.dataset.complement === "no" ? 0 : cell), stroke: glass(0.25)}));
      var t = svgEl("text", {x: x + cell / 2 - 1, y: y, "text-anchor": "middle", fill: colors[seq[i]] || "#ddd", "font-size": "13", "font-family": "SF Mono, Menlo, monospace", "font-weight": "600"});
      t.textContent = seq[i]; svg.appendChild(t);
      if (div.dataset.complement !== "no") {
        var u = svgEl("text", {x: x + cell / 2 - 1, y: y + cell, "text-anchor": "middle", fill: colors[comp[seq[i]]] || "#ddd", "font-size": "13", "font-family": "SF Mono, Menlo, monospace", opacity: 0.75});
        u.textContent = comp[seq[i]] || "N"; svg.appendChild(u);
        svg.appendChild(svgEl("line", {x1: x + cell / 2 - 1, y1: y + 3, x2: x + cell / 2 - 1, y2: y + cell - 11, stroke: glass(0.25)}));
      }
      if (c === 0) { var num = svgEl("text", {x: 4, y: y, fill: cssVar("--muted", "#a39b90"), "font-size": "10"}); num.textContent = i + 1; svg.appendChild(num); }
    }
    ann.forEach(function (q, k) {
      var r = Math.floor((q.start - 1) / perRow), x = 30 + ((q.start - 1) % perRow) * cell;
      var lab = svgEl("text", {x: x, y: 24 + r * rowH - 20 + (k % 2) * 0, fill: q.color, "font-size": "10.5", "font-weight": "600"}); lab.textContent = q.name; svg.appendChild(lab);
    });
    div.innerHTML = ""; div.appendChild(svg);
    return Promise.resolve();
  }
  function drawSequenceLegacy(div) {
    return need("seqviz").then(function () {
      var ann = (div.dataset.annotations || "").split(";").filter(Boolean).map(function (a) {
        var p = a.split(":"); return {name: p[0], start: +p[1], end: +p[2], color: p[3] || "#ff6b2c", direction: 1};
      });
      div.style.height = (div.dataset.height || 220) + "px";
      seqviz.Viewer(div, {name: div.dataset.name || "", seq: div.dataset.seq || "", annotations: ann, viewer: div.dataset.view || "linear",
        style: {height: div.dataset.height || 220, width: "100%"}, showComplement: div.dataset.complement !== "no", zoom: {linear: +(div.dataset.zoom || 50)}}).render();
    }).catch(function (e) { div.textContent = "sequence viewer: " + e.message; });
  }
  // <canvas class="smiles" data-smiles="CC(=O)O" width="260" height="160"></canvas>
  function drawSmiles(canvas) {
    return need("smiles").then(function () {
      var drawer = new SmilesDrawer.Drawer({width: canvas.width, height: canvas.height, bondThickness: 1.2});
      SmilesDrawer.parse(canvas.dataset.smiles, function (tree) { drawer.draw(tree, canvas, "dark", false); });
    }).catch(function (e) { console.error(e); });
  }
  // <div class="jsx" data-bounds="-5,5,5,-5" data-setup="..."></div>: a JSXGraph board; data-setup is JS run with (board, JXG).
  function drawJSX(div) {
    return need("jsxgraph").then(function () {
      div.style.height = (div.dataset.height || 260) + "px";
      if (!div.id) div.id = "jsx" + Math.random().toString(36).slice(2);
      var b = (div.dataset.bounds || "-5,5,5,-5").split(",").map(Number);
      var board = JXG.JSXGraph.initBoard(div.id, {boundingbox: b, axis: div.dataset.axis !== "no", showCopyright: false, showNavigation: false});
      if (div.dataset.setup) { try { new Function("board", "JXG", div.dataset.setup)(board, JXG); } catch (e) { console.error(e); } }
      div.__board = board;
      watchBoard(div, board);
    }).catch(function (e) { div.textContent = "jsxgraph: " + e.message; });
  }
  // <div class="helix" data-height="240" data-pairs="14"></div>: a 3D double helix with base pairs (three.js).
  function drawHelix(div) {
    return need(["three", "orbit"]).then(function () {
      var T = window.THREE, W = div.clientWidth || 400, H = +(div.dataset.height || 240);
      div.style.height = H + "px";
      var scene = new T.Scene(), camera = new T.PerspectiveCamera(45, W / H, 0.1, 100); camera.position.set(0, 0, 16);
      var renderer = new T.WebGLRenderer({antialias: true, alpha: true}); renderer.setPixelRatio(window.devicePixelRatio); renderer.setSize(W, H); div.innerHTML = ""; div.appendChild(renderer.domElement);
      scene.add(new T.AmbientLight(0xffffff, 0.7)); var light = new T.PointLight(0xffffff, 40); light.position.set(6, 8, 10); scene.add(light);
      var colors = {A: 0x7cc7ff, T: 0xffd166, G: 0x9ef0b6, C: 0xff6b2c}, pairs = +(div.dataset.pairs || 14), seq = (div.dataset.seq || "ATGCGATTACGCAT").toUpperCase();
      var group = new T.Group(), backbone = new T.MeshStandardMaterial({color: 0xe8e0d4, roughness: 0.4});
      var s1 = [], s2 = [];
      for (var i = 0; i < pairs; i++) {
        var a = i * 0.62, y = (i - pairs / 2) * 0.75;
        var p1 = new T.Vector3(Math.cos(a) * 2.6, y, Math.sin(a) * 2.6), p2 = new T.Vector3(Math.cos(a + Math.PI) * 2.6, y, Math.sin(a + Math.PI) * 2.6);
        s1.push(p1); s2.push(p2);
        var base = seq[i % seq.length], comp = {A: "T", T: "A", G: "C", C: "G"}[base] || "A";
        var half1 = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 2.6, 12), new T.MeshStandardMaterial({color: colors[base]}));
        var half2 = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 2.6, 12), new T.MeshStandardMaterial({color: colors[comp]}));
        var mid = p1.clone().lerp(p2, 0.5);
        half1.position.copy(p1.clone().lerp(mid, 0.5)); half2.position.copy(p2.clone().lerp(mid, 0.5));
        half1.lookAt(mid); half1.rotateX(Math.PI / 2); half2.lookAt(mid); half2.rotateX(Math.PI / 2);
        group.add(half1, half2);
      }
      [s1, s2].forEach(function (pts) {
        var curve = new T.CatmullRomCurve3(pts); group.add(new T.Mesh(new T.TubeGeometry(curve, 120, 0.22, 10, false), backbone));
        pts.forEach(function (p) { var m = new T.Mesh(new T.SphereGeometry(0.3, 14, 14), backbone); m.position.copy(p); group.add(m); });
      });
      scene.add(group);
      var controls = new window.OrbitControls(camera, renderer.domElement); controls.enableZoom = false;
      (function frame() { group.rotation.y += 0.006; controls.update(); renderer.render(scene, camera); requestAnimationFrame(frame); })();
    }).catch(function (e) { div.textContent = "3d: " + e.message; });
  }
  // ---- the finance kit -------------------------------------------------------------------
  // fmt(value, kind, decimals): one formatter for every number on a finance piece, by banking
  // convention. Kinds: "x" a multiple (12.3x; a negative multiple is NM), "%" a percent given in
  // percent (9.0%), "bp" basis points (25bp), "$m" millions ($1,235m), "$bn" billions ($12.3bn),
  // "$" per share ($40.10), "num" plain (1,235). Negatives sit in parentheses, a value that
  // rounds to zero gets none, halves round away from zero, a missing value is n/a and a
  // non-finite one NM.
  var FMT_DECIMALS = {x: 1, "%": 1, bp: 0, "$m": 0, "$bn": 1, "$": 2, num: 0};
  function roundHalfUp(v, d) {
    var text = String(v);
    if (text.indexOf("e") >= 0) return Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
    return Number(Math.round(Number(text + "e" + d)) + "e-" + d);
  }
  function grouped(v, d) {
    var parts = v.toFixed(d).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }
  function fmt(v, kind, decimals) {
    if (v === null || v === undefined || v === "") return "n/a";
    if (typeof v === "string") v = Number(v.replace(/,/g, ""));
    if (typeof v !== "number" || !isFinite(v)) return "NM";
    kind = kind || "num";
    var d = decimals != null ? decimals : (kind in FMT_DECIMALS ? FMT_DECIMALS[kind] : 1);
    if (kind === "x" && v < 0) return "NM";
    var r = roundHalfUp(Math.abs(v), d), body = grouped(r, d), neg = v < 0 && r !== 0;
    var s = kind === "x" ? body + "x" : kind === "%" ? body + "%" : kind === "bp" ? body + "bp" : kind === "$m" ? "$" + body + "m"
          : kind === "$bn" ? "$" + body + "bn" : kind === "$" ? "$" + body : body;
    return neg ? "(" + s + ")" : s;
  }
  function finite(values) { return values.filter(function (v) { return typeof v === "number" && isFinite(v); }); }
  // Excel's QUARTILE.INC and PERCENTILE.INC: linear between the two nearest ranks of the sorted values.
  function quantile(values, p) {
    var xs = finite(values).sort(function (a, b) { return a - b; });
    if (!xs.length) return NaN;
    var h = (xs.length - 1) * p, lo = Math.floor(h), hi = Math.min(lo + 1, xs.length - 1);
    return xs[lo] + (h - lo) * (xs[hi] - xs[lo]);
  }
  function mean(values) { var xs = finite(values); return xs.length ? xs.reduce(function (a, b) { return a + b; }, 0) / xs.length : NaN; }
  function median(values) { return quantile(values, 0.5); }
  // A multiple; NaN (shown NM) when the denominator is zero or negative, the multiple is negative,
  // or it is above nmAbove (100x unless the piece says); null (n/a) when a side is missing.
  function multiple(num, den, nmAbove) {
    if (num === null || num === undefined || den === null || den === undefined) return null;
    if (typeof num !== "number" || typeof den !== "number" || !isFinite(num) || !isFinite(den) || den <= 0) return NaN;
    var m = num / den;
    return m < 0 || m > (nmAbove || 100) ? NaN : m;
  }
  // Implied value per share from unlevered free cash flows ($m, years 1 to N): each flow discounted
  // at WACC, plus a terminal value (Gordon growth on the last flow, or an exit multiple on the last
  // year's EBITDA) discounted from year N, less net debt, over diluted shares (m). With midYear the
  // flows are discounted at t - 0.5 and so is a growth terminal value; an exit multiple terminal
  // value stays at N (Rosenbaum and Pearl). NaN when WACC is not above growth.
  function dcf(model, waccPct, terminal, method) {
    var w = waccPct / 100, flows = (model && model.fcf) || [], n = flows.length;
    if (!n || !(w > 0)) return NaN;
    var pv = 0;
    for (var t = 1; t <= n; t++) pv += flows[t - 1] / Math.pow(1 + w, model.midYear ? t - 0.5 : t);
    var tv, at = n;
    if (method === "multiple") {
      if (typeof model.ebitda !== "number") return NaN;
      tv = model.ebitda * terminal;
    } else {
      var g = terminal / 100;
      if (w <= g) return NaN;
      tv = flows[n - 1] * (1 + g) / (w - g);
      if (model.midYear) at = n - 0.5;
    }
    var equity = pv + tv / Math.pow(1 + w, at) - (model.netDebt || 0);
    return model.shares ? equity / model.shares : equity;
  }
  function round(v, d) { var f = Math.pow(10, d); return Math.round(v * f) / f; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  // Every finance piece names where its numbers came from in data-source; without one, or with
  // numbers that do not read, it shows [unclear] and no numbers.
  function financePiece(piece, draw) {
    var source = (piece.dataset.source || "").trim().replace(/^sources?:\s*/i, ""), script = piece.querySelector('script[type="application/json"]'), data;
    try {
      if (!script) throw new Error("no numbers inside it");
      data = JSON.parse(script.textContent);
    } catch (e) { return unclear(piece, "the numbers could not be read (" + e.message + ")"); }
    if (!source) return unclear(piece, (data.title ? data.title + ": " : "") + "no source line, so the numbers are not shown");
    piece.innerHTML = "";
    if (data.title) piece.appendChild(el("div", "fin-title", data.title));
    if (data.subtitle) piece.appendChild(el("div", "fin-sub", data.subtitle));
    try { draw(piece, data); } catch (e) { console.error("finance piece: " + e.message); return unclear(piece, "it could not be drawn (" + e.message + ")"); }
    piece.appendChild(el("div", "source", "Source: " + source));
  }
  function unclear(piece, why) { piece.innerHTML = ""; piece.appendChild(el("div", "fin-unclear", "[unclear] " + why)); }

  // <div class="football" data-source="..."><script type="application/json">{"title": "...", "unit": "$",
  //   "price": 40.1, "priceLabel": "Current", "highlight": "DCF", "bars": [{"label": "DCF", "detail": "WACC 8.5% to 9.5%",
  //   "low": 38.2, "high": 47.9}, ...]}</script></div>: one floating bar per method, grey for context, the
  // highlighted one in the accent, the current price as a dashed line, each bar's low and high at its ends.
  function drawFootball(piece, data) {
    if (!window.Chart) throw new Error("charts are not loaded");
    var bars = data.bars || [], unit = data.unit || "$";
    if (!bars.length) throw new Error("no bars");
    bars.forEach(function (b) { if (!(isFinite(b.low) && isFinite(b.high) && b.high >= b.low)) throw new Error("each bar needs a low and a high"); });
    var lit = typeof data.highlight === "number" ? data.highlight : bars.findIndex(function (b) { return b.highlight === true || (data.highlight && b.label === data.highlight); });
    var accent = cssVar("--accent", "#f2a93b"), context = cssVar("--context", "#4f5f76"), text = cssVar("--chart-text", "#eee"),
        tick = cssVar("--chart-tick", "#bbb"), grid = cssVar("--chart-grid", "#333"), strong = cssVar("--strong", "#fff"), font = cssVar("--font", "sans-serif");
    var values = [].concat.apply([], bars.map(function (b) { return [b.low, b.high]; }));
    if (isFinite(data.price)) values.push(data.price);
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values), pad = (hi - lo) * 0.22 || 1;
    var tickDecimals = hi - lo >= 8 ? 0 : 2;
    // A method's detail wraps at about 26 characters so the labels leave the plot most of the width.
    var wrap = function (text) {
      var lines = [], line = "";
      String(text).split(" ").forEach(function (word) { if (line && (line + " " + word).length > 26) { lines.push(line); line = word; } else line = line ? line + " " + word : word; });
      if (line) lines.push(line);
      return lines;
    };
    var labels = bars.map(function (b) { return b.detail ? [b.label].concat(wrap(b.detail)) : b.label; });
    var tallest = labels.reduce(function (m, l) { return Math.max(m, Array.isArray(l) ? l.length : 1); }, 1);
    var area = el("div", "plotarea"); area.style.height = (bars.length * Math.max(34, tallest * 14 + 8) + 58) + "px";
    var canvas = document.createElement("canvas"); area.appendChild(canvas); piece.appendChild(area);
    var priceLine = {id: "priceLine", afterDatasetsDraw: function (chart) {
      if (!isFinite(data.price)) return;
      var x = chart.scales.x.getPixelForValue(data.price), a = chart.chartArea, ctx = chart.ctx;
      ctx.save(); ctx.strokeStyle = strong; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x, a.top - 3); ctx.lineTo(x, a.bottom); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = strong; ctx.font = "600 11px " + font; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText((data.priceLabel || "Current") + " " + fmt(data.price, unit), x, a.top - 5); ctx.restore();
    }};
    var ends = {id: "barEnds", afterDatasetsDraw: function (chart) {
      var ctx = chart.ctx;
      ctx.save(); ctx.font = "11px " + font; ctx.textBaseline = "middle"; ctx.fillStyle = text;
      chart.getDatasetMeta(0).data.forEach(function (bar, i) {
        var left = Math.min(bar.x, bar.base), right = Math.max(bar.x, bar.base);
        ctx.textAlign = "right"; ctx.fillText(fmt(bars[i].low, unit), left - 5, bar.y);
        ctx.textAlign = "left"; ctx.fillText(fmt(bars[i].high, unit), right + 5, bar.y);
      });
      ctx.restore();
    }};
    new Chart(canvas, {type: "bar", plugins: [priceLine, ends],
      data: {labels: labels,
             datasets: [{data: bars.map(function (b) { return [b.low, b.high]; }),
                         backgroundColor: bars.map(function (b, i) { return i === lit ? accent : context; }),
                         borderRadius: 2, borderSkipped: false, barPercentage: 0.62, categoryPercentage: 0.9}]},
      options: {indexAxis: "y", responsive: true, maintainAspectRatio: false, animation: false,
        layout: {padding: {top: 20, right: 6}}, plugins: {legend: {display: false}, tooltip: {enabled: false}},
        scales: {x: {min: lo - pad, max: hi + pad, grid: {color: grid}, border: {color: grid},
                     ticks: {color: tick, maxTicksLimit: 7, callback: function (v) { return fmt(v, unit, tickDecimals); }}},
                 y: {grid: {display: false}, border: {color: grid}, ticks: {color: text, font: {size: 11.5}}}}}});
  }

  // <div class="sens" data-source="..."><script type="application/json">{"title": "...", "metric": "Implied share price",
  //   "unit": "$", "method": "growth" or "multiple", "wacc": [8, 8.5, 9, 9.5, 10], "growth": [2, 2.5, 3, 3.5, 4]
  //   (or "multiple": [10, 11, 12, 13, 14]), "base": {"wacc": 9, "terminal": 3}, "band": {"low": 38, "high": 46},
  //   "price": 40.1, "model": {"fcf": [...], "ebitda": 1180, "netDebt": 1850, "shares": 160, "midYear": false},
  //   "values": [[...], ...]}</script></div>
  // Rows are WACC, columns terminal growth or the exit multiple. The base case is boxed (the center
  // unless "base" names it); the reasonable band is shaded (one step around the base, or the cells
  // whose value falls inside "band"). Cells are "values" when given, else computed from "model";
  // with a model a WACC slider recomputes the implied value in the page as he drags it.
  function drawSens(piece, data) {
    var method = data.method === "multiple" || (!data.growth && data.multiple) ? "multiple" : "growth";
    var rows = data.wacc || [], cols = (method === "multiple" ? data.multiple : data.growth) || [], unit = data.unit || "$", model = data.model;
    if (!rows.length || !cols.length) throw new Error("it needs a wacc list and a " + (method === "multiple" ? "multiple" : "growth") + " list");
    if (!model && !data.values) throw new Error("it needs a model or the values");
    var colKind = method === "multiple" ? "x" : "%", metric = data.metric || (model && model.shares ? "Implied share price" : "Implied equity value");
    function value(r, c) {
      if (data.values) { var v = data.values[r] && data.values[r][c]; return typeof v === "number" ? v : NaN; }
      return dcf(model, rows[r], cols[c], method);
    }
    var base = data.base || {}, baseTerm = base.terminal != null ? base.terminal : (method === "multiple" ? base.multiple : base.growth);
    var br = rows.indexOf(base.wacc) >= 0 ? rows.indexOf(base.wacc) : Math.floor((rows.length - 1) / 2);
    var bc = cols.indexOf(baseTerm) >= 0 ? cols.indexOf(baseTerm) : Math.floor((cols.length - 1) / 2);
    var band = data.band && isFinite(data.band.low) && isFinite(data.band.high) ? data.band : null;
    var table = el("table", "fin-table"), head = el("thead"), body = el("tbody");
    var group = el("tr", "group"); group.appendChild(el("th", "corner", metric));
    var span = el("th", null, method === "multiple" ? "Exit multiple (EV / EBITDA)" : "Terminal growth"); span.colSpan = cols.length; group.appendChild(span);
    var colRow = el("tr"); colRow.appendChild(el("th", "corner", "WACC"));
    cols.forEach(function (c) { colRow.appendChild(el("th", "colh", fmt(c, colKind))); });
    head.appendChild(group); head.appendChild(colRow);
    rows.forEach(function (w, r) {
      var tr = el("tr"); tr.appendChild(el("th", "rowh", fmt(w, "%")));
      cols.forEach(function (c, ci) {
        var v = value(r, ci), td = el("td", null, fmt(v, unit));
        var inBand = band ? (isFinite(v) && v >= band.low && v <= band.high) : (Math.abs(r - br) <= 1 && Math.abs(ci - bc) <= 1);
        if (inBand) td.classList.add("band");
        if (r === br && ci === bc) td.classList.add("base");
        if (!isFinite(v)) td.classList.add("nm");
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    table.appendChild(head); table.appendChild(body); piece.appendChild(table);
    if (!model) return;
    var live = el("div", "live"), label = el("label", null, "WACC"), input = document.createElement("input"), out = el("span", "out");
    input.type = "range"; input.setAttribute("data-dot-own", ""); input.setAttribute("aria-label", "WACC");
    input.min = Math.min.apply(null, rows); input.max = Math.max.apply(null, rows); input.step = "0.05"; input.value = rows[br];
    live.appendChild(label); live.appendChild(input); live.appendChild(out); piece.appendChild(live);
    var termText = method === "multiple" ? fmt(cols[bc], "x") + " exit" : fmt(cols[bc], "%") + " growth";
    function update(tell) {
      var w = Number(input.value), v = dcf(model, w, cols[bc], method);
      out.textContent = "";
      out.appendChild(document.createTextNode(fmt(w, "%", 2) + " and " + termText + ": "));
      out.appendChild(el("b", null, fmt(v, unit)));
      if (isFinite(data.price) && isFinite(v)) out.appendChild(document.createTextNode(", " + fmt((v / data.price - 1) * 100, "%") + " vs " + fmt(data.price, unit) + " current"));
      var near = rows.reduce(function (best, x, i) { return Math.abs(x - w) < Math.abs(rows[best] - w) ? i : best; }, 0);
      Array.from(body.rows).forEach(function (tr, i) { tr.classList.toggle("near", i === near); });
      if (tell) reportEvent("slider", {figure: data.title || "sensitivity", name: "WACC", value: round(w, 2), unit: "%",
                                       result: {label: metric.toLowerCase(), value: round(v, 2), text: fmt(v, unit)}});
    }
    input.addEventListener("input", function () { update(false); });
    input.addEventListener("change", function () { update(true); });
    update(false);
  }

  // <div class="comps" data-source="..."><script type="application/json">{"title": "...", "nmAbove": 100,
  //   "columns": [{"label": "EV", "key": "ev", "format": "$m"}, {"label": "EV / EBITDA", "period": "LTM", "num": "ev", "den": "ebitdaLtm"}, ...],
  //   "peers": [{"name": "...", "ticker": "...", "ev": 12400, "ebitdaLtm": 1050, ...}], "target": {...}}</script></div>
  // A column is a multiple (num over den, or a given "key"), NM when the denominator is zero or
  // negative, the multiple negative, or above nmAbove; or a plain figure ("format": "$m", "$bn",
  // "%", "$"). The statistics leave out NM cells and the target: 75th percentile, mean, median and
  // 25th percentile (Excel's QUARTILE.INC). The target row is boxed.
  var COMPS_COLUMNS = [{label: "EV / Revenue", period: "LTM", num: "ev", den: "revenueLtm"}, {label: "EV / Revenue", period: "NTM", num: "ev", den: "revenueNtm"},
                       {label: "EV / EBITDA", period: "LTM", num: "ev", den: "ebitdaLtm"}, {label: "EV / EBITDA", period: "NTM", num: "ev", den: "ebitdaNtm"}];
  function compsCell(row, col, nmAbove) {
    var format = col.format || "x";
    if (!col.key) return format === "x" ? multiple(row[col.num], row[col.den], nmAbove) : NaN;
    var v = row[col.key];
    if (v === null || v === undefined) return null;
    if (typeof v !== "number" || !isFinite(v)) return NaN;
    return format === "x" && (v < 0 || v > nmAbove) ? NaN : v;
  }
  function drawComps(piece, data) {
    var cols = data.columns || COMPS_COLUMNS, peers = data.peers || [], nmAbove = data.nmAbove || 100;
    if (!peers.length) throw new Error("no peers");
    var table = el("table", "fin-table"), head = el("thead"), body = el("tbody");
    var group = el("tr", "group"), periods = el("tr");
    group.appendChild(el("th", null, "")); periods.appendChild(el("th", null, "Company"));
    for (var i = 0; i < cols.length; i++) {
      var j = i; while (j + 1 < cols.length && cols[j + 1].label === cols[i].label) j++;
      var g = el("th", null, cols[i].period ? cols[i].label : ""); g.colSpan = j - i + 1; group.appendChild(g);
      for (var k = i; k <= j; k++) periods.appendChild(el("th", "num", cols[k].period || cols[k].label));
      i = j;
    }
    head.appendChild(group); head.appendChild(periods);
    function row(cls, name, ticker, cells) {
      var tr = el("tr", cls), first = el("td", null, name);
      if (ticker) first.appendChild(el("span", "tick", ticker));
      tr.appendChild(first);
      cells.forEach(function (v, ci) { var td = el("td", "num", fmt(v, cols[ci].format || "x")); if (typeof v === "number" && !isFinite(v)) td.classList.add("nm"); tr.appendChild(td); });
      body.appendChild(tr);
    }
    var grid = peers.map(function (p) { return cols.map(function (c) { return compsCell(p, c, nmAbove); }); });
    peers.forEach(function (p, r) { row("peer", p.name || "", p.ticker, grid[r]); });
    var column = function (ci) { return grid.map(function (cells) { return cells[ci]; }); };
    [["75th percentile", function (xs) { return quantile(xs, 0.75); }], ["Mean", mean], ["Median", median], ["25th percentile", function (xs) { return quantile(xs, 0.25); }]]
      .forEach(function (stat, si) { row("stat" + (si ? "" : " first"), stat[0], "", cols.map(function (c, ci) { return stat[1](column(ci)); })); });
    if (data.target) row("target", data.target.name || "Target", data.target.ticker, cols.map(function (c) { return compsCell(data.target, c, nmAbove); }));
    table.appendChild(head); table.appendChild(body); piece.appendChild(table);
  }

  // ---- figures that report back -------------------------------------------------------------
  // dot.report(kind, data) tells Dot what he did to a figure: posts {type: "event", kind, data, card}
  // through the dot handler. At most one message per 1.5 s (a newer value of the same thing waits
  // and replaces the older), and only when the value changed since it was last told. Built in: a
  // JSXGraph point let go (its coordinates), a JSXGraph or range slider set, a [data-part] tapped,
  // and the WACC slider on a .sens card. Dot may answer in words; an event never makes Dot act.
  var EVENT_GAP = 1500, lastPost = 0, held = null, heldTimer = null, told = {};
  function eventKey(kind, data) { return kind + "\u001f" + (data.point || data.name || data.part || data.figure || ""); }
  function cardID() {
    var m = location.pathname.match(/card-([^\/]+)\.html$/);
    return document.documentElement.dataset.card || (m ? decodeURIComponent(m[1]) : "");
  }
  function post(msg) {
    told[eventKey(msg.kind, msg.data)] = JSON.stringify(msg.data);
    lastPost = Date.now();
    try { window.webkit.messageHandlers.dot.postMessage(msg); } catch (e) {}
  }
  function reportEvent(kind, data) {
    kind = String(kind || "event");
    data = data && typeof data === "object" ? data : {value: data};
    var key = eventKey(kind, data);
    if (held && eventKey(held.kind, held.data) === key) held = null;
    if (told[key] === JSON.stringify(data)) return false;
    var msg = {type: "event", kind: kind, data: data, card: cardID()}, wait = lastPost + EVENT_GAP - Date.now();
    if (wait <= 0 && !heldTimer) { post(msg); return true; }
    held = msg;
    if (!heldTimer) heldTimer = setTimeout(function () { heldTimer = null; var m = held; held = null; if (m) post(m); }, Math.max(wait, 0));
    return true;
  }
  // A JSXGraph board: when he lets go, every free point that moved reports where it is, every slider its value.
  function watchBoard(div, board) {
    var figure = div.dataset.name || div.getAttribute("aria-label") || "", seen = {};
    function state(e) {
      if (e.visPropCalc && e.visPropCalc.visible === false) return null;
      if (e.elType === "slider") return {kind: "slider", data: {figure: figure, name: e.name || e.id, value: round(e.Value(), 3)}};
      if ((e.elType === "point" || e.elType === "glider") && e.isDraggable && !(e.visProp && e.visProp.fixed))
        return {kind: "drag", data: {figure: figure, point: e.name || e.id, x: round(e.X(), 2), y: round(e.Y(), 2)}};
      return null;
    }
    function scan(tell) {
      board.objectsList.forEach(function (e) {
        var s = state(e); if (!s) return;
        var now = JSON.stringify(s.data);
        if (tell && seen[e.id] !== now) reportEvent(s.kind, s.data);
        seen[e.id] = now;
      });
    }
    scan(false);
    board.on("up", function () { scan(true); });
  }
  document.addEventListener("change", function (e) {
    var input = e.target;
    if (!input.matches || !input.matches('input[type="range"]') || input.hasAttribute("data-dot-own")) return;
    var label = input.closest("label");
    var name = input.getAttribute("aria-label") || input.name || input.id || (label ? label.textContent.trim() : "") || "slider";
    reportEvent("slider", {name: name.slice(0, 60), value: Number(input.value), unit: input.dataset.unit || ""});
  });
  document.addEventListener("click", function (e) {
    var part = e.target.closest && e.target.closest("[data-part]");
    if (part) reportEvent("tap", {part: part.dataset.part, label: (part.getAttribute("aria-label") || part.textContent || "").trim().slice(0, 80)});
  });

  function hidden(el) {
    var s = el.closest(".step");
    if (s && !s.classList.contains("shown")) return true;
    return !!el.closest("[data-step].off");
  }
  function each(root, selector, fn) {
    root.querySelectorAll(selector).forEach(function (el) {
      if (el.dataset.drawn || hidden(el)) return;
      el.dataset.drawn = "1"; fn(el);
    });
  }
  function drawAll(root) {
    root = root || document;
    each(root, ".plot", drawPlot);
    each(root, ".numberline", drawNumberLine);
    each(root, ".chart", drawChart);
    each(root, ".molecule", drawMolecule);
    each(root, ".sequence", drawSequence);
    each(root, "canvas.smiles", drawSmiles);
    each(root, ".jsx", drawJSX);
    each(root, ".helix", drawHelix);
    each(root, ".football", function (el) { financePiece(el, drawFootball); });
    each(root, ".sens", function (el) { financePiece(el, drawSens); });
    each(root, ".comps", function (el) { financePiece(el, drawComps); });
    drawMermaid(root);
    root.querySelectorAll(".diagram svg").forEach(function (svg) {
      if (svg.querySelector("#arrowhead")) return;
      var defs = svgEl("defs", {}), m = svgEl("marker", {id: "arrowhead", markerWidth: "8", markerHeight: "8", refX: "6", refY: "4", orient: "auto"});
      m.appendChild(svgEl("path", {d: "M0,0 L8,4 L0,8 z", fill: cssVar("--accent", "#ff6b2c")})); defs.appendChild(m); svg.insertBefore(defs, svg.firstChild);
    });
    root.querySelectorAll("[data-animate]").forEach(function (el) { if (!hidden(el) && !el.dataset.animated) { el.dataset.animated = "1"; runAnimation(el); } });
  }
  function report(kind, text) {
    try { window.webkit.messageHandlers.dot.postMessage(kind + ": " + text); } catch (e) {}
  }
  window.addEventListener("error", function (e) { report("error", (e.message || "") + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno); });
  window.addEventListener("unhandledrejection", function (e) { report("rejection", String(e.reason && e.reason.message || e.reason)); });
  var nativeError = console.error; console.error = function () { report("console", Array.prototype.slice.call(arguments).join(" ")); nativeError.apply(console, arguments); };
  window.Board = {need: need, typeset: typeset, draw: drawAll, animate: runAnimation, report: report, cssVar: cssVar,
                 fmt: fmt, quantile: quantile, mean: mean, median: median, multiple: multiple, dcf: dcf};
  window.dot = {report: reportEvent};
  window.board = {reveal: reveal, stepRect: stepRect, scrollToStep: scrollToStep, height: height, stepCount: stepCount, shownCount: shownCount,
                  setWaiting: setWaiting, isStage: function () { return !!stage; }};
  document.addEventListener("DOMContentLoaded", function () {
    settleLook();
    setupStage();
    drawAll(); typeset();
    if (window.anime) anime({targets: "body > *:not(script)", opacity: [0, 1], translateY: [8, 0], delay: anime.stagger(60), duration: 480, easing: "easeOutCubic"});
  });
})();
