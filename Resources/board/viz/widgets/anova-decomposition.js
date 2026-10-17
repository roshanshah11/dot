// One-way ANOVA on three groups of six. Every value's distance from the grand mean splits into two pieces: its
// group mean's distance from the grand mean (between groups, amber) and its own distance from its group mean
// (within groups, blue). Squared and summed, SS_T = SS_B + SS_W; F compares the two per degree of freedom.
// The queue's eighteen values are the points themselves: each one is dragged (control: false) rather than slid,
// because eighteen sliders would bury the picture. With df = (2, 15) the F tail has a closed form,
// p = (1 + 2F/15)^(-15/2), so the p-value is exact.
(function () {
  var G = ["A", "B", "C"], K = 3, M = 6, N = K * M;
  var params = {}, defs = {A: [32, 36, 38, 40, 43, 45], B: [44, 47, 49, 51, 53, 56], C: [55, 58, 60, 62, 65, 66]};
  G.forEach(function (g) { defs[g].forEach(function (d, i) { params["group" + g + (i + 1)] = {kind: "number", default: d, min: 0, max: 100, step: 1, label: g + "_" + (i + 1), control: false}; }); });
  function calc(v) {
    var groups = G.map(function (g) { var xs = []; for (var i = 1; i <= M; i++) xs.push(v["group" + g + i]); return xs; });
    var means = groups.map(function (xs) { return xs.reduce(function (a, b) { return a + b; }, 0) / M; });
    var grand = means.reduce(function (a, b) { return a + b; }, 0) / K, ssb = 0, ssw = 0;
    groups.forEach(function (xs, j) { ssb += M * Math.pow(means[j] - grand, 2); xs.forEach(function (x) { ssw += Math.pow(x - means[j], 2); }); });
    if (ssb < 1e-9) ssb = 0; if (ssw < 1e-9) ssw = 0;
    var F = ssw > 0 ? (ssb / (K - 1)) / (ssw / (N - K)) : ssb > 0 ? Infinity : NaN;
    var p = isFinite(F) ? Math.pow(1 + 2 * F / (N - K), -(N - K) / 2) : ssb > 0 ? 0 : NaN;
    return {groups: groups, means: means, grand: grand, ssb: ssb, ssw: ssw, F: F, p: p};
  }
  function pText(p) { return p < 0.001 ? "p < 0.001" : "p = " + Viz.fmt(p, 3); }
  function n1(x) { return Viz.fmt(x, 1); }

  Viz.register("anova-decomposition", {
    title: "ANOVA: between vs within",
    subject: "stats",
    shows: "Drag any point: each value's gap from the grand mean splits into a between-group part and a within-group part, and F weighs one against the other",
    params: params,
    formula: function (v) {
      var k = calc(v), F = isNaN(k.F) ? "\\text{undefined}" : Viz.n(k.F);
      return "\\begin{array}{l}F=\\dfrac{SS_B/(k-1)}{SS_W/(N-k)}=\\dfrac{" + Viz.n(k.ssb, 1) + "/2}{" + Viz.n(k.ssw, 1) + "/15}\\\\" +
        "\\quad=" + F + "\\\\SS_T=" + Viz.n(k.ssb, 1) + "+" + Viz.n(k.ssw, 1) + "=" + Viz.n(k.ssb + k.ssw, 1) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (isNaN(k.F)) return "All eighteen values are equal: there is no variation at all, so <b>F is undefined</b>.";
      if (!isFinite(k.F)) return "Every value equals its group's mean: within-group variation is 0, so <b>F is infinite</b> and the groups surely differ.";
      if (k.p < 0.05) return "<b>F = " + Viz.fmt(k.F) + "</b> (" + pText(k.p) + "): the group means differ far more than the scatter inside the groups would explain by chance.";
      return "<b>F = " + Viz.fmt(k.F) + "</b> (" + pText(k.p) + "): the means differ no more than the scatter inside the groups could produce by chance.";
    },
    examples: [
      {name: "Minimum supported values", values: Object.keys(params).reduce(function (o, key) { o[key] = 0; return o; }, {})},
      {name: "Maximum supported values", values: Object.keys(params).reduce(function (o, key) { o[key] = 100; return o; }, {})},
      {name: "same means, not significant", values: {groupA1: 30, groupA2: 42, groupA3: 50, groupA4: 55, groupA5: 61, groupA6: 70,
        groupB1: 33, groupB2: 44, groupB3: 48, groupB4: 56, groupB5: 60, groupB6: 66, groupC1: 35, groupC2: 40, groupC3: 52, groupC4: 54, groupC5: 63, groupC6: 68}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 40, x1 = 334, yB = 240, yT = 22, colW = (x1 - x0) / K;
      var Y = function (val) { return yB - (yB - yT) * val / 100; };
      [0, 25, 50, 75, 100].forEach(function (t) {
        api.line([x0, Y(t)], [x1, Y(t)], {color: c.grid, width: 1});
        api.label([x0 - 6, Y(t)], String(t), {color: c.muted, size: 12, anchor: "end"});
      });
      api.line([x0, yB], [x1, yB], {color: c.axis, width: 1.2});
      api.line([x0, Y(k.grand)], [x1 + 6, Y(k.grand)], {color: c.muted, width: 1.5, dash: "6 4"});
      // grand-mean label on the side of the line away from group C's between arrow
      var side = k.means[2] >= k.grand ? 1 : -1;
      api.label([x1 + 10, Y(k.grand) + side * 10], side > 0 ? "grand" : "mean " + n1(k.grand), {color: c.muted, size: 12});
      api.label([x1 + 10, Y(k.grand) + side * 24], side > 0 ? "mean " + n1(k.grand) : "grand", {color: c.muted, size: 12});
      G.forEach(function (g, j) {
        var cx = x0 + colW * (j + 0.5), m = k.means[j], d = m - k.grand;
        api.label([cx - 6, yB + 14], g + ": mean " + n1(m), {color: c.ink, size: 12.5, anchor: "middle", weight: 600});
        // within: each point to its group mean
        k.groups[j].forEach(function (x, i) {
          var px = cx - 34 + i * 10;
          if (Math.abs(x - m) > 1e-9) api.line([px, Y(x)], [px, Y(m)], {color: c.c2, width: 1.8, opacity: 0.8});
        });
        api.line([cx - 41, Y(m)], [cx + 23, Y(m)], {color: c.c3, width: 3});
        // between: the grand mean to the group mean
        if (Math.abs(Y(m) - Y(k.grand)) > 7) {
          api.arrow([cx + 28, Y(k.grand)], [cx + 28, Y(m)], {color: c.c3, width: 2.5, halo: false, head: Math.min(9, Math.abs(Y(m) - Y(k.grand)) * 0.8)});
          api.label([cx + 33, (Y(k.grand) + Y(m)) / 2], (d > 0 ? "+" : "−") + n1(Math.abs(d)), {color: c.c3, size: 12, weight: 650});
        }
        k.groups[j].forEach(function (x, i) {
          var px = cx - 34 + i * 10, key = "group" + g + (i + 1);
          var hg = api.handle([px, Y(x)], {color: c.c1, r: 4.5, onDrag: function (q) {
            var patch = {}; patch[key] = Math.round(Math.max(0, Math.min(100, (yB - q[1]) / (yB - yT) * 100))); api.set(patch);
          }});
          // points sit 10 px apart, so shrink the invisible grab circle (framework default r + 9) to stop a
          // neighbour's grab area from stealing the drag
          if (hg && hg.firstChild) hg.firstChild.setAttribute("r", 5.5);
        });
      });
      // the sums of squares as one bar: between + within = total
      var tot = k.ssb + k.ssw, bx = 40, bw = 352, yb = 282, wb = tot > 0 ? bw * k.ssb / tot : 0;
      api.rect(bx, yb, bw, 14, {fill: c.grid, rx: 3});
      if (tot > 0) {
        api.rect(bx, yb, wb, 14, {fill: c.c3, fillOpacity: 0.9, rx: 3});
        api.rect(bx + wb, yb, bw - wb, 14, {fill: c.c2, fillOpacity: 0.9, rx: 3});
      }
      api.label([bx, yb - 10], "between SS " + n1(k.ssb) + (tot > 0 ? " (" + Math.round(100 * k.ssb / tot) + "%)" : ""), {color: c.c3, size: 12.5, weight: 650});
      api.label([bx + bw, yb - 10], "within SS " + n1(k.ssw), {color: c.c2, size: 12.5, weight: 650, anchor: "end"});
      api.label([bx + bw / 2, yb + 27], "total SS " + n1(tot) + "   ·   drag any point", {color: c.muted, size: 12, anchor: "middle"});
    }
  });
})();
