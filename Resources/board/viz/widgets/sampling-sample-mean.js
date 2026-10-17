// Sampling and the sample mean, on a population you can see: 50 students' nightly sleep in hours (a fixed seeded set).
// Each sample is a simple random sample of n students without replacement (sample j always uses the same shuffle, so
// a bigger n adds students to the same sample). Top: the population as a dot plot, this sample's students in amber,
// mu dashed. Bottom: the mean of every sample drawn so far, the latest in amber. The means cluster around mu much
// more tightly than single students do: their SD is about sigma/sqrt(n) * sqrt((N - n)/(N - 1)) for N = 50.
// Dot's design: the queue entry has no schema; n and the number of samples drawn are the inputs.
(function () {
  function rnd(seed) { return function () { seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var N = 50, POP = (function () {
    var r = rnd(808), out = [];
    while (out.length < N) { var u = r() || 1e-9, w = r(), z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w); if (Math.abs(z) < 2.2) out.push(Math.round((7 + 1.1 * z) * 10) / 10); }
    return out;
  })();
  var MU = POP.reduce(function (a, b) { return a + b; }, 0) / N;
  var SIGMA = Math.sqrt(POP.reduce(function (a, b) { return a + (b - MU) * (b - MU); }, 0) / N);
  var r2 = function (x) { return Math.round(x * 100) / 100; }, f2 = function (x) { return Viz.fmt(x, 2); };
  function sample(j, n) {   // the first n of sample j's shuffle
    var r = rnd(500 + 31 * j), idx = [], i;
    for (i = 0; i < N; i++) idx.push(i);
    for (i = N - 1; i > 0; i--) { var k = Math.floor(r() * (i + 1)), t = idx[i]; idx[i] = idx[k]; idx[k] = t; }
    return idx.slice(0, n);
  }
  function calc(v) {
    var n = v.sample_size, K = v.samples, means = [];
    for (var j = 1; j <= K; j++) means.push(sample(j, n).reduce(function (a, i) { return a + POP[i]; }, 0) / n);
    var cur = sample(K, n), sum = Math.round(cur.reduce(function (a, i) { return a + POP[i]; }, 0) * 10) / 10, xbar = sum / n;
    var mm = means.reduce(function (a, b) { return a + b; }, 0) / K;
    var sdm = K > 1 ? Math.sqrt(means.reduce(function (a, b) { return a + (b - mm) * (b - mm); }, 0) / (K - 1)) : NaN;
    return {n: n, K: K, cur: cur, sum: sum, xbar: xbar, means: means, sdm: sdm, theory: SIGMA / Math.sqrt(n) * Math.sqrt((N - n) / (N - 1))};
  }
  function stacks(vals, bin) {   // dot-plot positions: [bin centre, height index]
    var seen = {};
    return vals.map(function (x) { var b = Math.round(x / bin); seen[b] = (seen[b] || 0) + 1; return [b * bin, seen[b] - 1]; });
  }

  Viz.register("sampling-sample-mean", {
    title: "Sampling: the sample mean",
    subject: "stats",
    shows: "Draw random samples from a population of 50: each sample's mean lands near μ, and the means pile up far more tightly than single values",
    params: {
      sample_size: {kind: "integer", default: 5, min: 2, max: 25, label: "n"},
      samples: {kind: "integer", default: 30, min: 1, max: 40, label: "\\text{samples}"}
    },
    formula: function (v) {
      var k = calc(v), d = r2(k.xbar) - r2(MU);
      return "\\begin{array}{l}\\bar x=\\dfrac{1}{n}\\sum x_i=\\dfrac{" + Viz.n(k.sum, 1) + "}{" + k.n + "}=" + Viz.n(k.xbar, 2) +
        "\\\\[8pt]\\bar x-\\mu=" + Viz.n(k.xbar, 2) + "-" + Viz.n(MU, 2) + "=" + Viz.n(d, 2) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), d = r2(k.xbar) - r2(MU), side = Math.abs(d) < 0.005 ? "right on μ" : f2(Math.abs(d)) + " h " + (d > 0 ? "above" : "below") + " μ = " + f2(MU);
      var head = "Sample " + k.K + " (" + k.n + " students) has <b>x̄ = " + f2(k.xbar) + " h</b>, " + side;
      if (k.K === 1) return head + "; draw more samples to see their means pile up around μ.";
      return head + "; the " + k.K + " means so far have SD <b>" + f2(k.sdm) + "</b>, against σ = " + f2(SIGMA) + " for single students.";
    },
    examples: [
      {name: "Minimum supported values", values: {sample_size: 2, samples: 1}},
      {name: "Maximum supported values", values: {sample_size: 25, samples: 40}},
      {name: "small samples, many draws", values: {sample_size: 2, samples: 40}},
      {name: "big samples, many draws", values: {sample_size: 20, samples: 40}}
    ],
    size: [400, 284],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 30, x1 = 386, lo = 4.5, hi = 9;
      var X = function (h) { return x0 + (x1 - x0) * (h - lo) / (hi - lo); };
      var inS = {}; k.cur.forEach(function (i) { inS[i] = true; });
      var hi_ = k.xbar >= MU;   // bracket labels go on the side away from the drop line
      function bracket(y, half, color, text) {   // a +-half bracket around mu at height y, labelled at one end
        var a = X(MU - half), b = X(MU + half);
        api.line([a, y], [b, y], {color: color, width: 1.6});
        api.line([a, y - 4], [a, y + 4], {color: color, width: 1.6});
        api.line([b, y - 4], [b, y + 4], {color: color, width: 1.6});
        api.label([hi_ ? a - 6 : b + 6, y + 4], text, {color: color, size: 12.5, weight: 650, anchor: hi_ ? "end" : "start"});
      }
      // the population, with its +-sigma bracket
      api.label([4, 12], N + " students' sleep (h): μ = " + f2(MU) + ", σ = " + f2(SIGMA), {color: c.c2, size: 12.5, weight: 650});
      var pb = 112, ps = stacks(POP, 0.2), ph = Math.min(11.5, 80 / (1 + Math.max.apply(null, ps.map(function (q) { return q[1]; }))));
      bracket(28, SIGMA, c.c2, "±σ");
      ps.forEach(function (q, i) {
        api.circle([X(q[0]), pb - 6 - q[1] * ph], 5, inS[i] ? {fill: c.c3, fillOpacity: 0.95, stroke: c.card, width: 1} : {fill: c.c2, fillOpacity: 0.4});
      });
      api.line([x0, pb], [x1, pb], {color: c.axis, width: 1.2});
      for (var h = 5; h <= 9; h++) api.label([X(h), pb + 13], String(h), {color: c.muted, size: 12, anchor: "middle"});
      // the means panel: a pile of dots that grows taller (not wider) as samples are added, with the theory +-SE bracket
      var LB = 166, SEY = 184, mb = 264, ms = stacks(k.means, 0.1), top = Math.max.apply(null, ms.map(function (q) { return q[1]; }));
      var mh = Math.min(10, 62 / Math.max(1, top)), mr = Math.max(2.6, Math.min(3.8, mh / 2 - 0.2));
      var cy = mb - 5 - ms[k.K - 1][1] * mh, right = k.xbar < 7.6;
      api.label([4, LB], k.K === 1 ? "mean of the 1 sample so far" : "means of the " + k.K + " samples so far (h): SD " + f2(k.sdm), {color: c.c1, size: 12.5, weight: 650});
      bracket(SEY, k.theory, c.c1, "±SE = " + f2(k.theory));
      // the latest sample's mean drops to the pile, in two pieces that skip the panel label
      api.line([X(k.xbar), pb + 22], [X(k.xbar), LB - 14], {color: c.c3, width: 1.4, dash: "3 3"});
      api.line([X(k.xbar), LB + 8], [X(k.xbar), cy - 7], {color: c.c3, width: 1.4, dash: "3 3"});
      api.polygon([[X(k.xbar) - 6, pb + 20], [X(k.xbar) + 6, pb + 20], [X(k.xbar), pb + 28]], {fill: c.c3, fillOpacity: 1});
      api.label([X(k.xbar) + (right ? 9 : -9), pb + 34], "sample " + k.K + ": x̄ = " + f2(k.xbar), {color: c.c3, size: 12.5, weight: 650, anchor: right ? "start" : "end"});
      ms.forEach(function (q, j) {
        var last = j === k.K - 1;
        api.circle([X(q[0]), mb - 5 - q[1] * mh], last ? mr + 1 : mr, {fill: last ? c.c3 : c.c1, fillOpacity: 0.95});
      });
      // mu, dashed, in two pieces that skip the label band between the panels
      api.line([X(MU), 28], [X(MU), pb], {color: c.ink, width: 1.2, dash: "4 4", opacity: 0.6});
      api.line([X(MU), SEY], [X(MU), mb], {color: c.ink, width: 1.2, dash: "4 4", opacity: 0.6});
      api.label([X(MU), mb + 13], "μ", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      api.line([x0, mb], [x1, mb], {color: c.axis, width: 1.2});
      for (h = 5; h <= 9; h++) api.label([X(h), mb + 13], String(h), {color: c.muted, size: 12, anchor: "middle"});
    }
  });
})();
