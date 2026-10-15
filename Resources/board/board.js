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
        if (lib.css) loadCSS(lib.css);
        if (lib.module) return import("./" + lib.module).then(function (m) { window[name === "three" ? "THREE" : name] = m; return m; });
        return loadScript(lib.script);
      });
      return loaded[name];
    })).then(function (r) { return r.length === 1 ? r[0] : r; });
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

  // ---- steps ---------------------------------------------------------------------------
  function steps() { return Array.from(document.querySelectorAll(".step")); }
  function reveal(n) {
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
    var cur = steps()[n - 1];
    if (!cur) return null;
    var r = cur.getBoundingClientRect();
    return JSON.stringify({x: r.left, y: r.top, w: r.width, h: r.height, viewH: window.innerHeight});
  }
  function scrollToStep(n) { var cur = steps()[n - 1]; if (cur) cur.scrollIntoView({block: "nearest"}); return stepRect(n); }
  function height() { return document.documentElement.scrollHeight; }
  function stepCount() { return steps().length; }
  function shownCount() { return document.querySelectorAll(".step.shown").length; }

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
    var accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff6b2c";
    var palette = [accent, "#7cc7ff", "#9ef0b6", "#ffd166", "#c79bff"];
    new Chart(canvas, {type: div.dataset.kind || "bar", data: {labels: labels, datasets: series.map(function (vals, i) {
      return {label: names[i] || "", data: vals, backgroundColor: div.dataset.kind === "line" ? "transparent" : palette[i % palette.length] + "cc",
              borderColor: palette[i % palette.length], borderWidth: 2, tension: 0.3, fill: false};
    })}, options: {animation: {duration: 900}, plugins: {legend: {display: names.length > 1 && !!names[0], labels: {color: "#eee"}},
      title: {display: !!div.dataset.title, text: div.dataset.title, color: "#eee"}}, scales: {x: {ticks: {color: "#bbb"}, grid: {color: "#333"}}, y: {ticks: {color: "#bbb"}, grid: {color: "#333"}}}}});
  }
  // <div class="mermaid">flowchart LR; A-->B</div>
  function drawMermaid(root) {
    var nodes = Array.from((root || document).querySelectorAll(".mermaid")).filter(function (el) { return !el.dataset.drawn && !hidden(el); });
    nodes.forEach(function (el) { el.dataset.drawn = "1"; });
    if (!nodes.length) return Promise.resolve();
    return need("mermaid").then(function () {
      mermaid.initialize({startOnLoad: false, theme: "dark", themeVariables: {primaryColor: "#2a2420", primaryTextColor: "#f0ebe3", lineColor: "#ff6b2c", fontFamily: "-apple-system, Helvetica, sans-serif"}});
      return mermaid.run({nodes: nodes});
    }).catch(function (e) { console.error(e); });
  }
  // <div class="molecule" data-pdb="1BNA" data-style="cartoon|stick|sphere" data-height="260"></div>
  // A PDB id fetches from RCSB (the one network call a card may make); data-src can name a local file.
  function drawMolecule(div) {
    return need("3dmol").then(function () {
      div.style.height = (div.dataset.height || 260) + "px"; div.style.position = "relative";
      var viewer = $3Dmol.createViewer(div, {backgroundColor: "#15120f"});
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
      if (div.dataset.codons === "yes" && i % 3 === 0) svg.appendChild(svgEl("line", {x1: x - 1, y1: y - 18, x2: x - 1, y2: y + 4 + (div.dataset.complement === "no" ? 0 : cell), stroke: "rgba(255,255,255,0.25)"}));
      var t = svgEl("text", {x: x + cell / 2 - 1, y: y, "text-anchor": "middle", fill: colors[seq[i]] || "#ddd", "font-size": "13", "font-family": "SF Mono, Menlo, monospace", "font-weight": "600"});
      t.textContent = seq[i]; svg.appendChild(t);
      if (div.dataset.complement !== "no") {
        var u = svgEl("text", {x: x + cell / 2 - 1, y: y + cell, "text-anchor": "middle", fill: colors[comp[seq[i]]] || "#ddd", "font-size": "13", "font-family": "SF Mono, Menlo, monospace", opacity: 0.75});
        u.textContent = comp[seq[i]] || "N"; svg.appendChild(u);
        svg.appendChild(svgEl("line", {x1: x + cell / 2 - 1, y1: y + 3, x2: x + cell / 2 - 1, y2: y + cell - 11, stroke: "rgba(255,255,255,0.25)"}));
      }
      if (c === 0) { var num = svgEl("text", {x: 4, y: y, fill: "#a39b90", "font-size": "10"}); num.textContent = i + 1; svg.appendChild(num); }
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
  function hidden(el) { var s = el.closest(".step"); return s && !s.classList.contains("shown"); }
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
    drawMermaid(root);
    root.querySelectorAll(".diagram svg").forEach(function (svg) {
      if (svg.querySelector("#arrowhead")) return;
      var defs = svgEl("defs", {}), m = svgEl("marker", {id: "arrowhead", markerWidth: "8", markerHeight: "8", refX: "6", refY: "4", orient: "auto"});
      m.appendChild(svgEl("path", {d: "M0,0 L8,4 L0,8 z", fill: "#ff6b2c"})); defs.appendChild(m); svg.insertBefore(defs, svg.firstChild);
    });
    root.querySelectorAll("[data-animate]").forEach(function (el) { if (!hidden(el) && !el.dataset.animated) { el.dataset.animated = "1"; runAnimation(el); } });
  }
  function report(kind, text) {
    try { window.webkit.messageHandlers.dot.postMessage(kind + ": " + text); } catch (e) {}
  }
  window.addEventListener("error", function (e) { report("error", (e.message || "") + " @" + (e.filename || "").split("/").pop() + ":" + e.lineno); });
  window.addEventListener("unhandledrejection", function (e) { report("rejection", String(e.reason && e.reason.message || e.reason)); });
  var nativeError = console.error; console.error = function () { report("console", Array.prototype.slice.call(arguments).join(" ")); nativeError.apply(console, arguments); };
  window.Board = {need: need, typeset: typeset, draw: drawAll, animate: runAnimation, report: report};
  window.board = {reveal: reveal, stepRect: stepRect, scrollToStep: scrollToStep, height: height, stepCount: stepCount, shownCount: shownCount};
  document.addEventListener("DOMContentLoaded", function () {
    drawAll(); typeset();
    if (window.anime) anime({targets: "body > *:not(script)", opacity: [0, 1], translateY: [8, 0], delay: anime.stagger(60), duration: 480, easing: "easeOutCubic"});
  });
})();
