// A standard score is a position measured with a different ruler. The normal curve N(mu, sigma^2) sits on the raw x
// axis; underneath it a second ruler has its 0 at mu and one unit every sigma, so reading x off that ruler gives
// z = (x - mu) / sigma directly. The shaded area left of x is the share of the distribution below it, Phi(z)
// (normal CDF from the Abramowitz-Stegun 7.1.26 erf approximation, error below 1.5e-7). Drag the x handle or use
// the sliders.
(function () {
  function erf(x) {
    var s = x < 0 ? -1 : 1, t; x = Math.abs(x); t = 1 / (1 + 0.3275911 * x);
    return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
  }
  // probabilities are read at z rounded to 2 decimals, the way a z table is used, so the formula's numbers agree
  function Phi(z) { z = Math.round(z * 100) / 100; return 0.5 * (1 + erf(z / Math.SQRT2)); }
  function pctText(p) { return p > 0.9999 ? "more than 99.99%" : p < 0.0001 ? "less than 0.01%" : Viz.fmt(p * 100, p > 0.999 || p < 0.001 ? 2 : 1) + "%"; }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };

  Viz.register("standard-score-z", {
    title: "Standard score (z-score)",
    subject: "stats",
    shows: "Move x, μ and σ: the z ruler starts at the mean and counts in standard deviations, so z is where x lands on it",
    params: {
      // defaults with mu off zero and sigma off one, so the z ruler visibly differs from the x axis in origin and unit
      x: {kind: "number", default: 3.1, min: -4, max: 4, step: 0.1, label: "x"},
      mu: {kind: "number", default: 1, min: -1.5, max: 1.5, step: 0.1, label: "\\mu"},
      sigma: {kind: "number", default: 1.5, min: 0.4, max: 1.8, step: 0.05, label: "\\sigma"}
    },
    formula: function (v) {
      var z = (v.x - v.mu) / v.sigma;
      return "\\begin{array}{l}z=\\dfrac{x-\\mu}{\\sigma}=\\dfrac{" + Viz.n(v.x) + "-" + Viz.p(v.mu) + "}{" + Viz.n(v.sigma) + "}=" + Viz.n(z, 2) + "\\\\" +
        "P(Z<z)=\\Phi(" + Viz.n(z, 2) + ")=" + Viz.n(Phi(z), 4) + "\\end{array}";
    },
    status: function (v) {
      var z = (v.x - v.mu) / v.sigma, p = Phi(z);
      if (Math.abs(z) < 0.005) return "x equals the mean, so <b>z = 0</b>: exactly half the distribution lies below it.";
      return "x = " + f(v.x) + " sits <b>" + f(Math.abs(z)) + " standard deviation" + (Math.abs(z) === 1 ? "" : "s") + " " + (z > 0 ? "above" : "below") +
        "</b> the mean, so <b>" + pctText(p) + "</b> of the distribution lies below it.";
    },
    examples: [
      {name: "x = 3.1, μ = 1, σ = 1.5: z = 1.4", values: {x: 3.1, mu: 1, sigma: 1.5}},
      {name: "at the mean", values: {x: 1, mu: 1, sigma: 1.5}},
      {name: "narrow spread, far out", values: {x: 4, mu: -1.5, sigma: 0.4}},
      {name: "wide spread, below the mean", values: {x: -2, mu: 1, sigma: 1.8}},
      {name: "Minimum supported values", values: {x: -4, mu: -1.5, sigma: 0.4}},
      {name: "Maximum supported values", values: {x: 4, mu: 1.5, sigma: 1.8}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, x0 = 22, x1 = 382, base = 164, top = 46, zr = 238;
      var X = function (x) { return x0 + (x1 - x0) * (x + 5) / 10; }, inv = function (px) { return (px - x0) / (x1 - x0) * 10 - 5; };
      var peak = 1 / (v.sigma * Math.sqrt(2 * Math.PI)), Y = function (d) { return base - (base - top) * d / peak; };
      var z = (v.x - v.mu) / v.sigma, pdf = function (x) { var u = (x - v.mu) / v.sigma; return Math.exp(-u * u / 2) / (v.sigma * Math.sqrt(2 * Math.PI)); };
      // the curve, and the area below x
      var pts = [], area = [[X(-5), base]];
      for (var i = 0; i <= 300; i++) { var xx = -5 + 10 * i / 300; pts.push([X(xx), Y(pdf(xx))]); if (xx <= v.x) area.push([X(xx), Y(pdf(xx))]); }
      area.push([X(v.x), Y(pdf(v.x))], [X(v.x), base]);
      api.polygon(area, {fill: c.c2, fillOpacity: 0.3, stroke: "none"});
      api.polyline(pts, {stroke: c.c2, width: 2.2});
      api.label([x0, 12], pctText(Phi(z)) + " of the area lies left of x", {color: c.c2, size: 12.5, weight: 650});
      // the mean
      api.line([X(v.mu), base], [X(v.mu), Y(pdf(v.mu)) - 4], {color: c.ink, width: 1.4, dash: "4 3"});
      api.label([X(v.mu), Y(pdf(v.mu)) - 12], "μ = " + f(v.mu), {color: c.ink, size: 12.5, anchor: "middle"});
      // raw x axis
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.2});
      for (var t = -4; t <= 4; t++) {
        api.line([X(t), base], [X(t), base + 4], {color: c.axis, width: 1});
        api.label([X(t), base + 14], api.fmt(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x0, base + 14], "x", {color: c.muted, size: 12.5, italic: true});
      // x - mu, as a bracket between the axes
      var by = 196;
      if (Math.abs(v.x - v.mu) > 1e-9) {
        api.line([X(v.mu), by], [X(v.x), by], {color: c.c3, width: 2});
        [v.mu, v.x].forEach(function (q) { api.line([X(q), by - 4], [X(q), by + 4], {color: c.c3, width: 2}); });
        var right = v.x > v.mu, room = Math.abs(X(v.x) - X(v.mu)) > 80;
        api.label(room ? [(X(v.mu) + X(v.x)) / 2, by + 12] : [X(v.mu) + (right ? -8 : 8), by], "x − μ = " + f(v.x - v.mu),
          {color: c.c3, size: 12.5, weight: 650, anchor: room ? "middle" : right ? "end" : "start"});
      }
      // the z ruler: 0 at mu, one unit per sigma
      api.line([x0, zr], [x1, zr], {color: c.c4, width: 1.6});
      var kLo = Math.ceil((-5 - v.mu) / v.sigma), kHi = Math.floor((5 - v.mu) / v.sigma), every = v.sigma * 36 < 24 ? 2 : 1;
      api.line([X(v.mu), zr], [X(v.mu + v.sigma), zr], {color: c.c4, width: 5});
      api.label([X(v.mu + v.sigma / 2), zr - 11], "σ", {color: c.c4, size: 12.5, weight: 650, anchor: "middle"});
      for (var k = kLo; k <= kHi; k++) {
        api.line([X(v.mu + k * v.sigma), zr - 5], [X(v.mu + k * v.sigma), zr + 5], {color: c.c4, width: k === 0 ? 2 : 1.2});
        if (k % every === 0) api.label([X(v.mu + k * v.sigma), zr + 16], api.fmt(k), {color: c.c4, size: 12, anchor: "middle"});
      }
      api.label([x0, zr - 11], "z", {color: c.c4, size: 12.5, italic: true, weight: 650});
      // x read off both rulers: the reading line breaks across the x tick labels, and across the sigma label when it
      // passes through it, so it never strikes a number
      var gaps = [[base, by - 6]], sx = X(v.mu + v.sigma / 2);
      if (Math.abs(X(v.x) - sx) < 10) gaps.push([zr - 19, zr - 4]);
      var y0 = Y(pdf(v.x));
      gaps.concat([[zr + 6, zr + 6]]).forEach(function (g) {
        if (g[0] > y0 + 1) api.line([X(v.x), y0], [X(v.x), g[0]], {color: c.c1, width: 1.6, dash: "5 3"});
        y0 = g[1];
      });
      api.circle([X(v.x), zr], 5, {fill: c.c1, fillOpacity: 1, stroke: c.card, width: 1.5});
      api.label([X(v.x), zr + 38], "z = " + f(z), {color: c.c1, size: 13, weight: 700, anchor: "middle"});
      api.handle([X(v.x), base], {color: c.c1, label: "x", onDrag: function (q) {
        api.set({x: Math.round(Math.max(-4, Math.min(4, inv(q[0]))) * 10) / 10});
      }});
    }
  });
})();
