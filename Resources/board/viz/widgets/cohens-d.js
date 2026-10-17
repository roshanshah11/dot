// Cohen's d: the gap between two group means measured in pooled standard deviations. Both groups are drawn as normal
// curves with the same SD, placed symmetrically about the middle of a fixed axis (only their difference matters), so a
// bigger SD visibly widens both curves. Under the axis is a ruler in SD units starting at group 1's mean: group 2's
// mean lands on it at exactly d. The shaded area is the overlap of the two curves, 2 Phi(-|d|/2); Cohen's U3, Phi(d),
// is the share of group 2 above group 1's mean. The strip at the bottom places |d| against Cohen's benchmarks
// (0.2 small, 0.5 medium, 0.8 large).
(function () {
  function erfc(x) { // Numerical Recipes erfcc, relative error < 1.2e-7
    var z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    var r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 +
      t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function Phi(z) { return 0.5 * erfc(-z / Math.SQRT2); }
  function size(ad) { ad += 1e-9; return ad < 0.2 ? "negligible" : ad < 0.5 ? "small" : ad < 0.8 ? "medium" : "large"; }
  var pc = function (x) { return Math.round(100 * x) + "%"; };

  Viz.register("cohens-d", {
    title: "Cohen's d: effect size",
    subject: "stats",
    shows: "Pull the means apart or widen the spread: d counts how many standard deviations separate the groups, and the overlap of the two curves shrinks as d grows",
    params: {
      initial_mean_difference: {kind: "number", default: 0.8, min: -4, max: 4, step: 0.05, label: "\\bar x_2-\\bar x_1"},
      pooled_standard_deviation: {kind: "number", default: 1, min: 0.75, max: 2, step: 0.05, label: "s_{\\text{pooled}}"}
    },
    formula: function (v) {
      var d = v.initial_mean_difference / v.pooled_standard_deviation;
      return "d=\\dfrac{\\bar x_2-\\bar x_1}{s_{\\text{pooled}}}=\\dfrac{" + Viz.n(v.initial_mean_difference, 2) + "}{" + Viz.n(v.pooled_standard_deviation, 2) + "}=" + Viz.n(d, 2);
    },
    status: function (v) {
      var d = v.initial_mean_difference / v.pooled_standard_deviation, ad = Math.abs(d);
      if (ad < 1e-9) return "d = 0: the two means are equal, so the curves sit on top of each other and overlap <b>100%</b>.";
      return "d = " + Viz.fmt(d, 2) + ", a <b>" + size(ad) + "</b> effect: " + pc(Phi(d)) + " of group 2 lies above group 1's mean, and the curves overlap <b>" + pc(2 * Phi(-ad / 2)) + "</b>.";
    },
    examples: [
      {name: "Minimum supported values", values: {initial_mean_difference: -4, pooled_standard_deviation: 0.75}},
      {name: "Maximum supported values", values: {initial_mean_difference: 4, pooled_standard_deviation: 2}},
      {name: "no difference", values: {initial_mean_difference: 0, pooled_standard_deviation: 1}},
      {name: "small effect", values: {initial_mean_difference: 0.3, pooled_standard_deviation: 1.5}},
      {name: "same gap, wider spread", values: {initial_mean_difference: 0.8, pooled_standard_deviation: 2}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, diff = v.initial_mean_difference, s = v.pooled_standard_deviation, d = diff / s, ad = Math.abs(d);
      var x0 = 20, x1 = 380, R = 7, base = 166, top = 40, m1 = -diff / 2, m2 = diff / 2;
      var X = function (x) { return x0 + (x1 - x0) * (x + R) / (2 * R); };
      var pk = 1 / (0.75 * Math.sqrt(2 * Math.PI)), Y = function (q) { return base - (base - top) * q / pk; };
      var pdf = function (x, m) { return Math.exp(-0.5 * Math.pow((x - m) / s, 2)) / (s * Math.sqrt(2 * Math.PI)); };
      var c1 = [], c2 = [], ov = [[X(-R), base]];
      for (var i = 0; i <= 280; i++) {
        var x = -R + 2 * R * i / 280, a = pdf(x, m1), b = pdf(x, m2);
        c1.push([X(x), Y(a)]); c2.push([X(x), Y(b)]); ov.push([X(x), Y(Math.min(a, b))]);
      }
      ov.push([X(R), base]);
      api.polygon([[X(-R), base]].concat(c1, [[X(R), base]]), {fill: c.c2, fillOpacity: 0.12});
      api.polygon([[X(-R), base]].concat(c2, [[X(R), base]]), {fill: c.c3, fillOpacity: 0.12});
      api.polygon(ov, {fill: c.ink, fillOpacity: 0.22});
      api.polyline(c1, {stroke: c.c2, width: 2.4});
      api.polyline(c2, {stroke: c.c3, width: 2.4});
      api.line([X(-R), base], [X(R), base], {color: c.axis, width: 1.2});
      // means, group names on the outer flanks, and the gap bracket above
      var sg = diff >= 0 ? 1 : -1, yPk = Y(pdf(0, 0));
      api.line([X(m1), base], [X(m1), yPk], {color: c.c2, width: 1.4, dash: "4 3"});
      api.line([X(m2), base], [X(m2), yPk], {color: c.c3, width: 1.4, dash: "4 3"});
      var yFl = Y(pdf(1.2 * s, 0)) - 8;
      api.label([X(m1 - sg * 1.2 * s) - sg * 4, yFl], "group 1", {color: c.c2, size: 12.5, weight: 650, anchor: sg > 0 ? "end" : "start"});
      api.label([X(m2 + sg * 1.2 * s) + sg * 4, yFl], "group 2", {color: c.c3, size: 12.5, weight: 650, anchor: sg > 0 ? "start" : "end"});
      var yb = Math.min(yPk - 12, 30);
      if (Math.abs(X(m2) - X(m1)) > 3) {
        api.line([X(m1), yb], [X(m2), yb], {color: c.ink, width: 1.5});
        [m1, m2].forEach(function (m) { api.line([X(m), yb - 4], [X(m), yb + 4], {color: c.ink, width: 1.5}); });
      }
      api.label([X(0), yb - 13], ad < 1e-9 ? "same mean" : "x̄₂ − x̄₁ = " + Viz.fmt(diff, 2), {color: c.ink, size: 12.5, weight: 600, anchor: "middle"});
      // the overlap's share: inside the shared area when it is big. When it is a sliver, the label goes up in the gap
      // between the two curves at the lowest height where it clears both, or else just above both curves (under the
      // bracket), with a thin leader down to the crossing; only if neither fits does it sit on a card plate over the crossing
      var yI = Y(pdf(0, m1)), big = base - yI > 44, ovT = "overlap " + pc(2 * Phi(-ad / 2)), ovW = ovT.length * 6.8 + 8;
      if (ad > 1e-9) {
        var oy = big ? (yI + base) / 2 + 8 : null, pk1 = 1 / (s * Math.sqrt(2 * Math.PI)), upx = (x1 - x0) / (2 * R);
        if (!big) {
          for (var f = pdf(0, m1) / pk1 + 0.04; f < 0.97 && oy === null; f += 0.01)
            if ((Math.abs(diff) - 2 * s * Math.sqrt(-2 * Math.log(f))) * upx >= ovW + 6) oy = Y(f * pk1);
          if (oy === null) {
            var hi = base;
            for (var xq = -ovW / 2 - 3; xq <= ovW / 2 + 3; xq += 2) { var dq = xq / upx; hi = Math.min(hi, Y(Math.max(pdf(dq, m1), pdf(dq, m2)))); }
            if (hi - 20 > yb + 6) oy = hi - 11;
          }
          if (oy !== null) api.line([X(0), oy + 9], [X(0), yI - 3], {color: c.ink, width: 1, opacity: 0.45});
        }
        if (oy === null || big) { oy = oy === null ? yI - 12 : oy; api.rect(X(0) - ovW / 2, oy - 9, ovW, 18, {fill: c.card, fillOpacity: 0.85, rx: 4}); }
        api.label([X(0), oy], ovT, {color: c.ink, size: 12, anchor: "middle"});
      }
      // the SD ruler from group 1's mean: group 2's mean lands at d
      var yr = base + 13;
      for (var kk = -9; kk <= 9; kk++) {
        var xr = m1 + kk * s;
        if (xr < -R - 1e-9 || xr > R + 1e-9) continue;
        api.line([X(xr), base], [X(xr), base + 5], {color: c.axis, width: 1});
        api.label([X(xr), yr], String(kk), {color: kk ? c.muted : c.c2, size: 12, anchor: "middle", weight: kk ? 500 : 650});
      }
      var capLeft = X(m2) > 200;
      api.label([capLeft ? x0 : x1, yr + 20], "in SDs from x̄₁", {color: c.muted, size: 12, anchor: capLeft ? "start" : "end"});
      // d's place on the ruler: a caret under the ruler's numbers (a line through them would touch the nearest one)
      api.polygon([[X(m2), yr + 8], [X(m2) - 4.5, yr + 14], [X(m2) + 4.5, yr + 14]], {fill: c.c1, fillOpacity: 1});
      api.label([X(m2), yr + 23], "d = " + Viz.fmt(d, 2), {color: c.c1, size: 12.5, weight: 700, anchor: X(m2) > 345 ? "end" : X(m2) < 55 ? "start" : "middle"});
      // |d| against Cohen's benchmarks
      var bx0 = 100, bx1 = 380, BX = function (q) { return bx0 + (bx1 - bx0) * Math.min(q, 2) / 2; }, by = 234;
      api.label([4, by + 6], "size of |d|", {color: c.muted, size: 12});
      [[0, 0.2, 0.1], [0.2, 0.5, 0.22], [0.5, 0.8, 0.36], [0.8, 2, 0.5]].forEach(function (b, j) {
        api.rect(BX(b[0]), by, BX(b[1]) - BX(b[0]) - 1, 12, {fill: c.c1, fillOpacity: b[2], rx: 2});
        if (j) api.label([(BX(b[0]) + BX(b[1])) / 2, by + (j === 2 ? 40 : 26)], ["", "small", "medium", "large"][j], {color: c.muted, size: 12, anchor: "middle"});
      });
      // past 2 the note "off the strip" takes the right half of the tick row, so only 0 and 0.5 are labelled
      (ad > 2 ? [0, 0.5] : [0, 0.5, 1, 1.5, 2]).forEach(function (q) { api.label([BX(q), by - 9], String(q), {color: c.muted, size: 12, anchor: "middle"}); });
      api.polygon([[BX(ad), by + 13], [BX(ad) - 6, by + 21], [BX(ad) + 6, by + 21]], {fill: c.c1, fillOpacity: 1});
      api.line([BX(ad), by - 2], [BX(ad), by + 14], {color: c.c1, width: 2.5});
      if (ad > 2) api.label([bx1, by - 9], "off the strip: |d| = " + Viz.fmt(ad, 2) + " →", {color: c.c1, size: 12, weight: 650, anchor: "end"});
      api.handle([X(m2), base], {color: c.c3, r: 6, onDrag: function (q) {
        var xd = (q[0] - x0) / (x1 - x0) * 2 * R - R;
        api.set({initial_mean_difference: Math.round(Math.max(-4, Math.min(4, 2 * xd)) * 20) / 20});
      }});
    }
  });
})();
