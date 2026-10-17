// Population standard deviation of eight values. The values keep one fixed pattern around the mean mu = 50 (deviations
// -4, -3, -1, -1, 1, 2, 3, 3 at sigma = 2.5, whose squares 16 + 9 + 1 + 1 + 1 + 4 + 9 + 9 sum to 50) and are stretched
// so their spread matches the slider; the widget then computes every deviation, every square and sigma from the values
// themselves (sigma comes back equal to the slider). Top: each value on its own row with its deviation from the mean
// drawn as a segment, and the band mu +/- sigma. Bottom: the square on each deviation, with its area (x - mu)^2 written
// under it, and their average square, whose area is the variance and whose side is sigma. The squares are drawn at one
// scale per setting, chosen so the largest is about 60 px: areas are to scale with each other, not with the number line.
(function () {
  var MU = 50, PATTERN = [-4, -3, -1, -1, 1, 2, 3, 3]; // mean 0, population SD sqrt(50 / 8) = 2.5
  function calc(v) {
    var s0 = Math.sqrt(PATTERN.reduce(function (a, z) { return a + z * z; }, 0) / PATTERN.length);
    var xs = PATTERN.map(function (z) { return MU + v.sigma * z / s0; }), n = xs.length;
    var mean = xs.reduce(function (a, x) { return a + x; }, 0) / n;
    var dev = xs.map(function (x) { return x - mean; }), ss = dev.reduce(function (a, d) { return a + d * d; }, 0);
    var sd = Math.sqrt(ss / n);
    return {xs: xs, n: n, mean: mean, dev: dev, ss: ss, vr: ss / n, sd: sd,
            inside: dev.filter(function (d) { return Math.abs(d) <= sd + 1e-9; }).length};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };
  // rendered width of a short number at 12 px: digits about 7 px, the point and the minus narrower
  function tw(s) { return String(s).replace(/[.−\/ ]/g, "").length * 7 + (String(s).length - String(s).replace(/[.−\/ ]/g, "").length) * 4; }

  Viz.register("standard-deviation", {
    title: "Standard deviation: the root mean square distance",
    subject: "stats",
    shows: "Slide σ: the values spread out, each squared distance from the mean grows, and σ is the side of the average square",
    params: {
      sigma: {kind: "number", default: 2.5, min: 0, max: 3, step: 0.1, label: "\\sigma"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\sigma=\\sqrt{\\tfrac{1}{N}\\sum_{i=1}^{N}(x_i-\\mu)^2}\\\\\\quad=\\sqrt{\\tfrac{" + Viz.n(k.ss, 2) + "}{" + k.n + "}}=\\sqrt{" +
        Viz.n(k.vr, 3) + "}=" + Viz.n(k.sd, 2) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (k.sd < 1e-9) return "Every value equals the mean " + MU + ", so every deviation is 0 and <b>σ = 0</b>: no spread at all.";
      return "The squared distances from μ average <b>" + f(k.vr, 3) + "</b> (the variance), so σ = √" + f(k.vr, 3) + " = <b>" + f(k.sd) + "</b>; " +
        k.inside + " of the " + k.n + " values lie within one σ of the mean.";
    },
    examples: [
      {name: "Minimum supported values", values: {sigma: 0}},
      {name: "Maximum supported values", values: {sigma: 3}},
      {name: "tight spread", values: {sigma: 0.5}},
      {name: "σ = 1.7: areas with decimals", values: {sigma: 1.7}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 24, x1 = 376, ax = 134;
      var X = function (x) { return x0 + (x1 - x0) * (x - (MU - 5)) / 10; };
      var rowY = function (i) { return 26 + i * 12; };
      // the band mu +/- sigma
      if (k.sd > 1e-9) {
        api.rect(X(k.mean - k.sd), 18, X(k.mean + k.sd) - X(k.mean - k.sd), ax - 18, {fill: c.c3, fillOpacity: 0.12, rx: 2});
        api.line([X(k.mean), 122], [X(k.mean + k.sd), 122], {color: c.c3, width: 2});
        [k.mean, k.mean + k.sd].forEach(function (x) { api.line([X(x), 117], [X(x), 127], {color: c.c3, width: 2}); });
        api.label([X(k.mean + k.sd) + 6, 122], "σ = " + f(k.sd), {color: c.c3, size: 12.5, weight: 650});
      }
      // the mean
      api.line([X(k.mean), 16], [X(k.mean), ax], {color: c.ink, width: 2});
      api.label([X(k.mean) - 6, 12], "μ = " + f(k.mean), {color: c.ink, size: 12.5, weight: 650, anchor: "end"});
      // each value on its own row, with its deviation from the mean
      k.xs.forEach(function (x, i) {
        var y = rowY(i), inside = Math.abs(k.dev[i]) <= k.sd + 1e-9;
        if (Math.abs(k.dev[i]) > 1e-9) api.line([X(k.mean), y], [X(x), y], {color: c.c2, width: 2.2});
        api.circle([X(x), y], 4.2, inside ? {fill: c.c2, fillOpacity: 1} : {fill: c.card, fillOpacity: 1, stroke: c.c2, width: 2});
      });
      // number line
      api.line([x0 - 6, ax], [x1 + 6, ax], {color: c.axis, width: 1.2});
      for (var t = MU - 5; t <= MU + 5; t++) {
        api.line([X(t), ax], [X(t), ax + 4], {color: c.axis, width: 1});
        api.label([X(t), ax + 14], String(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      // squares on the deviations (left of x = 312), then their average (the column centered at 354)
      var base = 270, gap = 5, rowL = 12, rowR = 312, acx = 354;
      api.label([rowL, 182], "(x − μ)² as squares, areas to scale with each other", {color: c.muted, size: 12});
      if (k.sd < 1e-9) {
        for (var z = 0; z < k.n; z++) api.circle([rowL + 6 + z * 18, base - 2], 2.2, {fill: c.c2, fillOpacity: 0.8});
        api.label([rowL, base - 22], "every square has area 0, so the average is 0", {color: c.c3, size: 12, weight: 650});
        return;
      }
      var areas = k.dev.map(function (d) { return d * d; }), labs = areas.map(function (a) { return f(a); });
      var maxDev = Math.max.apply(null, k.dev.map(Math.abs)), M, S, widths;
      // the largest scale (up to 62 px for the biggest square) at which every square and its area label fit the row
      for (M = 62; M > 24; M--) {
        S = M / maxDev;
        widths = k.dev.map(function (d, i) { return Math.max(Math.abs(d) * S, tw(labs[i]) + 2); });
        if (rowL + widths.reduce(function (a, w) { return a + w; }, 0) + gap * (k.n - 1) <= rowR) break;
      }
      var x = rowL;
      k.dev.forEach(function (d, i) {
        var side = Math.abs(d) * S, cx = x + widths[i] / 2;
        api.rect(cx - side / 2, base - side, side, side, {fill: c.c2, fillOpacity: 0.28, stroke: c.c2, width: 1.2, rx: 1});
        api.label([cx, base + 13], labs[i], {color: c.c2, size: 12, weight: 600, anchor: "middle"});
        x += widths[i] + gap;
      });
      // the average square: area ss / N, side sigma
      var side = k.sd * S, top = base - side;
      api.label([acx - side / 2 - 5, base - side / 2], "→", {color: c.muted, size: 15, anchor: "end"});
      api.rect(acx - side / 2, top, side, side, {fill: c.c3, fillOpacity: 0.5, stroke: c.c3, width: 1.6, rx: 1});
      api.label([acx, base - side / 2], f(k.vr), {color: c.ink, size: 12, weight: 700, anchor: "middle"});
      api.label([acx, top - 9], f(k.ss) + "/" + k.n + " =", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      api.label([acx, top - 24], "average", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      api.label([acx, base + 13], "side " + f(k.sd), {color: c.c3, size: 12, weight: 650, anchor: "middle"});
    }
  });
})();
