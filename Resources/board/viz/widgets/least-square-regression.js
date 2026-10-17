// Least squares, literally: each residual y_i - yhat_i of a trial line is drawn as a square (equal axis scales, so
// the area really is the residual squared). Moving the trial line changes the total area, SSE; the least squares
// line (dashed teal) is the one line with the smallest possible total, at b1 = Sxy / Sxx and b0 = ybar - b1 xbar.
// The eight points are fixed (Dot's own small data set); the trial intercept and slope are the inputs, and the two
// handles on the trial line drag its ends. Dot's own extra: the queue gives only the formula.
(function () {
  var XS = [1, 2, 3, 4, 5, 6, 7, 8], YS = [2.0, 3.4, 3.1, 4.9, 4.6, 6.4, 6.0, 7.6];
  var fit = (function () {
    var n = XS.length, mx = 0, my = 0, sxx = 0, sxy = 0, i;
    for (i = 0; i < n; i++) { mx += XS[i] / n; my += YS[i] / n; }
    for (i = 0; i < n; i++) { sxx += (XS[i] - mx) * (XS[i] - mx); sxy += (XS[i] - mx) * (YS[i] - my); }
    var b1 = sxy / sxx;
    return {mx: mx, my: my, sxx: sxx, sxy: sxy, b1: b1, b0: my - b1 * mx};
  })();
  function sse(b0, b1) { var s = 0; for (var i = 0; i < XS.length; i++) s += Math.pow(YS[i] - b0 - b1 * XS[i], 2); return s; }
  fit.sse = sse(fit.b0, fit.b1);
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };

  Viz.register("least-square-regression", {
    title: "Least squares regression line",
    subject: "stats",
    shows: "Move the trial line: each residual becomes a square, and the least squares line is the one with the smallest total area",
    params: {
      intercept: {kind: "number", default: 3.5, min: -2, max: 6, step: 0.05, label: "b_0"},
      slope: {kind: "number", default: 0.2, min: -1, max: 2, step: 0.05, label: "b_1"},
      showFit: {kind: "boolean", default: true, label: "\\text{best line}", on: "shown", off: "hidden"}
    },
    formula: function (v) {
      return "\\begin{array}{l}\\hat y=b_0+b_1x=" + Viz.n(v.intercept) + (v.slope < 0 ? "-" : "+") + Viz.n(Math.abs(v.slope)) + "x\\\\" +
        "\\textstyle\\sum(y_i-\\hat y_i)^2=" + Viz.n(sse(v.intercept, v.slope)) + "\\\\" +
        "\\text{best: }b_1=\\tfrac{S_{xy}}{S_{xx}}=" + Viz.n(fit.b1, 3) + ",\\ b_0=" + Viz.n(fit.b0, 3) + "\\end{array}";
    },
    status: function (v) {
      var s = sse(v.intercept, v.slope), gap = (s - fit.sse) / fit.sse;
      if (gap < 0.01) return "Within 1% of the minimum: this is the least squares line, total squared error <b>" + f(s) + "</b>.";
      return "Your line's squares add up to <b>" + f(s) + "</b>; the least squares line ŷ = " + f(fit.b0) + " + " + f(fit.b1) +
        "x gets the total down to <b>" + f(fit.sse) + "</b>, the smallest any line can.";
    },
    examples: [
      {name: "the least squares line", values: {intercept: 1.4, slope: 0.75}},
      {name: "flat line at the mean", values: {intercept: 4.75, slope: 0}},
      {name: "every input at its minimum", values: {intercept: -2, slope: -1, showFit: false}},
      {name: "every input at its maximum", values: {intercept: 6, slope: 2}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, b0 = v.intercept, b1 = v.slope, yh = function (x) { return b0 + b1 * x; };
      var pl = api.plane({x: [-0.5, 9.5], y: [-0.5, 9.5], box: [6, 6, 270, 278], step: 1, ticks: false, labels: false});
      var halo = function (t) { ["stroke", c.card, "stroke-width", 3, "stroke-linejoin", "round", "paint-order", "stroke"].forEach(function (x, k, l) { if (k % 2 === 0) t.setAttribute(x, l[k + 1]); }); return t; };
      var Y0 = pl.yr[0], X1 = pl.xr[1], Y1 = pl.yr[1];
      // residual squares: biggest first, each goes to the side (inward first) that overlaps the squares already placed
      // least and keeps it whole inside the first quadrant (x, y >= 0 stays clear for the tick labels), then is clipped to it
      var ov = function (p, q) { return Math.max(0, Math.min(p[2], q[2]) - Math.max(p[0], q[0])) * Math.max(0, Math.min(p[3], q[3]) - Math.max(p[1], q[1])); };
      var win = [0, 0, X1, Y1], sqs = [], i;
      XS.map(function (x, k) { return k; }).sort(function (k, j) { return Math.abs(YS[j] - yh(XS[j])) - Math.abs(YS[k] - yh(XS[k])); }).forEach(function (k) {
        var a = Math.abs(YS[k] - yh(XS[k])), lo = Math.min(YS[k], yh(XS[k])), d0 = XS[k] > 4.5 ? -1 : 1, best = null;
        if (a < 1e-9) return;
        [d0, -d0].forEach(function (d, n) {
          var q = [d > 0 ? XS[k] : XS[k] - a, lo, d > 0 ? XS[k] + a : XS[k], lo + a];
          var cost = 3 * (a * a - ov(q, win)) + sqs.reduce(function (t, o) { return t + ov(o, q); }, 0) + n * 1e-6;
          if (!best || cost < best.cost) best = {q: q, cost: cost};
        });
        sqs.push(best.q);
      });
      sqs.forEach(function (q) {
        var b = [Math.max(q[0], 0), Math.max(q[1], 0), Math.min(q[2], X1), Math.min(q[3], Y1)];
        if (b[2] <= b[0] || b[3] <= b[1]) return;
        var p0 = pl.px([b[0], b[3]]), p1 = pl.px([b[2], b[1]]);
        api.rect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1], {fill: c.c3, fillOpacity: 0.16, stroke: c.c3, width: 1, rx: 0});
      });
      for (i = 0; i < XS.length; i++) api.line(pl.px([XS[i], YS[i]]), pl.px([XS[i], Math.max(Y0, Math.min(Y1, yh(XS[i])))]), {color: c.c3, width: 1.6});
      // tick labels, skipping an x label whose residual runs down through it
      [2, 4, 6, 8].forEach(function (t) {
        if (yh(t) > -0.05) api.label([pl.x(t), pl.y(0) + 14], String(t), {color: c.muted, size: 12, anchor: "middle"});
        api.label([pl.x(0) - 6, pl.y(t)], String(t), {color: c.muted, size: 12, anchor: "end"});
      });
      if (v.showFit) {
        pl.lineThrough([0, fit.b0], [1, fit.b1], {color: c.c1, width: 2.2, dash: "7 5"});
      }
      pl.lineThrough([0, b0], [1, b1], {color: c.c3, width: 2.6});
      // below the best line's lower-left end, where no data sit; haloed over the trial line and squares
      if (v.showFit) halo(api.label([pl.x(0.15), pl.y(fit.b0 + fit.b1 * 0.15) + 20], "least squares", {color: c.c1, size: 12, weight: 650}));
      // axis names drawn over the squares, which can fill the plane at extreme settings
      halo(api.label([pl.x(X1) - 2, pl.y(0) - 11], "x", {color: c.muted, size: 12.5, anchor: "end"}));
      halo(api.label([pl.x(0) + 9, pl.y(Y1) + 6], "y", {color: c.muted, size: 12.5}));
      for (var j = 0; j < XS.length; j++) api.circle(pl.px([XS[j], YS[j]]), 4.2, {fill: c.ink});
      // handles at the two ends of the data: drag one end, the other stays put
      function setEnds(yl, yr) {
        var s1 = Math.max(-1, Math.min(2, Math.round((yr - yl) / 7 * 20) / 20));
        api.set({slope: s1, intercept: Math.max(-2, Math.min(6, Math.round((yl - s1) * 20) / 20))});
      }
      var cl = function (y) { return Math.max(Y0 + 0.6, Math.min(Y1 - 0.2, y)); };   // clamped clear of the x tick labels
      api.handle(pl.px([1, cl(yh(1))]), {color: c.c3, r: 6, onDrag: function (q) { setEnds(pl.invert(q)[1], yh(8)); }});
      api.handle(pl.px([8, cl(yh(8))]), {color: c.c3, r: 6, onDrag: function (q) { setEnds(yh(1), pl.invert(q)[1]); }});
      // the two totals side by side, on one scale
      var s = sse(b0, b1), mx = Math.max(s, fit.sse), bx = [306, 360], base = 250, hpx = 170;
      api.label([333, 22], "Σ squares", {color: c.muted, size: 12.5, anchor: "middle"});
      api.line([284, base], [390, base], {color: c.axis, width: 1.3});
      var hs = hpx * s / mx, hf = hpx * fit.sse / mx;
      api.rect(bx[0] - 18, base - hs, 36, hs, {fill: c.c3, fillOpacity: 0.75, rx: 3});
      api.rect(bx[1] - 18, base - hf, 36, hf, {fill: c.c1, fillOpacity: v.showFit ? 0.75 : 0.3, rx: 3});
      api.label([bx[0], base - hs - 11], f(s), {color: c.c3, size: 12.5, weight: 650, anchor: "middle"});
      api.label([bx[1], base - hf - 11], f(fit.sse), {color: c.c1, size: 12.5, weight: 650, anchor: "middle"});
      api.label([bx[0], base + 14], "yours", {color: c.c3, size: 12, anchor: "middle"});
      api.label([bx[1], base + 14], "best", {color: c.c1, size: 12, anchor: "middle"});
    }
  });
})();
