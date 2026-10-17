// Skewness as a direction: a distribution with mean 0 and standard deviation 1 whose moment skewness is set by the
// strength slider (gamma1 = 1.2 x strength, so 0 is a normal curve and 1 is a strongly skewed one). The curve is a
// standardized gamma distribution with shape k = 4 / gamma1^2 (a gamma has skewness 2 / sqrt k exactly), mirrored for
// left skew. Its mode is exactly 1 / sqrt k below the mean; its median is found from the CDF numerically. The x axis
// is in standard deviations, so the mean is always at 0 and the hump and the tail move around it.
(function () {
  var LZ = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
            12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lgamma(z) { z -= 1; var x = LZ[0]; for (var i = 1; i < 9; i++) x += LZ[i] / (z + i); var t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x); }
  function calc(v) {
    var g = 1.2 * v.skewStrength, sgn = v.direction === "left" ? -1 : 1, pdf;
    if (g < 1e-6) pdf = function (z) { return Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI); };
    else {
      var k = 4 / (g * g), sk = Math.sqrt(k), lg = lgamma(k);
      pdf = function (z) { var x = k + sk * z * sgn; return x <= 0 ? 0 : sk * Math.exp((k - 1) * Math.log(x) - x - lg); };
    }
    // median: walk the CDF from the far left
    var dz = 0.002, cdf = 0, med = 0, z = -10;
    for (; z < 10; z += dz) { var p = (pdf(z) + pdf(z + dz)) / 2 * dz; if (cdf + p >= 0.5) { med = z + dz * (0.5 - cdf) / p; break; } cdf += p; }
    return {g: g * sgn, pdf: pdf, mode: g < 1e-6 ? 0 : -sgn * g / 2, med: g < 1e-6 ? 0 : med, sgn: sgn};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };
  var sg = function (x) { return (x > 0 ? "+" : "") + f(x); };

  Viz.register("skewness-direction", {
    title: "Skewness: which way the tail points",
    subject: "stats",
    shows: "Pick a direction and slide the strength: the long tail drags the mean toward it, past the median, while the peak (mode) stays on the other side",
    params: {
      direction: {kind: "enum", values: ["left", "right"], default: "right", label: "\\text{tail}"},
      skewStrength: {kind: "number", default: 0.6, min: 0, max: 1, step: 0.05, label: "\\text{strength}"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\gamma_1=\\dfrac{E[(X-\\mu)^3]}{\\sigma^3}=" + Viz.n(k.g, 2) + "\\\\" +
        "\\text{mean}-\\text{median}=" + Viz.n(-k.med, 2) + "\\sigma\\\\\\text{mean}-\\text{mode}=" + Viz.n(-k.mode, 2) + "\\sigma\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (Math.abs(k.g) < 1e-6) return "<b>Symmetric</b> (skewness 0): both tails match, so the mean, median and mode all sit at the center.";
      var side = k.sgn > 0 ? "right" : "left";
      return "<b>Skewed " + side + "</b> (skewness " + f(k.g) + "): the long " + side + " tail pulls the mean <b>" + f(Math.abs(k.med)) + "σ</b> past the median toward it, and the peak sits " +
        f(Math.abs(k.mode)) + "σ from the mean on the other side.";
    },
    examples: [
      {name: "Minimum supported values", values: {skewStrength: 0}},
      {name: "Maximum supported values", values: {skewStrength: 1}},
      {name: "direction: left", values: {direction: "left"}},
      {name: "strong left skew", values: {direction: "left", skewStrength: 1}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 26, x1 = 382, base = 236, top = 70, ymax = 0.6;
      var X = function (z) { return x0 + (x1 - x0) * (z + 4) / 8; }, Y = function (d) { return base - (base - top) * d / ymax; };
      // the curve
      var pts = [[X(-4), base]];
      for (var i = 0; i <= 400; i++) { var z = -4 + 8 * i / 400; pts.push([X(z), Y(k.pdf(z))]); }
      pts.push([X(4), base]);
      api.polygon(pts, {fill: c.c2, fillOpacity: 0.18, stroke: "none"});
      api.polyline(pts.slice(1, -1), {stroke: c.c2, width: 2.4});
      // axis in standard deviations
      api.line([x0 - 4, base], [x1 + 4, base], {color: c.axis, width: 1.2});
      for (var t = -3; t <= 3; t++) {
        api.line([X(t), base], [X(t), base + 4], {color: c.axis, width: 1});
        api.label([X(t), base + 15], t === 0 ? "0" : (t > 0 ? "+" : "−") + Math.abs(t) + "σ", {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x1, base + 34], "distance from the mean, in standard deviations", {color: c.muted, size: 12, anchor: "end"});
      if (Math.abs(k.g) < 1e-6) {
        api.line([X(0), base], [X(0), 40], {color: c.ink, width: 2});
        api.label([X(0), 30], "mean = median = mode", {color: c.ink, size: 13, weight: 650, anchor: "middle"});
        api.label([X(2.6), Y(0.08) - 22], "matching tails", {color: c.muted, size: 12.5, anchor: "middle"});
        api.label([X(-2.6), Y(0.08) - 22], "matching tails", {color: c.muted, size: 12.5, anchor: "middle"});
        return;
      }
      // mode, median and mean: tallest label row for the one farthest toward the tail
      var s = k.sgn, marks = [
        {z: k.mode, name: "mode " + sg(k.mode) + "σ", col: c.c1, y: 58},
        {z: k.med, name: "median " + sg(k.med) + "σ", col: c.c4, y: 40},
        {z: 0, name: "mean 0", col: c.c3, y: 22}];
      marks.forEach(function (m) {
        api.line([X(m.z), base], [X(m.z), m.y + 8], {color: m.col, width: m.z === 0 ? 2.6 : 2, dash: m.z === 0 ? null : "5 3"});
        api.label([X(m.z) + (s > 0 ? -4 : 4), m.y], m.name, {color: m.col, size: 12.5, weight: 650, anchor: s > 0 ? "end" : "start"});
      });
      api.point([X(k.mode), Y(k.pdf(k.mode))], {color: c.c1, r: 4});
      // the long tail: label and arrow float just above the curve on the tail side
      var ly = Y(k.pdf(1.5 * s)) - 26, ta = X(1.7 * s), tb = X(3.7 * s);
      api.label([X(2.7 * s), ly], "long " + (s > 0 ? "right" : "left") + " tail", {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      api.arrow([ta, ly + 14], [tb, ly + 14], {color: c.c5, width: 2.5, halo: false});
    }
  });
})();
