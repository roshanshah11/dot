// A histogram of 60 exam scores (out of 100) in four classes whose scores take four classic shapes. The bars count the
// scores in each bin [a, a + w) (the last bin includes 100), and the bin width is Dot's added control: wide bins can
// hide a shape that narrow ones show (the bimodal class at width 20). Everything marked is computed from the scores: the mean (amber balance point),
// the median (teal), the tallest bin, the peaks, the long tail, empty bins forming a gap, and values past 1.5 IQR.
(function () {
  var DATA = {
    "roughly symmetric": [42, 46, 49, 51, 52, 53, 54, 55, 56, 57, 58, 58, 59, 60, 60, 61, 61, 62, 62, 63, 64, 64, 64, 65, 65, 66, 66, 67, 67, 68,
      68, 69, 69, 70, 70, 71, 71, 72, 72, 72, 73, 74, 74, 75, 75, 76, 76, 77, 78, 78, 79, 80, 81, 82, 83, 84, 85, 87, 90, 94],
    "skewed right": [32, 33, 34, 34, 35, 35, 36, 36, 37, 37, 37, 38, 38, 38, 39, 39, 39, 40, 40, 40, 41, 41, 41, 42, 42, 42, 43, 43, 43, 44,
      44, 45, 45, 45, 46, 46, 47, 47, 48, 48, 49, 49, 50, 51, 51, 52, 53, 54, 55, 56, 57, 58, 59, 61, 63, 65, 68, 72, 78, 92],
    // two groups near 45 and 77 with the dip at 55-65: 5- and 10-wide bins show both peaks, but 20-wide bins put each group's
    // edge in the same bins as the other's core ([40,60) 24, [60,80) 23), so the shape flattens into one lump
    "bimodal": [33, 36, 38, 39, 40, 41, 42, 43, 43, 44, 44, 45, 45, 46, 47, 47, 48, 48, 49, 50, 51, 52, 52, 53, 54, 55, 57, 58, 61, 63,
      65, 66, 67, 68, 69, 70, 71, 72, 72, 73, 74, 74, 75, 76, 76, 77, 77, 78, 78, 79, 79, 80, 81, 82, 83, 84, 85, 87, 88, 91],
    "gap or outlier": [18, 57, 60, 62, 63, 64, 65, 65, 66, 67, 67, 68, 68, 68, 69, 69, 70, 70, 70, 71, 71, 71, 72, 72, 72, 73, 73, 73, 73, 74,
      74, 74, 75, 75, 75, 75, 76, 76, 76, 77, 77, 77, 78, 78, 78, 79, 79, 80, 80, 80, 81, 81, 82, 83, 83, 84, 85, 86, 88, 91]
  };
  function med(a) { var m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
  function calc(v) {
    var xs = DATA[v.distribution_shape], n = xs.length, w = Number(v.binWidth), nb = 100 / w, counts = [];
    for (var b = 0; b < nb; b++) counts.push(0);
    xs.forEach(function (x) { counts[Math.min(nb - 1, Math.floor(x / w))]++; });
    var sum = xs.reduce(function (s, x) { return s + x; }, 0), h = n >> 1, q1 = med(xs.slice(0, h)), q3 = med(xs.slice(h)), iqr = q3 - q1;
    var top = counts.indexOf(Math.max.apply(null, counts));
    var peaks = counts.map(function (cnt, i) {   // local maxima at least 3 above the lowest bin between them and the next taller bar
      var l = counts.slice(0, i), r = counts.slice(i + 1), lt = l.slice().reverse().concat([0]), rt = r.concat([0]);
      var dip = function (side) { var lo = cnt; for (var j = 0; j < side.length; j++) { if (side[j] > cnt) return cnt - lo; lo = Math.min(lo, side[j]); } return cnt - lo; };
      return cnt > 0 && dip(lt) >= 3 && dip(rt) >= 3 ? i : -1;
    }).filter(function (i) { return i >= 0; });
    var gaps = [], isGap = v.distribution_shape === "gap or outlier", first = counts.findIndex(function (q) { return q > 0; }), last = nb - 1 - counts.slice().reverse().findIndex(function (q) { return q > 0; });
    for (var g = first + 1; g < last; g++) if (isGap && !counts[g]) { if (gaps.length && gaps[gaps.length - 1][1] === g - 1) gaps[gaps.length - 1][1] = g; else gaps.push([g, g]); }
    return {xs: xs, n: n, w: w, nb: nb, counts: counts, sum: sum, mean: sum / n, median: med(xs), q1: q1, q3: q3, top: top, peaks: peaks, gaps: gaps,
            out: isGap ? xs.filter(function (x) { return x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr; }) : []};   // flagged only for this shape: a skewed tail is not "unusual"
  }
  var f = function (x) { return Viz.fmt(x, 1); }, bin = function (k, i) { return i * k.w + "–" + (i + 1) * k.w; };

  Viz.register("histogram", {
    title: "Histogram: the shape of a distribution",
    subject: "stats",
    shows: "Pick a shape and a bin width: the bars count scores per interval, so symmetry, a long tail, two peaks or a gap with an outlier show up, unless the bins are too wide",
    params: {
      distribution_shape: {kind: "enum", values: ["roughly symmetric", "skewed right", "bimodal", "gap or outlier"], default: "roughly symmetric", label: "shape"},
      binWidth: {kind: "enum", values: ["5", "10", "20"], default: "10", label: "\\text{bin width}"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\bar{x}=\\frac{\\sum x_i}{n}=\\frac{" + k.sum + "}{" + k.n + "}=" + Viz.n(k.mean, 2) + "\\\\\\text{median}=" + Viz.n(k.median) +
        "\\\\\\text{tallest bin }[" + k.top * k.w + "," + (k.top + 1) * k.w + ")\\text{: }" + k.counts[k.top] + "\\text{ scores}\\end{array}";
    },
    status: function (v) {
      var k = calc(v), shape = v.distribution_shape;
      if (shape === "skewed right") return "Skewed right: a long tail of high scores pulls the mean (<b>" + f(k.mean) + "</b>) above the median (<b>" + f(k.median) + "</b>).";
      if (shape === "bimodal" && k.peaks.length >= 2) {
        var lo = Math.min(k.counts[k.peaks[0]], k.counts[k.peaks[k.peaks.length - 1]]), atMean = k.counts[Math.floor(k.mean / k.w)];
        return "Two peaks, in " + bin(k, k.peaks[0]) + " and " + bin(k, k.peaks[k.peaks.length - 1]) + ": the mean (<b>" + f(k.mean) + "</b>) falls in the dip between them" +
          (atMean <= 0.35 * lo ? ", where few students actually scored." : ".");
      }
      if (shape === "bimodal") return "With bins this wide the two groups blur into one lump; narrower bins show the two peaks.";
      if (shape === "gap or outlier") return "One score of <b>" + k.out[0] + "</b> sits alone past empty bins; it drags the mean (<b>" + f(k.mean) + "</b>) below the median (<b>" + f(k.median) + "</b>).";
      return "Roughly symmetric: the mean (<b>" + f(k.mean) + "</b>) and median (<b>" + f(k.median) + "</b>) agree, and the tallest bar is <b>" + bin(k, k.top) + "</b>.";
    },
    examples: [
      {name: "skewed right", values: {distribution_shape: "skewed right"}},
      {name: "bimodal, narrow bins", values: {distribution_shape: "bimodal", binWidth: "5"}},
      {name: "gap or outlier", values: {distribution_shape: "gap or outlier"}},
      {name: "symmetric, wide bins", values: {distribution_shape: "roughly symmetric", binWidth: "20"}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 40, x1 = 384, yB = 222, yT = 50;
      var halo = function (el) { el.setAttribute("stroke", c.card); el.setAttribute("stroke-width", 4); el.setAttribute("paint-order", "stroke"); return el; };
      var X = function (s) { return x0 + (x1 - x0) * s / 100; };
      var mx = Math.max.apply(null, k.counts), ymax = [5, 10, 15, 20, 30, 40, 50, 60].filter(function (t) { return t >= mx * 1.12 + 2; })[0];   // headroom for the count and median labels
      var gstep = ymax <= 20 ? 5 : 10, Y = function (q) { return yB - (yB - yT) * q / ymax; };
      api.label([x0 - 30, 14], "exam scores of " + k.n + " students, bins " + k.w + " points wide", {color: c.muted, size: 12});
      for (var g = gstep; g <= ymax; g += gstep) {
        api.line([x0, Y(g)], [x1, Y(g)], {color: c.grid, width: 1});
        api.label([x0 - 6, Y(g)], String(g), {color: c.muted, size: 12, anchor: "end"});
      }
      // the bars, then the median line over them, then the haloed counts on top so the line never runs through a number
      var isOut = function (i) { return k.out.some(function (x) { return Math.min(k.nb - 1, Math.floor(x / k.w)) === i; }); };
      k.counts.forEach(function (q, i) {
        if (q) api.rect(X(i * k.w) + 0.5, Y(q), X(k.w) - X(0) - 1, yB - Y(q), {fill: isOut(i) ? c.c5 : c.c2, fillOpacity: isOut(i) ? 0.9 : 0.7, rx: 1});
      });
      api.line([X(k.median), yB], [X(k.median), yT - 4], {color: c.c1, width: 2, dash: "5 4"});
      api.label([X(k.median), yT - 13], "median " + f(k.median), {color: c.c1, size: 12.5, weight: 650, anchor: "middle"});
      k.counts.forEach(function (q, i) {
        if (!q) return;
        var cx = X((i + 0.5) * k.w), dm = cx - X(k.median), nudge = (dm < 0 ? -1 : 1) * Math.max(0, String(q).length * 3.4 + 6 - Math.abs(dm));   // a count near the line steps aside, 6 px clear
        if (k.w >= 10 || i === k.top) halo(api.label([cx + nudge, Y(q) - 9], String(q), {color: i === k.top ? c.ink : c.muted, size: 12, weight: i === k.top ? 700 : 500, anchor: "middle"}));
        if (isOut(i)) halo(api.label([cx - 6, Y(q) - 46], "unusual: " + k.out.join(", "), {color: c.c5, size: 12.5, weight: 650}));
      });
      k.gaps.forEach(function (gp) {
        var a = X(gp[0] * k.w) + 3, b = X((gp[1] + 1) * k.w) - 3, y = yB - 10;
        api.line([a, y], [b, y], {color: c.c6, width: 2, dash: "4 3"});
        api.line([a, y - 5], [a, y + 5], {color: c.c6, width: 2}); api.line([b, y - 5], [b, y + 5], {color: c.c6, width: 2});
        api.label([(a + b) / 2, y - 13], "gap", {color: c.c6, size: 12.5, weight: 650, anchor: "middle"});
      });
      if (v.distribution_shape === "bimodal") k.peaks.forEach(function (i) {
        halo(api.label([X((i + 0.5) * k.w), Y(k.counts[i]) - (k.w >= 10 || i === k.top ? 26 : 10)], k.peaks.length > 1 ? "peak" : "one lump", {color: c.c6, size: 12.5, weight: 650, anchor: "middle"}));
      });
      if (v.distribution_shape === "skewed right") {   // the tail: from the upper quartile out to the largest score, above its bars
        var tallTail = Math.max.apply(null, k.counts.slice(Math.floor(k.q3 / k.w))), yt = Math.min(Y(tallTail) - 30, yB - 40);
        api.arrow([X(k.q3) + 10, yt], [X(k.xs[k.n - 1]), yt], {color: c.c6, width: 2, halo: false, head: 9});
        api.label([X(k.xs[k.n - 1]), yt - 13], "long right tail", {color: c.c6, size: 12.5, weight: 650, anchor: "end"});
      }
      // axis, mean as the balance point
      api.line([x0 - 4, yB], [x1 + 6, yB], {color: c.axis, width: 1.4});
      for (var t = 0; t <= 100; t += 10) {
        api.line([X(t), yB], [X(t), yB + 4], {color: c.axis, width: 1});
        api.label([X(t), yB + 27], String(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      var M = X(k.mean);
      api.polygon([[M, yB + 1], [M - 7, yB + 13], [M + 7, yB + 13]], {fill: c.c3, fillOpacity: 0.95});
      api.label([M + (k.mean < k.median ? -10 : 10), yB + 9], "mean " + f(k.mean), {color: c.c3, size: 12.5, weight: 650, anchor: k.mean < k.median ? "end" : "start"});
      api.label([x1 + 6, yB + 50], "score", {color: c.muted, size: 12, anchor: "end"});
      // viz.css sets every svg text's fill to ink, which beats the fill attribute api.label writes: restate it inline
      api.svg.querySelectorAll("text").forEach(function (t) { if (t.getAttribute("fill")) t.style.fill = t.getAttribute("fill"); });
    }
  });
})();
