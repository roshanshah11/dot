// Mean vs median on one small data set: nine quiz scores out of 100, and optionally a tenth student who scored far
// below everyone else. The top strip is the sorted list with its middle (the median) boxed; the dot plot shows the
// mean (the balance point, amber) and the median (the middle value, teal). Switching the outlier on drags the
// mean toward it by (outlier − old mean) / 10, while the median only steps from the 5th value to the average of the
// 5th and 6th, and does not care how far away the outlier is. With the outlier off, its would-be place is a ghost.
// Dot's design: the queue gives only outlierMode; the outlier's score is added so the pull can be dragged.
(function () {
  var BASE = [62, 68, 71, 74, 76, 79, 81, 85, 90];   // sum 686, mean 76.2, median 76
  function stats(xs) {
    var s = xs.slice().sort(function (a, b) { return a - b; }), n = s.length, sum = s.reduce(function (t, x) { return t + x; }, 0);
    var med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    return {sorted: s, n: n, sum: sum, mean: sum / n, median: med};
  }
  function calc(v) {
    var on = v.outlierMode === "with", base = stats(BASE), now = on ? stats(BASE.concat([v.outlier])) : base;
    return {on: on, base: base, now: now};
  }
  function sg(x) { return (x < -1e-9 ? "−" : x > 1e-9 ? "+" : "") + Viz.fmt(Math.abs(x), 1); }

  Viz.register("mean-vs-median", {
    title: "Mean vs median",
    subject: "stats",
    shows: "Add one extreme score: the mean is pulled toward it, while the median, the middle value, barely moves",
    params: {
      outlierMode: {kind: "enum", values: ["without", "with"], default: "without", label: "\\text{outlier}",
        names: {without: "without", "with": "with"}},
      outlier: {kind: "integer", default: 12, min: 0, max: 50, label: "\\text{score}"}
    },
    formula: function (v) {
      var k = calc(v), s = k.now.sorted;
      var med = k.on ? "\\tfrac{" + s[4] + "+" + s[5] + "}{2}=" + Viz.n(k.now.median) : "x_{(5)}=" + Viz.n(k.now.median);
      return "\\begin{array}{l}\\bar x=\\tfrac{\\sum x_i}{n}=\\tfrac{" + k.now.sum + "}{" + k.now.n + "}=" + Viz.n(k.now.mean, 1) + "\\\\[4pt]\\text{median}=" + med + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), dm = k.now.mean - k.base.mean, dd = k.now.median - k.base.median;
      if (!k.on) return "Nine scores with no outlier: the mean <b>" + Viz.fmt(k.base.mean, 1) + "</b> and the median <b>" + k.base.median +
        "</b> almost agree, because the scores are spread evenly around the middle.";
      return "The score of " + v.outlier + " drags the mean <b>" + sg(dm) + "</b> to " + Viz.fmt(k.now.mean, 1) + ", but the median moves only <b>" +
        sg(dd) + "</b>: it depends on the order of the scores, not on how far out the low one is.";
    },
    examples: [
      {name: "outlierMode: with", values: {outlierMode: "with"}},
      {name: "outlier at 0", values: {outlierMode: "with", outlier: 0}},
      {name: "outlier at 50", values: {outlierMode: "with", outlier: 50}}
    ],
    size: [400, 250],
    draw: function (api, v) {
      var c = api.color, k = calc(v), s = k.now.sorted, n = s.length;
      // sorted list, middle boxed
      var bw = 34, sx = 200 - n * bw / 2, yb = 34;
      api.label([200, 12], "quiz scores out of 100, sorted", {color: c.muted, size: 12, anchor: "middle"});
      var mids = n % 2 ? [(n - 1) / 2] : [n / 2 - 1, n / 2];
      s.forEach(function (x, i) {
        var isOut = k.on && x === v.outlier && i === 0, isMid = mids.indexOf(i) >= 0;
        api.rect(sx + i * bw + 2, yb - 12, bw - 4, 24, {fill: isOut ? c.c5 : c.ink, fillOpacity: isOut ? 0.25 : 0.07, stroke: isMid ? c.c1 : null, width: 2, rx: 4});
        api.label([sx + i * bw + bw / 2, yb], String(x), {color: isOut ? c.c5 : c.ink, size: 12.5, weight: isMid ? 700 : 500, anchor: "middle"});
      });
      var mx = sx + (mids[0] + mids[mids.length - 1] + 1) / 2 * bw;
      api.label([mx, yb + 22], n % 2 ? "middle (5th of 9)" : "middle pair (5th, 6th of 10)", {color: c.c1, size: 12, anchor: "middle", weight: 600});
      // dot plot on 0..100
      var x0 = 24, x1 = 380, ya = 150, X = function (q) { return x0 + (x1 - x0) * q / 100; };
      api.line([x0, ya], [x1, ya], {color: c.axis, width: 1.2});
      for (var t = 0; t <= 100; t += 10) {
        api.line([X(t), ya], [X(t), ya + 4], {color: c.axis, width: 1});
        if (t % 20 === 0) api.label([X(t), ya + 14], String(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      BASE.forEach(function (x) { api.circle([X(x), ya - 8], 4.6, {fill: c.ink, fillOpacity: 0.8}); });
      if (k.on) {
        api.circle([X(v.outlier), ya - 8], 5.5, {fill: c.c5});
        api.label([X(v.outlier), ya - 24], "outlier " + v.outlier, {color: c.c5, size: 12, weight: 650, anchor: "middle"});
      } else {
        api.circle([X(v.outlier), ya - 8], 5.5, {stroke: c.faint, dash: "3 3", width: 1.5});
        api.label([X(v.outlier), ya - 24], "left out", {color: c.muted, size: 12, anchor: "middle"});
      }
      // median: a line above the dots; mean: a fulcrum below the axis. Dashed ghosts are the values without the outlier.
      var ym = 92, yt = ya + 26, tri = function (q) { return [[X(q), yt], [X(q) - 8, yt + 14], [X(q) + 8, yt + 14]]; };
      if (k.on) {
        api.line([X(k.base.median), ym], [X(k.base.median), ya - 16], {color: c.c1, width: 1.5, dash: "3 3", opacity: 0.6});
        api.polygon(tri(k.base.mean), {fill: "none", stroke: c.c3, dash: "3 3", width: 1.5});
        if (Math.abs(X(k.now.mean) - X(k.base.mean)) > 12)
          api.arrow([X(k.base.mean), ya + 70], [X(k.now.mean), ya + 70], {color: c.c3, width: 2.5, halo: false, label: sg(k.now.mean - k.base.mean), labelAt: "mid", labelOffset: [0, 14], labelSize: 12.5});
      }
      api.line([X(k.now.median), ym], [X(k.now.median), ya - 16], {color: c.c1, width: 2.5});
      api.label([X(k.now.median) + 6, ym - 2], "median " + api.fmt(k.now.median, 1), {color: c.c1, size: 13, weight: 700, anchor: "start"});
      api.line([X(k.now.mean), ya], [X(k.now.mean), yt], {color: c.c3, width: 1.5, opacity: 0.7});
      api.polygon(tri(k.now.mean), {fill: c.c3, fillOpacity: 0.95});
      api.label([X(k.now.mean), yt + 27], "mean " + api.fmt(k.now.mean, 1), {color: c.c3, size: 13, weight: 700, anchor: "middle"});
    }
  });
})();
