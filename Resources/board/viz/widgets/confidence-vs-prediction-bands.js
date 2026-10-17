// Simple linear regression on twelve fixed points (Dot's own data). Two bands around the least squares line:
//   confidence band for the mean response:  ŷ ± t*·s·sqrt(1/n + (x0 − x̄)²/Sxx)
//   prediction band for one new response:   ŷ ± t*·s·sqrt(1 + 1/n + (x0 − x̄)²/Sxx)
// with s the residual standard error and t* the two-sided t critical value on n − 2 = 10 degrees of freedom. Both
// are narrowest at x̄ and flare away from it; the extra 1 under the root (one new point's own scatter) keeps the
// prediction band wide even where the line itself is pinned down. The t values are the df = 10 table entries
// (1.812461, 2.228139, 3.169273), checked against a numerical t CDF. Drag the dot on the line (or the x0 slider).
(function () {
  var XS = [1, 1.8, 2.5, 3.2, 4, 4.6, 5.3, 6, 6.8, 7.5, 8.2, 9], YS = [2.8, 2.26, 3.55, 3.04, 5.1, 4.52, 5.61, 4.8, 6.76, 6.85, 6.64, 8.2];
  var T10 = {"90%": 1.812461, "95%": 2.228139, "99%": 3.169273};
  var fit = (function () {
    var n = XS.length, mx = 0, my = 0, sxx = 0, sxy = 0, sse = 0, i;
    for (i = 0; i < n; i++) { mx += XS[i] / n; my += YS[i] / n; }
    for (i = 0; i < n; i++) { sxx += Math.pow(XS[i] - mx, 2); sxy += (XS[i] - mx) * (YS[i] - my); }
    var b1 = sxy / sxx, b0 = my - b1 * mx;
    for (i = 0; i < n; i++) sse += Math.pow(YS[i] - b0 - b1 * XS[i], 2);
    return {n: n, mx: mx, sxx: sxx, b0: b0, b1: b1, s: Math.sqrt(sse / (n - 2))};
  })();
  function bands(x, level) {
    var t = T10[level], lev = 1 / fit.n + Math.pow(x - fit.mx, 2) / fit.sxx;
    return {y: fit.b0 + fit.b1 * x, t: t, ci: t * fit.s * Math.sqrt(lev), pi: t * fit.s * Math.sqrt(1 + lev)};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 2 : d); };

  Viz.register("confidence-vs-prediction-bands", {
    title: "Confidence band vs prediction band",
    subject: "stats",
    shows: "Around a regression line, the confidence band covers the mean y and the wider prediction band covers one new y; both flare away from x̄",
    params: {
      confidence_level: {kind: "enum", values: ["90%", "95%", "99%"], default: "95%", label: "\\text{level}"},
      x0: {kind: "number", default: 8.5, min: 0, max: 10, step: 0.5, label: "x_0"}
    },
    formula: function (v) {
      var b = bands(v.x0, v.confidence_level), h = 1 / fit.n + Math.pow(v.x0 - fit.mx, 2) / fit.sxx;
      return "\\begin{array}{l}h_0=\\tfrac1n+\\tfrac{(x_0-\\bar x)^2}{S_{xx}}=" + Viz.n(h, 3) + "\\\\s=" + Viz.n(fit.s, 3) + ",\\ t^*_{10}=" + Viz.n(b.t, 3) + ",\\ \\hat y=" + Viz.n(b.y) + "\\\\" +
        "\\text{CI: }\\hat y\\pm t^*s\\sqrt{h_0}=" + Viz.n(b.y) + "\\pm" + Viz.n(b.ci) + "\\\\" +
        "\\text{PI: }\\hat y\\pm t^*s\\sqrt{1+h_0}=" + Viz.n(b.y) + "\\pm" + Viz.n(b.pi) + "\\end{array}";
    },
    status: function (v) {
      var b = bands(v.x0, v.confidence_level), lv = v.confidence_level;
      var near = Math.abs(v.x0 - fit.mx) < 0.26 ? " This is x̄, where both bands are narrowest." : "";
      return "At x = " + f(v.x0, 1) + " the " + lv + " confidence band for the mean y runs from <b>" + f(b.y - b.ci) + "</b> to <b>" + f(b.y + b.ci) +
        "</b>, but one new y could land from <b>" + f(b.y - b.pi) + "</b> to <b>" + f(b.y + b.pi) + "</b>: " + f(b.pi / b.ci, 1) + "× as wide." + near;
    },
    examples: [
      {name: "confidence_level: 90%", values: {confidence_level: "90%"}},
      {name: "confidence_level: 99%", values: {confidence_level: "99%"}},
      {name: "at the mean of x", values: {x0: 5}},
      {name: "past the data, 99%", values: {x0: 10, confidence_level: "99%"}},
      {name: "x0 at its minimum", values: {x0: 0}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      // viz.css paints every svg text ink, which beats the fill attribute; an inline style restores the label colors
      var lab0 = api.label; api.label = function (at, t, o) { var e = lab0(at, t, o); if (o && o.color) e.style.fill = o.color; return e; };
      var c = api.color, lv = v.confidence_level;
      var pl = api.plane({x: [0, 10], y: [-1, 11], box: [8, 6, 384, 276], equal: false, step: 1, tickEvery: 2, xLabel: "x", yLabel: "y"});
      var cl = function (y) { return Math.max(-1, Math.min(11, y)); };
      var up = [], lo = [], cu = [], cd = [];
      for (var x = 0; x <= 10.0001; x += 0.1) {
        var b = bands(x, lv);
        up.push(pl.px([x, cl(b.y + b.pi)])); lo.push(pl.px([x, cl(b.y - b.pi)]));
        cu.push(pl.px([x, cl(b.y + b.ci)])); cd.push(pl.px([x, cl(b.y - b.ci)]));
      }
      api.polygon(up.concat(lo.slice().reverse()), {fill: c.c2, fillOpacity: 0.13});
      api.polyline(up, {stroke: c.c2, width: 1.4, dash: "5 4"}); api.polyline(lo, {stroke: c.c2, width: 1.4, dash: "5 4"});
      api.polygon(cu.concat(cd.slice().reverse()), {fill: c.c1, fillOpacity: 0.32});
      api.polyline(cu, {stroke: c.c1, width: 1.3}); api.polyline(cd, {stroke: c.c1, width: 1.3});
      pl.lineThrough([0, fit.b0], [1, fit.b1], {color: c.ink, width: 2});
      // x-bar, where both bands pinch
      api.line(pl.px([fit.mx, -0.4]), pl.px([fit.mx, 0.4]), {color: c.muted, width: 1.5});
      api.label(pl.px([fit.mx, 0.95]), "x̄ = " + api.fmt(fit.mx), {color: c.muted, size: 12, anchor: "middle", raw: true});
      for (var i = 0; i < XS.length; i++) api.circle(pl.px([XS[i], YS[i]]), 3.6, {fill: c.c3});
      // both intervals at x0
      var b0 = bands(v.x0, lv), left = v.x0 > 5, dx = left ? -7 : 7;
      api.line(pl.px([v.x0, cl(b0.y + b0.pi)]), pl.px([v.x0, cl(b0.y - b0.pi)]), {color: c.c2, width: 3});
      api.line([pl.x(v.x0) + dx, pl.y(cl(b0.y + b0.ci))], [pl.x(v.x0) + dx, pl.y(cl(b0.y - b0.ci))], {color: c.c1, width: 5});
      [b0.y + b0.pi, b0.y - b0.pi].forEach(function (e) { if (e > -1 && e < 11) api.line([pl.x(v.x0) - 5, pl.y(e)], [pl.x(v.x0) + 5, pl.y(e)], {color: c.c2, width: 2}); });
      api.handle(pl.px([v.x0, b0.y]), {color: c.ink, r: 6, onDrag: function (q) { api.set({x0: Math.max(0, Math.min(10, Math.round(pl.invert(q)[0] * 2) / 2))}); }});
      // which band is which, read at x0
      api.label([pl.x(0.6), pl.y(10.4)], lv + " bands at x₀ = " + api.fmt(v.x0), {color: c.muted, size: 12, raw: true});
      api.label([pl.x(0.6), pl.y(9.6)], "prediction, one new y: " + f(b0.y - b0.pi) + " to " + f(b0.y + b0.pi), {color: c.c2, size: 12.5, weight: 650});
      api.label([pl.x(0.6), pl.y(8.8)], "confidence, the mean y: " + f(b0.y - b0.ci) + " to " + f(b0.y + b0.ci), {color: c.c1, size: 12.5, weight: 650});
    }
  });
})();
