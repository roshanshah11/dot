// A dot plot: one dot per student, stacked over a number line, for three classes' summer reading.
// Every number in the figure is computed from the data: the median (teal line), the mean (amber balance point under
// the axis), the middle half Q1 to Q3 (blue bar, quartiles as medians of the lower and upper halves), the range,
// any gap of three or more empty values (purple bracket) and any value past the 1.5 IQR fences (red ring).
(function () {
  var DATA = {
    "clustered": [5, 6, 6, 7, 7, 7, 7, 8, 8, 8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 11],
    "spread-out": [0, 1, 2, 2, 3, 4, 5, 5, 6, 7, 8, 8, 9, 10, 11, 12, 12, 13, 14, 15],
    "gap-and-unusual-value": [2, 3, 3, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 8, 8, 15]
  };
  function med(a) { var m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  function calc(v) {
    var xs = DATA[v.example].slice().sort(function (a, b) { return a - b; }), n = xs.length;
    var sum = xs.reduce(function (s, x) { return s + x; }, 0), h = n >> 1;
    var q1 = med(xs.slice(0, h)), q3 = med(xs.slice(n % 2 ? h + 1 : h)), iqr = q3 - q1;
    var lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr, gaps = [], run = null;
    for (var t = xs[0]; t <= xs[n - 1]; t++) {   // runs of 3 or more empty values inside the data's range
      if (xs.indexOf(t) < 0) { run = run || [t, t]; run[1] = t; }
      else { if (run && run[1] - run[0] >= 2) gaps.push(run); run = null; }
    }
    return {xs: xs, n: n, sum: sum, mean: sum / n, median: med(xs), q1: q1, q3: q3, iqr: iqr, lo: lo, hi: hi, gaps: gaps,
            min: xs[0], max: xs[n - 1], out: xs.filter(function (x) { return x < lo || x > hi; })};
  }
  var f = function (x) { return Viz.fmt(x, 2); };

  Viz.register("dot-plot", {
    title: "Dot plot: shape, center and spread",
    subject: "stats",
    shows: "Pick a class: each dot is one student's count of books, so clusters, spread, gaps and unusual values show at a glance",
    params: {
      example: {kind: "enum", values: ["clustered", "spread-out", "gap-and-unusual-value"], default: "clustered", label: "class",
        names: {"clustered": "clustered", "spread-out": "spread out", "gap-and-unusual-value": "gap + unusual value"}}
    },
    formula: function (v) {
      var k = calc(v), s = "\\begin{array}{l}\\bar{x}=\\frac{\\sum x_i}{n}=\\frac{" + k.sum + "}{" + k.n + "}=" + Viz.n(k.mean, 2) +
        "\\\\\\text{median}=" + Viz.n(k.median) + "\\\\\\text{IQR}=Q_3-Q_1=" + Viz.n(k.q3) + "-" + Viz.n(k.q1) + "=" + Viz.n(k.iqr);
      if (k.out.length) s += "\\\\Q_3+1.5\\,\\text{IQR}=" + Viz.n(k.hi, 2) + "<" + k.out[k.out.length - 1];
      return s + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (k.out.length) return "A gap from " + k.gaps[0][0] + " to " + k.gaps[0][1] + " sets off one unusual value, <b>" + k.out[0] +
        "</b> books, which pulls the mean (<b>" + f(k.mean) + "</b>) above the median (<b>" + f(k.median) + "</b>).";
      if (k.iqr <= 3) return "Clustered: the middle half of the class read <b>" + f(k.q1) + " to " + f(k.q3) + "</b> books, and the mean and median agree at <b>" + f(k.median) + "</b>.";
      return "Spread out: the counts run from <b>" + k.min + " to " + k.max + "</b> books and the middle half alone spans <b>" + f(k.iqr) + "</b>, so no single value is typical.";
    },
    examples: [
      {name: "example: spread-out", values: {example: "spread-out"}},
      {name: "example: gap-and-unusual-value", values: {example: "gap-and-unusual-value"}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 34, x1 = 366, base = 184, r = 6, dy = 13.5;
      var X = function (t) { return x0 + (x1 - x0) * t / 15; };
      api.label([x0 - 4, 14], "books read this summer, " + k.n + " students (one dot each)", {color: c.muted, size: 12});
      // middle half behind the dots
      api.rect(X(k.q1) - r - 2, 58, X(k.q3) - X(k.q1) + 2 * r + 4, base - 58, {fill: c.c2, fillOpacity: 0.09, rx: 4});
      // median
      api.line([X(k.median), 46], [X(k.median), base], {color: c.c1, width: 2, dash: "5 4"});
      api.label([X(k.median), 38], "median " + f(k.median), {color: c.c1, size: 12.5, weight: 650, anchor: "middle"});
      // the dots
      var seen = {};
      k.xs.forEach(function (x) {
        var j = seen[x] = (seen[x] || 0) + 1, isOut = k.out.indexOf(x) >= 0, at = [X(x), base - 9 - (j - 1) * dy];
        api.circle(at, r, {fill: isOut ? c.c5 : c.ink, stroke: c.card, width: 1.2});
        if (isOut) {
          api.circle(at, r + 5, {stroke: c.c5, width: 2});
          api.label([at[0] + 8, at[1] - 30], "unusual value", {color: c.c5, size: 12.5, weight: 650, anchor: "end"});
        }
      });
      k.gaps.forEach(function (g) {
        var a = X(g[0] - 0.3), b = X(g[1] + 0.3), y = base - 10;
        api.line([a, y], [b, y], {color: c.c6, width: 2, dash: "4 3"});
        api.line([a, y - 5], [a, y + 5], {color: c.c6, width: 2});
        api.line([b, y - 5], [b, y + 5], {color: c.c6, width: 2});
        api.label([(a + b) / 2, y - 13], "gap", {color: c.c6, size: 12.5, weight: 650, anchor: "middle"});
      });
      // number line, the mean as its balance point
      api.line([x0 - 10, base], [x1 + 10, base], {color: c.axis, width: 1.4});
      for (var t = 0; t <= 15; t++) {
        api.line([X(t), base], [X(t), base + 4], {color: c.axis, width: 1});
        api.label([X(t), base + 27], String(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      var M = X(k.mean);
      api.polygon([[M, base + 1], [M - 7, base + 13], [M + 7, base + 13]], {fill: c.c3, fillOpacity: 0.95});
      api.label([M + 10, base + 10], "mean " + f(k.mean), {color: c.c3, size: 12.5, weight: 650});
      // spread: the range as a thin line, the middle half as a thick bar
      var ys = 238;
      api.line([X(k.min), ys], [X(k.max), ys], {color: c.muted, width: 1.5});
      api.line([X(k.min), ys - 5], [X(k.min), ys + 5], {color: c.muted, width: 1.5});
      api.line([X(k.max), ys - 5], [X(k.max), ys + 5], {color: c.muted, width: 1.5});
      api.rect(X(k.q1), ys - 5, Math.max(3, X(k.q3) - X(k.q1)), 10, {fill: c.c2, fillOpacity: 0.85, rx: 2});
      api.label([x0 - 4, ys + 22], "range " + k.min + " to " + k.max, {color: c.muted, size: 12});
      api.label([x1 + 6, ys + 22], "middle half " + f(k.q1) + " to " + f(k.q3), {color: c.c2, size: 12, weight: 600, anchor: "end"});
      // viz.css sets every svg text's fill to ink, which beats the fill attribute api.label writes: restate it inline
      api.svg.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
