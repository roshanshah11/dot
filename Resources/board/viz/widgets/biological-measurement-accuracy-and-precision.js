// Accuracy and precision in a routine lab check: a pipette set to 100 µL dispenses water onto a balance n times.
// Accuracy is about the average: the bias (systematic error) is the mean minus the true 100 µL. Precision is about
// the scatter: the standard deviation s (random error), or the CV = s / mean. One fixed set of twelve deviates is
// centred and rescaled in code for each n, so the drawn replicates have exactly the mean 100 + bias and the SD set
// on the sliders. The pass marks (±2% for both) are a teaching-lab tolerance, not a standard's.
// Dot's design: the queue gives no parameters; bias, spread and the number of replicates drive the idea.
(function () {
  var RAW = [0.42, -1.31, 0.88, -0.27, 1.62, -0.74, 0.09, -1.05, 0.63, 1.18, -0.52, -0.21];
  var TRUE = 100, TOL = 2;   // µL, and the ±2% tolerance (2 µL at 100 µL)
  function deviates(n) { // the first n deviates with mean 0 and sample SD 1
    var z = RAW.slice(0, n), m = z.reduce(function (t, x) { return t + x; }, 0) / n;
    var s = Math.sqrt(z.reduce(function (t, x) { return t + (x - m) * (x - m); }, 0) / (n - 1));
    return z.map(function (x) { return (x - m) / s; });
  }
  function calc(v) {
    var xs = deviates(v.n).map(function (z) { return TRUE + v.bias + v.sd * z; }), n = xs.length;
    var mean = xs.reduce(function (t, x) { return t + x; }, 0) / n;
    var s = Math.sqrt(xs.reduce(function (t, x) { return t + (x - mean) * (x - mean); }, 0) / (n - 1));
    var bias = mean - TRUE, cv = s / mean * 100;
    return {xs: xs, mean: mean, s: s, bias: bias, cv: cv, acc: Math.abs(bias) <= TOL + 1e-9, prec: cv <= TOL + 1e-9};
  }
  var sgn = function (x) { return (x > 1e-9 ? "+" : x < -1e-9 ? "−" : "") + Viz.fmt(Math.abs(x), 1); };

  Viz.register("biological-measurement-accuracy-and-precision", {
    title: "Pipette accuracy and precision",
    subject: "stats",
    shows: "Weigh repeated 100 µL dispenses: bias moves the whole cluster away from the true volume (accuracy), spread widens it (precision)",
    params: {
      bias: {kind: "number", default: 3, min: -8, max: 8, step: 0.5, label: "\\text{bias}\\ (\\mu\\text{L})"},
      sd: {kind: "number", default: 1, min: 0.2, max: 5, step: 0.1, label: "s\\ (\\mu\\text{L})"},
      n: {kind: "integer", default: 10, min: 3, max: 12, label: "n"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\bar x=\\tfrac{1}{n}\\textstyle\\sum x_i=" + Viz.n(k.mean, 1) + "\\ \\mu\\text{L}\\\\[3pt]\\text{bias}=\\bar x-100=" + sgn(k.bias).replace("−", "-") +
        "\\\\[3pt]\\text{CV}=s/\\bar x=" + Viz.n(k.s, 1) + "/" + Viz.n(k.mean, 1) + "=" + Viz.n(k.cv, 2) + "\\%\\end{array}";
    },
    status: function (v) {
      var k = calc(v), b = "bias " + sgn(k.bias) + " µL", cv = "CV " + Viz.fmt(k.cv, 2) + "%";
      if (k.acc && k.prec) return "<b>Accurate and precise</b>: the mean is within 2% of 100 µL (" + b + ") and the dispenses agree closely (" + cv + ").";
      if (k.prec) return "<b>Precise but not accurate</b>: the dispenses agree (" + cv + ") but all miss the same way (" + b + "), a systematic error that recalibration fixes and more replicates never will.";
      if (k.acc) return "<b>Accurate but not precise</b>: the mean is on target (" + b + ") but single dispenses scatter (" + cv + "), a random error from technique; averaging more replicates helps.";
      return "<b>Neither accurate nor precise</b>: the dispenses miss on average (" + b + ") and scatter widely (" + cv + ").";
    },
    examples: [
      {name: "accurate and precise", values: {bias: 0.5, sd: 0.6}},
      {name: "precise, not accurate", values: {bias: -6, sd: 0.5}},
      {name: "accurate, not precise", values: {bias: 0, sd: 4}},
      {name: "bias and spread at minimum", values: {bias: -8, sd: 0.2, n: 3}},
      {name: "bias and spread at maximum", values: {bias: 8, sd: 5, n: 12}}
    ],
    size: [400, 256],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 24, x1 = 376, lo = 80, hi = 120, X = function (q) { return x0 + (x1 - x0) * (Math.max(lo, Math.min(hi, q)) - lo) / (hi - lo); };
      var ya = 160;
      api.label([api.w / 2, 14], v.n + " dispenses of a pipette set to 100 µL, weighed (µL)", {color: c.muted, size: 12, anchor: "middle"});
      // tolerance band and the true volume
      api.rect(X(TRUE - TOL), 40, X(TRUE + TOL) - X(TRUE - TOL), ya - 40, {fill: c.c4, fillOpacity: 0.1, rx: 0});
      api.line([X(TRUE), 40], [X(TRUE), ya], {color: c.c4, width: 2});
      api.label([X(TRUE), 32], "true 100 µL, ±2% band", {color: c.c4, size: 12, weight: 650, anchor: "middle"});
      // axis
      api.line([x0, ya], [x1, ya], {color: c.axis, width: 1.3});
      for (var t = lo; t <= hi; t += 5) {
        api.line([X(t), ya], [X(t), ya + 4], {color: c.axis, width: 1});
        api.label([X(t), ya + 15], String(t), {color: c.muted, size: 12, anchor: "middle"});
      }
      // replicates as a dot plot: stack dots that would overlap
      var placed = [], r = 6, top = 0;
      k.xs.slice().sort(function (a, b) { return a - b; }).forEach(function (x) {
        var px = X(x), level = 0;
        while (placed.some(function (q) { return q[1] === level && Math.abs(q[0] - px) < 2 * r + 1; })) level++;
        placed.push([px, level]); top = Math.max(top, level);
      });
      var gap = top ? Math.min(2 * r + 1, (ya - 12 - 82) / top) : 0;   // squeeze a tall stack under the bracket
      placed.forEach(function (q) { api.circle([q[0], ya - 12 - q[1] * gap], r, {fill: c.ink, fillOpacity: 0.85, stroke: c.card, width: 1}); });
      // precision: mean ± s bracket above the dots
      var yb = 66, xm = X(k.mean);
      api.line([X(k.mean - k.s), yb], [X(k.mean + k.s), yb], {color: c.c2, width: 2.5});
      [k.mean - k.s, k.mean + k.s].forEach(function (q) { api.line([X(q), yb - 5], [X(q), yb + 5], {color: c.c2, width: 2}); });
      var sLab = "±s = " + api.fmt(k.s, 1);
      api.label([X(k.mean + k.s) + 6, yb], sLab, {color: c.c2, size: 12, weight: 650});
      // accuracy: the mean, and the bias arrow from the true value to it
      api.line([xm, yb + 8], [xm, ya], {color: c.c3, width: 2, dash: "4 3"});
      var mLab = api.label([xm, yb - 14], "mean " + api.fmt(k.mean, 1), {color: c.c3, size: 12.5, weight: 700, anchor: "middle"});
      mLab.setAttribute("stroke", c.card); mLab.setAttribute("stroke-width", 4); mLab.setAttribute("paint-order", "stroke");   // legible over the true line
      var yArr = ya + 36;
      if (Math.abs(xm - X(TRUE)) > 12) api.arrow([X(TRUE), yArr], [xm, yArr], {color: c.c3, width: 2.5, halo: false});
      else api.point([xm, yArr], {color: c.c3, r: 4});
      api.label([(X(TRUE) + xm) / 2, yArr + 17], "bias " + sgn(k.bias) + " µL", {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      // the verdicts
      var ok = function (pass) { return pass ? c.c4 : c.c5; };
      api.label([x0, 242], "accuracy: " + (k.acc ? "within" : "outside") + " ±2%", {color: ok(k.acc), size: 12.5, weight: 700});
      api.label([x1, 242], "precision: CV " + api.fmt(k.cv, 2) + "% " + (k.prec ? "≤" : ">") + " 2%", {color: ok(k.prec), size: 12.5, weight: 700, anchor: "end"});
    }
  });
})();
