// Outliers, leverage and influence in simple regression. Twelve fixed points follow a trend; the amber point can be
// dragged anywhere and starts in one of three classic spots. The dashed line is the least-squares fit without it,
// the blue line the fit with it. Leverage h = 1/n + (x − x̄)²/Sxx grows with distance from x̄; the standardized
// residual r = e/(s√(1 − h)) measures how far off the trend it sits; Cook's D = r²h/(2(1 − h)) combines the two into
// how much the fit moves. Cut-offs: h > 2p/n (p = 2 coefficients), |r| > 2, D > 1.
// The case buttons place the point; dx, dy are the drag offset from that spot, cleared when the case changes.
(function () {
  var XS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7];
  var YS = XS.map(function (x, i) { return 2 + 0.8 * x + [0.4, -0.5, 0.3, -0.2, 0.6, -0.4, 0.1, -0.6, 0.5, -0.1, 0.3, -0.4][i]; });
  var XR = [0, 14], YR = [0, 16], lastCase = new WeakMap();
  function fit(X, Y) {
    var n = X.length, mx = 0, my = 0, sxx = 0, sxy = 0, i;
    for (i = 0; i < n; i++) { mx += X[i] / n; my += Y[i] / n; }
    for (i = 0; i < n; i++) { sxx += (X[i] - mx) * (X[i] - mx); sxy += (X[i] - mx) * (Y[i] - my); }
    var b1 = sxy / sxx; return {b0: my - b1 * mx, b1: b1, mx: mx, sxx: sxx};
  }
  var BASE = fit(XS, YS);   // the "aligned" spot sits exactly on the fit without it
  var PRESET = {"central-outlier": [4.2, 10.4], "aligned-high-leverage": [13, BASE.b0 + 13 * BASE.b1], influential: [13, 4.5]};
  function point(v) {
    var P = PRESET[v.initial_case];
    return [Math.max(XR[0] + 0.2, Math.min(XR[1] - 0.2, P[0] + v.dx)), Math.max(YR[0] + 0.2, Math.min(YR[1] - 0.2, P[1] + v.dy))];
  }
  function calc(v) {
    var P = point(v), X = XS.concat([P[0]]), Y = YS.concat([P[1]]), n = X.length;
    var w = fit(X, Y), wo = fit(XS, YS), sse = 0;
    for (var i = 0; i < n; i++) { var e = Y[i] - (w.b0 + w.b1 * X[i]); sse += e * e; }
    var s = Math.sqrt(sse / (n - 2)), h = 1 / n + Math.pow(P[0] - w.mx, 2) / w.sxx, res = P[1] - (w.b0 + w.b1 * P[0]);
    var r = res / (s * Math.sqrt(1 - h)), D = r * r * h / (2 * (1 - h));
    return {P: P, n: n, w: w, wo: wo, h: h, res: res, r: r, D: D, hCut: 4 / n, highLev: h > 4 / n, outlier: Math.abs(r) > 2, infl: D > 1};
  }
  function tint(api) { api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; }); }   // viz.css paints text ink

  Viz.register("outlier-leverage-influence", {
    title: "Outliers, leverage and influence",
    subject: "stats",
    shows: "Drag the amber point: leverage grows with its distance from x̄, the residual with its distance from the trend, and only together do they swing the line",
    params: {
      initial_case: {kind: "enum", values: ["central-outlier", "aligned-high-leverage", "influential"], default: "influential", label: "case",
                     names: {"central-outlier": "outlier at x̄", "aligned-high-leverage": "high leverage", influential: "influential"}},
      dx: {kind: "number", default: 0, min: -14, max: 14, step: 0.1, control: false},
      dy: {kind: "number", default: 0, min: -16, max: 16, step: 0.1, control: false}
    },
    formula: function (v) {
      var b = calc(v), f = function (q) { return Viz.n(q.b0, 2) + (q.b1 < 0 ? "-" : "+") + Viz.n(Math.abs(q.b1), 3) + "x"; };
      return "\\begin{array}{l}\\hat y_{\\text{with}}=" + f(b.w) + "\\\\[2pt]\\hat y_{\\text{without}}=" + f(b.wo) +
        "\\\\[4pt]h=\\tfrac{1}{n}+\\tfrac{(x-\\bar x)^2}{S_{xx}}=" + Viz.n(b.h, 3) +
        "\\\\[4pt]r=" + Viz.n(b.r, 2) + ",\\ \\ D=\\tfrac{r^2}{2}\\cdot\\tfrac{h}{1-h}=" + Viz.n(b.D, 2) + "\\end{array}";
    },
    status: function (v) {
      var b = calc(v), sl = "slope " + Viz.fmt(b.wo.b1, 2) + " → " + Viz.fmt(b.w.b1, 2);
      if (b.infl) return "<b>Influential</b> (D = " + Viz.fmt(b.D, 2) + " > 1): " + (b.highLev ? "far from x̄ and off the trend, it" : "it") + " drags the line, " + sl + ".";
      if (b.outlier && !b.highLev) return "<b>An outlier, not influential</b>: " + Viz.fmt(Math.abs(b.r), 2) + " SDs off the trend, but close to x̄ (h = " + Viz.fmt(b.h, 2) + ") it mostly lifts the line: " + sl + ".";
      if (b.highLev && !b.outlier) return "<b>High leverage, low influence</b>: far out in x (h = " + Viz.fmt(b.h, 2) + ") but on the trend, so the line barely moves: " + sl + ".";
      if (b.highLev) return "<b>High leverage and off the trend</b>, yet D = " + Viz.fmt(b.D, 2) + " stays under 1: " + sl + ".";
      return "<b>An ordinary point</b>: small residual (r = " + Viz.fmt(b.r, 2) + ") and low leverage (h = " + Viz.fmt(b.h, 2) + "), so " + sl + ".";
    },
    examples: [
      {name: "initial_case: central-outlier", values: {initial_case: "central-outlier"}},
      {name: "initial_case: aligned-high-leverage", values: {initial_case: "aligned-high-leverage"}},
      {name: "an ordinary point", values: {initial_case: "central-outlier", dy: -5.5}}
    ],
    size: [400, 310],
    draw: function (api, v) {
      var prev = lastCase.get(api.svg);
      if (prev && prev !== v.initial_case) { v.dx = 0; v.dy = 0; }   // a new case puts the point back on its spot
      lastCase.set(api.svg, v.initial_case);
      var c = api.color, b = calc(v);
      var pl = api.plane({x: XR, y: YR, box: [30, 8, 362, 200], equal: false, grid: true, step: 2, tickEvery: 4, ticks: true});
      // x̄ (with the point) and the point's distance from it, which is what leverage measures
      api.line(pl.px([b.w.mx, 0]), pl.px([b.w.mx, 15.6]), {color: c.faint, width: 1.2, dash: "2 4"});
      api.label(pl.px([b.w.mx, 15.4]), "x̄", {color: c.muted, size: 12.5, anchor: "middle"});
      // both fits
      var clipY = function (q, x) { return Math.max(0.6, Math.min(15.4, q.b0 + q.b1 * x)); };
      var seg = function (q, st) { var a = pl.through([0, q.b0], [1, q.b1]); if (a) api.line(pl.px(a[0]), pl.px(a[1]), st); };
      seg(b.wo, {color: c.muted, width: 2, dash: "6 5"});
      seg(b.w, {color: c.c2, width: 2.6});
      var yWo = pl.y(clipY(b.wo, 14)), yW = pl.y(clipY(b.w, 14));
      if (Math.abs(yWo - yW) < 15) { if (yW < yWo) { yW = yWo - 15; } else { yW = yWo + 15; } }
      api.label([pl.x(14) - 2, yW - 9], "with", {color: c.c2, size: 12, weight: 650, anchor: "end"});
      api.label([pl.x(14) - 2, yWo - 9], "without", {color: c.muted, size: 12, anchor: "end"});
      // the data, the residual of the amber point, the point itself
      XS.forEach(function (x, i) { api.point(pl.px([x, YS[i]]), {color: c.c1, r: 3.8}); });
      var fitY = b.w.b0 + b.w.b1 * b.P[0];
      if (Math.abs(b.res) > 0.05) api.line(pl.px(b.P), pl.px([b.P[0], Math.max(0, Math.min(16, fitY))]), {color: c.c6, width: 2, dash: "4 3"});
      api.handle(pl.px(b.P), {color: c.c3, r: 7, onDrag: function (q) {
        var d = pl.invert(q), P0 = PRESET[v.initial_case];
        var x = Math.max(0.2, Math.min(13.8, d[0])), y = Math.max(0.2, Math.min(15.8, d[1]));
        api.set({dx: Math.round((x - P0[0]) * 10) / 10, dy: Math.round((y - P0[1]) * 10) / 10});
      }});
      if (Math.abs(pl.y(b.P[1]) - pl.y(fitY)) > 26) api.label([pl.x(b.P[0]) + (b.P[0] > 10 ? -10 : 10), (pl.y(b.P[1]) + pl.y(fitY)) / 2], "residual", {color: c.c6, size: 12, anchor: b.P[0] > 10 ? "end" : "start"});
      // three meters, each with its cut-off; a bar turns red once it crosses
      var rows = [["leverage h", b.h, 1, b.hCut, api.fmt(b.h, 2)], ["std. residual |r|", Math.abs(b.r), 4, 2, api.fmt(Math.abs(b.r), 2)], ["Cook's D", b.D, 2, 1, api.fmt(b.D, 2)]];
      rows.forEach(function (row, k) {
        var y = 240 + k * 24, bx0 = 128, bx1 = 296, frac = Math.min(1, row[1] / row[2]), over = row[1] > row[3];
        api.label([10, y], row[0], {color: c.muted, size: 12});
        api.rect(bx0, y - 6, bx1 - bx0, 12, {fill: c.grid, rx: 3});
        api.rect(bx0, y - 6, Math.max(2, (bx1 - bx0) * frac), 12, {fill: over ? c.c5 : c.muted, fillOpacity: over ? 0.85 : 0.5, rx: 3});
        var cx = bx0 + (bx1 - bx0) * row[3] / row[2];
        api.line([cx, y - 9], [cx, y + 9], {color: c.ink, width: 1.6});
        api.label([bx1 + 8, y], row[4] + (over ? " > " : " ≤ ") + api.fmt(row[3], 2), {color: over ? c.c5 : c.ink, size: 12.5, weight: 650});
      });
      tint(api);
    }
  });
})();
