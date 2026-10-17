// Logistic regression is a straight line squashed into a probability. Top: the log-odds eta = b0 + b1 x, a line
// (clipped to -6..6). Bottom: P(Y = 1 | x) = 1 / (1 + e^(-eta)), the S-curve. Where the line crosses 0 the curve
// crosses 1/2 (the decision boundary x = -b0/b1), and there the curve is steepest, with slope b1/4 (amber tangent).
// Dot's extra x (draggable) reads both panels at one input: log-odds, odds e^eta, and the probability.
(function () {
  function sig(z) { return 1 / (1 + Math.exp(-z)); }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 3 : d); };

  Viz.register("logistic-regression", {
    title: "Logistic regression curve",
    subject: "stats",
    shows: "Slide β₀ and β₁: the log-odds β₀ + β₁x is a straight line, and the logistic function bends it into a probability between 0 and 1",
    params: {
      intercept: {kind: "number", default: -0.5, min: -2, max: 2, step: 0.1, label: "\\beta_0"},
      coefficient: {kind: "number", default: 1.2, min: -2.5, max: 2.5, step: 0.1, label: "\\beta_1"},
      x: {kind: "number", default: 1, min: -6, max: 6, step: 0.1, label: "x"}
    },
    formula: function (v) {
      var z = v.intercept + v.coefficient * v.x;
      return "\\begin{array}{l}P(Y=1\\mid x)=\\dfrac{1}{1+e^{-(\\beta_0+\\beta_1x)}}\\\\[4pt]\\quad=\\dfrac{1}{1+e^{-(" + Viz.n(v.intercept) + (v.coefficient < 0 ? "" : "+") + Viz.n(v.coefficient) +
        "\\cdot" + Viz.p(v.x) + ")}}=" + Viz.n(sig(z), 3) + "\\end{array}";
    },
    status: function (v) {
      var z = v.intercept + v.coefficient * v.x, P = sig(z);
      if (v.coefficient === 0) return "With β₁ = 0, x has no effect: P(Y=1) is <b>" + f(sig(v.intercept)) + "</b> at every x.";
      var xb = -v.intercept / v.coefficient, off = Math.abs(xb) > 6 ? " (off this chart)" : "";
      return "At x = " + f(v.x, 2) + " the log-odds are " + f(z, 2) + ", odds <b>" + (z >= 0 ? f(Math.exp(z), 2) + " to 1" : "1 to " + f(Math.exp(-z), 2)) + "</b>, so P(Y=1) = <b>" + f(P) + "</b>; P " +
        (v.coefficient > 0 ? "rises" : "falls") + " through 0.5 at x = " + f(xb, 2) + off + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {intercept: -2, coefficient: -2.5}},
      {name: "Maximum supported values", values: {intercept: 2, coefficient: 2.5}},
      {name: "no effect of x", values: {intercept: 0.8, coefficient: 0}},
      {name: "boundary at zero", values: {intercept: 0, coefficient: 1, x: 0}},
      {name: "gentle slope, boundary off the chart", values: {intercept: 2, coefficient: 0.2, x: -4}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, b0 = v.intercept, b1 = v.coefficient, x0 = 40, x1 = 384, X = function (x) { return x0 + (x1 - x0) * (x + 6) / 12; };
      var tT = 22, tB = 92, E = function (z) { return (tT + tB) / 2 - (tB - tT) / 12 * Math.max(-6, Math.min(6, z)); };
      var pT = 124, pB = 262, Y = function (p) { return pB - (pB - pT) * p; };
      var z = b0 + b1 * v.x, P = sig(z), xb = b1 !== 0 ? -b0 / b1 : null, inB = xb != null && Math.abs(xb) <= 6;
      // top panel: the log-odds line
      api.line([x0, E(0)], [x1, E(0)], {color: c.axis, width: 1.2});
      api.line([x0, tT], [x0, tB], {color: c.axis, width: 1});
      [-6, 6].forEach(function (q) { api.label([x0 - 6, E(q)], String(q).replace("-", "−"), {color: c.muted, size: 12, anchor: "end"}); });
      api.label([x0 - 6, E(0)], "0", {color: c.muted, size: 12, anchor: "end"});
      var lp = [];
      for (var xx = -6; xx <= 6.001; xx += 0.05) { var zz = b0 + b1 * xx; if (Math.abs(zz) <= 6) lp.push([X(xx), E(zz)]); else if (lp.length) { api.polyline(lp, {stroke: c.c6, width: 2.4}); lp = []; } }
      if (lp.length > 1) api.polyline(lp, {stroke: c.c6, width: 2.4});
      api.label([x0 + 6, tT - 10], "log-odds  η = β₀ + β₁x", {color: c.c6, size: 12.5, weight: 650});
      // bottom panel: the probability
      [0, 0.5, 1].forEach(function (p) {
        api.line([x0, Y(p)], [x1, Y(p)], {color: p === 0 ? c.axis : c.grid, width: p === 0 ? 1.2 : 1, dash: p === 0.5 ? "4 4" : null});
        api.label([x0 - 6, Y(p)], String(p), {color: c.muted, size: 12, anchor: "end"});
      });
      api.line([x0, pT], [x0, pB], {color: c.axis, width: 1});
      for (var t = -6; t <= 6; t += 2) api.label([X(t), pB + 14], String(t).replace("-", "−"), {color: c.muted, size: 12, anchor: "middle"});
      api.label([x1, pB + 29], "x", {color: c.muted, size: 12.5, anchor: "end", italic: true});
      api.label([x0 + 6, pT - 12], "P(Y = 1 | x)", {color: c.c2, size: 12.5, weight: 650});
      if (inB) {
        api.line([X(xb), E(0)], [X(xb), pB], {color: c.c3, width: 1.4, dash: "5 4"});
        api.point([X(xb), E(0)], {color: c.c3, r: 3.5});
        var lr = xb < 2.5;
        api.label([X(xb) + (lr ? 8 : -8), Y(b1 > 0 ? 0.32 : 0.68) + (b1 > 0 ? 12 : -12)], "P = 0.5 at x = " + f(xb, 2), {color: c.c3, size: 12, weight: 600, anchor: lr ? "start" : "end"});
        api.label([X(xb) + (lr ? 8 : -8), Y(b1 > 0 ? 0.32 : 0.68) + (b1 > 0 ? 27 : 3)], "slope β₁/4 = " + f(b1 / 4, 3), {color: c.c3, size: 12, anchor: lr ? "start" : "end"});
      }
      var sp = [];
      for (var s = -6; s <= 6.001; s += 0.05) sp.push([X(s), Y(sig(b0 + b1 * s))]);
      api.polyline(sp, {stroke: c.c2, width: 2.8});
      if (inB) {
        // tangent at the boundary, slope b1/4 per unit of x, drawn over P = 0.5 +- 0.35 so it leaves the curve visibly
        var hw = Math.min(4, 1.4 / Math.abs(b1)), ta = Math.max(-6, xb - hw), tb = Math.min(6, xb + hw), tan = function (x) { return 0.5 + b1 / 4 * (x - xb); };
        api.line([X(ta), Y(tan(ta))], [X(tb), Y(tan(tb))], {color: c.c3, width: 2, dash: "6 3"});
      }
      // the reading at x, carried through both panels
      var Pz = [X(v.x), Y(P)], Ez = [X(v.x), E(z)];
      api.line([Pz[0], tT], [Pz[0], pB], {color: c.c1, width: 1, dash: "2 4", opacity: 0.8});
      if (Math.abs(z) <= 6) api.point(Ez, {color: c.c1, r: 4.5});
      var er = v.x < 2;
      api.label([Ez[0] + (er ? 8 : -8), Math.max(tT + 6, Math.min(tB - 6, E(z) + (b1 >= 0 === er ? -11 : 11)))], "η = " + f(z, 2), {color: c.c1, size: 12, weight: 650, anchor: er ? "start" : "end"});
      api.label([Pz[0] + (er ? 10 : -10), Math.max(pT + 8, Math.min(pB - 10, Y(P) + (b1 >= 0 === er ? -13 : 13)))], "P = " + f(P), {color: c.c1, size: 12.5, weight: 700, anchor: er ? "start" : "end"});
      api.handle(Pz, {color: c.c1, r: 6, onDrag: function (q) {
        api.set({x: Math.max(-6, Math.min(6, Math.round(((q[0] - x0) / (x1 - x0) * 12 - 6) * 10) / 10))});
      }});
    }
  });
})();
