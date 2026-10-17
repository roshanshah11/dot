// The ROC curve of a classifier under the equal-variance binormal model. On a latent scale, negatives are N(-d/2, 1)
// and positives N(+d/2, 1); the score the classifier reports is s = 1 / (1 + e^(-z)), a number in (0, 1).
// Score >= threshold t means "predict positive", so TPR = P(s >= t | +) = Phi(d/2 - z_t) and FPR = Phi(-d/2 - z_t),
// with z_t = logit(t). Sweeping t from 1 down to 0 traces the curve from (0, 0) to (1, 1). The area under it
// is P(s+ > s-) = Phi(d / sqrt 2), so the AUC slider sets d = sqrt 2 * Phi^-1(AUC).
// Left: the two score densities with the threshold (the shaded parts right of it are the TPR and FPR); right: the curve.
(function () {
  var K = 1;   // s = logistic(z): unimodal score densities at every AUC
  function Phi(x) {   // Abramowitz-Stegun 7.1.26, |error| < 1.5e-7
    var z = Math.min(40, Math.abs(x)) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
    var e = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
    return x >= 0 ? 0.5 * (1 + e) : 0.5 * (1 - e);
  }
  function PhiInv(p) {   // Acklam's rational approximation, relative error < 1.2e-9
    var a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
    var b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
    var c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    var d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    var q, r;
    if (p < 0.02425) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - 0.02425) return -PhiInv(1 - p);
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function calc(v) {
    var d = Math.SQRT2 * PhiInv(v.auroc), t = v.threshold;
    var zt = t <= 0 ? -Infinity : t >= 1 ? Infinity : Math.log(t / (1 - t)) / K;
    return {d: d, tpr: Phi(d / 2 - zt), fpr: Phi(-d / 2 - zt), auc: Phi(d / Math.SQRT2)};
  }
  function dens(s, m) { var z = Math.log(s / (1 - s)) / K; return Math.exp(-0.5 * (z - m) * (z - m)) / (Math.sqrt(2 * Math.PI) * K * s * (1 - s)); }
  var f2 = function (x) { return Viz.fmt(x, 2); }, pc = function (x) { return Math.round(x * 100) + "%"; };

  Viz.register("roc-curve", {
    title: "ROC curve and AUC",
    subject: "stats",
    shows: "Slide the AUC to separate the two score distributions and the threshold to move along the curve: each threshold is one (FPR, TPR) point",
    params: {
      auroc: {kind: "number", default: 0.75, min: 0.5, max: 0.95, step: 0.01, label: "\\text{AUC}"},
      threshold: {kind: "number", default: 0.5, min: 0, max: 1, step: 0.01, label: "t"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\text{TPR}=P(s\\ge t\\mid +)=" + Viz.n(k.tpr, 2) + "\\\\[3pt]\\text{FPR}=P(s\\ge t\\mid -)=" + Viz.n(k.fpr, 2) +
        "\\\\[3pt]\\text{AUC}=P(s_+>s_-)=" + Viz.n(k.auc, 2) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), aucTxt = v.auroc <= 0.5 + 1e-9 ? "AUC 0.5 means the scores carry no information, so every threshold sits on the diagonal"
        : "AUC " + f2(v.auroc) + " means a random positive outscores a random negative " + pc(v.auroc) + " of the time";
      if (v.threshold <= 0) return "Threshold 0 flags everyone: TPR = FPR = <b>1</b>, the top-right corner; " + aucTxt + ".";
      if (v.threshold >= 1) return "Threshold 1 flags no one: TPR = FPR = <b>0</b>, the bottom-left corner; " + aucTxt + ".";
      return "At threshold " + f2(v.threshold) + " the test flags <b>" + pc(k.tpr) + "</b> of positives and <b>" + pc(k.fpr) + "</b> of negatives; " + aucTxt + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {auroc: 0.5, threshold: 0}},
      {name: "Maximum supported values", values: {auroc: 0.95, threshold: 1}},
      {name: "useless test", values: {auroc: 0.5, threshold: 0.5}},
      {name: "strong test, strict threshold", values: {auroc: 0.95, threshold: 0.7}}
    ],
    size: [400, 226],
    draw: function (api, v) {
      var c = api.color, k = calc(v), t = v.threshold, x0 = 20, x1 = 216, base = 176, top = 40;
      var X = function (s) { return x0 + (x1 - x0) * s; };
      // the two score densities, each scaled by the same factor
      var S = [], i;
      for (i = 1; i < 200; i++) S.push(i / 200);
      var neg = S.map(function (s) { return dens(s, -k.d / 2); }), pos = S.map(function (s) { return dens(s, k.d / 2); });
      var peak = Math.max(Math.max.apply(null, neg), Math.max.apply(null, pos)), Y = function (f) { return base - (base - top) * f / peak; };
      function area(f, col, op) {   // the part of a density right of the threshold
        var pts = [[X(Math.max(t, 0.005)), base]];
        S.forEach(function (s, j) { if (s >= t) pts.push([X(s), Y(f[j])]); });
        pts.push([X(0.995), base]);
        if (pts.length > 2) api.polygon(pts, {fill: col, fillOpacity: op});
      }
      area(pos, c.c3, 0.3); area(neg, c.c2, 0.38);   // FP drawn over TP so the false alarms stay visible
      api.polyline([[X(0), base]].concat(S.map(function (s, j) { return [X(s), Y(neg[j])]; }), [[X(1), base]]), {stroke: c.c2, width: 2});
      api.polyline([[X(0), base]].concat(S.map(function (s, j) { return [X(s), Y(pos[j])]; }), [[X(1), base]]), {stroke: c.c3, width: 2});
      api.label([x0, 16], "actual −", {color: c.c2, size: 12.5, weight: 650});
      api.label([x1, 16], "actual +", {color: c.c3, size: 12.5, weight: 650, anchor: "end"});
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.2});
      [0, 0.5, 1].forEach(function (s) { api.label([X(s), base + 13], String(s), {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([(X(0) + X(0.5)) / 2, base + 13], "score", {color: c.muted, size: 12, anchor: "middle"});
      api.line([X(t), 28], [X(t), base], {color: c.ink, width: 2});
      api.handle([X(t), base], {color: c.ink, r: 6, onDrag: function (q) { api.set({threshold: Math.round(Math.max(0, Math.min(1, (q[0] - x0) / (x1 - x0))) * 100) / 100}); }});
      api.label([x0, 210], "TPR " + f2(k.tpr), {color: c.c3, size: 12.5, weight: 650});
      api.label([x0 + 84, 210], "FPR " + f2(k.fpr), {color: c.c2, size: 12.5, weight: 650});
      // the ROC curve
      var rx = 250, ry = 30, rs = 138, RX = function (f) { return rx + rs * f; }, RY = function (q) { return ry + rs * (1 - q); };
      var roc = [[RX(0), RY(0)]];
      for (var z = 8; z >= -8; z -= 0.1) roc.push([RX(Phi(-k.d / 2 - z)), RY(Phi(k.d / 2 - z))]);
      roc.push([RX(1), RY(1)]);
      api.polygon(roc.concat([[RX(1), RY(0)]]), {fill: c.c1, fillOpacity: 0.14});
      api.rect(rx, ry, rs, rs, {stroke: c.axis, width: 1, rx: 0});
      api.line([RX(0), RY(0)], [RX(1), RY(1)], {color: c.faint, width: 1, dash: "4 4"});
      api.polyline(roc, {stroke: c.c1, width: 2.4});
      api.label([RX(0.97), RY(0.1)], "AUC " + f2(k.auc), {color: c.c1, size: 12.5, weight: 650, anchor: "end"});
      api.label([rx - 4, RY(0) + 11], "0", {color: c.muted, size: 12, anchor: "end"});
      api.label([rx - 5, RY(1)], "1", {color: c.muted, size: 12, anchor: "end"});
      api.label([RX(1), RY(0) + 13], "1", {color: c.muted, size: 12, anchor: "middle"});
      api.label([rx + rs / 2, RY(0) + 13], "FPR", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      api.label([rx + 6, ry - 12], "TPR", {color: c.c3, size: 12.5, weight: 650});
      var P = [RX(k.fpr), RY(k.tpr)];
      api.line([P[0], P[1]], [P[0], RY(0)], {color: c.c2, width: 1, dash: "3 3"});
      api.line([P[0], P[1]], [RX(0), P[1]], {color: c.c3, width: 1, dash: "3 3"});
      api.point(P, {color: c.ink, r: 5.5});
      api.label([rx + rs / 2, 210], "threshold " + f2(t) + " → (" + f2(k.fpr) + ", " + f2(k.tpr) + ")", {color: c.ink, size: 12, anchor: "middle"});
    }
  });
})();
