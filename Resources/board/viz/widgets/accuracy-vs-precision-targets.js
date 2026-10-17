// Twelve shots at a target whose bullseye is the true value. Accuracy is about where the shots are on average:
// the bias is the distance from the bullseye to the mean of the hits (amber arrow). Precision is about how close
// the shots are to each other: the spread s is the root-mean-square distance of the hits from their own mean
// (blue circle). The same twelve-point pattern is used everywhere, centred and rescaled in code so its spread is
// exactly 1 before it is scaled and shifted; the bias and spread printed are computed from the drawn hits.
(function () {
  var RAW = [[0.9, 0.3], [-0.6, 0.8], [0.2, -1.1], [-1.2, -0.3], [1.3, -0.7], [-0.3, 1.4], [0.5, 0.9], [-0.9, -1.0],
             [0.1, 0.2], [1.0, 1.2], [-1.4, 0.5], [0.6, -0.4]];
  var UNIT = (function () { // centre the pattern and scale it to RMS distance 1 (n - 1 in the denominator)
    var n = RAW.length, mx = 0, my = 0, ss = 0;
    RAW.forEach(function (p) { mx += p[0] / n; my += p[1] / n; });
    RAW.forEach(function (p) { ss += Math.pow(p[0] - mx, 2) + Math.pow(p[1] - my, 2); });
    var s = Math.sqrt(ss / (n - 1));
    return RAW.map(function (p) { return [(p[0] - mx) / s, (p[1] - my) / s]; });
  })();
  var OFFSET = [1.8, 1.2], SPREAD = {small: 0.5, large: 1.5};   // cm
  function calc(v) {
    var off = v.meanPosition === "offset" ? OFFSET : [0, 0], sp = SPREAD[v.measurementSpread];
    var hits = UNIT.map(function (u) { return [off[0] + sp * u[0], off[1] + sp * u[1]]; }), n = hits.length;
    var m = [0, 0]; hits.forEach(function (h) { m[0] += h[0] / n; m[1] += h[1] / n; });
    var ss = 0; hits.forEach(function (h) { ss += Math.pow(h[0] - m[0], 2) + Math.pow(h[1] - m[1], 2); });
    return {hits: hits, mean: m, bias: Math.hypot(m[0], m[1]), s: Math.sqrt(ss / (n - 1)), accurate: v.meanPosition === "centered", precise: v.measurementSpread === "small"};
  }
  var r2 = function (x) { return Viz.fmt(Math.abs(x) < 1e-9 ? 0 : x, 2); };

  Viz.register("accuracy-vs-precision-targets", {
    title: "Accuracy vs precision",
    subject: "stats",
    shows: "Move the mean and widen the spread: accuracy is how far the average lands from the bullseye, precision is how tightly the shots group",
    params: {
      meanPosition: {kind: "enum", values: ["centered", "offset"], default: "centered", label: "\\text{mean}"},
      measurementSpread: {kind: "enum", values: ["small", "large"], default: "small", label: "\\text{spread}"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\text{bias}=|\\bar{\\mathbf{x}}-\\mathbf{x}_{\\text{true}}|=" + Viz.n(k.bias) + "\\ \\text{cm}\\\\" +
        "s=\\sqrt{\\tfrac{1}{n-1}\\sum|\\mathbf{x}_i-\\bar{\\mathbf{x}}|^2}=" + Viz.n(k.s) + "\\ \\text{cm}\\end{array}";
    },
    status: function (v) {
      var k = calc(v), b = r2(k.bias) + " cm", s = r2(k.s) + " cm";
      if (k.accurate && k.precise) return "<b>Accurate and precise</b>: the hits group within " + s + " and their mean sits on the bullseye.";
      if (k.accurate) return "<b>Accurate, not precise</b>: single shots stray (spread " + s + "), but their mean still lands on the bullseye.";
      if (k.precise) return "<b>Precise, not accurate</b>: the shots agree within " + s + " yet all miss by <b>" + b + "</b>, a systematic error averaging cannot remove.";
      return "<b>Neither</b>: the shots scatter by " + s + " and their mean misses by <b>" + b + "</b>.";
    },
    examples: [
      {name: "meanPosition: offset", values: {meanPosition: "offset"}},
      {name: "measurementSpread: large", values: {measurementSpread: "large"}},
      {name: "neither accurate nor precise", values: {meanPosition: "offset", measurementSpread: "large"}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, k = calc(v), cx = 118, cy = 136, u = 26, R = 4;
      var P = function (q) { return [cx + q[0] * u, cy - q[1] * u]; };
      // the target: four rings, 1 cm apart
      for (var r = R; r >= 1; r--) api.circle([cx, cy], r * u, {fill: r % 2 ? "none" : c.grid, fillOpacity: 1, stroke: c.faint, width: 1});
      api.circle([cx, cy], 5, {fill: c.muted});
      api.label([cx, cy + R * u + 15], "bullseye = true value", {color: c.muted, size: 12, anchor: "middle"});
      api.label([6, 16], "rings 1 cm apart", {color: c.muted, size: 12});
      // spread: a circle of radius s around the hits' mean, with one radius drawn and named
      var M = P(k.mean), rs = k.s * u, e = [M[0] + rs * 0.707, M[1] + rs * 0.707];
      api.circle(M, rs, {stroke: c.c2, width: 2, dash: "5 4", fill: c.c2, fillOpacity: 0.07});
      api.line(M, e, {color: c.c2, width: 2});
      api.label([e[0] + 7, e[1] + 8], "s", {color: c.c2, size: 14, weight: 700});
      // the hits
      k.hits.forEach(function (h) { api.circle(P(h), 4, {fill: c.ink, stroke: c.card, width: 1.2}); });
      // bias: bullseye to the mean of the hits, labelled at whichever spot beside the arrow is clearest of the hits
      if (k.bias > 1e-9) {
        var dx = M[0] - cx, dy = M[1] - cy, L = Math.hypot(dx, dy);
        api.arrow([cx, cy], M, {color: c.c3, width: 2.5});
        var best = null, hp = k.hits.map(P);
        [0.3, 0.45, 0.6].forEach(function (t) { [-1, 1].forEach(function (sd) {
          var q = [cx + dx * t - sd * dy / L * 17, cy + dy * t + sd * dx / L * 17];
          var clear = Math.min.apply(null, hp.map(function (h) { return Math.hypot((h[0] - q[0]) / 1.6, h[1] - q[1]); }));
          if (!best || clear > best.clear) best = {q: q, clear: clear};
        }); });
        api.label(best.q, "bias", {color: c.c3, size: 13, weight: 650, anchor: "middle"});
      }
      api.line([M[0] - 6, M[1] - 6], [M[0] + 6, M[1] + 6], {color: c.c3, width: 3});
      api.line([M[0] - 6, M[1] + 6], [M[0] + 6, M[1] - 6], {color: c.c3, width: 3});
      // the two read-outs: bias (accuracy) and spread (precision), bars on the same 0..3 cm scale
      var bx = 252, bw = 136, sc = bw / 3;
      function meter(y, title, name, val, color, good, goodWord, badWord, meaning) {
        api.label([bx, y], title, {color: c.ink, size: 13, weight: 650});
        api.label([bx, y + 20], name + " " + r2(val) + " cm", {color: color, size: 13, weight: 650});
        api.rect(bx, y + 33, bw, 9, {fill: c.grid, rx: 4});
        api.rect(bx, y + 33, Math.max(3, Math.min(bw, val * sc)), 9, {fill: color, rx: 4});
        api.label([bx, y + 58], (good ? "\u2713 " + goodWord : "\u2717 " + badWord), {color: good ? c.ink : color, size: 13, weight: 650});
        api.label([bx, y + 76], meaning, {color: c.muted, size: 12});
      }
      meter(40, "accuracy", "bias", k.bias, c.c3, k.accurate, "accurate", "not accurate", "mean vs true value");
      meter(150, "precision", "spread s", k.s, c.c2, k.precise, "precise", "not precise", "shots vs each other");
    }
  });
})();
