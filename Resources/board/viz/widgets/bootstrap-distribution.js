// The bootstrap. One sample of 20 nights of sleep; each resample draws 20 nights from it with replacement (so some
// repeat and some drop out), and the statistic is recomputed. The spread of B resampled statistics estimates the
// standard error, and their 2.5th and 97.5th percentiles give a 95% percentile interval. Resample b always uses the
// same seeded draws, so changing B adds or removes resamples without reshuffling the rest. Top: the sample, and the
// resample picked with "resample #"; bottom: the bootstrap distribution with that resample's value marked.
(function () {
  var DATA = [4.5, 5.5, 6, 6, 6.5, 6.5, 6.5, 7, 7, 7, 7, 7.5, 7.5, 7.5, 8, 8, 8.5, 8.5, 9, 10], N = DATA.length, MAXB = 2000, CUT = 7;
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var draws = function (b) { var r = rng(7919 * b + 3), out = []; for (var j = 0; j < N; j++) out.push(DATA[Math.floor(r() * N)]); return out; };
  var STAT = {
    mean: function (xs) { return xs.reduce(function (t, x) { return t + x; }, 0) / xs.length; },
    median: function (xs) { var s = xs.slice().sort(function (a, b) { return a - b; }), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; },
    proportion: function (xs) { return xs.filter(function (x) { return x >= CUT; }).length / xs.length; }
  };
  var RES = null, cache = {};
  function boot(stat) { // statistic of resamples 1..MAXB, computed once per statistic
    if (!RES) { RES = []; for (var b = 1; b <= MAXB; b++) RES.push(draws(b)); }
    if (!cache[stat]) cache[stat] = RES.map(STAT[stat]);
    return cache[stat];
  }
  function quantile(sorted, q) { var h = (sorted.length - 1) * q, lo = Math.floor(h); return sorted[lo] + (h - lo) * ((sorted[lo + 1] === undefined ? sorted[lo] : sorted[lo + 1]) - sorted[lo]); }
  function calc(v) {
    var all = boot(v.statistic), th = all.slice(0, v.B), m = STAT.mean(th);
    var se = Math.sqrt(th.reduce(function (t, x) { return t + (x - m) * (x - m); }, 0) / (v.B - 1)), s = th.slice().sort(function (a, b) { return a - b; });
    var one = RES[v.resample - 1];
    return {th: th, se: se, lo: quantile(s, 0.025), hi: quantile(s, 0.975), obs: STAT[v.statistic](DATA), one: one, oneStat: all[v.resample - 1]};
  }
  var NAME = {mean: "mean", median: "median", proportion: "share ≥ 7 h"}, UNIT = {mean: " h", median: " h", proportion: ""};
  var f2 = function (x) { return Viz.fmt(x, 2); };

  Viz.register("bootstrap-distribution", {
    title: "The bootstrap distribution",
    subject: "stats",
    shows: "Resample the data with replacement again and again: the spread of the recomputed statistic is its standard error, and its middle 95% is an interval",
    params: {
      statistic: {kind: "enum", values: ["mean", "median", "proportion"], default: "mean", label: "\\text{statistic}"},
      B: {kind: "integer", default: 1000, min: 100, max: 2000, step: 100, label: "B"},
      resample: {kind: "integer", default: 1, min: 1, max: 30, label: "\\text{resample}\\ \\#"}
    },
    formula: function (v) {
      var k = calc(v), sym = v.statistic === "mean" ? "\\bar x" : v.statistic === "median" ? "\\tilde x" : "\\hat p";
      return "\\begin{array}{l}" + sym + "=" + Viz.n(k.obs, 3) + ",\\ \\ " + sym + "^*_{" + v.resample + "}=" + Viz.n(k.oneStat, 3) + "\\\\[3pt]SE_{\\text{boot}}=\\text{sd}(" + sym + "^*_1,\\dots," + sym + "^*_{" + v.B + "})=" +
        Viz.n(k.se, 3) + "\\\\[3pt]95\\%\\ \\text{interval}=[" + Viz.n(k.lo, 2) + ",\\ " + Viz.n(k.hi, 2) + "]\\end{array}";
    },
    status: function (v) {
      var k = calc(v), base = "From " + v.B + " resamples of the 20 nights: SE <b>" + f2(k.se) + UNIT[v.statistic] + "</b>, 95% interval <b>" + f2(k.lo) + " to " + f2(k.hi) + UNIT[v.statistic] + "</b>";
      var few = v.B < 500 ? "; with this few resamples the SE itself wobbles, and the textbook " : ", close to the textbook ";
      if (v.statistic === "mean") return base + few + "s/√n = 0.28 h" + (v.B < 500 ? " is the check." : ", with no formula needed.");
      if (v.statistic === "median") return base + "; the histogram is lumpy because a median can only land on a data value or halfway between two.";
      return base + few + "√(p(1−p)/n) = 0.11 for p = 0.65" + (v.B < 500 ? " is the check." : ".");
    },
    examples: [
      {name: "statistic: median", values: {statistic: "median"}},
      {name: "statistic: proportion", values: {statistic: "proportion"}},
      {name: "few resamples", values: {B: 100, resample: 30}},
      {name: "many resamples", values: {B: 2000}}
    ],
    size: [400, 340],
    draw: function (api, v) {
      var c = api.color, k = calc(v), prop = v.statistic === "proportion";
      var halo = function (t) { t.setAttribute("stroke", c.card); t.setAttribute("stroke-width", 4); t.setAttribute("paint-order", "stroke"); return t; };
      var x0 = 36, x1 = 376, X = function (h) { return x0 + (x1 - x0) * (h - 4) / 6.5; };   // 4 h to 10.5 h
      function dots(xs, base, gap, r, color, maxH) {
        var counts = {}; xs.forEach(function (x) { counts[x] = (counts[x] || 0) + 1; });
        var tall = Math.max.apply(null, Object.keys(counts).map(function (key) { return counts[key]; })), g = Math.min(gap, maxH / Math.max(1, tall - 1));
        Object.keys(counts).forEach(function (key) {
          var x = Number(key), on = !prop || x >= CUT;
          for (var i = 0; i < counts[key]; i++) api.circle([X(x), base - i * g], r, on ? {fill: color} : {stroke: color, width: 1.5});
        });
      }
      // the sample and one resample, on one hours scale
      api.label([x0, 10], "the sample: 20 nights (hours of sleep)", {color: c.muted, size: 12});
      dots(DATA, 54, 8, 3.6, c.ink, 30);
      api.line([x0, 61], [x1, 61], {color: c.axis, width: 1.2});
      for (var h = 4; h <= 10; h++) api.label([X(h), 73], String(h), {color: c.muted, size: 12, anchor: "middle"});
      api.label([x0, 92], "resample #" + v.resample + ": 20 draws with replacement, " + NAME[v.statistic] + " " + api.fmt(k.oneStat, 3), {color: c.c3, size: 12, weight: 650});
      dots(k.one, 142, 6.5, 3, c.c3, 38);
      api.line([x0, 148], [x1, 148], {color: c.axis, width: 1});
      if (prop) {
        api.line([X(CUT) - 4, 24], [X(CUT) - 4, 150], {color: c.c6, width: 1.5, dash: "4 3"});
        api.label([x1, 10], "filled: 7 h or more", {color: c.c6, size: 12, anchor: "end"});
      }
      // the bootstrap distribution
      var lo = prop ? 0.3 : 6, hi = prop ? 1 : 8.4, P = function (q) { return x0 + (x1 - x0) * (Math.max(lo, Math.min(hi, q)) - lo) / (hi - lo); };
      // bins: resampled means sit on a 0.025 h grid, so 0.1 h bins hold four grid points each; medians (0.25 h grid) and
      // shares (0.05 grid) are discrete, so they get one narrow bar per possible value, with the gaps left showing
      var bw = {mean: 0.1, median: 0.25, proportion: 0.05}[v.statistic], drawW = {mean: 0.1, median: 0.12, proportion: 0.035}[v.statistic];
      var base = 288, top = 190, bins = {}, most = 0;
      k.th.forEach(function (t) { var b = v.statistic === "mean" ? Math.floor(t / bw + 1e-6) + 0.5 : Math.round(t / bw); bins[b] = (bins[b] || 0) + 1; most = Math.max(most, bins[b]); });
      api.label([x0, 168], v.B + " resampled values of the " + NAME[v.statistic], {color: c.muted, size: 12});
      var ciL = P(k.lo), ciR = P(k.hi);
      api.rect(ciL, top, ciR - ciL, base - top, {fill: c.c2, fillOpacity: 0.08, rx: 0});
      Object.keys(bins).forEach(function (b) {
        var hgt = (base - top) * bins[b] / most, cx = P(b * bw), w = (x1 - x0) * drawW / (hi - lo) - 1.5;
        api.rect(cx - w / 2, base - hgt, w, hgt, {fill: c.c2, fillOpacity: 0.7, rx: 1});
      });
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.3});
      var step = prop ? 0.1 : 0.5;
      for (var t = lo; t <= hi + 1e-9; t += step) {
        api.line([P(t), base], [P(t), base + 4], {color: c.axis, width: 1});
        api.label([P(t), base + 15], api.fmt(t, 1), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.line([P(k.obs), top - 8], [P(k.obs), base], {color: c.ink, width: 2});
      halo(api.label([P(k.obs) + 6, top - 4], "sample " + api.fmt(k.obs, 3), {color: c.ink, size: 12, weight: 650}));
      var xs = P(k.oneStat);
      api.polygon([[xs, base - 1], [xs - 6, base - 12], [xs + 6, base - 12]], {fill: c.c3, fillOpacity: 1});
      // the 95% percentile interval
      var yc = 318;
      api.line([ciL, yc], [ciR, yc], {color: c.c2, width: 2.5});
      [ciL, ciR].forEach(function (x) { api.line([x, yc - 5], [x, yc + 5], {color: c.c2, width: 2}); });
      api.label([(ciL + ciR) / 2, yc + 15], "middle 95%: " + f2(k.lo) + " to " + f2(k.hi), {color: c.c2, size: 12, weight: 650, anchor: "middle"});
    }
  });
})();
