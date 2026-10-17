// The central limit theorem by simulation. A population on 0..10 (blue) is sampled n at a time; one sample's draws
// and its mean are shown under it, and the amber histogram holds the means of 2,000 such samples (a fixed seed per
// shape, so the picture is repeatable). The teal curve is the normal the theorem predicts, N(mu, sigma^2 / n), on the
// same axis. Each population is a piecewise-constant density on 200 cells of width 0.05 (draws are uniform inside a
// cell), and mu, sigma, skewness and kurtosis are computed from that same density, so the numbers match the sampler.
// Means of n draws have skewness gamma1/sqrt(n) and excess kurtosis gamma2/n exactly; the status uses those to say
// how close to normal the means are.
(function () {
  var H = 0.05, NC = 200, R = 2000;
  var SHAPES = ["right-skewed", "uniform", "bimodal", "normal"];
  var DENS = {
    "right-skewed": function (x) { return x * Math.exp(-x / 1.1); },                // gamma, shape 2, scale 1.1
    "uniform": function () { return 1; },
    "bimodal": function (x) { return Math.exp(-0.5 * Math.pow((x - 2.5) / 0.9, 2)) + Math.exp(-0.5 * Math.pow((x - 7.5) / 0.9, 2)); },
    "normal": function (x) { return Math.exp(-0.5 * Math.pow((x - 5) / 1.5, 2)); }
  };
  var popCache = {}, simCache = {};
  function pop(shape) {
    if (popCache[shape]) return popCache[shape];
    var f = DENS[shape], w = [], tot = 0, cum = [], s = 0, i, j;
    for (i = 0; i < NC; i++) { w.push(f((i + 0.5) * H)); tot += w[i]; }
    w = w.map(function (q) { return q / tot; });
    w.forEach(function (q) { s += q; cum.push(s); });
    var mu = 0, m2 = 0, m3 = 0, m4 = 0;
    for (i = 0; i < NC; i++) mu += w[i] * (i + 0.5) * H;
    for (i = 0; i < NC; i++) for (j = 0; j < 8; j++) {
      var d = (i + (j + 0.5) / 8) * H - mu, q = w[i] / 8;
      m2 += q * d * d; m3 += q * d * d * d; m4 += q * d * d * d * d;
    }
    return (popCache[shape] = {w: w, cum: cum, mu: mu, sd: Math.sqrt(m2), skew: m3 / Math.pow(m2, 1.5), kurt: m4 / (m2 * m2) - 3});
  }
  function sim(shape, n) {
    var key = shape + "|" + n;
    if (simCache[key]) return simCache[key];
    var P = pop(shape), seed = 101 + SHAPES.indexOf(shape) * 7919;
    function rnd() { seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    function draw() {
      var u = rnd(), lo = 0, hi = NC - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (P.cum[mid] >= u) hi = mid; else lo = mid + 1; }
      return (lo + rnd()) * H;
    }
    var means = [], first = [], s1 = 0, s2 = 0;
    for (var r = 0; r < R; r++) {
      var sum = 0;
      for (var k = 0; k < n; k++) { var x = draw(); sum += x; if (r === 0) first.push(x); }
      means.push(sum / n); s1 += sum / n; s2 += (sum / n) * (sum / n);
    }
    var m = s1 / R;
    return (simCache[key] = {means: means, first: first, mean: m, sd: Math.sqrt((s2 - R * m * m) / (R - 1))});
  }
  var f2 = function (x) { return Viz.fmt(x, 2); };

  Viz.register("central-limit-theorem", {
    title: "The central limit theorem",
    subject: "stats",
    shows: "Pick a population and a sample size: the means of many samples pile up in a normal shape centred on μ, with spread σ/√n, whatever the population looks like",
    params: {
      population_shape: {kind: "enum", values: SHAPES, default: "right-skewed", label: "\\text{shape}"},
      sample_size: {kind: "integer", default: 5, min: 1, max: 100, label: "n"}
    },
    formula: function (v) {
      var P = pop(v.population_shape), se = P.sd / Math.sqrt(v.sample_size);
      return "\\begin{array}{l}\\mu_{\\bar x}=\\mu=" + Viz.n(P.mu, 2) + "\\\\[3pt]\\sigma_{\\bar x}=\\dfrac{\\sigma}{\\sqrt{n}}=\\dfrac{" + Viz.n(P.sd, 2) +
        "}{\\sqrt{" + v.sample_size + "}}=" + Viz.n(se, 2) + "\\end{array}";
    },
    status: function (v) {
      var P = pop(v.population_shape), n = v.sample_size, se = P.sd / Math.sqrt(n), sk = P.skew / Math.sqrt(n), ku = P.kurt / n;
      if (v.population_shape === "normal") return "A normal population gives exactly normal means at every n; only the spread shrinks, here to σ/√n = <b>" + f2(se) + "</b>.";
      if (n === 1) return "With n = 1 each mean is a single draw, so the 2,000 means simply copy the " + v.population_shape + " population.";
      var stat = v.population_shape === "right-skewed" ? "skewness " + f2(P.skew) + "/√" + n + " = <b>" + f2(sk) + "</b>" : "excess kurtosis " + f2(P.kurt) + "/" + n + " = <b>" + f2(ku) + "</b>";
      if (Math.abs(sk) < 0.3 && Math.abs(ku) < 0.35) return "Means of " + n + " are already close to normal (" + stat + "), centred on μ = " + f2(P.mu) + " with spread <b>" + f2(se) + "</b>.";
      return "Means of " + n + " are not normal yet (" + stat + ", a trace of the " + (v.population_shape === "uniform" ? "flat" : v.population_shape === "bimodal" ? "two-humped" : "skewed") +
        " population), though their spread is already down to <b>" + f2(se) + "</b>.";
    },
    examples: [
      {name: "Minimum supported values", values: {population_shape: "right-skewed", sample_size: 1}},
      {name: "Maximum supported values", values: {population_shape: "normal", sample_size: 100}},
      {name: "two dice-like draws make a triangle", values: {population_shape: "uniform", sample_size: 2}},
      {name: "bimodal, n = 30", values: {population_shape: "bimodal", sample_size: 30}},
      {name: "skewed, n = 30", values: {population_shape: "right-skewed", sample_size: 30}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, n = v.sample_size, P = pop(v.population_shape), S = sim(v.population_shape, n), se = P.sd / Math.sqrt(n);
      var x0 = 24, x1 = 384, X = function (x) { return x0 + (x1 - x0) * x / 10; };
      // a centred label on a card-coloured plate (placed where api.label's clamp will put it, so the two line up)
      var plate = function (at, text, col, sz, wt, op) {
        var w = text.length * sz * 0.56, cx = Math.max(w / 2 + 3, Math.min(api.w - w / 2 - 3, at[0]));
        api.rect(cx - w / 2 - 4, at[1] - sz * 0.75, w + 8, sz * 1.5, {fill: c.card, fillOpacity: op, rx: 4});
        api.label([cx, at[1]], text, {color: col, size: sz, weight: wt, anchor: "middle"});
      };
      // the population
      var pTop = 26, pBase = 84, wMax = Math.max.apply(null, P.w);
      api.label([x0, 12], "population: " + v.population_shape + ", μ = " + f2(P.mu) + " (dashed), σ = " + f2(P.sd), {color: c.c2, size: 12.5, weight: 650});
      // drawn smooth through the cell centres (the cells are 0.05 wide, finer than a pixel and a half)
      var pts = [[X(0), pBase], [X(0), pBase - (pBase - pTop) * P.w[0] / wMax]];
      P.w.forEach(function (q, i) { pts.push([X((i + 0.5) * H), pBase - (pBase - pTop) * q / wMax]); });
      pts.push([X(10), pBase - (pBase - pTop) * P.w[NC - 1] / wMax], [X(10), pBase]);
      api.polygon(pts, {fill: c.c2, fillOpacity: 0.2, stroke: c.c2, width: 1.6});
      api.line([X(0), pBase], [X(10), pBase], {color: c.axis, width: 1});
      // one sample of n and its mean
      var ys = 96;
      S.first.forEach(function (x, i) { api.circle([X(x), ys + ((i * 5) % 3 - 1) * 4], 2.4, {fill: c.c2, fillOpacity: 0.8}); });
      var m0 = S.first.reduce(function (a, b) { return a + b; }, 0) / n;
      api.line([X(m0), ys - 9], [X(m0), ys + 9], {color: c.c3, width: 3});
      plate([X(m0), ys + 17], (n === 1 ? "one draw, its own mean " : "one sample of " + n + ", its mean ") + f2(m0), c.c3, 12, 600, 1);
      // the means of 2,000 samples
      var hTop = 166, hBase = 274;
      api.label([x0, 138], "means of 2,000 samples of " + n + ": their SD is " + f2(S.sd), {color: c.c3, size: 12.5, weight: 650});
      api.label([x0, 154], "normal curve the CLT predicts: SD σ/√n = " + f2(se), {color: c.c1, size: 12.5, weight: 650});
      var nb = Math.max(10, Math.min(200, Math.round(10 * 3.5 / se))), bw = 10 / nb, counts = [];
      for (var b = 0; b < nb; b++) counts.push(0);
      S.means.forEach(function (x) { counts[Math.min(nb - 1, Math.floor(x / bw))]++; });
      var dens = counts.map(function (k) { return k / (R * bw); }), peak = 1 / (se * Math.sqrt(2 * Math.PI));
      var top = Math.max(peak, Math.max.apply(null, dens)), Yd = function (d) { return hBase - (hBase - hTop) * d / top; };
      var hp = [[X(0), hBase]];
      dens.forEach(function (d, i) { hp.push([X(i * bw), Yd(d)], [X((i + 1) * bw), Yd(d)]); });
      hp.push([X(10), hBase]);
      api.polygon(hp, {fill: c.c3, fillOpacity: 0.3, stroke: c.c3, width: 1.2});
      var curve = [];
      for (var t = -4; t <= 4.0001; t += 0.05) {
        var x = P.mu + t * se;
        if (x >= 0 && x <= 10) curve.push([X(x), Yd(peak * Math.exp(-t * t / 2))]);
      }
      api.polyline(curve, {stroke: c.c1, width: 2.2});
      // the ±1 SE span at the curve's inflection height: arrows when there is room, a capped bar on a narrow spike,
      // and named either way so the narrow bump at large n still reads
      var yb = Yd(peak * Math.exp(-0.5)), sa = X(P.mu - se), sb = X(P.mu + se), lt = "±σ/√n";
      if (sb - sa > 16) api.line([sa, yb], [sb, yb], {color: c.c1, width: 1.6, arrow: true, arrowStart: true});
      else {
        api.line([sa, yb], [sb, yb], {color: c.c1, width: 1.6});
        [sa, sb].forEach(function (e) { api.line([e, yb - 4], [e, yb + 4], {color: c.c1, width: 1.6}); });
      }
      plate([sb + 10 + lt.length * 12 * 0.28, yb], lt, c.c1, 12, 650, 0.85);
      // mu, dashed, in two pieces that skip the label band between the population and the histogram
      api.line([X(P.mu), pTop - 2], [X(P.mu), pBase + 4], {color: c.ink, width: 1.2, dash: "4 4", opacity: 0.55});
      api.line([X(P.mu), hTop - 4], [X(P.mu), hBase], {color: c.ink, width: 1.2, dash: "4 4", opacity: 0.55});
      api.line([X(0), hBase], [X(10), hBase], {color: c.axis, width: 1.2});
      for (var k = 0; k <= 10; k += 2) {
        api.line([X(k), hBase], [X(k), hBase + 4], {color: c.axis, width: 1});
        api.label([X(k), hBase + 15], String(k), {color: c.muted, size: 12, anchor: "middle"});
      }
    }
  });
})();
