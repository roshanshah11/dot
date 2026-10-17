// One odd plate among replicates. Eight replicate plates gave 42 to 56 colonies; plate 9's count is the slider (a
// contaminated plate or a dilution slip gives a wild number). Top: the counts on a 0..300 axis with the mean (amber,
// a balance point under the axis) and the median (teal, the middle value). Bottom, on the same horizontal axis: what
// the mean and the median would be for every possible count on plate 9. The mean (392 + x) / 9 is a straight line with
// no limit; the median of nine is the 5th value, so it can only ever sit between 48 and 50, the 4th and 5th of the eight.
// Dot's design: the queue gives no parameters; plate 9's count and whether it is kept drive the idea.
(function () {
  var BASE = [42, 45, 47, 48, 50, 51, 53, 56], SUM = 392, MAXX = 300;
  function stats(xs) {
    var s = xs.slice().sort(function (a, b) { return a - b; }), n = s.length, sum = s.reduce(function (t, x) { return t + x; }, 0);
    return {n: n, sum: sum, mean: sum / n, median: n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2};
  }
  function calc(v) { return {base: stats(BASE), now: v.keep ? stats(BASE.concat([v.x])) : stats(BASE)}; }
  var medianFor = function (x) { return Math.min(50, Math.max(48, x)); };   // the median of the nine for plate 9 = x

  Viz.register("biological-outlier-effects-on-mean-and-median", {
    title: "One odd plate: mean vs median",
    subject: "stats",
    shows: "Drag one plate's colony count far from its replicates: the mean follows it without limit, the median barely moves",
    params: {
      x: {kind: "integer", default: 210, min: 0, max: 300, label: "\\text{plate 9}"},
      keep: {kind: "boolean", default: true, label: "\\text{use it}", on: "kept", off: "left out"}
    },
    formula: function (v) {
      var k = calc(v), now = k.now;
      if (!v.keep) return "\\begin{array}{l}\\bar x=\\tfrac{392}{8}=" + Viz.n(now.mean, 1) + "\\\\[4pt]\\text{median}=\\tfrac{48+50}{2}=" + Viz.n(now.median, 1) + "\\end{array}";
      return "\\begin{array}{l}\\bar x=\\tfrac{392+" + v.x + "}{9}=" + Viz.n(now.mean, 1) + "\\\\[4pt]\\text{median}=x_{(5)}=" + Viz.n(now.median, 1) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), dm = k.now.mean - k.base.mean, dd = k.now.median - k.base.median;
      var sg = function (q) { return (q > 1e-9 ? "+" : q < -1e-9 ? "−" : "") + Viz.fmt(Math.abs(q), 1); };
      if (!v.keep) return "Without plate 9 the mean (<b>" + Viz.fmt(k.now.mean, 1) + "</b>) and median (<b>" + Viz.fmt(k.now.median, 1) + "</b>) agree; leaving a plate out needs a recorded reason, like contamination, not just an odd count.";
      if (v.x >= 42 && v.x <= 56) return "A count of " + v.x + " fits with the other plates, so the mean (" + Viz.fmt(k.now.mean, 1) + ") and median (" + Viz.fmt(k.now.median, 1) + ") still agree.";
      return "A count of " + v.x + " moves the mean <b>" + sg(dm) + "</b> to " + Viz.fmt(k.now.mean, 1) + " but the median only <b>" + sg(dd) +
        "</b>: one plate can drag the mean anywhere, while the median of nine is stuck between 48 and 50.";
    },
    examples: [
      {name: "plate 9 at 0", values: {x: 0}},
      {name: "plate 9 at 300", values: {x: 300}},
      {name: "plate 9 fits in", values: {x: 49}},
      {name: "plate 9 left out", values: {keep: false}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), xs = BASE.concat(v.keep ? [v.x] : []).sort(function (p, q) { return p - q; }), n = xs.length;
      // top: the counts in order, the middle one boxed (that is all the median looks at)
      var bw = 38, sx = api.w / 2 - n * bw / 2, yb = 40, mids = n % 2 ? [(n - 1) / 2] : [n / 2 - 1, n / 2], seen9 = false;
      api.label([api.w / 2, 12], (v.keep ? "the nine" : "the eight") + " colony counts, in order", {color: c.muted, size: 12, anchor: "middle"});
      xs.forEach(function (x, i) {
        var is9 = v.keep && !seen9 && x === v.x && (seen9 = true), mid = mids.indexOf(i) >= 0;
        api.rect(sx + i * bw + 2, yb - 13, bw - 4, 26, {fill: is9 ? c.c5 : c.ink, fillOpacity: is9 ? 0.3 : 0.07, stroke: mid ? c.c1 : null, width: 2.2, rx: 4});
        api.label([sx + i * bw + bw / 2, yb], String(x), {color: is9 ? c.c5 : c.ink, size: 13, weight: mid ? 750 : 500, anchor: "middle"});
      });
      var mcx = sx + (mids[0] + mids[mids.length - 1] + 1) / 2 * bw;
      api.label([mcx, yb + 25], n % 2 ? "5th of 9 = median " + api.fmt(k.now.median, 1) : "4th and 5th of 8: median " + api.fmt(k.now.median, 1), {color: c.c1, size: 12.5, weight: 700, anchor: "middle"});
      var above = xs.filter(function (x) { return x < k.now.mean - 1e-9; }).length;
      api.label([api.w / 2, yb + 48], "mean " + api.fmt(k.now.mean, 1) + ": above " + above + " of the " + n + " counts", {color: c.c3, size: 12.5, weight: 700, anchor: "middle"});
      // bottom: the summary for every possible count on plate 9
      var x0 = 46, x1 = 380, X = function (q) { return x0 + (x1 - x0) * q / MAXX; };
      var gy0 = 262, gy1 = 132, lo = 30, hi = 80, Y = function (q) { return gy0 - (gy0 - gy1) * (q - lo) / (hi - lo); };
      api.label([x0, gy1 - 14], v.keep ? "for every count plate 9 could have:" : "left out; if kept, for every count:", {color: c.muted, size: 12});
      for (var g = lo; g <= hi; g += 10) {
        api.line([x0, Y(g)], [x1, Y(g)], {color: c.grid, width: 1});
        api.label([x0 - 7, Y(g)], String(g), {color: c.muted, size: 12, anchor: "end"});
      }
      api.line([x0, gy0], [x1, gy0], {color: c.axis, width: 1.3});
      for (var t = 0; t <= MAXX; t += 50) {
        api.line([X(t), gy0], [X(t), gy0 + 4], {color: c.axis, width: 1});
        api.label([X(t), gy0 + 15], String(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x1, gy0 + 30], "plate 9 count", {color: c.muted, size: 12, anchor: "end"});
      var meanLine = [[X(0), Y(SUM / 9)], [X(MAXX), Y((SUM + MAXX) / 9)]];
      var medLine = [[X(0), Y(48)], [X(48), Y(48)], [X(50), Y(50)], [X(MAXX), Y(50)]];
      api.polyline(meanLine, {stroke: c.c3, width: 2.5, opacity: v.keep ? 1 : 0.45});
      api.polyline(medLine, {stroke: c.c1, width: 2.5, opacity: v.keep ? 1 : 0.45});
      api.label([X(MAXX) - 4, Y((SUM + MAXX) / 9) - 12], "mean: no limit", {color: c.c3, size: 12, weight: 600, anchor: "end"});
      if (v.keep) {
        // the cursor rises from the axis only to the higher of the two points, so it never reaches "mean: no limit",
        // and its label sits at its foot, just above the axis, where neither line ever goes
        var yM = Y(k.now.mean), yD = Y(k.now.median);
        api.line([X(v.x), gy0], [X(v.x), Math.min(yM, yD)], {color: c.c5, width: 1.5, dash: "4 4"});
        api.label([X(v.x) + (v.x > 150 ? -6 : 6), gy0 - 10], "plate 9 = " + v.x, {color: c.c5, size: 12, weight: 650, anchor: v.x > 150 ? "end" : "start"});
      }
      // drawn after the cursor, with a halo, so the dashed line passes behind the words instead of striking them
      var med = api.label([X(MAXX) - 4, Y(50) + 13], "median: stuck between 48 and 50", {color: c.c1, size: 12, weight: 600, anchor: "end"});
      ["stroke", c.card, "stroke-width", 6, "stroke-linejoin", "round", "paint-order", "stroke"].forEach(function (q, i, l) { if (i % 2 === 0) med.setAttribute(q, l[i + 1]); });
      if (v.keep) {
        api.point([X(v.x), yM], {color: c.c3, r: 5});
        api.point([X(v.x), yD], {color: c.c1, r: 5});
      }
    }
  });
})();
