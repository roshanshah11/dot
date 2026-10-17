// Two class sections' quiz scores as vertical box plots on one shared score axis. Section 1 stays fixed; the
// comparison picks Section 2's data. Each section has 11 scores (shown as dots beside its box). Quartiles use the
// median-of-halves rule (TI-84, AP Statistics): with n = 11 the median is the 6th score, Q1 the median of the lower
// 5 (the 3rd) and Q3 the 9th. Whiskers run to the most extreme scores inside the 1.5 IQR fences (no score here is
// beyond them). Center is read from the median line, spread from the box height (the IQR).
(function () {
  var S1 = [58, 63, 65, 67, 69, 70, 72, 74, 75, 78, 83];
  var SETS = {
    "same-median-different-iqr": [45, 52, 57, 62, 66, 70, 74, 79, 83, 88, 94],
    "different-median-same-iqr": [69, 74, 77, 78, 80, 82, 83, 85, 87, 89, 96],
    "different-median-different-iqr": [52, 60, 68, 73, 77, 80, 84, 87, 90, 94, 98]
  };
  var NAMES = {"same-median-different-iqr": "same median", "different-median-same-iqr": "same IQR", "different-median-different-iqr": "both differ"};
  function med(a) { var n = a.length, h = n >> 1; return n % 2 ? a[h] : (a[h - 1] + a[h]) / 2; }
  function summary(data) {
    var a = data.slice().sort(function (x, y) { return x - y; }), n = a.length, h = n >> 1;
    var q1 = med(a.slice(0, h)), q3 = med(a.slice(n % 2 ? h + 1 : h)), iqr = q3 - q1, lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
    var inside = a.filter(function (x) { return x >= lo && x <= hi; });
    return {a: a, q1: q1, m: med(a), q3: q3, iqr: iqr, wl: inside[0], wh: inside[inside.length - 1]};
  }

  Viz.register("side-by-side-box-plots", {
    title: "Side-by-side box plots: center vs spread",
    subject: "stats",
    shows: "Pick a comparison: the median lines tell you which section scored higher, the box heights (IQR) which one is more spread out",
    params: {
      initial_comparison: {kind: "enum", values: Object.keys(SETS), names: NAMES, default: "same-median-different-iqr", label: "\\text{compare}"},
      showData: {kind: "boolean", default: true, label: "\\text{scores}", on: "shown", off: "hidden"}
    },
    formula: function (v) {
      var a = summary(S1), b = summary(SETS[v.initial_comparison]);
      return "\\begin{array}{l}\\text{Sec 1: }M=" + a.m + ",\\ IQR=" + a.q3 + "-" + a.q1 + "=" + a.iqr + "\\\\" +
        "\\text{Sec 2: }M=" + b.m + ",\\ IQR=" + b.q3 + "-" + b.q1 + "=" + b.iqr + "\\\\" +
        "\\Delta M=" + (b.m - a.m) + ",\\ \\ \\tfrac{IQR_2}{IQR_1}=" + Viz.n(b.iqr / a.iqr, 2) + "\\end{array}";
    },
    status: function (v) {
      var a = summary(S1), b = summary(SETS[v.initial_comparison]), dm = b.m - a.m;
      if (dm === 0) return "Same center, different spread: both medians are <b>" + a.m + "</b>, but Section 2's middle half spans <b>" + b.iqr +
        "</b> points, " + Viz.fmt(b.iqr / a.iqr, 1) + " times Section 1's " + a.iqr + ".";
      var above = b.m > a.q3 ? ", above Section 1's whole box (Q₃ = " + a.q3 + ")" : "";
      if (b.iqr === a.iqr) return "Same spread, different center: both middle halves span <b>" + a.iqr + "</b> points, but Section 2's median is <b>" +
        Math.abs(dm) + "</b> points " + (dm > 0 ? "higher" : "lower") + " at " + b.m + above + ".";
      return "Both differ: Section 2's median is <b>" + Math.abs(dm) + "</b> points " + (dm > 0 ? "higher" : "lower") + above + ", and its IQR of <b>" + b.iqr +
        "</b> is " + Viz.fmt(b.iqr / a.iqr, 1) + " times Section 1's " + a.iqr + ".";
    },
    examples: [
      {name: "initial_comparison: different-median-same-iqr", values: {initial_comparison: "different-median-same-iqr"}},
      {name: "initial_comparison: different-median-different-iqr", values: {initial_comparison: "different-median-different-iqr"}},
      {name: "boxes only", values: {initial_comparison: "same-median-different-iqr", showData: false}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, yTop = 34, yBot = 258, lo = 40, hi = 100, ax = 46;
      var Y = function (t) { return yBot - (yBot - yTop) * (t - lo) / (hi - lo); };
      var a = summary(S1), b = summary(SETS[v.initial_comparison]);
      // the shared score axis
      api.line([ax, yBot + 4], [ax, yTop - 8], {color: c.axis, width: 1.2});
      for (var t = lo; t <= hi; t += 10) {
        api.line([ax - 4, Y(t)], [ax, Y(t)], {color: c.axis, width: 1});
        api.line([ax, Y(t)], [392, Y(t)], {color: c.grid, width: 1});
        api.label([ax - 7, Y(t)], String(t), {color: c.muted, size: 12, anchor: "end"});
      }
      api.label([ax - 30, 12], "score", {color: c.muted, size: 12});
      function group(s, cx, col, name) {
        var bw = 50, x0 = cx - bw / 2;
        api.label([cx, 12], name, {color: col, size: 13, weight: 650, anchor: "middle"});
        // whiskers with caps
        api.line([cx, Y(s.wh)], [cx, Y(s.q3)], {color: col, width: 2});
        api.line([cx, Y(s.q1)], [cx, Y(s.wl)], {color: col, width: 2});
        [s.wl, s.wh].forEach(function (w) { api.line([cx - 12, Y(w)], [cx + 12, Y(w)], {color: col, width: 2}); });
        api.rect(x0, Y(s.q3), bw, Y(s.q1) - Y(s.q3), {fill: col, fillOpacity: 0.22, stroke: col, width: 1.8, rx: 2});
        api.line([x0, Y(s.m)], [x0 + bw, Y(s.m)], {color: c.ink, width: 3});
        // the five numbers on the right of the box
        var lx = x0 + bw + 7;
        api.label([lx, Y(s.q3)], "Q₃ " + s.q3, {color: col, size: 12, weight: 600});
        api.label([lx, Y(s.m)], "M " + s.m, {color: c.ink, size: 12, weight: 650});
        api.label([lx, Y(s.q1)], "Q₁ " + s.q1, {color: col, size: 12, weight: 600});
        api.label([lx, Y(s.wh)], String(s.wh), {color: c.muted, size: 12});
        api.label([lx, Y(s.wl)], String(s.wl), {color: c.muted, size: 12});
        // the scores, laid over the box in three columns so none hide each other
        if (v.showData) s.a.forEach(function (x, i) {
          api.circle([cx + [-13, 0, 13][i % 3], Y(x)], 3.4, {fill: col, fillOpacity: 0.95, stroke: c.card, width: 1.2});
        });
        // IQR bracket under the plot
        api.label([cx, 284], "IQR " + s.iqr, {color: col, size: 12.5, weight: 650, anchor: "middle"});
        return {x0: x0, x1: x0 + bw};
      }
      var g1 = group(a, 118, c.c1, "Section 1"), g2 = group(b, 298, c.c2, "Section 2");
      // compare the centers: Section 1's median carried across to Section 2's box
      var dm = b.m - a.m, mx = (g1.x1 + 48 + g2.x0) / 2;
      api.line([g1.x1 + 48, Y(a.m)], [g2.x0 - 3, Y(a.m)], {color: c.c3, width: 1.4, dash: "5 4"});
      if (dm !== 0) {
        api.arrow([mx, Y(a.m)], [mx, Y(b.m)], {color: c.c3, width: 2.2, halo: false});
        api.label([mx, Y(b.m) + (dm > 0 ? -12 : 12)], "ΔM " + (dm > 0 ? "+" : "−") + Math.abs(dm), {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      } else {
        api.label([mx, Y(a.m) - 11], "same M", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      }
    }
  });
})();
