// Wilcoxon rank-sum (Mann-Whitney) test on two groups of six. Top: the raw values of A (teal) and B (amber) on one
// axis. Middle: all twelve lined up smallest to largest and ranked 1 to 12; tied values share the average of the ranks
// they span (midranks), joined by a bar. W_A is the sum of A's ranks. Bottom: the exact null distribution of W_A, the
// rank sums of all C(12, 6) = 924 equally likely ways to hand six of these ranks to A if the groups do not differ;
// the red bars are as far from E[W_A] = 39 as the observed sum or farther, and their share is the two-sided p-value.
// The queue's only parameter picks the starting data; "shift" (Dot's addition) slides every B value so you can watch
// the ranks interleave or separate.
(function () {
  var DATA = {
    "intermingled": {A: [3, 6.5, 9, 12, 14.5, 17], B: [4, 7.5, 10, 11, 15.5, 18]},
    "group-a-lower": {A: [2, 3.5, 5, 6, 8, 10.5], B: [7, 11.5, 13, 14, 16, 18.5]},
    "group-a-higher": {A: [7, 11, 13.5, 15, 16.5, 18], B: [2.5, 4, 5.5, 8, 9.5, 12.5]},
    "ties": {A: [4, 6, 6, 9, 12, 12], B: [6, 9, 9, 12, 15, 15]}
  };
  function calc(v) {
    var d = DATA[v.initial_pattern], A = d.A, B = d.B.map(function (b) { return b + v.shift; });
    var all = A.map(function (x, i) { return {x: x, g: "A", i: i}; }).concat(B.map(function (x, i) { return {x: x, g: "B", i: i}; }));
    all.sort(function (p, q) { return p.x - q.x || (p.g < q.g ? -1 : p.g > q.g ? 1 : 0); });
    var ties = [];
    for (var i = 0; i < all.length;) {
      var j = i; while (j + 1 < all.length && Math.abs(all[j + 1].x - all[i].x) < 1e-9) j++;
      for (var k = i; k <= j; k++) { all[k].rank = (i + j + 2) / 2; all[k].slot = k; }
      if (j > i) ties.push([i, j]);
      i = j + 1;
    }
    var rA = all.filter(function (p) { return p.g === "A"; }).map(function (p) { return p.rank; });
    var W = rA.reduce(function (s, r) { return s + r; }, 0), N = 12, nA = 6, mu = nA * (N + 1) / 2, dev = Math.abs(W - mu);
    // exact permutation distribution of W_A over the 924 six-subsets of the (mid)ranks, keyed by 2W so midranks stay integer
    var ranks = all.map(function (p) { return p.rank; }), dist = {}, extreme = 0, total = 0;
    (function walk(start, left, sum) {
      if (!left) { var key = Math.round(2 * sum); dist[key] = (dist[key] || 0) + 1; total++; if (Math.abs(sum - mu) >= dev - 1e-9) extreme++; return; }
      for (var s = start; s <= N - left; s++) walk(s + 1, left - 1, sum + ranks[s]);
    })(0, nA, 0);
    return {A: A, B: B, all: all, ties: ties, rA: rA, W: W, WB: N * (N + 1) / 2 - W, mu: mu, dist: dist, extreme: extreme, total: total, p: extreme / total,
            half: ranks.some(function (r) { return r % 1; })};
  }
  function pTxt(p) { return Math.abs(p - 0.05) < 0.005 ? Viz.fmt(p, 4) : Viz.fmt(p, p < 0.1 ? 3 : 2); }
  var f = function (x) { return Viz.fmt(x, 1); };
  function tint(api) { api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; }); }   // viz.css paints text ink

  Viz.register("wilcoxon-rank-sum", {
    title: "Wilcoxon rank-sum test",
    subject: "stats",
    shows: "Pool both groups, rank everything, and add up A's ranks: a sum far from what chance gives (the 924 possible splits) means the groups differ",
    params: {
      initial_pattern: {kind: "enum", values: ["intermingled", "group-a-lower", "group-a-higher", "ties"], default: "intermingled",
        names: {"intermingled": "mixed", "group-a-lower": "A lower", "group-a-higher": "A higher", "ties": "ties"}, label: "\\text{data}"},
      shift: {kind: "number", default: 0, min: -6, max: 6, step: 0.5, label: "B\\text{ shift}"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}W_A=" + k.rA.map(function (r) { return Viz.n(r, 1); }).join("{+}") + "\\\\[3pt]\\phantom{W_A}=" + Viz.n(k.W, 1) +
        ",\\ \\ \\mathbb{E}[W_A]=39,\\ \\ p=" + pTxt(k.p) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), tie = k.ties.length ? "; tied values share the average of the ranks they span" : "";
      var share = k.extreme + " of the " + k.total + " equally likely splits";
      if (Math.abs(k.W - k.mu) < 1e-9) return "A's rank sum of 39 is exactly what no difference predicts: every one of the 924 splits is at least this far out, so <b>p = 1</b>" + tie + ".";
      if (k.p < 0.05) return "A's ranks sum to <b>" + f(k.W) + "</b>, far " + (k.W < k.mu ? "below" : "above") + " the 39 expected if the groups were alike; only " + share +
        " are this lopsided, so <b>p = " + pTxt(k.p) + "</b>: A tends to be " + (k.W < k.mu ? "lower" : "higher") + tie + ".";
      return "A's rank sum of " + f(k.W) + " is near the 39 expected under no difference; " + share + " are at least this far from 39, so <b>p = " + pTxt(k.p) + "</b>: no clear evidence the groups differ" + tie + ".";
    },
    examples: [
      {name: "intermingled: p near 1", values: {initial_pattern: "intermingled"}},
      {name: "A lower", values: {initial_pattern: "group-a-lower"}},
      {name: "A higher", values: {initial_pattern: "group-a-higher"}},
      {name: "ties get midranks", values: {initial_pattern: "ties"}},
      {name: "Minimum supported values", values: {initial_pattern: "intermingled", shift: -6}},
      {name: "Maximum supported values", values: {initial_pattern: "ties", shift: 6}}
    ],
    size: [400, 340],
    draw: function (api, v) {
      var c = api.color, k = calc(v), col = {A: c.c1, B: c.c3};
      // the raw values on one axis; axis spans the data at any shift
      var lo = -5, hi = 25, x0 = 36, x1 = 386, X = function (q) { return x0 + (x1 - x0) * (q - lo) / (hi - lo); };
      api.line([x0, 26], [x1, 26], {color: c.axis, width: 1.2});
      for (var t = 0; t <= 25; t += 5) { api.line([X(t), 23], [X(t), 29], {color: c.axis, width: 1}); api.label([X(t), 13], String(t), {color: c.muted, size: 12, anchor: "middle"}); }
      var rowY = {A: 46, B: 70};
      api.label([6, rowY.A], "A", {color: c.c1, size: 13, weight: 700});
      api.label([6, rowY.B], "B", {color: c.c3, size: 13, weight: 700});
      if (v.shift) api.label([6, rowY.B + 15], (v.shift > 0 ? "+" : "−") + Viz.fmt(Math.abs(v.shift), 1), {color: c.c3, size: 12});
      // slots for the ranked lineup
      var s0 = 48, s1 = 380, sy = 130, SX = function (j) { return s0 + (s1 - s0) * j / 11; };
      // tied points of one group sit side by side
      k.all.forEach(function (p) {
        var same = k.all.filter(function (q) { return q.g === p.g && Math.abs(q.x - p.x) < 1e-9; }), at = same.indexOf(p);
        p.dx = X(p.x) + (same.length > 1 ? (at - (same.length - 1) / 2) * 11 : 0);
      });
      k.all.forEach(function (p) { api.line([p.dx, rowY[p.g] + 6], [SX(p.slot), sy - 9], {color: col[p.g], width: 1, opacity: 0.35}); });
      k.ties.forEach(function (tr) { api.line([SX(tr[0]), sy], [SX(tr[1]), sy], {color: c.muted, width: 10, opacity: 0.35}); });
      k.all.forEach(function (p) {
        api.circle([p.dx, rowY[p.g]], 5, {fill: col[p.g], fillOpacity: 1});
        api.circle([SX(p.slot), sy], 8, {fill: col[p.g], fillOpacity: 0.3, stroke: col[p.g], width: 1.6});
        api.label([SX(p.slot), sy + 20], Viz.fmt(p.rank, 1), {color: col[p.g], size: 12.5, weight: 650, anchor: "middle"});
      });
      api.label([4, sy + 20], "rank", {color: c.muted, size: 12});
      // the two rank sums
      api.label([s0 - 8, 178], "A's rank sum = " + f(k.W), {color: c.c1, size: 13.5, weight: 700});
      api.label([s1 + 6, 178], "B's rank sum = " + f(k.WB), {color: c.c3, size: 13.5, weight: 700, anchor: "end"});
      api.label([(s0 + s1) / 2, 178], "total 78", {color: c.muted, size: 12, anchor: "middle"});
      // the null distribution of W_A: all 924 splits
      var base = 302, htop = 228, wLo = 21, wHi = 57, H = function (q) { return x0 + 4 + (x1 - x0 - 8) * (q - wLo) / (wHi - wLo); };
      var unit = k.half ? 0.5 : 1, maxC = 0, keys = Object.keys(k.dist).map(Number);
      keys.forEach(function (key) { maxC = Math.max(maxC, k.dist[key]); });
      var bw = Math.max(1.5, (H(wLo + unit) - H(wLo)) * 0.8);
      api.label([x0, 198], "A's rank sum over all " + k.total + " ways to split the ranks", {color: c.muted, size: 12});
      keys.forEach(function (key) {
        var w = key / 2, h = (base - htop) * k.dist[key] / maxC, far = Math.abs(w - k.mu) >= Math.abs(k.W - k.mu) - 1e-9;
        api.rect(H(w) - bw / 2, base - h, bw, h, {fill: far ? c.c5 : c.muted, fillOpacity: far ? 0.85 : 0.4, rx: 0});
      });
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.2});
      [21, 30, 39, 48, 57].forEach(function (q) { api.label([H(q), base + 13], String(q), {color: c.muted, size: 12, anchor: "middle"}); });
      api.line([H(39), base], [H(39), htop], {color: c.muted, width: 1.2, dash: "3 3"});
      api.line([H(k.W), base + 3], [H(k.W), htop - 10], {color: c.c1, width: 2.2});
      var lr = k.W < 39;
      api.label([H(k.W) + (lr ? 5 : -5), htop - 9], "observed " + f(k.W), {color: c.c1, size: 12.5, weight: 650, anchor: lr ? "start" : "end"});
      api.label([lr ? x1 : x0, htop + 8], "p = " + pTxt(k.p), {color: c.c5, size: 13.5, weight: 700, anchor: lr ? "end" : "start"});
      api.label([lr ? x1 : x0, htop + 24], k.extreme + " of " + k.total + " in red", {color: c.c5, size: 12, anchor: lr ? "end" : "start"});
      tint(api);
    }
  });
})();
