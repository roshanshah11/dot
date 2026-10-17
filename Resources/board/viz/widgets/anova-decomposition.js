// One-way ANOVA on three groups of six. Every value's distance from the grand mean splits into two pieces: its
// group mean's distance from the grand mean (between groups, amber) and its own distance from its group mean
// (within groups, blue). Squared and summed, SS_T = SS_B + SS_W; F compares the two per degree of freedom.
// The queue's eighteen values are the points themselves: each one is dragged (control: false) rather than slid,
// because eighteen sliders would bury the picture. With df = (2, 15) the F tail has a closed form,
// p = (1 + 2F/15)^(-15/2), so the p-value is exact. The y axis zooms to the data (rounded to 10s, at least 40
// wide) so the within-group sticks read; while a point is dragged the axis holds still, widening (in 10s) only to
// keep a point dragged past its end in view, and it zooms back to the data on release.
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
  function autoRange(k) {
    var all = [].concat.apply([], k.groups), lo = Math.max(0, Math.floor((Math.min.apply(null, all) - 2) / 10) * 10);
    var hi = Math.min(100, Math.ceil((Math.max.apply(null, all) + 2) / 10) * 10);
    while (hi - lo < 40) { if (hi < 100) hi += 10; if (hi - lo < 40 && lo > 0) lo -= 10; }
    return [lo, hi];
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
      return "\\begin{array}{l}F=\\dfrac{SS_B/(k-1)}{SS_W/(N-k)}\\\\[4pt]F=(" + Viz.n(k.ssb, 1) + "/2)/(" + Viz.n(k.ssw, 1) + "/15)=" + F + "\\\\[2pt]" +
        "SS_T=" + Viz.n(k.ssb, 1) + "+" + Viz.n(k.ssw, 1) + "=" + Viz.n(k.ssb + k.ssw, 1) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (isNaN(k.F)) return "All eighteen values are equal: there is no variation at all, so <b>F is undefined</b>.";
      if (!isFinite(k.F)) return "Every value equals its group's mean: within-group variation is 0, so <b>F is infinite</b> and the groups surely differ.";
      if (k.p < 0.05) return "<b>F = " + Viz.fmt(k.F) + "</b> (" + pText(k.p) + "): the group means differ far more than the scatter inside the groups would explain by chance.";
      return "<b>F = " + Viz.fmt(k.F) + "</b> (" + pText(k.p) + "): the means differ no more than the scatter inside the groups could produce by chance.";
    },
    examples: [
      // C sits 16 above A and B, which share a mean: one group carries all of the between part
      {name: "one group shifted up", values: {groupA1: 38, groupA2: 41, groupA3: 43, groupA4: 45, groupA5: 47, groupA6: 50,
        groupB1: 39, groupB2: 42, groupB3: 43, groupB4: 45, groupB5: 46, groupB6: 49, groupC1: 54, groupC2: 57, groupC3: 59, groupC4: 61, groupC5: 63, groupC6: 66}},
      // every group averages exactly 50: no between part at all, F = 0, however tight the groups are
      {name: "tight groups, same means", values: {groupA1: 48, groupA2: 49, groupA3: 50, groupA4: 50, groupA5: 51, groupA6: 52,
        groupB1: 47, groupB2: 49, groupB3: 50, groupB4: 51, groupB5: 51, groupB6: 52, groupC1: 48, groupC2: 49, groupC3: 49, groupC4: 51, groupC5: 51, groupC6: 52}},
      // the default's group means (39, 50, 61, so the same SS_B 1452) with scatter of +-4, 12, 22: F 2.82, p 0.09
      {name: "big spread hides the effect", values: {groupA1: 17, groupA2: 27, groupA3: 35, groupA4: 43, groupA5: 51, groupA6: 61,
        groupB1: 28, groupB2: 38, groupB3: 46, groupB4: 54, groupB5: 62, groupB6: 72, groupC1: 39, groupC2: 49, groupC3: 57, groupC4: 65, groupC5: 73, groupC6: 83}}
    ],
    size: [400, 340],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 40, x1 = 334, yB = 262, yT = 18, colW = (x1 - x0) / K;
      // the axis range lives on the svg (one per mounted widget) so it survives redraws; it is frozen during a drag
      var S = api.svg.__anova || (api.svg.__anova = {drag: false});
      if (!S.drag || !S.yr) S.yr = autoRange(k);
      var lo = S.yr[0], hi = S.yr[1];
      var Y = function (val) { return yB - (yB - yT) * (val - lo) / (hi - lo); };
      for (var t = lo; t <= hi + 1e-9; t += 10) {
        api.line([x0, Y(t)], [x1, Y(t)], {color: c.grid, width: 1});
        api.label([x0 - 6, Y(t)], String(t), {color: c.muted, size: 12, anchor: "end"});
      }
      api.line([x0, yB], [x1, yB], {color: c.axis, width: 1.2});
      var gy = Y(k.grand);
      api.line([x0, gy], [x1 + 6, gy], {color: c.muted, width: 1.5, dash: "6 4"});
      // grand-mean label on the side of the line away from group C's between arrow; near the axis (lowest line past
      // yB - 24) or the top it flips, and then starts beyond the arrow's head so it never sits beside the arrow's label
      var mC = Y(k.means[2]), cArrow = Math.abs(mC - gy) > 7, side = mC <= gy ? 1 : -1;
      var base = function (sd) { return cArrow && (sd < 0) === (mC < gy) ? mC : gy; };
      if (side > 0 && base(1) + 24 > yB - 24) side = -1; else if (side < 0 && base(-1) - 24 < yT) side = 1;
      var by = base(side);
      api.label([x1 + 10, by + side * 10], side > 0 ? "grand" : "mean " + n1(k.grand), {color: c.muted, size: 12});
      api.label([x1 + 10, by + side * 24], side > 0 ? "mean " + n1(k.grand) : "grand", {color: c.muted, size: 12});
      function drag(key) {
        return function (q) {
          if (!S.drag) {   // the pointer-to-value scale is the one on screen when the drag starts, so it never runs away
            S.drag = true; S.base = S.yr.slice();
            window.addEventListener("pointerup", function end() {
              window.removeEventListener("pointerup", end); S.drag = false;
              var r = autoRange(calc(api.state));
              if (r[0] !== S.yr[0] || r[1] !== S.yr[1]) api.set({});   // zoom back to the data, redrawing only if it changed
            });
          }
          var B = S.base, val = Math.round(Math.max(0, Math.min(100, B[0] + (yB - q[1]) / (yB - yT) * (B[1] - B[0]))));
          // a point dragged past the axis end widens the axis (in 10s) just enough to keep it in view
          S.yr = [Math.min(B[0], Math.floor(val / 10) * 10), Math.max(B[1], Math.ceil(val / 10) * 10)];
          var patch = {}; patch[key] = val; api.set(patch);
        };
      }
      G.forEach(function (g, j) {
        var cx = x0 + colW * (j + 0.5), m = k.means[j], d = m - k.grand;
        api.label([cx - 6, yB + 14], g + ": mean " + n1(m), {color: c.ink, size: 12.5, anchor: "middle", weight: 600});
        api.line([cx - 41, Y(m)], [cx + 23, Y(m)], {color: c.c3, width: 3});
        // between: the grand mean to the group mean
        if (Math.abs(Y(m) - gy) > 7) {
          api.arrow([cx + 28, gy], [cx + 28, Y(m)], {color: c.c3, width: 2.5, halo: false, head: Math.min(9, Math.abs(Y(m) - gy) * 0.8)});
          api.label([cx + 33, (gy + Y(m)) / 2], (d > 0 ? "+" : "−") + n1(Math.abs(d)), {color: c.c3, size: 12, weight: 650});
        }
        k.groups[j].forEach(function (x, i) {
          var px = cx - 34 + i * 10;
          var hg = api.handle([px, Y(x)], {color: c.c1, r: 3.5, onDrag: drag("group" + g + (i + 1))});
          // points sit 10 px apart, so shrink the invisible grab circle (framework default r + 9) to stop a
          // neighbour's grab area from stealing the drag
          if (hg && hg.firstChild) hg.firstChild.setAttribute("r", 5.5);
        });
        // within: each point to its group mean, drawn over the points (and deaf to the pointer) so even a 1-unit
        // gap shows as a blue stub
        k.groups[j].forEach(function (x, i) {
          var px = cx - 34 + i * 10;
          if (Math.abs(x - m) > 1e-9) api.line([px, Y(x)], [px, Y(m)], {color: c.c2, width: 2.5}).setAttribute("pointer-events", "none");
        });
      });
      // the sums of squares as one bar: between + within = total
      var tot = k.ssb + k.ssw, bx = 40, bw = 352, yb = 305, wb = tot > 0 ? bw * k.ssb / tot : 0;
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
