// The hypergeometric distribution: draw n items without replacement from a population of N that holds K successes;
// X counts the successes in the sample. Top: the population (green successes, grey failures) with one sample of the
// chosen kind ringed, k successes and n - k failures. Every sample of n is equally likely, so
// P(X = k) = (ways to pick the k successes) x (ways to pick the n - k failures) / (ways to pick any n).
// Bottom: the whole distribution for k = 0..12 with the chosen k highlighted and the mean nK/N dashed.
// k is Dot's addition to the queue's three parameters so the formula can show one outcome with his numbers in it.
(function () {
  function C(n, r) {
    if (r < 0 || r > n) return 0;
    r = Math.min(r, n - r);
    var out = 1;
    for (var i = 1; i <= r; i++) out = out * (n - r + i) / i;
    return Math.round(out);
  }
  function calc(v) {
    var N = v.population_size, K = v.population_successes, n = v.sample_size, k = v.k;
    var lo = Math.max(0, n - (N - K)), hi = Math.min(n, K), total = C(N, n);
    var pk = function (j) { return C(K, j) * C(N - K, n - j) / total; };
    return {N: N, K: K, n: n, k: k, lo: lo, hi: hi, a: C(K, k), b: C(N - K, n - k), total: total, p: pk(k), pk: pk,
            ok: k >= lo && k <= hi, mean: n * K / N};
  }
  var big = function (x) { return String(x).replace(/(\d)(?=(\d{3})+$)/g, "$1{,}"); };
  var txt = function (x) { return String(x).replace(/(\d)(?=(\d{3})+$)/g, "$1,"); };
  function pc(x) {
    if (x === 1 || x === 0 || x >= 0.001) return x === 1 ? "1" : x === 0 ? "0" : Viz.fmt(x, 3);
    var e = Math.floor(Math.log10(x)), sup = {"0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹"};
    return Viz.fmt(x / Math.pow(10, e), 1) + " × 10⁻" + String(-e).split("").map(function (d) { return sup[d]; }).join("");
  }

  Viz.register("hypergeometric-distribution", {
    title: "Hypergeometric distribution: drawing without replacement",
    subject: "stats",
    shows: "Set the population, its successes and the sample size, then pick k: the chance is the number of samples with exactly k successes over all samples of n",
    params: {
      population_size: {kind: "integer", default: 12, min: 12, max: 24, label: "N"},
      population_successes: {kind: "integer", default: 5, min: 0, max: 12, label: "K"},
      sample_size: {kind: "integer", default: 7, min: 1, max: 12, label: "n"},
      k: {kind: "integer", default: 3, min: 0, max: 12, label: "k"}
    },
    formula: function (v) {
      var q = calc(v);
      return "\\begin{array}{l}P(X=k)=\\dfrac{\\binom{K}{k}\\binom{N-K}{n-k}}{\\binom{N}{n}}=\\dfrac{\\binom{" + q.K + "}{" + q.k + "}\\binom{" + (q.N - q.K) + "}{" + (q.n - q.k) + "}}{\\binom{" + q.N + "}{" + q.n + "}}\\\\[6pt]" +
        "\\quad=\\dfrac{" + big(q.a) + "\\cdot" + big(q.b) + "}{" + big(q.total) + "}=" + (q.p === 0 || q.p === 1 ? q.p : q.p >= 0.0001 ? Viz.n(q.p, 4) : q.p.toExponential(2).replace(/e(.*)/, "\\times10^{$1}")) + "\\end{array}";
    },
    status: function (v) {
      var q = calc(v);
      if (q.k > q.K) return "<b>Impossible</b>: the population holds only " + q.K + " success" + (q.K === 1 ? "" : "es") + ", so no sample can contain " + q.k + ".";
      if (q.k > q.n) return "<b>Impossible</b>: a sample of " + q.n + " cannot hold " + q.k + " successes.";
      if (!q.ok) return "<b>Impossible</b>: with only " + (q.N - q.K) + " failures to go round, any sample of " + q.n + " has at least <b>" + q.lo + "</b> successes.";
      if (q.p === 1) return "<b>Certain</b>: every sample of " + q.n + " has exactly " + q.k + " success" + (q.k === 1 ? "" : "es") + ", so P(X = " + q.k + ") = 1.";
      return "<b>" + txt(q.a * q.b) + "</b> of the " + txt(q.total) + " equally likely samples " + (q.a * q.b === 1 ? "has" : "have") + " exactly " + q.k + " success" + (q.k === 1 ? "" : "es") +
        ", so P(X = " + q.k + ") = <b>" + pc(q.p) + "</b>; on average a sample holds nK/N = <b>" + Viz.fmt(q.mean, 2) + "</b>.";
    },
    examples: [
      {name: "Minimum supported values", values: {population_size: 12, population_successes: 0, sample_size: 1, k: 0}},
      {name: "Maximum supported values", values: {population_size: 24, population_successes: 12, sample_size: 12, k: 12}},
      {name: "quality check: no defectives", values: {population_size: 20, population_successes: 3, sample_size: 5, k: 0}},
      {name: "impossible: more successes than exist", values: {population_size: 12, population_successes: 5, sample_size: 7, k: 6}},
      {name: "forced successes", values: {population_size: 12, population_successes: 10, sample_size: 7, k: 4}}
    ],
    size: [400, 316],
    draw: function (api, v) {
      var c = api.color, q = calc(v);
      // ---- the population: successes on the left, failures on the right, two rows each --------------------------
      var sp = 23, gap = 32, cs = Math.ceil(q.K / 2), cf = Math.ceil((q.N - q.K) / 2), wTot = (cs + cf) * sp + (cs && cf ? gap : 0);
      var left = (400 - wTot) / 2 + sp / 2, rows = [34, 58];
      var sx = function (i) { return left + Math.floor(i / 2) * sp; }, fx = function (i) { return left + cs * sp + (cs ? gap : 0) + Math.floor(i / 2) * sp; };
      for (var i = 0; i < q.K; i++) {
        var drawnS = q.ok && i < q.k, Ps = [sx(i), rows[i % 2]];
        if (drawnS) api.circle(Ps, 10.5, {stroke: c.c3, width: 2.5});
        api.circle(Ps, 8, {fill: c.c4, fillOpacity: drawnS || !q.ok ? 0.95 : 0.4});
      }
      for (var j = 0; j < q.N - q.K; j++) {
        var drawnF = q.ok && j < q.n - q.k, Pf = [fx(j), rows[j % 2]];
        if (drawnF) api.circle(Pf, 10.5, {stroke: c.c3, width: 2.5});
        api.circle(Pf, 8, {fill: c.muted, fillOpacity: drawnF || !q.ok ? 0.7 : 0.25});
      }
      var mid = cs && cf ? left + cs * sp - sp / 2 + gap / 2 : 200;
      if (q.K) api.label([cf ? mid - 6 : 200, 84], "K = " + q.K + " success" + (q.K === 1 ? "" : "es"), {color: c.c4, size: 12.5, weight: 650, anchor: cf ? "end" : "middle"});
      api.label([cs ? mid + 6 : 200, 84], "N − K = " + (q.N - q.K) + " failure" + (q.N - q.K === 1 ? "" : "s"), {color: c.muted, size: 12.5, weight: 600, anchor: cs ? "start" : "middle"});
      api.label([200, 104], q.ok ? "ringed: one sample of n = " + q.n + " with k = " + q.k + " success" + (q.k === 1 ? "" : "es") :
        "no sample of " + q.n + " has exactly " + q.k + " success" + (q.k === 1 ? "" : "es"), {color: q.ok ? c.c3 : c.c5, size: 12.5, weight: 650, anchor: "middle"});
      // ---- the distribution of X, k = 0..12 ------------------------------------------------------------------------
      var x0 = 46, x1 = 386, yB = 274, yT = 156, slot = (x1 - x0) / 13, bw = slot * 0.66, maxP = 0;
      for (var m = q.lo; m <= q.hi; m++) maxP = Math.max(maxP, q.pk(m));
      var top = [0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1].filter(function (t) { return t >= maxP - 1e-9; })[0], st = top <= 0.4 ? 0.1 : 0.2;
      var Y = function (p) { return yB - (yB - yT) * p / top; };
      for (var g = st; g <= top + 1e-9; g += st) {
        api.line([x0, Y(g)], [x1, Y(g)], {color: c.grid, width: 1});
        api.label([x0 - 6, Y(g)], Viz.fmt(g, 1), {color: c.muted, size: 12, anchor: "end"});
      }
      for (var b = 0; b <= 12; b++) {
        var pb = b >= q.lo && b <= q.hi ? q.pk(b) : 0, cx = x0 + (b + 0.5) * slot, sel = b === q.k;
        if (pb > 0) api.rect(cx - bw / 2, Y(pb), bw, Math.max(1.5, yB - Y(pb)), {fill: sel ? c.c3 : c.c2, fillOpacity: sel ? 0.95 : 0.5, rx: 2});
        api.label([cx, yB + 13], String(b), {color: sel ? c.c3 : c.muted, size: 12, weight: sel ? 700 : 500, anchor: "middle"});
      }
      if (!q.ok) api.line([x0 + (q.k + 0.5) * slot - bw / 2, yB - 1], [x0 + (q.k + 0.5) * slot + bw / 2, yB - 1], {color: c.c5, width: 3});
      api.line([x0, yB], [x1 + 6, yB], {color: c.axis, width: 1.4});
      api.label([x1 + 6, yB + 30], "successes in the sample, k", {color: c.muted, size: 12, anchor: "end"});
      api.label([x1 + 6, 126], "P(X = " + q.k + ") = " + pc(q.p), {color: q.ok ? c.c3 : c.c5, size: 13, weight: 700, anchor: "end"});
      var mx = x0 + (q.mean + 0.5) * slot;
      api.line([mx, yB], [mx, yT - 8], {color: c.ink, width: 1.5, dash: "4 4"});
      api.label([mx + (mx > 250 ? -5 : 5), yT - 14], "mean nK/N = " + Viz.fmt(q.mean, 2), {color: c.ink, size: 12.5, weight: 600, anchor: mx > 250 ? "end" : "start"});
    }
  });
})();
