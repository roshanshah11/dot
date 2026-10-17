// One lab quantity measured n times. Single readings scatter with standard deviation sigma (blue); the mean of the
// n readings scatters much less, with standard error SE = sigma / sqrt(n) (amber). Both curves are true probability
// densities over the same millimetre axis (equal areas), so as n grows the amber curve narrows and rises while the
// blue one keeps its width. The dots are one fixed run of readings (a seeded sequence scaled by sigma, the seed picked
// so the run is typical: every running mean stays within 1.3 SE of the truth), so adding readings shows this run's
// mean settling toward the true value. The inset plots SE against n: the 1/sqrt(n) law.
// Dot's own extra (no queue schema): sigma and n are the only two inputs SE needs.
(function () {
  var MU = 50;
  var Z = (function () { // 100 standard normal draws from a fixed seed (mulberry32, then Box-Muller)
    var s = 31, out = [];
    function rnd() { s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    while (out.length < 100) { var u = rnd() || 1e-9, w = rnd(); out.push(Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * w)); }
    return out;
  })();
  function calc(v) {
    var m = 0; for (var i = 0; i < v.n; i++) m += Z[i];
    return {se: v.sigma / Math.sqrt(v.n), xbar: MU + v.sigma * m / v.n};
  }
  function pdf(x, m, s) { return Math.exp(-0.5 * Math.pow((x - m) / s, 2)) / (s * Math.sqrt(2 * Math.PI)); }

  Viz.register("standard-error-vs-sd", {
    title: "Standard deviation vs standard error",
    subject: "stats",
    shows: "Slide n: single readings keep their spread (SD), but the mean of n readings tightens as SE = σ/√n",
    params: {
      sigma: {kind: "number", default: 8, min: 2, max: 15, step: 0.5, label: "\\sigma\\ (\\text{mm})"},
      n: {kind: "integer", default: 10, min: 1, max: 100, label: "n"}
    },
    formula: function (v) {
      var k = calc(v);
      return "SE=\\frac{\\sigma}{\\sqrt{n}}=\\frac{" + Viz.n(v.sigma) + "}{\\sqrt{" + v.n + "}}=" + Viz.n(k.se) + "\\ \\text{mm}";
    },
    status: function (v) {
      var k = calc(v), sd = Viz.fmt(v.sigma) + " mm";
      if (v.n === 1) return "With one reading the mean is that reading, so its uncertainty equals the SD: <b>" + sd + "</b>.";
      return "Single readings scatter by <b>" + sd + "</b>, but the mean of " + v.n + " is uncertain by only <b>" + Viz.fmt(k.se) +
        " mm</b>; " + (4 * v.n) + " readings would halve that.";
    },
    examples: [
      {name: "one reading", values: {n: 1}},
      {name: "a hundred readings", values: {n: 100}},
      {name: "precise instrument", values: {sigma: 2, n: 10}},
      {name: "noisy instrument", values: {sigma: 15, n: 10}},
      {name: "four readings halve it", values: {sigma: 8, n: 4}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 28, x1 = 384, yTop = 34, yAx = 128, hMax = yAx - yTop;
      var X = function (mm) { return x0 + (x1 - x0) * mm / 100; };
      // y scale: the mean's curve always reaches the top; single readings' curve is 1/sqrt(n) as tall (equal areas)
      var ys = hMax / pdf(MU, MU, k.se), Yd = function (d) { return yAx - d * ys; };
      api.line([x0, yAx], [x1, yAx], {color: c.axis, width: 1.2});
      [0, 25, 50, 75, 100].forEach(function (t) {
        api.line([X(t), yAx], [X(t), yAx + 4], {color: c.axis, width: 1});
        api.label([X(t), yAx + 14], String(t), {color: c.muted, size: 12, anchor: "middle"});
      });
      api.label([x1, yAx - 10], "reading (mm)", {color: c.muted, size: 12, anchor: "end"});
      api.line([X(MU), yTop - 14], [X(MU), yAx], {color: c.faint, width: 1, dash: "3 4"});
      api.label([X(MU), yTop - 22], "true value 50", {color: c.muted, size: 12, anchor: "middle"});
      // single readings: N(mu, sigma)
      var blue = [];
      for (var mm = 0; mm <= 100.001; mm += 0.5) blue.push([X(mm), Yd(pdf(mm, MU, v.sigma))]);
      api.polygon([[X(0), yAx]].concat(blue, [[X(100), yAx]]), {fill: c.c2, fillOpacity: 0.14});
      api.polyline(blue, {stroke: c.c2, width: 2});
      // the mean of n: N(mu, SE)
      var amber = [[X(Math.max(0, MU - 5 * k.se)), yAx]];
      for (var t = -5; t <= 5.001; t += 0.1) amber.push([X(MU + t * k.se), Yd(pdf(MU + t * k.se, MU, k.se))]);
      amber.push([X(Math.min(100, MU + 5 * k.se)), yAx]);
      api.polygon(amber, {fill: c.c3, fillOpacity: 0.16});
      api.polyline(amber.slice(1, -1), {stroke: c.c3, width: 2.5});
      // labels on the curves
      var bx = MU - 1.35 * v.sigma;
      api.label([X(bx) - 6, Math.min(Yd(pdf(bx, MU, v.sigma)) - 10, yAx - 22)], "single readings, SD " + api.fmt(v.sigma), {color: c.c2, size: 12.5, weight: 650, anchor: "end"});
      api.label([X(MU) + 10, yTop + 6], "mean of " + v.n + ", SE " + api.fmt(k.se), {color: c.c3, size: 12.5, weight: 650});
      // ±1 SE bracket at the mean's curve, half height
      var hy = Yd(pdf(MU + k.se, MU, k.se));
      if ((X(MU + k.se) - X(MU - k.se)) > 8) api.line([X(MU - k.se), hy], [X(MU + k.se), hy], {color: c.c3, width: 1.5, arrow: true, arrowStart: true});
      // one run of n readings, and its mean
      var yS = 174;
      api.label([x0, yS - 17], "one run of " + v.n + " reading" + (v.n > 1 ? "s" : ""), {color: c.c2, size: 12});
      for (var i = 0; i < v.n; i++) {
        var r = Math.max(0, Math.min(100, MU + v.sigma * Z[i]));
        api.circle([X(r), yS + ((i * 7) % 5 - 2) * 2.6], 2.6, {fill: c.c2, fillOpacity: 0.75});
      }
      api.line([X(k.xbar), yS - 10], [X(k.xbar), yS + 10], {color: c.c3, width: 3});
      api.label([X(k.xbar), yS + 19], "its mean " + api.fmt(k.xbar), {color: c.c3, size: 12, anchor: "middle", weight: 600});
      // inset: SE against n on a fixed 0..15 mm scale
      var ix0 = 60, ix1 = 384, iyB = 272, iyT = 218, N = function (q) { return ix0 + (ix1 - ix0) * (q - 1) / 99; }, S = function (q) { return iyB - (iyB - iyT) * q / 15; };
      api.line([ix0, iyB], [ix1, iyB], {color: c.axis, width: 1.2});
      api.line([ix0, iyB], [ix0, iyT - 4], {color: c.axis, width: 1.2});
      api.label([ix0 - 6, S(15)], "15", {color: c.muted, size: 12, anchor: "end"});
      api.label([ix0 - 6, iyB], "0", {color: c.muted, size: 12, anchor: "end"});
      api.label([ix0 - 6, (iyT + iyB) / 2], "SE", {color: c.muted, size: 12, anchor: "end"});
      api.label([ix0, iyB + 13], "1", {color: c.muted, size: 12, anchor: "middle"});
      api.label([ix1, iyB + 13], "100", {color: c.muted, size: 12, anchor: "middle"});
      api.label([(ix0 + ix1) / 2, iyB + 13], "n (readings in the mean)", {color: c.muted, size: 12, anchor: "middle"});
      var curve = [];
      for (var q = 1; q <= 100; q++) curve.push([N(q), S(v.sigma / Math.sqrt(q))]);
      api.polyline(curve, {stroke: c.c3, width: 2, opacity: 0.85});
      api.line([N(1), S(v.sigma)], [N(100), S(v.sigma)], {color: c.c2, width: 1.5, dash: "5 4"});
      api.label([N(100), S(v.sigma) - 9], "SD stays " + api.fmt(v.sigma), {color: c.c2, size: 12, anchor: "end"});
      api.point([N(v.n), S(k.se)], {color: c.c3, r: 4.5});
      api.label([N(v.n) + (v.n > 70 ? -8 : 8), S(k.se) + (S(k.se) > iyT + 20 ? -11 : 12)], "n = " + v.n, {color: c.c3, size: 12, anchor: v.n > 70 ? "end" : "start", weight: 600});
    }
  });
})();
