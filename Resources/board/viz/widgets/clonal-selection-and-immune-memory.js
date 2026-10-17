// Clonal selection leaves memory behind. Antigen A selects the rare naive B and T cells whose receptors fit it (about
// 1 in 10^5); they divide for days before antibody shows (a lag of about a week), plasma cells make mostly IgM, and the
// response fades as most effector cells die. The expanded clone leaves long-lived memory cells: more A-specific cells
// than before, already class-switched and affinity-matured. A second dose of A brings antibody up in 1-3 days to a peak
// typically 10-1000 times higher, mostly IgG, that lasts longer. A new antigen B finds no memory: it gets a slow, small
// primary response, which is why memory is specific.
// The curves are the textbook shape, not data: log10 of antibody relative to baseline rises as A(t/tp)^k e^{k(1-t/tp)}
// up to the peak tp and then falls as A / (1 + ((t - tp)/tau)^2). Primary: A = 2, tp = 11 d, k = 4, tau = 9 d.
// Secondary: A = 4, tp = 6 d, k = 3, tau = 30 d. Responses add in linear units; lag = time to reach 10x baseline.
// The lower strip follows the clones themselves (log share of lymphocytes), so memory shows as a bigger starting clone.
(function () {
  var PRI = {A: 2, tp: 11, k: 4, tau: 9}, SEC = {A: 4, tp: 6, k: 3, tau: 30};
  function f(t, m) { if (t <= 0) return 0; return t <= m.tp ? m.A * Math.pow(t / m.tp, m.k) * Math.exp(m.k * (1 - t / m.tp)) : m.A / (1 + Math.pow((t - m.tp) / m.tau, 2)); }
  function antiA(t, v) { return 1 + (Math.pow(10, f(t, PRI)) - 1) + (v.second === "same" ? Math.pow(10, f(t - v.t2, SEC)) - 1 : 0); }
  function antiB(t, v) { return 1 + (v.second === "new" ? Math.pow(10, f(t - v.t2, PRI)) - 1 : 0); }
  function lag(m) { for (var t = 0; t < 30; t += 0.05) if (f(t, m) >= 1) return t; return NaN; }
  var LAG1 = lag(PRI), LAG2 = lag(SEC);
  function peaks(v) {
    var p1 = 0, p2 = 0;
    for (var t = 0; t <= 120; t += 0.25) {
      var a = Math.log10(antiA(t, v)), b = Math.log10(antiB(t, v));
      if (t < v.t2) p1 = Math.max(p1, a); else p2 = Math.max(p2, v.second === "same" ? a : b);
    }
    return [p1, p2];
  }
  // Clone size, log10 of the share of lymphocytes that fit the antigen: naive 1 in 10^5; the primary expansion peaks
  // near 1 in 100 (1000x) on day 9 and ~90% of those cells die, leaving memory near 1 in 1000 (100x naive). A second
  // dose expands the memory clone from there to ~1 in 20 by day 5 and leaves a larger memory pool (~1 in 200).
  var CP = {pk: -2, tp: 9, k: 4, mem: -3, tc: 6}, CS = {pk: -1.3, tp: 5, k: 3, mem: -2.3, tc: 8};
  function clone(s, m, start) {
    if (s <= 0) return start;
    if (s <= m.tp) { var u = s / m.tp; return start + (m.pk - start) * Math.pow(u, m.k) * Math.exp(m.k * (1 - u)); }
    return m.mem + (m.pk - m.mem) * Math.exp(-(s - m.tp) / m.tc);
  }
  function cellsA(t, v) { return v.second === "same" && t > v.t2 ? clone(t - v.t2, CS, clone(v.t2, CP, -5)) : clone(t, CP, -5); }
  function cellsB(t, v) { return v.second === "new" ? clone(t - v.t2, CP, -5) : -5; }
  var round = function (x) { var e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e); return Math.round(m) * Math.pow(10, e); };
  function memFold(v) { return round(Math.pow(10, clone(v.t2, CP, -5) + 5)); }

  Viz.register("clonal-selection-and-immune-memory", {
    title: "Immune memory: first and second response",
    subject: "biology",
    shows: "Slide the day and the second exposure: the first response to an antigen is slow and small, the memory cells it leaves make the second fast and about a hundred times larger, and a new antigen starts from scratch",
    params: {
      t2: {kind: "integer", default: 40, min: 20, max: 80, label: "t_2\\,(\\text{d})"},
      second: {kind: "enum", values: ["same", "new"], names: {same: "antigen A again", "new": "new antigen B"}, default: "same", label: "\\text{2nd}"},
      day: {kind: "integer", default: 120, min: 0, max: 120, label: "\\text{day}"}
    },
    formula: function (v) {
      var p = peaks(v), fold = Math.pow(10, p[1] - p[0]);
      if (v.second === "new") return "\\text{anti-A: lag}\\approx" + Viz.n(LAG1, 1) + "\\,\\text{d},\\ \\text{peak}\\approx10^{" + Viz.n(p[0], 1) + "}\\newline\\text{anti-B: lag}\\approx" + Viz.n(LAG1, 1) + "\\,\\text{d},\\ \\text{peak}\\approx10^{" + Viz.n(p[1], 1) + "}";
      return "\\text{lag } " + Viz.n(LAG1, 1) + "\\to" + Viz.n(LAG2, 1) + "\\,\\text{d},\\quad\\frac{\\text{peak}_2}{\\text{peak}_1}\\approx\\frac{10^{" + Viz.n(p[1], 1) + "}}{10^{" + Viz.n(p[0], 1) + "}}\\approx" + Viz.n(round(fold), 0) + "\\times";
    },
    status: function (v) {
      var d = v.day, p = peaks(v), fold = round(Math.pow(10, p[1] - p[0]));
      if (d < v.t2) {
        if (d === 0) return "Day 0: antigen A arrives, and of millions of naive lymphocytes only the rare clones whose receptors fit it, about <b>1 in 100,000</b>, are selected.";
        if (d < LAG1) return "Day " + d + ": the <b>lag</b>; the selected clones are dividing, but there are not yet enough plasma cells for antibody to rise.";
        if (d <= PRI.tp) return "Day " + d + ": the expanded clone has become plasma cells and anti-A antibody climbs to about <b>" + Math.round(antiA(d, v)) + "×</b> baseline, mostly IgM.";
        return "Day " + d + ": the first response fades as most effector cells die, but the clone leaves <b>memory B and T cells</b>, so A-specific cells are still about <b>" + round(Math.pow(10, cellsA(d, v) + 5)) + "×</b> as common as before.";
      }
      if (v.second === "new") return "Day " + d + ": antigen B is new, so no memory cell fits it and the response to B is slow and small again (it peaks near <b>" + round(Math.pow(10, p[1])) + "×</b> baseline); memory is specific to A.";
      if (d < v.t2 + LAG2) return "Day " + d + ": antigen A is back and the memory clone, about <b>" + memFold(v) + "×</b> the naive one and already switched to IgG, responds at once; antibody rises within about <b>2 days</b>.";
      return "Second response to A: after a lag of about " + Viz.n(LAG2, 0) + " days instead of " + Viz.n(LAG1, 0) + ", antibody peaks about <b>" + fold + "×</b> higher than the first time, mostly IgG, and stays up longer.";
    },
    examples: [
      {name: "day 0: selection", values: {day: 0}},
      {name: "lag phase", values: {day: 3}},
      {name: "first response at its peak", values: {day: 11}},
      {name: "early second dose", values: {t2: 20, second: "same", day: 120}},
      {name: "late dose of a new antigen", values: {t2: 80, second: "new", day: 120}}
    ],
    size: [400, 336],
    draw: function (api, v) {
      var c = api.color, x0 = 46, x1 = 386, yb = 164, yt = 40, top = 4.6, ys0 = 198, ys1 = 300, lo = -5.4, hi = -0.8;
      var X = function (t) { return x0 + (x1 - x0) * t / 120; }, Y = function (l) { return yb - (yb - yt) * l / top; };
      var Ys = function (l) { return ys1 - (ys1 - ys0) * (l - lo) / (hi - lo); };
      var B = v.second === "new";
      // antibody panel: axes and ticks
      api.line([x0, yb], [x1 + 4, yb], {color: c.axis, width: 1.2});
      api.line([x0, yb], [x0, yt - 8], {color: c.axis, width: 1.2});
      ["1", "10", "10²", "10³", "10⁴"].forEach(function (t, i) {
        api.line([x0 - 4, Y(i)], [x0, Y(i)], {color: c.axis, width: 1.2});
        if (i) api.line([x0, Y(i)], [x1, Y(i)], {color: c.grid, width: 1});
        api.label([x0 - 7, Y(i)], t, {color: c.muted, size: 12, anchor: "end", raw: true});
      });
      api.label([x0 - 30, 14], "antibody (× baseline, log)", {color: c.muted, size: 12});
      // cell strip: how common the A-specific and B-specific clones are, on a log scale
      api.line([x0, ys1], [x1 + 4, ys1], {color: c.axis, width: 1.2});
      api.line([x0, ys1], [x0, ys0 - 4], {color: c.axis, width: 1.2});
      [[-5, "1/10⁵"], [-3, "1/10³"], [-1, "1/10"]].forEach(function (q) {
        api.line([x0 - 4, Ys(q[0])], [x0, Ys(q[0])], {color: c.axis, width: 1.2});
        api.line([x0, Ys(q[0])], [x1, Ys(q[0])], {color: c.grid, width: 1});
        api.label([x0 - 7, Ys(q[0])], q[1], {color: c.muted, size: 12, anchor: "end", raw: true});
      });
      var hdr = api.label([x0 - 30, ys0 - 13], "", {color: c.muted, size: 12, clamp: false});
      [["A-specific", c.c1, 650], [" and ", c.muted, 500], ["B-specific", c.c6, 650], [" cells per lymphocyte (log)", c.muted, 500]].forEach(function (q) {
        var sp = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        sp.textContent = q[0]; sp.setAttribute("fill", q[1]); sp.style.fill = q[1]; sp.setAttribute("font-weight", q[2]); hdr.appendChild(sp);
      });
      for (var t = 0; t <= 120; t += 20) {
        api.line([X(t), yb], [X(t), yb + 4], {color: c.axis, width: 1.2});
        api.line([X(t), ys1], [X(t), ys1 + 4], {color: c.axis, width: 1.2});
        api.label([X(t), ys1 + 15], String(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x1, ys1 + 30], "days", {color: c.muted, size: 12, anchor: "end"});
      // antigen doses, through both panels
      var dose = function (t, color, text) {
        api.polygon([[X(t), yb - 2], [X(t) - 6, yb + 9], [X(t) + 6, yb + 9]], {fill: color, fillOpacity: 1});
        api.line([X(t), ys1], [X(t), yt + 6], {color: color, width: 1.2, dash: "3 4", opacity: 0.6});
        api.label([X(t) + 5, yt - 6], text, {color: color, size: 12, weight: 650});
      };
      dose(0, c.c5, "A");
      dose(v.t2, B ? c.c6 : c.c5, B ? "B" : "A again");
      // a curve: solid up to the chosen day, faint after it
      var curve = function (fn, color, toY) {
        var pts = [];
        for (var u = 0; u <= 120.001; u += 0.5) pts.push([X(u), toY(fn(u, v))]);
        var cut = Math.max(0, Math.min(pts.length, Math.round(v.day / 0.5) + 1));
        api.polyline(pts, {stroke: color, width: 2, opacity: 0.3, dash: "4 4"});
        if (cut > 1) api.polyline(pts.slice(0, cut), {stroke: color, width: 3});
      };
      var logA = function (u) { return Math.log10(antiA(u, v)); }, logB = function (u) { return Math.log10(antiB(u, v)); };
      curve(logA, c.c1, Y);
      if (B) curve(logB, c.c6, Y);
      curve(cellsB, c.c6, Ys);
      curve(cellsA, c.c1, Ys);
      // memory: at the second dose the A clone starts this many times above the naive 1 in 10^5
      var ax = X(v.t2) - 6, aTop = Ys(cellsA(v.t2, v)), fold = memFold(v);
      var ahead = v.day < v.t2 ? 0.5 : 1;   // still in the future at the chosen day: drawn faint, like the curves
      api.line([ax, Ys(-5) - 2], [ax, aTop + 2], {color: c.c1, width: 1.6, arrow: true, arrowStart: true, opacity: ahead});
      api.label([ax - 5, (Ys(-5) + aTop) / 2], (X(v.t2) - x0 > 110 ? "memory " : "") + fold + "×", {color: c.c1, size: 12, weight: 650, anchor: "end", opacity: ahead});
      // peak labels beside each peak, kept clear of the axis and the dose lines
      var p = peaks(v);
      var tag = function (xp, yp, texts, L, R, o) {
        for (var i = 0; i < texts.length; i++) {
          var e = api.label([xp, yp], texts[i], Object.assign({size: 12, clamp: false}, o)), w = 0;
          try { w = e.getComputedTextLength(); } catch (err) { w = 0; }
          if (!w) w = texts[i].length * 6.7;
          var x = null, y = yp - 8, a = "start";
          if (xp + 7 + w <= R - 4) x = xp + 7;
          else if (w + 8 <= R - L) { x = Math.max(L + 4 + w / 2, Math.min(R - 4 - w / 2, xp)); y = yp - 16; a = "middle"; }
          if (x != null || i === texts.length - 1) { e.setAttribute("x", x == null ? xp : x); e.setAttribute("y", y); e.setAttribute("text-anchor", a); return; }
          e.parentNode.removeChild(e);
        }
      };
      tag(X(PRI.tp), Y(p[0]), B ? ["anti-A, IgM", "anti-A"] : ["1st, IgM", "1st"], x0, X(v.t2), {color: c.c1});
      if (B) tag(X(v.t2 + PRI.tp), Y(p[1]), ["anti-B, IgM", "anti-B"], X(v.t2), api.w - 2, {color: c.c6});
      else tag(X(v.t2 + SEC.tp), Y(p[1]), ["2nd, IgG"], X(v.t2), api.w - 2, {color: c.c1, weight: 650});
      // today
      api.line([X(v.day), yt - 4], [X(v.day), ys1], {color: c.ink, width: 1.4, opacity: 0.55});
      api.circle([X(v.day), Y(logA(v.day))], 5, {fill: c.c1, stroke: c.card, width: 2});
      if (B && v.day > v.t2) api.circle([X(v.day), Y(logB(v.day))], 5, {fill: c.c6, stroke: c.card, width: 2});
      api.circle([X(v.day), Ys(cellsB(v.day, v))], 4.5, {fill: c.c6, stroke: c.card, width: 2});
      api.circle([X(v.day), Ys(cellsA(v.day, v))], 4.5, {fill: c.c1, stroke: c.card, width: 2});
      // viz.css paints every svg label ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
