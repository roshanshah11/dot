// Random sampling vs selection bias, on 120 snails whose shell lengths are fixed (a seeded generator, mean near 22 mm).
// A random sample gives every snail the same chance; "easiest to spot" picks snails with chance proportional to
// (length / 22)^3, the way an eye finds big shells first (weighted sampling without replacement, Efraimidis-Spirakis
// keys u^(1/w), using the same random numbers as the random method so only the rule differs). The histogram is the mean
// of 300 such samples: random samples centre on the true mean, biased ones centre too high (less so only as the sample nears the whole population).
// Dot's design: the queue gives no parameters; method, sample size and which sample drive the idea.
(function () {
  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var N = 120, COLS = 20, REPS = 300;
  var POP = (function () {
    var r = rng(20261017), out = [];
    for (var i = 0; i < N; i++) {
      var z = (r() + r() + r() + r() - 2) * Math.sqrt(3);    // roughly normal, SD 1
      out.push({len: Math.round(Math.max(8, Math.min(38, 22 + 5 * z)) * 10) / 10, jx: r() * 4 - 2, jy: r() * 4 - 2});
    }
    return out;
  })();
  var MU = POP.reduce(function (t, p) { return t + p.len; }, 0) / N;
  function sample(method, n, s) { // indices of the n snails picked in sample number s
    var r = rng(9973 * s + 17), keys = POP.map(function (p, i) {
      var u = r(), w = method === "biased" ? Math.pow(p.len / 22, 3) : 1;
      return [Math.pow(u, 1 / w), i];
    });
    keys.sort(function (a, b) { return b[0] - a[0]; });
    return keys.slice(0, n).map(function (k) { return k[1]; });
  }
  var meanOf = function (idx) { return idx.reduce(function (t, i) { return t + POP[i].len; }, 0) / idx.length; };
  var cache = {};
  function calc(v) {
    var key = v.method + v.n, means = cache[key];
    if (!means) { means = []; for (var s = 1; s <= REPS; s++) means.push(meanOf(sample(v.method, v.n, s))); cache[key] = means; }
    var pick = sample(v.method, v.n, v.sample), avg = means.reduce(function (t, x) { return t + x; }, 0) / REPS;
    var sd = Math.sqrt(means.reduce(function (t, x) { return t + (x - avg) * (x - avg); }, 0) / (REPS - 1));
    return {pick: pick, xbar: meanOf(pick), means: means, avg: avg, sd: sd, bias: avg - MU};
  }
  var sg = function (x) { return (x >= 0.05 ? "+" : x <= -0.05 ? "−" : "") + Viz.fmt(Math.abs(x), 1); };

  Viz.register("biological-random-sampling-and-selection-bias", {
    title: "Random sampling vs selection bias",
    subject: "stats",
    shows: "Sample snails at random or by picking the easiest to spot: random samples scatter around the true mean, biased ones land too high every time",
    params: {
      method: {kind: "enum", values: ["random", "biased"], default: "random", label: "\\text{method}", names: {random: "random", biased: "easiest to spot"}},
      n: {kind: "integer", default: 10, min: 5, max: 40, label: "n"},
      sample: {kind: "integer", default: 1, min: 1, max: 20, label: "\\text{sample}\\ \\#"}
    },
    formula: function (v) {
      var k = calc(v);
      var f2 = function (x) { return x.toFixed(2); }, b = Math.abs(k.bias) < 0.005 ? "0.00" : (k.bias > 0 ? "+" : "-") + f2(Math.abs(k.bias));
      return "\\begin{array}{l}\\bar x=" + f2(k.xbar) + "\\ \\text{mm (this sample)}\\\\[3pt]\\mu=" + f2(MU) + "\\ \\text{mm (all 120)}\\\\[3pt]E[\\bar x]-\\mu\\approx " +
        f2(k.avg) + "-" + f2(MU) + "=" + b + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), off = sg(k.xbar - MU);
      if (v.method === "random") return "Every snail had the same chance, so this sample is off by " + off + " mm by luck alone, and the " + REPS +
        " sample means centre on the true <b>" + Viz.fmt(MU, 1) + " mm</b> (spread " + Viz.fmt(k.sd, 1) + " mm, smaller as n grows).";
      return "Big shells are easier to spot, so the " + REPS + " sample means centre near " + Viz.fmt(k.avg, 1) + " mm, <b>" + sg(k.bias) +
        " mm</b> too high; taking more snails narrows the spread but does not fix the aim.";
    },
    examples: [
      {name: "method: easiest to spot", values: {method: "biased"}},
      {name: "small random samples", values: {method: "random", n: 5, sample: 20}},
      {name: "large biased samples", values: {method: "biased", n: 40}},
      {name: "large random samples", values: {method: "random", n: 40}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, k = calc(v), picked = {};
      var halo = function (t) { t.setAttribute("stroke", c.card); t.setAttribute("stroke-width", 4); t.setAttribute("paint-order", "stroke"); return t; };   // legible over bars
      k.pick.forEach(function (i) { picked[i] = true; });
      // the population: dot size is shell length, the sample is amber
      api.label([api.w / 2, 12], "120 snails (dot size = shell length), " + v.n + " sampled", {color: c.muted, size: 12, anchor: "middle"});
      POP.forEach(function (p, i) {
        var col = i % COLS, row = Math.floor(i / COLS), at = [29 + col * 18 + p.jx, 34 + row * 17 + p.jy], r = 2 + (p.len - 8) / 30 * 4.5;
        api.circle(at, r, picked[i] ? {fill: c.c3, stroke: c.c3, width: 1.5} : {fill: c.ink, fillOpacity: 0.28});
      });
      // the means of 300 samples taken the same way
      var x0 = 30, x1 = 380, lo = 14, hi = 34, X = function (q) { return x0 + (x1 - x0) * (Math.max(lo, Math.min(hi, q)) - lo) / (hi - lo); };
      var base = 268, top = 172, bins = {}, bw = 0.5, most = 0;
      k.means.forEach(function (m) { var b = Math.floor(Math.max(lo, Math.min(hi - 1e-9, m)) / bw); bins[b] = (bins[b] || 0) + 1; most = Math.max(most, bins[b]); });
      api.label([x0, 152], "mean shell length of each of " + REPS + " samples taken this way (mm)", {color: c.muted, size: 12});
      Object.keys(bins).forEach(function (b) {
        var h = (base - top) * bins[b] / most;
        api.rect(X(b * bw) + 0.5, base - h, X(b * bw + bw) - X(b * bw) - 1, h, {fill: c.c2, fillOpacity: 0.55, rx: 1});
      });
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.3});
      for (var t = lo; t <= hi; t += 2) {
        api.line([X(t), base], [X(t), base + 4], {color: c.axis, width: 1});
        api.label([X(t), base + 15], String(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.line([X(MU), top - 6], [X(MU), base], {color: c.c4, width: 2.2});
      var biasRight = k.avg >= MU;
      halo(api.label([X(MU) + (biasRight ? -6 : 6), top - 4], "true mean " + api.fmt(MU, 1), {color: c.c4, size: 12, weight: 650, anchor: biasRight ? "end" : "start"}));
      // this sample's mean on the axis
      var xs = X(k.xbar);
      api.polygon([[xs, base - 1], [xs - 6, base - 12], [xs + 6, base - 12]], {fill: c.c3, fillOpacity: 1});
      // the bias: from the true mean to the centre of the histogram
      var yb = 304;
      if (Math.abs(X(k.avg) - X(MU)) > 14) {
        api.arrow([X(MU), yb], [X(k.avg), yb], {color: c.c5, width: 2.5, halo: false});
        api.label([X(k.avg) + (biasRight ? 8 : -8), yb], "bias " + sg(k.bias) + " mm", {color: c.c5, size: 12.5, weight: 700, anchor: biasRight ? "start" : "end"});
      } else {
        api.label([X(MU), yb], "centred on the truth (bias " + (k.bias < 0 ? "−" : "+") + Math.abs(k.bias).toFixed(2) + " mm, chance)", {color: c.c4, size: 12.5, weight: 650, anchor: "middle"});
      }
      halo(api.label([xs + (xs > X(MU) ? 8 : -8), base - 22], "this sample " + api.fmt(k.xbar, 1), {color: c.c3, size: 12, weight: 700, anchor: xs > X(MU) ? "start" : "end"}));
    }
  });
})();
