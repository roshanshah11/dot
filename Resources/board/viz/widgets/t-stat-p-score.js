// From a t statistic to its p-value: the t density with df degrees of freedom, the observed t (amber, draggable on the
// axis) and the p-value as the red tail area beyond it, both tails for a two-sided test. The one-sided test is taken in
// the direction of the observed t (H1: mu > mu0 when t >= 0, mu < mu0 when t < 0), so its p is half the two-sided one.
// Tails come from P(|T| >= |t|) = I_{df/(df+t^2)}(df/2, 1/2), the regularized incomplete beta function (continued
// fraction, Numerical Recipes 6.4); at 1 df this is the Cauchy tail 1 - 2 atan|t| / pi. The dashed lines are the 5% cutoffs.
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
  function pOf(v) { var p2 = tail2(v.tStatistic, v.degreesOfFreedom); return v.testType === "one_sided" ? p2 / 2 : p2; }
  function pNum(p) { // four places near 0.05 so a borderline p never rounds onto the cutoff
    if (p < 0.0001) return "< 0.0001";
    if (Math.abs(p - 0.05) < 0.005) { var t = p.toPrecision(3); return "= " + (t === "0.0500" ? p.toPrecision(4) : t); }
    return "= " + Viz.fmt(p, p < 0.01 ? 4 : 3);
  }

  Viz.register("t-stat-p-score", {
    title: "From a t statistic to a p-value",
    subject: "stats",
    shows: "Drag t and set the degrees of freedom: the red tail area beyond t is the p-value, doubled for a two-sided test",
    params: {
      tStatistic: {kind: "number", default: 2, min: -5, max: 5, step: 0.01, label: "t"},
      degreesOfFreedom: {kind: "integer", default: 10, min: 1, max: 50, label: "\\text{df}"},
      testType: {kind: "enum", values: ["one_sided", "two_sided"], default: "two_sided", names: {one_sided: "one-sided", two_sided: "two-sided"}, label: "\\text{test}"}
    },
    formula: function (v) {
      var t = v.tStatistic, df = v.degreesOfFreedom, p = pOf(v), tt = Viz.n(t, 2), at = Viz.n(Math.abs(t), 2);
      var expr = v.testType === "two_sided" ? "2P(T_{" + df + "}\\ge " + at + ")" : t >= 0 ? "P(T_{" + df + "}\\ge " + tt + ")" : "P(T_{" + df + "}\\le " + tt + ")";
      return "p=" + expr + (p < 0.0001 ? "<0.0001" : "=" + pNum(p).slice(2));
    },
    status: function (v) {
      var t = v.tStatistic, df = v.degreesOfFreedom, p = pOf(v), two = v.testType === "two_sided";
      var cut = two ? tcrit(0.05, df) : tcrit(0.1, df), side = t >= 0 ? "μ > μ₀" : "μ < μ₀";
      if (t === 0) return "t = 0 is exactly what H₀ predicts: <b>p " + (two ? "= 1" : "= 0.5") + "</b>, no evidence at all.";
      var head = two ? "Two-sided: " : "One-sided (H₁: " + side + "): ", what = two ? "|t| = " + Viz.fmt(Math.abs(t), 2) : "t = " + Viz.fmt(t, 2);
      var cutTxt = two ? "±" + cut.toFixed(3) : Viz.fmt(t < 0 ? -cut : cut, 3);
      if (p < 0.05) return head + what + " is past the 5% cutoff " + cutTxt + " for " + df + " df, so <b>p " + pNum(p) + "</b>" + (p < 0.0001 ? "" : " < 0.05") + ": reject H₀.";
      return head + "a t this extreme turns up " + Viz.fmt(100 * p, 1) + "% of the time under H₀ with " + df + " df, so <b>p " + pNum(p) + "</b> ≥ 0.05: not significant.";
    },
    examples: [
      {name: "Minimum supported values", values: {tStatistic: -5, degreesOfFreedom: 1}},
      {name: "Maximum supported values", values: {tStatistic: 5, degreesOfFreedom: 50}},
      {name: "testType: one_sided", values: {testType: "one_sided"}},
      {name: "t = 0: no evidence", values: {tStatistic: 0}},
      {name: "same t, few df", values: {tStatistic: 2.5, degreesOfFreedom: 3}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, t = v.tStatistic, df = v.degreesOfFreedom, two = v.testType === "two_sided", p = pOf(v);
      var R = 6, x0 = 20, x1 = 380, base = 200, top = 80, ymax = tpdf(0, 50);
      var X = function (q) { return x0 + (x1 - x0) * (q + R) / (2 * R); }, Y = function (d) { return base - (base - top) * d / ymax; };
      var curve = function (a, b) { var out = [], n = 100; for (var i = 0; i <= n; i++) { var q = a + (b - a) * i / n; out.push([X(q), Y(tpdf(q, df))]); } return out; };
      var area = function (a, b) { if (b - a > 1e-6) api.polygon([[X(a), base]].concat(curve(a, b), [[X(b), base]]), {fill: c.c5, fillOpacity: 0.55}); };
      // the 5% rejection region, faint grey, behind the p-value tails
      var cut = two ? tcrit(0.05, df) : tcrit(0.1, df), q = two || t >= 0 ? cut : -cut, cuts = two ? [-cut, cut] : [q];
      cuts.forEach(function (e) {
        if (Math.abs(e) < R) api.rect(e > 0 ? X(e) : x0, 64, e > 0 ? x1 - X(e) : X(e) - x0, base - 64, {fill: c.muted, fillOpacity: 0.08, rx: 0});
      });
      var a = Math.abs(t);
      if (two) { area(-R, -a); area(a, R); } else if (t >= 0) area(t, R); else area(-R, t);
      api.polyline(curve(-R, R), {stroke: c.c2, width: 2.4});
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.2});
      for (var k = -R + 1; k <= R - 1; k++) {
        api.line([X(k), base], [X(k), base + 4], {color: c.axis, width: 1});
        api.label([X(k), base + 15], api.fmt(k), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x1, base + 15], "t", {color: c.muted, size: 12.5, anchor: "end", italic: true});
      // the 5% cutoff(s), labelled beside the line, or at the edge when they are off the chart
      var cl = "5% cutoff " + (two ? "±" + cut.toFixed(3) : api.fmt(q, 3));
      if (cut < R) {
        cuts.forEach(function (e) { api.line([X(e), base], [X(e), 64], {color: c.muted, width: 1.3, dash: "4 4"}); });
        api.label([X(q) + (q > 0 ? 5 : -5), 56], cl, {color: c.muted, size: 12, anchor: q > 0 ? "start" : "end"});
      } else api.label([q > 0 ? x1 : x0, 56], cl + ", off the chart", {color: c.muted, size: 12, anchor: q > 0 ? "end" : "start"});
      // the observed t: a line up to the curve, its mirror for a two-sided test, its value under the handle
      if (two && a > 0) api.line([X(-t), base], [X(-t), Y(tpdf(t, df))], {color: c.c3, width: 1.6, dash: "3 3"});
      api.line([X(t), base], [X(t), Y(tpdf(t, df)) - 10], {color: c.c3, width: 2.4});
      api.label([X(t), base + 36], "t = " + api.fmt(t, 2), {color: c.c3, size: 13, weight: 700, anchor: "middle"});
      // the p-value, top right in the tail's red; a heavy tail that runs past the axis says how much of p is out there
      api.label([x0, 22], (two ? "two-sided: both tails" : "one-sided: the tail past t") + ", " + df + " df", {color: c.muted, size: 12.5});
      api.label([x1, 22], "p " + pNum(p), {color: c.c5, size: 14, weight: 700, anchor: "end"});
      var off = two ? tail2(R, df) : tail2(R, df) / 2;
      if (off >= 0.001) api.label([x1, 39], Viz.fmt(off, 3) + " of it lies past " + (two ? "±" : t < 0 ? "−" : "") + R + ", off the chart", {color: c.c5, size: 12, anchor: "end"});
      api.handle([X(t), base], {color: c.c3, onDrag: function (m) {
        api.set({tStatistic: Math.max(-5, Math.min(5, Math.round(((m[0] - x0) / (x1 - x0) * 2 * R - R) * 100) / 100))});
      }});
      api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
