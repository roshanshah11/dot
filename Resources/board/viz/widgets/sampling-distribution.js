// The sampling distribution of the sample mean, drawn exactly (no simulation). Top: the population, normal or
// right-skewed, with mean mu and SD sigma. Bottom: the distribution of x-bar for samples of n, on the same axis:
// centred on mu with SD sigma / sqrt n. The normal case is exact: x-bar ~ N(mu, sigma^2 / n). The right-skewed
// population is a shifted gamma with shape 2, X = mu - sigma*sqrt2 + (sigma/sqrt2)*G, G ~ Gamma(2, 1), which has mean
// mu, SD sigma and skewness sqrt2; the mean of n such draws is again a shifted gamma, with shape 2n, so its exact density
// is drawn, next to the dashed normal the central limit theorem says it approaches (its skewness is sqrt2 / sqrt n).
// Each panel is scaled to its own peak; the axis is in the population's units, so mu and sigma move the tick values.
(function () {
  var KS = 2;   // gamma shape of the skewed population
  function lgamma(z) {   // Lanczos, g = 7
    var g = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    z -= 1; var x = g[0];
    for (var i = 1; i < 9; i++) x += g[i] / (z + i);
    var t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function normal(x, m, s) { var z = (x - m) / s; return Math.exp(-0.5 * z * z) / (s * Math.sqrt(2 * Math.PI)); }
  function shiftedGamma(x, a, b, shape) { var u = (x - a) / b; return u <= 0 ? 0 : Math.exp((shape - 1) * Math.log(u) - u - lgamma(shape)) / b; }
  // densities in standardized units z = (x - mu) / sigma, so the picture is exact at any mu and sigma
  function popZ(z, shape) { return shape === "normal" ? normal(z, 0, 1) : shiftedGamma(z, -Math.SQRT2, 1 / Math.SQRT2, KS); }
  function meanZ(z, shape, n) { return shape === "normal" ? normal(z, 0, 1 / Math.sqrt(n)) : shiftedGamma(z, -Math.SQRT2, 1 / (Math.SQRT2 * n), KS * n); }
  function sig(x) {   // three significant figures
    var a = Math.abs(x); if (!a) return "0";
    return Viz.fmt(x, Math.max(0, Math.min(5, 2 - Math.floor(Math.log10(a)))));
  }

  Viz.register("sampling-distribution", {
    title: "Sampling distribution of the mean",
    subject: "stats",
    shows: "Set the population and the sample size: the means of samples are centred on μ and spread σ/√n, and even a skewed population gives nearly normal means once n is large",
    params: {
      population_shape: {kind: "enum", values: ["normal", "right-skewed"], default: "normal", label: "\\text{shape}"},
      population_mean: {kind: "number", default: 50, min: -10000, max: 10000, step: 1, label: "\\mu"},
      population_standard_deviation: {kind: "number", default: 12, min: 0.1, max: 1000, step: 0.1, label: "\\sigma"},
      sample_size: {kind: "integer", default: 10, min: 2, max: 100, label: "n"}
    },
    formula: function (v) {
      var se = v.population_standard_deviation / Math.sqrt(v.sample_size);
      return "\\begin{array}{l}\\mu_{\\bar x}=\\mu=" + Viz.n(v.population_mean, 2) + "\\\\[6pt]\\sigma_{\\bar x}=\\dfrac{\\sigma}{\\sqrt{n}}=\\dfrac{" +
        sig(v.population_standard_deviation).replace("−", "-") + "}{\\sqrt{" + v.sample_size + "}}=" + sig(se).replace("−", "-") + "\\end{array}";
    },
    status: function (v) {
      var n = v.sample_size, se = v.population_standard_deviation / Math.sqrt(n), shrink = Viz.fmt(Math.sqrt(n), 2), sk = Math.SQRT2 / Math.sqrt(n);
      var centre = "centred on μ = " + Viz.fmt(v.population_mean, 2) + " with SD <b>" + sig(se) + "</b>, " + shrink + " times narrower than single values";
      if (v.population_shape === "normal") return "Means of samples of " + n + " are exactly normal, " + centre + ".";
      return "Means of " + n + " from this skewed population have skewness 1.41/√" + n + " = <b>" + Viz.fmt(sk, 2) + "</b>" +
        (sk < 0.25 ? ", already close to the dashed normal, " : sk < 0.6 ? ", slightly skewed, " : ", still visibly skewed, ") + centre + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {population_mean: -10000, population_standard_deviation: 0.1, sample_size: 2}},
      {name: "Maximum supported values", values: {population_mean: 10000, population_standard_deviation: 1000, sample_size: 100}},
      {name: "population_shape: right-skewed", values: {population_shape: "right-skewed"}},
      {name: "skewed, n = 2", values: {population_shape: "right-skewed", sample_size: 2}},
      {name: "skewed, n = 100", values: {population_shape: "right-skewed", sample_size: 100}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, mu = v.population_mean, sd = v.population_standard_deviation, n = v.sample_size, shape = v.population_shape;
      var skew = shape !== "normal", zr = skew ? [-2.5, 5.5] : [-4, 4], x0 = 20, x1 = 384;
      var X = function (z) { return x0 + (x1 - x0) * (z - zr[0]) / (zr[1] - zr[0]); }, se = 1 / Math.sqrt(n);
      function curve(f, base, top, peak, o) {
        var pts = [];
        for (var i = 0; i <= 600; i++) { var z = zr[0] + (zr[1] - zr[0]) * i / 600; pts.push([X(z), base - (base - top) * Math.min(1.02, f(z) / peak)]); }
        if (o.fill) api.polygon([[X(zr[0]), base]].concat(pts, [[X(zr[1]), base]]), {fill: o.fill, fillOpacity: 0.2});
        api.polyline(pts, {stroke: o.stroke, width: o.width || 2, dash: o.dash});
      }
      function peakOf(f) { var m = 0; for (var i = 0; i <= 1200; i++) m = Math.max(m, f(zr[0] + (zr[1] - zr[0]) * i / 1200)); return m; }
      function span(base, top, peak, f, half, col, text) {   // a +-1 SD arrow at 60% of the panel height
        var y = base - (base - top) * 0.45, a = X(-half), b = X(half);
        if (b - a > 18) api.line([a, y], [b, y], {color: col, width: 1.6, arrow: true, arrowStart: true});
        else { api.line([a, y], [b, y], {color: col, width: 1.6}); [a, b].forEach(function (e) { api.line([e, y - 4], [e, y + 4], {color: col, width: 1.6}); }); }
        api.label([b + 8, y], text, {color: col, size: 12, weight: 650});
      }
      // population
      var pT = 30, pB = 104, pf = function (z) { return popZ(z, shape); }, pp = peakOf(pf);
      api.label([x0, 12], "population, " + shape + ": μ = " + sig(mu) + ", σ = " + sig(sd), {color: c.c2, size: 12.5, weight: 650});
      curve(pf, pB, pT, pp, {fill: c.c2, stroke: c.c2});
      span(pB, pT, pp, pf, 1, c.c2, "±σ");
      api.line([X(zr[0]), pB], [X(zr[1]), pB], {color: c.axis, width: 1});
      // sampling distribution of the mean
      var mT = 146, mB = 236, mf = function (z) { return meanZ(z, shape, n); }, nf = function (z) { return normal(z, 0, se); };
      var mp = Math.max(peakOf(mf), skew ? peakOf(nf) : 0);
      api.label([x0, 128], "sample means x̄, n = " + n + ": centre μ, SD σ/√n = " + sig(sd * se), {color: c.c3, size: 12.5, weight: 650});
      curve(mf, mB, mT, mp, {fill: c.c3, stroke: c.c3});
      if (skew) {
        curve(nf, mB, mT, mp, {stroke: c.c1, width: 1.6, dash: "5 4"});
        api.label([x1, 146], "dashed: normal, same μ and SD", {color: c.c1, size: 12, anchor: "end"});
      }
      span(mB, mT, mp, mf, se, c.c3, "±σ/√n");
      // mu, dashed, in two pieces that skip the label band between the panels
      api.line([X(0), pT - 4], [X(0), pB + 4], {color: c.ink, width: 1.2, dash: "4 4", opacity: 0.55});
      api.line([X(0), mT - 6], [X(0), mB], {color: c.ink, width: 1.2, dash: "4 4", opacity: 0.55});
      // the shared axis, in population units
      var ya = 248;
      api.line([X(zr[0]), ya], [X(zr[1]), ya], {color: c.axis, width: 1.2});
      var dec = Math.max(0, Math.min(3, 1 - Math.floor(Math.log10(sd))));
      for (var k = Math.ceil(zr[0]); k <= zr[1]; k++) {
        api.line([X(k), ya], [X(k), ya + 4], {color: c.axis, width: 1});
        if (k % 2 === 0) {
          api.label([X(k), ya + 15], Viz.fmt(mu + k * sd, dec), {color: k === 0 ? c.ink : c.muted, size: 12, anchor: "middle"});
          api.label([X(k), ya + 31], k === 0 ? "μ" : "μ" + (k > 0 ? "+" : "−") + Math.abs(k) + "σ", {color: c.muted, size: 12, anchor: "middle"});
        }
      }
    }
  });
})();
