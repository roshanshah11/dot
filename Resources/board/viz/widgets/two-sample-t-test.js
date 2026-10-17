// A two-sample t test from its three numbers: the difference in sample means, its standard error and the degrees of
// freedom. t = (x1bar - x2bar) / SE counts how many standard errors the difference sits from 0; the amber ruler along the
// top marks off one SE per tick. The curve is the t distribution under H0 (equal means); the red tails beyond +-|t| are the
// two-sided p-value, and the dashed lines are the 5% cutoffs +-t*. The second row of axis numbers reads the same points in
// the data's units (t * SE). Tails: P(|T| >= |t|) = I_{df/(df+t^2)}(df/2, 1/2), the regularized incomplete beta function
// (continued fraction, Numerical Recipes 6.4). df is a number, not an integer, so a Welch df such as 17.6 is used as given.
(function () {
  function lnG(z) {
    var p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
             12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnG(1 - z);
    z -= 1; var x = p[0]; for (var i = 1; i < 9; i++) x += p[i] / (z + i);
    var t = z + 7.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function betacf(a, b, x) {
    var tiny = 1e-300, qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < tiny) d = tiny; d = 1 / d; var h = d;
    for (var m = 1; m <= 300; m++) {
      var m2 = 2 * m, aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny; c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny; c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d;
      var del = d * c; h *= del; if (Math.abs(del - 1) < 1e-15) break;
    }
    return h;
  }
  function ibeta(x, a, b) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var bt = Math.exp(lnG(a + b) - lnG(a) - lnG(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function tail2(t, df) { return ibeta(df / (df + t * t), df / 2, 0.5); }
  function tpdf(t, df) { return Math.exp(lnG((df + 1) / 2) - lnG(df / 2) - 0.5 * Math.log(df * Math.PI) - (df + 1) / 2 * Math.log(1 + t * t / df)); }
  function tcrit(a2, df) { var lo = 0, hi = 1000; for (var i = 0; i < 100; i++) { var m = (lo + hi) / 2; if (tail2(m, df) > a2) lo = m; else hi = m; } return (lo + hi) / 2; }
  function pNum(p) {
    if (p < 0.0001) return "< 0.0001";
    if (Math.abs(p - 0.05) < 0.005) { var t = p.toPrecision(3); return "= " + (t === "0.0500" ? p.toPrecision(4) : t); }
    return "= " + Viz.fmt(p, p < 0.01 ? 4 : 3);
  }
  function calc(v) { var t = v.meanDifference / v.standardError, df = v.degreesOfFreedom; return {t: t, df: df, p: tail2(t, df), cut: tcrit(0.05, df)}; }

  Viz.register("two-sample-t-test", {
    title: "Two-sample t test",
    subject: "stats",
    shows: "Set the difference in means, its standard error and the df: t counts the standard errors between the difference and 0, and the red tails beyond it are the p-value",
    params: {
      meanDifference: {kind: "number", default: 1.5, min: -3, max: 3, step: 0.05, label: "\\bar x_1-\\bar x_2"},
      standardError: {kind: "number", default: 0.75, min: 0.75, max: 3, step: 0.05, label: "SE"},
      degreesOfFreedom: {kind: "number", default: 20, min: 2, max: 200, step: 1, label: "\\text{df}"}
    },
    formula: function (v) {
      var r = calc(v);
      return "\\begin{array}{l}t=\\dfrac{\\bar x_1-\\bar x_2}{SE}=\\dfrac{" + Viz.n(v.meanDifference) + "}{" + Viz.n(v.standardError) + "}=" + Viz.n(r.t, 2) + "\\\\[4pt]" +
        "p=2P(T_{" + Viz.n(r.df, 1) + "}\\ge" + Viz.n(Math.abs(r.t), 2) + ")" + (r.p < 0.0001 ? "<0.0001" : "=" + pNum(r.p).slice(2)) + "\\end{array}";
    },
    status: function (v) {
      var r = calc(v), d = Viz.fmt(v.meanDifference), se = Viz.fmt(Math.abs(r.t), 2);
      if (v.meanDifference === 0) return "The sample means are equal, so t = 0 and <b>p = 1</b>: no evidence the population means differ.";
      var unit = se === "1" ? " standard error" : " standard errors";
      if (r.p < 0.05) return "The difference of " + d + " is " + se + unit + " from 0, past the 5% cutoff ±" + r.cut.toFixed(3) + ", so <b>p " + pNum(r.p) + "</b>: reject equal means.";
      return "The difference of " + d + " is only " + se + unit + " from 0, inside the 5% cutoffs ±" + r.cut.toFixed(3) + ", so <b>p " + pNum(r.p) + "</b>: not significant.";
    },
    examples: [
      {name: "Minimum supported values", values: {meanDifference: -3, standardError: 0.75, degreesOfFreedom: 2}},
      {name: "Maximum supported values", values: {meanDifference: 3, standardError: 3, degreesOfFreedom: 200}},
      {name: "same difference, noisier data", values: {meanDifference: 1.5, standardError: 1.5, degreesOfFreedom: 20}},
      {name: "no difference", values: {meanDifference: 0}},
      {name: "clear difference", values: {meanDifference: 2.4, standardError: 0.8, degreesOfFreedom: 40}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, r = calc(v), t = r.t, df = r.df, se = v.standardError;
      var R = 6, x0 = 22, x1 = 378, base = 204, top = 92, ymax = tpdf(0, 200);
      var X = function (q) { return x0 + (x1 - x0) * (q + R) / (2 * R); }, Y = function (d) { return base - (base - top) * d / ymax; };
      var curve = function (a, b) { var out = [], n = 100; for (var i = 0; i <= n; i++) { var q = a + (b - a) * i / n; out.push([X(q), Y(tpdf(q, df))]); } return out; };
      // the 5% rejection regions, then the p-value tails, then the null curve
      var cut = r.cut, a = Math.abs(t);
      if (cut < R) [[x0, X(-cut)], [X(cut), x1]].forEach(function (s) { api.rect(s[0], 76, s[1] - s[0], base - 76, {fill: c.muted, fillOpacity: 0.08, rx: 0}); });
      [[-R, -a], [a, R]].forEach(function (s) { if (s[1] - s[0] > 1e-6) api.polygon([[X(s[0]), base]].concat(curve(s[0], s[1]), [[X(s[1]), base]]), {fill: c.c5, fillOpacity: 0.55}); });
      api.polyline(curve(-R, R), {stroke: c.c2, width: 2.4});
      // the curve's name rides its far tail on the side away from t (|t| <= 4 here, so no t line reaches it)
      api.label([t >= 0 ? x0 + 2 : x1 - 2, Y(tpdf(4.8, df)) - 13], "H₀: equal means", {color: c.c2, size: 12.5, anchor: t >= 0 ? "start" : "end"});
      if (cut < R) {
        [-cut, cut].forEach(function (q) { api.line([X(q), base], [X(q), 76], {color: c.muted, width: 1.3, dash: "4 4"}); });
        api.label([t >= 0 ? X(-cut) - 5 : X(cut) + 5, 84], "±" + cut.toFixed(3), {color: c.muted, size: 12, anchor: t >= 0 ? "end" : "start"});   // on the side away from t's line
      } else api.label([x1, 84], "5% cutoffs ±" + cut.toFixed(3) + ", off the chart", {color: c.muted, size: 12, anchor: "end"});
      // two axis rows: t, and the same points in the data's units
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.2});
      for (var k = -R + 1; k <= R - 1; k++) {
        api.line([X(k), base], [X(k), base + 4], {color: c.axis, width: 1});
        if (k % 2 === 0) api.label([X(k), base + 15], api.fmt(k), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x1, base + 15], "t", {color: c.muted, size: 12.5, anchor: "end", italic: true});
      var span = R * se, nice = [0.5, 1, 2, 2.5, 5, 10].filter(function (s) { return s / se >= 1.6; })[0] || 10;
      api.line([x0, base + 27], [x1 - 52, base + 27], {color: c.axis, width: 1});
      for (var raw = -Math.floor(span / nice) * nice; raw <= span + 1e-9; raw += nice) {
        var px = X(raw / se); if (px > x1 - 52 || px < x0) continue;
        api.line([px, base + 27], [px, base + 23], {color: c.axis, width: 1});
        api.label([px, base + 39], api.fmt(raw, 2), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x1, base + 31], "x̄₁ − x̄₂", {color: c.muted, size: 12, anchor: "end"});
      // the observed difference: its line, its mirror, and the ruler counting standard errors from 0
      api.line([X(t), base], [X(t), 50], {color: c.c3, width: 2.4});
      if (a > 0) api.line([X(-t), base], [X(-t), Y(tpdf(t, df))], {color: c.c3, width: 1.4, dash: "3 3"});
      var ry = 50, dir = t >= 0 ? 1 : -1;
      if (a > 0.02) {
        api.line([X(0), ry], [X(t), ry], {color: c.c3, width: 3});
        for (var j = 0; j <= Math.floor(a + 1e-9); j++) api.line([X(dir * j), ry - 6], [X(dir * j), ry + 6], {color: c.c3, width: 1.8});
      }
      api.line([X(0), ry + 8], [X(0), base], {color: c.faint, width: 1, dash: "2 4"});
      api.label([X(t / 2), 30], api.fmt(v.meanDifference) + " ÷ " + api.fmt(se, 2) + " = " + api.fmt(a, 2) + " SE" + (t < 0 ? " below 0" : t > 0 ? " above 0" : ""), {color: c.c3, size: 13, weight: 700, anchor: "middle"});
      api.label([t >= 0 ? x0 : x1, 66], "p " + pNum(r.p), {color: c.c5, size: 14, weight: 700, anchor: t >= 0 ? "start" : "end"});
      var off = tail2(R, df);   // heavy tails at low df: say how much of p runs past the chart's edge
      if (off >= 0.001 && a < R) api.label([t >= 0 ? x0 : x1, 262], Viz.fmt(off, 3) + " of p lies past ±" + R + ", off the chart", {color: c.c5, size: 12, anchor: t >= 0 ? "start" : "end"});
      api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
