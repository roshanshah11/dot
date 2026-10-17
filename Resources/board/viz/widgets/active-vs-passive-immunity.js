// Active immunity: your own B cells make the antibody and leave memory cells. Passive immunity: someone else's antibody,
// which protects at once but decays and leaves no memory. The 2x2 grid is natural/artificial by active/passive; the
// curve is antibody level on a log scale over 12 months. Model shapes: a primary response detectable after about 6 days
// and peaking near 3 weeks, settling to a plateau held by long-lived plasma cells; a memory (secondary) response
// starting within about 2 days and peaking about 10 days later at about 10 times the primary peak. Passive IgG decays
// as A0 * 2^(-t/t_half): t_half about 3 weeks for injected immune globulin (adult IgG half-life 21-23 days) and about
// 6 weeks for maternal IgG in an infant (published estimates 30-50 days, varying by antigen).
(function () {
  var EX = {
    "infection-and-recovery": {active: true, natural: true, start: "infected", cell: "infection, recovery"},
    vaccination: {active: true, natural: false, start: "vaccine dose", cell: "vaccination"},
    "maternal-antibodies": {active: false, natural: true, start: "birth", cell: "maternal antibodies", half: 1.4, halfText: "6 weeks"},
    "immune-globulin": {active: false, natural: false, start: "injection", cell: "immune globulin shot", half: 0.7, halfText: "3 weeks"}
  };
  var T1 = 8, FLOOR = 1e-4, CEIL = 40;
  function primary(t, t0) {
    var u = t - t0;
    if (u < 0.2) return 0.01;
    if (u < 0.7) return Math.pow(10, -2 + 2 * (u - 0.2) / 0.5);
    return 0.15 + 0.85 * Math.pow(2, -(u - 0.7));
  }
  function secondary(t) {
    var a1 = primary(T1 + 0.07, 0), u = t - T1;
    if (u < 0.07) return primary(t, 0);
    if (u < 0.35) return Math.pow(10, Math.log10(a1) + (1 - Math.log10(a1)) * (u - 0.07) / 0.28);
    return 1.5 + 8.5 * Math.pow(2, -(u - 0.35) / 1.2);
  }
  function passive(t, h) { return Math.pow(2, -t / h); }
  function small(x) { return x >= 0.01 ? Viz.n(x, 2) : Viz.n(x, 4); }
  // the numbers the formula and status quote, read off the model: peaks, lags (first rise above baseline) in days
  var DAY = 30.4, M = (function () {
    var p1 = 0, t1 = 0, p2 = 0, t2 = 0, l1 = null, l2 = null;
    for (var t = 0; t <= 12.0001; t += 0.01) {
      var a = primary(t, 0), b = secondary(t);
      if (t < T1 && a > p1) { p1 = a; t1 = t; }
      if (t >= T1 && b > p2) { p2 = b; t2 = t - T1; }
      if (l1 == null && a > 0.0101) l1 = t - 0.01;
      if (l2 == null && t > T1 && b > secondary(T1) * 1.01) l2 = t - T1 - 0.01;
    }
    return {p1: p1, p2: p2, ratio: p2 / p1, lag1: Math.round(l1 * DAY), lag2: Math.round(l2 * DAY), peak1: Math.round(t1 * DAY), late: primary(12, 0) / p1};
  })();

  Viz.register("active-vs-passive-immunity", {
    title: "Active vs passive immunity",
    subject: "biology",
    shows: "Pick an example: active immunity means your own B cells make antibody and memory cells, slowly at first; passive immunity is borrowed antibody that protects at once, fades with a half-life of weeks and leaves no memory",
    params: {
      initial_example: {kind: "enum", values: ["infection-and-recovery", "vaccination", "maternal-antibodies", "immune-globulin"], default: "vaccination",
        names: {"infection-and-recovery": "infection", vaccination: "vaccination", "maternal-antibodies": "maternal", "immune-globulin": "immune globulin"}, label: "\\text{example}"},
      exposure: {kind: "boolean", default: true, label: "\\text{exposure}", on: "month 8", off: "none"}
    },
    formula: function (v) {
      var e = EX[v.initial_example];
      if (!e.active) return "A(t) = A_0\\cdot 2^{-t/t_{1/2}},\\ t_{1/2} \\approx " + e.halfText.replace(" weeks", "\\ \\text{wk}") + " \\Rightarrow A(8\\,\\text{mo}) \\approx " + small(passive(T1, e.half)) + "\\,A_0";
      return v.exposure ? "\\text{peak}_2/\\text{peak}_1 = " + Viz.n(M.p2, 1) + "/" + Viz.n(M.p1, 1) + " = " + Viz.n(M.ratio, 1) + ",\\ \\ \\text{lag } " + M.lag1 + "\\,\\text{d} \\to " + M.lag2 + "\\,\\text{d}"
        : "\\text{lag } " + M.lag1 + "\\,\\text{d},\\ \\text{peak at } " + M.peak1 + "\\,\\text{d},\\ \\ A(12\\,\\text{mo}) = " + Viz.n(M.late, 2) + "\\,\\text{peak}";
    },
    status: function (v) {
      var x = v.initial_example, ex = v.exposure, e = EX[x], left = small(passive(T1, e.half || 1));
      var fast = "within " + M.lag2 + " days instead of " + M.lag1 + ", peaking " + Viz.fmt(M.ratio, 1) + " times higher (" + Viz.fmt(M.p2, 1) + " vs " + Viz.fmt(M.p1, 1) + ")";
      if (x === "infection-and-recovery") return "<b>Natural active</b>: beating the infection meant being sick for a while, but it left memory B and T cells" +
        (ex ? ", so at month 8 they answer " + fast + "." : " and a lasting antibody level, " + Viz.fmt(M.late, 2) + " of the peak at 12 months.");
      if (x === "vaccination") return "<b>Artificial active</b>: the vaccine's harmless antigen trains your B and T cells without the disease and leaves memory cells" +
        (ex ? ", so the pathogen at month 8 meets a response that starts " + fast + "." : ", while antibody settles to a lasting level, " + Viz.fmt(M.late, 2) + " of the peak at 12 months.");
      if (x === "maternal-antibodies") return "<b>Natural passive</b>: the mother's IgG crossed the placenta (breast milk adds IgA), protecting the newborn at once, but it halves about every 6 weeks, leaving " + left + " of it by month 8, and no memory" +
        (ex ? ", so the baby must start a slow primary response." : ".");
      return "<b>Artificial passive</b>: injected antibody (rabies or tetanus immune globulin, say) protects immediately, but it halves about every 3 weeks, leaving " + left + " of it by month 8, and no memory" +
        (ex ? ", so the body starts from scratch." : ".");
    },
    examples: [
      {name: "vaccination, then exposure", values: {initial_example: "vaccination", exposure: true}},
      {name: "infection and recovery", values: {initial_example: "infection-and-recovery", exposure: false}},
      {name: "maternal antibodies fade", values: {initial_example: "maternal-antibodies", exposure: false}},
      {name: "immune globulin, then exposure", values: {initial_example: "immune-globulin", exposure: true}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, e = EX[v.initial_example], own = c.c1, lent = c.c3;
      // ---- the 2x2 grid ----
      var gx = 96, cw = 144, ch = 30, rows = [22, 56];
      api.label([gx + cw / 2, 12], "natural", {color: c.muted, size: 12, anchor: "middle"});
      api.label([gx + cw + 4 + cw / 2, 12], "artificial", {color: c.muted, size: 12, anchor: "middle"});
      [["active", "memory cells", own], ["passive", "no memory", lent]].forEach(function (r, i) {
        api.label([14, rows[i] + 9], r[0], {color: r[2], size: 13, weight: 650});
        api.label([14, rows[i] + 23], r[1], {color: c.muted, size: 12});
      });
      Object.keys(EX).forEach(function (k) {
        var q = EX[k], x = gx + (q.natural ? 0 : cw + 4), y = rows[q.active ? 0 : 1], on = k === v.initial_example, col = q.active ? own : lent;
        api.rect(x, y, cw, ch, {fill: col, fillOpacity: on ? 0.28 : 0.06, stroke: on ? col : null, width: 1.8, rx: 6});
        api.label([x + cw / 2, y + ch / 2], q.cell, {color: on ? c.ink : c.muted, size: 12, weight: on ? 650 : 500, anchor: "middle"});
      });
      // ---- antibody level over a year, log scale ----
      var X0 = 56, X1 = 384, Yt = 112, Yb = 290, L0 = Math.log10(FLOOR), L1 = Math.log10(CEIL);
      var px = function (t) { return X0 + (X1 - X0) * t / 12; }, py = function (a) { return Yb - (Yb - Yt) * (Math.log10(Math.max(a, FLOOR)) - L0) / (L1 - L0); };
      api.label([X0 - 40, 99], "antibody, × " + (e.active ? "the primary peak" : "the starting dose A₀") + " (log scale: each line ×10)", {color: c.muted, size: 12, raw: true});
      ["0.0001", "0.001", "0.01", "0.1", "1", "10"].forEach(function (a) {
        api.line([X0, py(+a)], [X1, py(+a)], {color: c.axis, width: 1, opacity: 0.45});
        api.label([X0 - 5, py(+a)], a, {color: c.muted, size: 12, anchor: "end"});
      });
      api.line([X0, Yb], [X1 + 4, Yb], {color: c.axis, width: 1.3});
      api.line([X0, Yb], [X0, Yt - 4], {color: c.axis, width: 1.3});
      for (var m = 0; m <= 12; m += 2) api.label([px(m), Yb + 12], m === 12 ? "12 mo" : String(m), {color: c.muted, size: 12, anchor: m === 12 ? "end" : "middle"});
      var sick = function (t0, text) {
        api.rect(px(t0 + 0.05), Yt, px(0.5) - px(0), Yb - Yt, {fill: c.c5, fillOpacity: 0.16, rx: 0});
        api.label(t0 ? [px(t0 + 0.55) + 4, Yt + 8] : [px(t0 + 0.05) + 2, Yt + 24], text, {color: c.c5, size: 12}); // month 8: right of the band, beside "exposure"
      };
      if (v.initial_example === "infection-and-recovery") sick(0, "sick");
      if (!e.active && v.exposure) sick(T1, "can get sick");
      api.label([X0 + 4, Yb - 10], "month 0: " + e.start, {color: c.muted, size: 12});
      if (v.exposure) {
        api.line([px(T1), Yt], [px(T1), Yb], {color: c.ink, width: 1.2, dash: "4 4", opacity: 0.6});
        api.label([px(T1) - 4, Yt + 8], "exposure", {color: c.ink, size: 12, anchor: "end"});
      }
      var ptsOwn = [], ptsLent = [], ptsLate = [];
      for (var t = 0; t <= 12.001; t += 0.02) {
        if (e.active) ptsOwn.push([px(t), py(v.exposure ? secondary(t) : primary(t, 0))]);
        else {
          if (passive(t, e.half) >= FLOOR) ptsLent.push([px(t), py(passive(t, e.half))]); // ends where it leaves the axis
          if (v.exposure && t >= T1) ptsLate.push([px(t), py(primary(t, T1))]);
        }
      }
      if (e.active) {
        api.polyline(ptsOwn, {stroke: own, width: 2.6});
        api.label([px(1.1), py(2.6)], "your own antibody", {color: own, size: 12.5, weight: 650});
        if (v.exposure) { // memory: the secondary peak over the primary one, as a bracket between the two gridlines
          var xb = px(T1) - 9, yp1 = py(M.p1), yp2 = py(M.p2);
          api.line([xb, yp1], [xb, yp2], {color: own, width: 1.6});
          api.line([xb, yp1], [xb + 5, yp1], {color: own, width: 1.6}); api.line([xb, yp2], [xb + 5, yp2], {color: own, width: 1.6});
          api.label([xb - 5, (yp1 + yp2) / 2 - 7], "memory", {color: own, size: 12, weight: 650, anchor: "end"});
          api.label([xb - 5, (yp1 + yp2) / 2 + 7], "×" + api.fmt(M.ratio, 1), {color: own, size: 12, weight: 650, anchor: "end"});
        }
      } else {
        api.polyline(ptsLent, {stroke: lent, width: 2.6});
        api.label([X0 + 4, Yt + 9], "borrowed antibody", {color: lent, size: 12.5, weight: 650});
        api.point([px(e.half), py(0.5)], {color: lent, r: 4});
        api.label([px(e.half) + 8, (py(1) + py(10)) / 2], "half left after ~" + e.halfText, {color: lent, size: 12});
        if (v.exposure) { api.polyline(ptsLate, {stroke: own, width: 2.6}); api.label([px(T1) + 7, py(2.6)], "your own response", {color: own, size: 12}); }
        // the formula's number, on the curve at month 8; the label takes the first spot clear of the curves and the line
        var a8 = passive(T1, e.half), d8 = [px(T1), py(a8)], txt = "≈ " + small(a8) + " A₀", w8 = txt.length * 6.9;
        api.point(d8, {color: lent, r: 4.5, stroke: c.ink});
        var pts = ptsLent.concat(ptsLate), clear = function (x0, y0) {
          if (x0 < X0 + 2 || x0 + w8 > X1 + 12 || y0 - 7 < Yt || y0 + 7 > Yb - 2) return false;
          if (v.exposure && x0 - 3 < px(T1) && x0 + w8 + 3 > px(T1)) return false;
          return !pts.some(function (q) { return q[0] > x0 - 3 && q[0] < x0 + w8 + 3 && q[1] > y0 - 9 && q[1] < y0 + 9; });
        };
        var spots = [[d8[0] + 8, d8[1] - 13], [d8[0] - 8 - w8, d8[1] - 22], [d8[0] + 8, d8[1] + 14], [d8[0] - 8 - w8, d8[1] + 13], [d8[0] + 8, d8[1] - 28], [d8[0] - 8 - w8, d8[1] - 34]];
        var sp = spots.filter(function (q) { return clear(q[0], q[1]); })[0] || spots[0];
        api.label([sp[0], sp[1]], txt, {color: lent, size: 12.5, weight: 650, raw: true});
      }
      api.root.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
