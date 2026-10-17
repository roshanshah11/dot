// A classifier's scores for 40 labelled cases (20 actually positive, 20 actually negative) and the threshold that turns
// a score into a decision: score >= threshold means "predict positive". Dots are solid blue when the decision is right
// and hollow red when it is wrong (blue/red and filled/hollow, so red-green colour-blind readers can still separate
// them), and the four groups of the confusion matrix sit in four places on the strips. The ROC curve on the right
// traces (false positive rate, true positive rate) over every threshold; the dot is the current one, the dashed
// diagonal is a coin-flip classifier (area 0.5), and the area under the curve is the share of (positive, negative)
// pairs the scores put in the right order.
// The scores are a fixed made-up set with overlap in the middle, so no threshold is perfect.
(function () {
  var POS = [0.26, 0.33, 0.39, 0.45, 0.49, 0.54, 0.58, 0.62, 0.65, 0.69, 0.72, 0.76, 0.79, 0.82, 0.85, 0.88, 0.91, 0.94, 0.96, 0.98];
  var NEG = [0.03, 0.06, 0.09, 0.12, 0.15, 0.18, 0.21, 0.24, 0.27, 0.31, 0.34, 0.37, 0.41, 0.44, 0.48, 0.52, 0.56, 0.61, 0.67, 0.74];
  function counts(t) {
    var tp = POS.filter(function (s) { return s >= t - 1e-9; }).length, fp = NEG.filter(function (s) { return s >= t - 1e-9; }).length;
    return {tp: tp, fn: POS.length - tp, fp: fp, tn: NEG.length - fp};
  }
  var AUC = (function () { var w = 0; POS.forEach(function (p) { NEG.forEach(function (n) { w += p > n ? 1 : p === n ? 0.5 : 0; }); }); return w / (POS.length * NEG.length); })();
  var f2 = function (x) { return Viz.fmt(x, 2); };

  Viz.register("classification-threshold", {
    title: "Classification threshold",
    subject: "stats",
    shows: "Slide the threshold: lowering it catches more true positives but lets in more false alarms; raising it does the reverse, and the ROC dot slides along the curve",
    params: {
      threshold: {kind: "number", default: 0.5, min: 0, max: 1, step: 0.01, label: "\\text{threshold}"}
    },
    formula: function (v) {
      var k = counts(v.threshold), pp = k.tp + k.fp;
      return "\\begin{array}{l}\\text{precision}=\\dfrac{TP}{TP+FP}=" + (pp ? "\\dfrac{" + k.tp + "}{" + pp + "}=" + Viz.n(k.tp / pp, 2) : "\\dfrac{0}{0}") +
        "\\\\[8pt]\\text{recall}=\\dfrac{TP}{TP+FN}=\\dfrac{" + k.tp + "}{" + POS.length + "}=" + Viz.n(k.tp / POS.length, 2) + "\\end{array}";
    },
    status: function (v) {
      var k = counts(v.threshold), pp = k.tp + k.fp, acc = (k.tp + k.tn) / 40;
      if (pp === 40) return "At " + f2(v.threshold) + " every case is flagged: all 20 positives are caught (recall 1), but all 20 negatives are false alarms, so precision is only <b>0.5</b>.";
      if (pp === 0) return "No score reaches " + f2(v.threshold) + ", so nothing is flagged: no false alarms, but all 20 positives are missed (<b>recall 0</b>) and precision is undefined.";
      return "At " + f2(v.threshold) + ": <b>" + k.tp + "</b> of 20 positives caught (recall " + f2(k.tp / 20) + ") with <b>" + k.fp + "</b> false alarm" + (k.fp === 1 ? "" : "s") +
        " (precision " + f2(k.tp / pp) + "), accuracy " + Math.round(acc * 100) + "%.";
    },
    examples: [
      {name: "Minimum supported values", values: {threshold: 0}},
      {name: "Maximum supported values", values: {threshold: 1}},
      {name: "cautious: high threshold", values: {threshold: 0.75}},
      {name: "catch-all: low threshold", values: {threshold: 0.25}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, t = v.threshold, k = counts(t), x0 = 76, x1 = 386;
      var X = function (s) { return x0 + (x1 - x0) * s; };
      var yP = 38, yN = 76, yA = 100;
      // predicted-positive region
      api.rect(X(t), 18, x1 - X(t), yA - 18, {fill: c.c3, fillOpacity: 0.08, rx: 0});
      api.label([4, yP], "actual +", {color: c.ink, size: 12.5, weight: 600});
      api.label([4, yN], "actual −", {color: c.ink, size: 12.5, weight: 600});
      [yP, yN].forEach(function (y) { api.line([x0, y], [x1, y], {color: c.grid, width: 1}); });
      api.line([x0, yA], [x1, yA], {color: c.axis, width: 1.2});
      [0, 0.25, 0.5, 0.75, 1].forEach(function (s) { api.label([X(s), yA + 13], String(s), {color: c.muted, size: 12, anchor: "middle"}); });
      api.label([4, yA + 13], "score", {color: c.muted, size: 12});
      // the threshold goes down before the dots, so a score right at it stays visible on top of the line
      api.line([X(t), 16], [X(t), yA], {color: c.c3, width: 2.2});
      [[POS, yP, true], [NEG, yN, false]].forEach(function (row) {
        row[0].forEach(function (s) {
          var flagged = s >= t - 1e-9, right = flagged === row[2];
          api.circle([X(s), row[1]], 4.3, right ? {fill: c.c2, fillOpacity: 0.95, stroke: c.card, width: 1} : {fill: c.card, stroke: c.c5, width: 2});
        });
      });
      api.label([X(t) + (t > 0.7 ? -6 : 6), 12], "predict + if score ≥ " + f2(t), {color: c.c3, size: 12, weight: 650, anchor: t > 0.7 ? "end" : "start"});
      api.handle([X(t), yA], {color: c.c3, r: 6, onDrag: function (q) { api.set({threshold: Math.round(Math.max(0, Math.min(1, (q[0] - x0) / (x1 - x0))) * 100) / 100}); }});
      // confusion matrix
      var mx = 76, my = 162, cw = 74, ch = 46;
      api.label([mx + cw / 2, my - 12], "predicted +", {color: c.muted, size: 12, anchor: "middle"});
      api.label([mx + cw * 1.5 + 4, my - 12], "predicted −", {color: c.muted, size: 12, anchor: "middle"});
      api.label([4, my + ch / 2], "actual +", {color: c.muted, size: 12});
      api.label([4, my + ch * 1.5 + 4], "actual −", {color: c.muted, size: 12});
      [[k.tp, "TP", c.c2, 0, 0], [k.fn, "FN", c.c5, 1, 0], [k.fp, "FP", c.c5, 0, 1], [k.tn, "TN", c.c2, 1, 1]].forEach(function (q) {
        var x = mx + q[3] * (cw + 4), y = my + q[4] * (ch + 4);
        api.rect(x, y, cw, ch, {fill: q[2], fillOpacity: 0.12 + 0.5 * q[0] / 20, stroke: q[2], width: 1.2, rx: 5});
        api.label([x + cw / 2, y + ch / 2], q[1] + " " + q[0], {color: c.ink, size: 14, weight: 700, anchor: "middle"});
      });
      // ROC curve
      var rx = 268, ry = 148, rs = 108, RX = function (f) { return rx + rs * f; }, RY = function (tpr) { return ry + rs * (1 - tpr); };
      var ths = POS.concat(NEG).sort(function (a, b) { return b - a; }), roc = [[RX(0), RY(0)]];
      ths.forEach(function (s) { var q = counts(s); roc.push([RX(q.fp / 20), RY(q.tp / 20)]); });
      api.rect(rx, ry, rs, rs, {stroke: c.axis, width: 1, rx: 0});
      api.line([RX(0), RY(0)], [RX(1), RY(1)], {color: c.muted, width: 1, dash: "4 4"});
      // the diagonal's name, in the empty triangle under it, tucked into the bottom-right corner
      var chL = api.label([RX(1) - 4, RY(0.1)], "chance (0.5)", {color: c.muted, size: 12, anchor: "end"}), chW = 0;
      try { chW = chL.getComputedTextLength(); } catch (e) {}
      var chance = [RX(1) - 4 - (chW > 0 ? chW + 1 : 12 * 12 * 0.56), RY(0.1) - 7, RX(1) - 4, RY(0.1) + 7];
      api.polyline(roc, {stroke: c.c2, width: 2});
      api.label([rx, ry - 12], "ROC, area " + f2(AUC), {color: c.c2, size: 12, weight: 650});
      [0, 1].forEach(function (q) {
        api.label([RX(q), ry + rs + 13], String(q), {color: c.muted, size: 12, anchor: "middle"});
        api.label([rx - 4, RY(q) + (q ? 4 : 0)], String(q), {color: c.muted, size: 12, anchor: "end"});
      });
      api.label([rx + rs / 2, ry + rs + 29], "false positive rate", {color: c.muted, size: 12, anchor: "middle"});
      var yx = rx - 18, yy = ry + rs / 2;
      api.label([yx, yy], "true positive rate", {color: c.muted, size: 12, anchor: "middle"}).setAttribute("transform", "rotate(-90 " + yx + " " + yy + ")");
      api.point([RX(k.fp / 20), RY(k.tp / 20)], {color: c.c3, r: 5.5});
      var fx = k.fp / 20, ty = k.tp / 20, D = [RX(fx), RY(ty)], txt = "(" + f2(fx) + ", " + f2(ty) + ")";
      // plate first, then the label, so the label can be measured (an estimate if the SVG is not laid out yet) and placed
      var plate = api.rect(0, 0, 0, 0, {fill: c.card, fillOpacity: 0.85, rx: 3}), lab = api.label([0, 0], txt, {color: c.c3, size: 12, clamp: false});
      var tw = 0;
      try { tw = lab.getComputedTextLength(); } catch (e) {}
      tw = tw > 0 ? tw + 1 : txt.length * 12 * 0.56;
      // the dot's coordinates: the first spot (below the ROC curve first, where it is empty) that stays inside the panel
      // and clear of the curve, the dot and the chance label; it may cross the dashed diagonal, so it sits on a card plate
      var dense = [];
      roc.forEach(function (q, i) {
        if (!i) return;
        var a = roc[i - 1], n = Math.ceil(Math.hypot(q[0] - a[0], q[1] - a[1]) / 2);
        for (var j = 0; j <= n; j++) dense.push([a[0] + (q[0] - a[0]) * j / n, a[1] + (q[1] - a[1]) * j / n]);
      });
      // (each spot slides sideways to stay inside the frame, so the plate never cuts the frame line)
      var spot = [[8, 13, "start"], [-8, 13, "end"], [8, 27, "start"], [-8, 27, "end"], [8, -11, "start"], [10, 0, "start"], [8, -26, "start"], [-8, -11, "end"]].map(function (o) {
        var x0 = Math.max(rx + 4, Math.min(rx + rs - 4 - tw, o[2] === "end" ? D[0] + o[0] - tw : D[0] + o[0]));
        return {at: [x0, D[1] + o[1]], b: [x0 - 2, D[1] + o[1] - 7, x0 + tw + 2, D[1] + o[1] + 7]};
      }).filter(function (q) {
        var b = q.b, inside = function (pt, pad) { return pt[0] > b[0] - pad && pt[0] < b[2] + pad && pt[1] > b[1] - pad && pt[1] < b[3] + pad; };
        return b[1] > ry + 1 && b[3] < ry + rs - 1 && !inside(D, 6) &&
          !dense.some(function (pt) { return inside(pt, 1.5); }) && !(b[0] < chance[2] && chance[0] < b[2] && b[1] < chance[3] && chance[1] < b[3]);
      })[0] || {at: [D[0] + 8, D[1] + 13], b: [D[0] + 6, D[1] + 6, D[0] + 10 + tw, D[1] + 20]};
      [["x", spot.b[0]], ["y", spot.b[1]], ["width", spot.b[2] - spot.b[0]], ["height", spot.b[3] - spot.b[1]]].forEach(function (a) { plate.setAttribute(a[0], a[1]); });
      lab.setAttribute("x", spot.at[0]); lab.setAttribute("y", spot.at[1]);
    }
  });
})();
