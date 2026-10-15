// Dot's board helpers: step reveal, plots, number lines, math typesetting. No network, no frameworks.
(function () {
  function typeset() {
    if (window.renderMathInElement) {
      renderMathInElement(document.body, {
        delimiters: [{left: "$$", right: "$$", display: true}, {left: "\\[", right: "\\]", display: true},
                     {left: "$", right: "$", display: false}, {left: "\\(", right: "\\)", display: false}],
        throwOnError: false
      });
    }
  }
  function steps() { return Array.from(document.querySelectorAll(".step")); }
  function reveal(n) {
    var all = steps();
    all.forEach(function (s, i) {
      s.classList.toggle("shown", i < n);
      s.classList.toggle("current", i === n - 1);
    });
    return JSON.stringify({shown: Math.min(n, all.length), total: all.length});
  }
  function stepRect(n) {
    var cur = steps()[n - 1];
    if (!cur) return null;
    var r = cur.getBoundingClientRect();
    return JSON.stringify({x: r.left, y: r.top, w: r.width, h: r.height, viewH: window.innerHeight});
  }
  function scrollToStep(n) {
    var cur = steps()[n - 1];
    if (cur) cur.scrollIntoView({block: "nearest"});
    return stepRect(n);
  }
  function height() { return document.documentElement.scrollHeight; }
  function stepCount() { return steps().length; }
  function shownCount() { return document.querySelectorAll(".step.shown").length; }

  function svgEl(tag, attrs) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function drawPlot(div) {
    var fns = (div.dataset.fn || "x").split("|");
    var xr = (div.dataset.x || "-5,5").split(",").map(Number), x0 = xr[0], x1 = xr[1];
    var W = 400, H = 170, pad = 22;
    var samples = [];
    fns.forEach(function (expr) {
      var f; try { f = new Function("x", "with (Math) { return (" + expr + "); }"); } catch (e) { return; }
      var pts = [];
      for (var i = 0; i <= 160; i++) { var x = x0 + (x1 - x0) * i / 160; var y = f(x); if (isFinite(y)) pts.push([x, y]); }
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
      svg.appendChild(svgEl("path", {d: d, class: "curve" + (i ? " second" : "")}));
    });
    (div.dataset.points || "").split(";").filter(Boolean).forEach(function (pair) {
      var p = pair.split(",").map(Number);
      svg.appendChild(svgEl("circle", {cx: sx(p[0]), cy: sy(p[1]), r: 4, class: "pt"}));
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
  function drawAll() {
    document.querySelectorAll(".plot").forEach(drawPlot);
    document.querySelectorAll(".numberline").forEach(drawNumberLine);
    // Arrowhead marker for diagrams drawn by hand in svg.
    document.querySelectorAll(".diagram svg").forEach(function (svg) {
      if (svg.querySelector("#arrowhead")) return;
      var defs = svgEl("defs", {});
      var m = svgEl("marker", {id: "arrowhead", markerWidth: "8", markerHeight: "8", refX: "6", refY: "4", orient: "auto"});
      var p = svgEl("path", {d: "M0,0 L8,4 L0,8 z", fill: "#ff6b2c"});
      m.appendChild(p); defs.appendChild(m); svg.insertBefore(defs, svg.firstChild);
    });
  }
  window.board = {reveal: reveal, stepRect: stepRect, scrollToStep: scrollToStep, height: height, stepCount: stepCount, shownCount: shownCount};
  document.addEventListener("DOMContentLoaded", function () { drawAll(); typeset(); });
})();
