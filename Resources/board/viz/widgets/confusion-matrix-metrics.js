// A binary classifier's confusion matrix (rows = actual class, columns = predicted class) and the metrics read off it.
// Each cell shows its count as dots, one per case, on a 10 × 10 grid (counts run 0..100), so sizes compare at a glance.
// Correct cells are green (TP) and teal (TN); errors are red (FP, a false alarm) and amber (FN, a miss).
// precision = TP/(TP + FP), recall (sensitivity) = TP/(TP + FN), specificity = TN/(TN + FP), accuracy = (TP + TN)/total,
// F1 = 2TP/(2TP + FP + FN), the harmonic mean of precision and recall. A metric whose denominator is 0 is undefined (0/0)
// and is shown as 0/0 with an empty bar, never as 0.
(function () {
  function calc(v) {
    var tp = v.truePositiveCount, fp = v.falsePositiveCount, tn = v.trueNegativeCount, fn = v.falseNegativeCount;
    var q = function (a, b) { return b > 0 ? a / b : null; };
    return {tp: tp, fp: fp, tn: tn, fn: fn, total: tp + fp + tn + fn, pos: tp + fn, neg: tn + fp, flag: tp + fp,
            precision: q(tp, tp + fp), recall: q(tp, tp + fn), specificity: q(tn, tn + fp), accuracy: q(tp + tn, tp + fp + tn + fn), f1: q(2 * tp, 2 * tp + fp + fn)};
  }
  var f = function (x) { return x == null ? "undefined" : Viz.fmt(x, 3); };
  var tx = function (x) { return x == null ? "\\text{undef.}" : Viz.n(x, 3); };

  Viz.register("confusion-matrix-metrics", {
    title: "Confusion matrix: precision, recall and F1",
    subject: "stats",
    shows: "Change the four counts: precision asks how many flagged cases are real, recall how many real cases were caught",
    params: {
      truePositiveCount: {kind: "integer", default: 32, min: 0, max: 100, label: "\\text{TP}"},
      falsePositiveCount: {kind: "integer", default: 8, min: 0, max: 100, label: "\\text{FP}"},
      trueNegativeCount: {kind: "integer", default: 48, min: 0, max: 100, label: "\\text{TN}"},
      falseNegativeCount: {kind: "integer", default: 12, min: 0, max: 100, label: "\\text{FN}"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}\\text{precision}=\\tfrac{TP}{TP+FP}=\\tfrac{" + k.tp + "}{" + k.flag + "}=" + tx(k.precision) +
        "\\\\\\text{recall}=\\tfrac{TP}{TP+FN}=\\tfrac{" + k.tp + "}{" + k.pos + "}=" + tx(k.recall) + "\\\\" +
        "F_1=\\tfrac{2TP}{2TP+FP+FN}=\\tfrac{" + 2 * k.tp + "}{" + (2 * k.tp + k.fp + k.fn) + "}=" + tx(k.f1) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v);
      if (k.total === 0) return "No cases at all: every metric is 0/0, so all of them are <b>undefined</b>.";
      if (k.pos === 0) return "There are no actual positives, so recall is undefined; " + (k.flag ? "all " + k.flag + " flagged cases are false alarms." : "the model flags nothing, so precision is undefined too.");
      if (k.flag === 0) return "The model flags nothing: precision is undefined and recall is <b>0</b>, so all " + k.pos + " real positives are missed.";
      var tilt = k.precision > k.recall + 0.1 ? " It is cautious: few false alarms, but it misses " + k.fn + "." :
                 k.recall > k.precision + 0.1 ? " It is trigger-happy: it catches most, at the cost of " + k.fp + " false alarms." : "";
      return "Of " + k.flag + " cases flagged positive, " + k.tp + " are real (precision <b>" + f(k.precision) + "</b>); of " + k.pos +
        " real positives, " + k.tp + " were caught (recall <b>" + f(k.recall) + "</b>)." + tilt;
    },
    examples: [
      {name: "Minimum supported values", values: {truePositiveCount: 0, falsePositiveCount: 0, trueNegativeCount: 0, falseNegativeCount: 0}},
      {name: "Maximum supported values", values: {truePositiveCount: 100, falsePositiveCount: 100, trueNegativeCount: 100, falseNegativeCount: 100}},
      {name: "accurate but useless on rare cases", values: {truePositiveCount: 0, falsePositiveCount: 0, trueNegativeCount: 95, falseNegativeCount: 5}},
      {name: "flags everything", values: {truePositiveCount: 20, falsePositiveCount: 80, trueNegativeCount: 0, falseNegativeCount: 0}},
      {name: "perfect classifier", values: {truePositiveCount: 40, falsePositiveCount: 0, trueNegativeCount: 60, falseNegativeCount: 0}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      // viz.css paints every svg text ink, which beats the fill attribute; an inline style restores the label colors
      var lab0 = api.label; api.label = function (at, t, o) { var e = lab0(at, t, o); if (o && o.color) e.style.fill = o.color; return e; };
      var c = api.color, k = calc(v), cw = 90, ch = 92, gx = 66, gy = 40, gap = 4;
      // headers: rows actual, columns predicted
      api.label([gx + cw + gap / 2, 11], "predicted", {color: c.muted, size: 12, anchor: "middle"});
      api.label([gx + cw / 2, 28], "positive (" + k.flag + ")", {color: c.muted, size: 12, anchor: "middle"});
      api.label([gx + cw * 1.5 + gap, 28], "negative (" + (k.tn + k.fn) + ")", {color: c.muted, size: 12, anchor: "middle"});
      api.label([4, gy + ch / 2 - 8], "actual +", {color: c.muted, size: 12});
      api.label([4, gy + ch / 2 + 8], "(" + k.pos + ")", {color: c.muted, size: 12});
      api.label([4, gy + ch * 1.5 + gap - 8], "actual −", {color: c.muted, size: 12});
      api.label([4, gy + ch * 1.5 + gap + 8], "(" + k.neg + ")", {color: c.muted, size: 12});
      var cells = [["TP", k.tp, 0, 0, c.c4], ["FN", k.fn, 1, 0, c.c3], ["FP", k.fp, 0, 1, c.c5], ["TN", k.tn, 1, 1, c.c1]];
      cells.forEach(function (cell) {
        var x = gx + cell[2] * (cw + gap), y = gy + cell[3] * (ch + gap), col = cell[4];
        api.rect(x, y, cw, ch, {fill: col, fillOpacity: 0.08, stroke: col, width: 1.3, rx: 6});
        api.label([x + 7, y + 11], cell[0] + " " + cell[1], {color: col, size: 12.5, weight: 700});
        for (var i = 0; i < cell[1]; i++) api.circle([x + 9 + (i % 10) * 8, y + 25 + Math.floor(i / 10) * 6.6], 2.6, {fill: col, fillOpacity: 0.9});
      });
      api.label([gx + cw + gap / 2, gy + 2 * ch + gap + 14], "total " + k.total + ", accuracy " + (k.accuracy == null ? "undefined" : api.fmt(k.accuracy, 3)),
        {color: c.ink, size: 12, anchor: "middle"});
      // the metrics, each as a fraction and a bar
      var mx = 262, mw = 128, rows = [["precision", k.tp + " of " + k.flag + " flagged", k.precision], ["recall", k.tp + " of " + k.pos + " actual +", k.recall],
        ["specificity", k.tn + " of " + k.neg + " actual −", k.specificity], ["F₁", "2TP/(2TP+FP+FN)", k.f1]];
      rows.forEach(function (r, i) {
        var y = 30 + i * 62;
        api.label([mx, y], r[0], {color: c.ink, size: 13, weight: 650});
        api.label([mx + mw, y], r[2] == null ? "0/0" : api.fmt(r[2], 3), {color: r[2] == null ? c.muted : c.ink, size: 13, weight: 700, anchor: "end"});
        api.label([mx, y + 16], r[1], {color: c.muted, size: 12});
        api.rect(mx, y + 28, mw, 7, {fill: c.grid, rx: 3.5});
        if (r[2] != null) api.rect(mx, y + 28, mw * r[2], 7, {fill: c.c2, rx: 3.5}); // an undefined metric (0/0) gets no bar
      });
    }
  });
})();
