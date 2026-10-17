// A completely randomized experiment. N units each have an outcome they would show without treatment (a fixed seeded
// draw around 50); a random permutation puts floor(N/2) of them in treatment, and treatment adds the true effect tau to
// each treated unit. The control strip shows observed control outcomes; the treatment strip shows treated outcomes, with
// a faint ring at the outcome that unit would have had untreated (the potential outcome we never get to see).
// The estimate is the difference in group means; it misses tau only by the chance difference between the two groups'
// untreated outcomes, which randomization makes zero on average. The 95% CI uses the pooled two-sample t on N - 2 df.
// Both axes use the same pixels per unit, so a gap of 8 on the outcome axis is as long as 8 on the difference axis.
(function () {
  function rnd(seed) { return function () { seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var BASE = (function () {   // untreated outcomes, 50 + 8z with |z| < 2.3, so 31.6..68.4 and the axis 10..90 always fits
    var r = rnd(17), out = [];
    while (out.length < 30) { var u = r() || 1e-9, w = r(), z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w); if (Math.abs(z) < 2.3) out.push(Math.round((50 + 8 * z) * 10) / 10); }
    return out;
  })();
  var TC = {4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.16, 14: 2.145, 15: 2.131, 16: 2.12,
            17: 2.11, 18: 2.101, 19: 2.093, 20: 2.086, 21: 2.08, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.06, 26: 2.056, 27: 2.052, 28: 2.048};   // t(0.975, df)
  var r1 = function (x) { return Math.round(x * 10) / 10; }, f1 = function (x) { return Viz.fmt(x, 1); };
  function calc(v) {
    var N = v.experimental_units, tau = v.treatment_effect, r = rnd(101 + 7 * N), idx = [], i;
    for (i = 0; i < N; i++) idx.push(i);
    for (i = N - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    var nT = Math.floor(N / 2), nC = N - nT, isT = [];
    idx.forEach(function (u, k) { isT[u] = k < nT; });
    var T = [], C = [];
    for (i = 0; i < N; i++) { if (isT[i]) T.push({y: BASE[i] + tau, b: BASE[i]}); else C.push({y: BASE[i], b: BASE[i]}); }
    var mean = function (a) { return a.reduce(function (s, q) { return s + q.y; }, 0) / a.length; };
    var ss = function (a, m) { return a.reduce(function (s, q) { return s + (q.y - m) * (q.y - m); }, 0); };
    var mT = mean(T), mC = mean(C), se = Math.sqrt((ss(T, mT) + ss(C, mC)) / (N - 2) * (1 / nT + 1 / nC)), est = mT - mC, tc = TC[N - 2];
    return {N: N, tau: tau, nT: nT, nC: nC, isT: isT, T: T, C: C, mT: mT, mC: mC, est: est, shown: r1(mT) - r1(mC), se: se, t: est / se, lo: est - tc * se, hi: est + tc * se};
  }
  function swarm(xs, gap) {   // a vertical level per dot so no two dots on a level are closer than gap px
    var order = xs.map(function (x, i) { return i; }).sort(function (a, b) { return xs[a] - xs[b]; }), lv = [], placed = [];
    order.forEach(function (i) {
      var tries = [0, -1, 1, -2, 2, -3, 3];
      for (var k = 0; k < tries.length; k++) {
        var ok = placed.every(function (q) { return q[1] !== tries[k] || Math.abs(q[0] - xs[i]) >= gap; });
        if (ok || k === tries.length - 1) { lv[i] = tries[k]; placed.push([xs[i], tries[k]]); break; }
      }
    });
    return lv;
  }

  Viz.register("randomized-experiment", {
    title: "A randomized experiment",
    subject: "stats",
    shows: "Set the number of units and the true effect: a random split makes the groups alike, so the difference in their means estimates the effect, give or take chance",
    params: {
      experimental_units: {kind: "integer", default: 16, min: 6, max: 30, label: "N"},
      treatment_effect: {kind: "number", default: 8, min: -20, max: 20, step: 0.5, label: "\\tau"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\hat\\tau=\\bar y_T-\\bar y_C=" + Viz.n(k.mT, 1) + "-" + Viz.n(k.mC, 1) + "=" + Viz.n(k.shown, 1) +
        "\\\\[6pt]SE=s_p\\sqrt{\\tfrac{1}{" + k.nT + "}+\\tfrac{1}{" + k.nC + "}}=" + Viz.n(k.se, 2) + ",\\ \\ t=" + Viz.n(k.t, 2) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), ci = "95% CI " + f1(k.lo) + " to " + f1(k.hi), hit = k.lo > 0 || k.hi < 0;
      if (k.tau === 0) return "No true effect: the estimate " + f1(k.shown) + " is pure chance imbalance between the groups, and the " + ci +
        (hit ? " <b>excludes 0</b>, a false alarm that happens 5% of the time." : " <b>includes 0</b>, as it should.");
      return "Estimate <b>" + f1(k.shown) + "</b> against a true effect of " + f1(k.tau) + " (the gap is chance imbalance); the " + ci +
        (hit ? " <b>excludes 0</b>, so this experiment detects the effect." : " <b>includes 0</b>, so " + k.N + " units cannot tell this effect from chance.");
    },
    examples: [
      {name: "Minimum supported values", values: {experimental_units: 6, treatment_effect: -20}},
      {name: "Maximum supported values", values: {experimental_units: 30, treatment_effect: 20}},
      {name: "no true effect", values: {experimental_units: 16, treatment_effect: 0}},
      {name: "small effect, few units", values: {experimental_units: 8, treatment_effect: 4}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 78, x1 = 388, ppu = (x1 - x0) / 80;
      var X = function (y) { return x0 + (y - 10) * ppu; }, D = function (d) { return x0 + (d + 40) * ppu; };
      // the units and the coin
      api.label([4, 14], k.N + " units; a random draw puts " + k.nT + " in treatment, " + k.nC + " in control", {color: c.ink, size: 12.5, weight: 600});
      var sp = Math.min(22, (x1 - x0) / (k.N - 1)), ur = Math.min(6, sp * 0.4);
      api.label([4, 38], "units", {color: c.muted, size: 12});
      for (var i = 0; i < k.N; i++) api.circle([x0 + i * sp, 38], ur, {fill: k.isT[i] ? c.c3 : c.c2, fillOpacity: 0.9});
      // the two strips on the outcome axis
      var rows = [[k.C, 84, c.c2, "control", k.mC], [k.T, 130, c.c3, "treatment", k.mT]];
      rows.forEach(function (row) {
        var pts = row[0], y = row[1], col = row[2], lv = swarm(pts.map(function (q) { return X(q.y); }), 9.5);
        api.label([4, y], row[3], {color: col, size: 12.5, weight: 650});
        api.line([x0, y], [x1, y], {color: c.grid, width: 1});
        pts.forEach(function (q, j) {
          var yy = y + lv[j] * 8;
          if (row[3] === "treatment" && k.tau !== 0) {
            api.circle([X(q.b), yy], 4, {stroke: c.faint, width: 1.2});
          }
          api.circle([X(q.y), yy], 4.5, {fill: col, fillOpacity: 0.9, stroke: c.card, width: 1});
        });
        api.line([X(row[4]), y - 17], [X(row[4]), y + 17], {color: col, width: 2.6});
        api.label([X(row[4]), y - 24], "mean " + f1(row[4]), {color: col, size: 12, weight: 650, anchor: "middle"});
      });
      if (k.tau !== 0) api.label([4, 147], "○ untreated", {color: c.muted, size: 12});
      api.line([x0, 166], [x1, 166], {color: c.axis, width: 1.2});
      for (var t = 10; t <= 90; t += 10) api.label([X(t), 179], String(t), {color: c.muted, size: 12, anchor: "middle"});
      api.label([4, 166], "outcome", {color: c.muted, size: 12});
      // the difference: the true effect, the estimate and its 95% CI
      var yt = 206, ye = 232, ya = 256;
      api.line([D(0), 196], [D(0), ya], {color: c.faint, width: 1, dash: "3 3"});
      api.label([4, yt], "true effect", {color: c.ink, size: 12});
      api.polygon([[D(k.tau), yt - 6], [D(k.tau) + 6, yt], [D(k.tau), yt + 6], [D(k.tau) - 6, yt]], {fill: c.ink, fillOpacity: 0.9});
      api.label([D(k.tau) + (k.tau > 28 ? -10 : 10), yt], "τ = " + f1(k.tau), {color: c.ink, size: 12, anchor: k.tau > 28 ? "end" : "start"});
      api.label([4, ye], "estimate", {color: c.c1, size: 12.5, weight: 650});
      var lo = Math.max(-40, k.lo), hi = Math.min(40, k.hi);
      api.line([D(lo), ye], [D(hi), ye], {color: c.c1, width: 2.4, arrow: k.hi > 40, arrowStart: k.lo < -40});
      if (k.lo >= -40) api.line([D(lo), ye - 6], [D(lo), ye + 6], {color: c.c1, width: 2});
      if (k.hi <= 40) api.line([D(hi), ye - 6], [D(hi), ye + 6], {color: c.c1, width: 2});
      api.point([D(Math.max(-40, Math.min(40, k.est))), ye], {color: c.c1, r: 5.5});
      var right = D(hi) + 8 < x1 - 30;
      api.label([right ? D(hi) + 8 : D(lo) - 8, ye], f1(k.shown), {color: c.c1, size: 12.5, weight: 650, anchor: right ? "start" : "end"});
      api.line([x0, ya], [x1, ya], {color: c.axis, width: 1.2});
      for (var d = -40; d <= 40; d += 20) api.label([D(d), ya + 13], Viz.fmt(d), {color: c.muted, size: 12, anchor: "middle"});
      api.label([4, ya], "difference", {color: c.muted, size: 12});
    }
  });
})();
