// Two classes' test scores as box plots on one axis: class A is a fixed reference, class B takes the shape picked.
// Each class has 15 scores, drawn as dots above its box. Quartiles use the median-of-halves rule (TI-84, AP Statistics):
// with n = 15 the median is the 8th value, Q1 the median of the lower 7 (the 4th) and Q3 the 12th. Whiskers reach the
// most extreme scores inside the fences Q1 - 1.5 IQR and Q3 + 1.5 IQR; a score beyond a fence is plotted on its own.
// Dot's own extra beyond the queue's one enum: a toggle for the mean, which shows how skew drags it off the median.
(function () {
  var A = [42, 48, 51, 54, 56, 58, 59, 60, 61, 62, 64, 66, 69, 72, 78];
  var SETS = {
    "similar spread": [50, 57, 60, 63, 66, 67, 69, 70, 71, 73, 75, 77, 79, 82, 88],
    "wider middle spread": [30, 36, 40, 45, 48, 52, 56, 60, 64, 68, 72, 75, 79, 84, 90],
    "right-skewed": [40, 42, 44, 45, 46, 48, 49, 51, 53, 56, 60, 64, 70, 78, 90],
    "left-skewed": [40, 52, 60, 66, 70, 74, 77, 79, 81, 82, 84, 85, 86, 88, 90],
    "possible outlier": [44, 49, 52, 54, 56, 57, 58, 60, 61, 62, 63, 65, 67, 70, 97]
  };
  function med(a) { var n = a.length, h = n >> 1; return n % 2 ? a[h] : (a[h - 1] + a[h]) / 2; }
  function summary(data) {
    var a = data.slice().sort(function (x, y) { return x - y; }), n = a.length, h = n >> 1;
    var q1 = med(a.slice(0, h)), q3 = med(a.slice(n % 2 ? h + 1 : h)), iqr = q3 - q1, lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
    var inside = a.filter(function (x) { return x >= lo && x <= hi; });
    return {a: a, min: a[0], max: a[n - 1], q1: q1, m: med(a), q3: q3, iqr: iqr, lo: lo, hi: hi, wl: inside[0], wh: inside[inside.length - 1],
            out: a.filter(function (x) { return x < lo || x > hi; }), mean: a.reduce(function (s, x) { return s + x; }, 0) / n};
  }
  var f = function (x) { return Viz.fmt(x, 1); };

  Viz.register("box-plot", {
    title: "Box plots: reading shape and spread",
    subject: "stats",
    shows: "Pick a shape for class B: the box is the middle half (Q1 to Q3), the line the median, the whiskers run to the last score inside the 1.5 IQR fences",
    params: {
      initial_distribution: {kind: "enum", values: Object.keys(SETS), default: "similar spread", label: "\\text{class B}"},
      showMean: {kind: "boolean", default: true, label: "\\text{mean}", on: "shown", off: "hidden"}
    },
    formula: function (v) {
      var s = summary(SETS[v.initial_distribution]);
      return "\\begin{array}{l}Q_1=" + s.q1 + ",\\ M=" + s.m + ",\\ Q_3=" + s.q3 + "\\\\IQR=" + s.q3 + "-" + s.q1 + "=" + s.iqr + "\\\\" +
        "1.5\\,IQR=" + Viz.n(1.5 * s.iqr, 1) + "\\Rightarrow\\text{fences }" + Viz.n(s.lo, 1) + ",\\ " + Viz.n(s.hi, 1) + "\\end{array}";
    },
    status: function (v) {
      var s = summary(SETS[v.initial_distribution]), r = summary(A), up = s.q3 - s.m, down = s.m - s.q1;
      var mean = v.showMean ? ", which pulls the mean to <b>" + f(s.mean) + "</b>" : "";
      if (s.out.length) return "<b>" + s.out.join(", ") + "</b> lies beyond the fence Q₃ + 1.5·IQR = <b>" + f(s.hi) + "</b>, so it is plotted on its own and the whisker stops at " + s.wh + ".";
      if (up > 1.6 * down) return "Right-skewed: Q₃ sits <b>" + up + "</b> above the median but Q₁ only " + down + " below, and the long whisker runs up to " + s.max + mean + ".";
      if (down > 1.6 * up) return "Left-skewed: Q₁ sits <b>" + down + "</b> below the median but Q₃ only " + up + " above, and the long whisker runs down to " + s.min + mean + ".";
      if (s.iqr > 1.5 * r.iqr) return "Both medians are " + s.m + ", but B's middle half spans <b>" + s.iqr + "</b> points, " + f(s.iqr / r.iqr) + " times A's " + r.iqr + ": a much wider middle spread.";
      return "B's middle half spans <b>" + s.iqr + "</b> points against A's " + r.iqr + ": a similar spread, with B's median " + Math.abs(s.m - r.m) + " points " + (s.m > r.m ? "higher" : "lower") + ".";
    },
    examples: [
      {name: "right-skewed with the mean", values: {initial_distribution: "right-skewed", showMean: true}},
      {name: "left-skewed", values: {initial_distribution: "left-skewed"}},
      {name: "wider middle spread", values: {initial_distribution: "wider middle spread"}},
      {name: "a possible outlier", values: {initial_distribution: "possible outlier", showMean: false}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, x0 = 30, x1 = 385, lo = 25, hi = 100;
      var X = function (t) { return x0 + (x1 - x0) * (t - lo) / (hi - lo); };
      var a = summary(A), b = summary(SETS[v.initial_distribution]);
      function box(s, yc, h, col, fillOp) {
        api.line([X(s.wl), yc], [X(s.q1), yc], {color: col, width: 2});
        api.line([X(s.q3), yc], [X(s.wh), yc], {color: col, width: 2});
        [s.wl, s.wh].forEach(function (w) { api.line([X(w), yc - h * 0.3], [X(w), yc + h * 0.3], {color: col, width: 2}); });
        api.rect(X(s.q1), yc - h / 2, X(s.q3) - X(s.q1), h, {fill: col, fillOpacity: fillOp, stroke: col, width: 1.8, rx: 2});
        api.line([X(s.m), yc - h / 2], [X(s.m), yc + h / 2], {color: c.ink, width: 3});
        s.out.forEach(function (o) { api.circle([X(o), yc], 5, {stroke: c.c5, width: 2.2}); });
        if (v.showMean) api.polygon([[X(s.mean), yc - 6], [X(s.mean) + 6, yc], [X(s.mean), yc + 6], [X(s.mean) - 6, yc]], {fill: c.c3, fillOpacity: 1, stroke: c.card, width: 1.2});
      }
      function dots(s, y, col) { s.a.forEach(function (t) { api.circle([X(t), y], 2.8, {fill: s.out.indexOf(t) >= 0 ? c.c5 : col, fillOpacity: 0.85}); }); }
      // class A: the reference
      api.label([x0, 14], "class A (reference)", {color: c.muted, size: 12.5, weight: 600});
      dots(a, 32, c.muted);
      box(a, 54, 18, c.muted, 0.18);
      api.label([X(a.wh) + 10, 54], "IQR " + a.iqr, {color: c.muted, size: 12});
      // class B: the chosen shape
      api.label([x0, 90], "class B: " + v.initial_distribution, {color: c.c2, size: 12.5, weight: 650});
      dots(b, 110, c.c2);
      var yb = 150;
      // fences, where they fall on the axis
      [b.lo, b.hi].forEach(function (fe, i) {
        if (fe < lo || fe > hi) return;
        api.line([X(fe), yb - 18], [X(fe), yb + 18], {color: c.c5, width: 1.4, dash: "4 3", opacity: 0.8});
        api.label([X(fe), 124], (i ? "upper" : "lower") + " fence " + f(fe), {color: c.c5, size: 12, anchor: "middle"});
      });
      box(b, yb, 28, c.c2, 0.25);
      if (v.showMean) api.label([X(b.mean), 124], "mean " + f(b.mean), {color: c.c3, size: 12, weight: 600, anchor: "middle"});
      // the five numbers: quartiles on one row, median and whisker ends on the next
      api.label([X(b.q1), 178], "Q₁ " + b.q1, {color: c.c2, size: 12, weight: 600, anchor: "middle"});
      api.label([X(b.q3), 178], "Q₃ " + b.q3, {color: c.c2, size: 12, weight: 600, anchor: "middle"});
      api.label([X(b.m), 194], "median " + b.m, {color: c.ink, size: 12, weight: 600, anchor: "middle"});
      api.label([X(b.wl), 194], String(b.wl), {color: c.muted, size: 12, anchor: "middle"});
      api.label([X(b.wh), 194], String(b.wh), {color: c.muted, size: 12, anchor: "middle"});
      b.out.forEach(function (o) { api.label([X(o), 194], String(o), {color: c.c5, size: 12, weight: 600, anchor: "middle"}); });
      // the IQR as the width of the box
      var yq = 210;
      api.line([X(b.q1), yq], [X(b.q3), yq], {color: c.c2, width: 1.5});
      [b.q1, b.q3].forEach(function (q) { api.line([X(q), yq - 4], [X(q), yq + 4], {color: c.c2, width: 1.5}); });
      api.label([(X(b.q1) + X(b.q3)) / 2, yq + 12], "IQR = " + b.iqr, {color: c.c2, size: 12, anchor: "middle"});
      // the score axis
      var ya = 244;
      api.line([x0, ya], [x1, ya], {color: c.axis, width: 1.2});
      for (var t = 30; t <= 100; t += 10) {
        api.line([X(t), ya], [X(t), ya + 4], {color: c.axis, width: 1});
        api.label([X(t), ya + 15], String(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x1, ya + 30], "score", {color: c.muted, size: 12, anchor: "end"});
    }
  });
})();
