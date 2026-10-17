// From a z score to its p-value: the standard normal curve, the observed z (amber, draggable on the axis) and the
// p-value as the red tail area at least that far from 0, both tails for a two-sided test. The one-sided test is taken
// in the direction of the observed z (H1: mu > mu0 when z >= 0, mu < mu0 when z < 0), so its p is half the two-sided
// one. Grey bands and dashed lines are the 5% cutoffs (1.96 two-sided, 1.645 one-sided). The bar at the bottom is the
// same p as a share of the whole curve, next to alpha = 0.05. Tail areas use the Chebyshev erfc of Numerical Recipes
// 6.2 (fractional error under 1.2e-7), good to the digits shown even at z = 3.5.
(function () {
  function erfc(x) {
    var z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    var r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 +
      t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  function upper(z) { return 0.5 * erfc(z / Math.SQRT2); }            // P(Z >= z)
  function pdf(z) { return Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI); }
  function pOf(v) { var z = v.zScore; return v.testType === "two-sided" ? 2 * upper(Math.abs(z)) : z >= 0 ? upper(z) : upper(-z); }
  function pNum(p) {   // five significant digits right at 0.05 so a borderline p never rounds onto the cutoff
    if (Math.abs(p - 0.05) < 0.0005) return String(Number(p.toPrecision(5)));
    if (p >= 0.01) return p.toFixed(4);
    return String(Number(p.toPrecision(3)));
  }
  var CUT2 = 1.959964, CUT1 = 1.644854;
  function tint(api) { api.root.querySelectorAll("text").forEach(function (t) { var col = t.getAttribute("fill"); if (col) t.style.fill = col; }); }   // viz.css paints text ink

  Viz.register("z-score-p-value", {
    title: "From a z score to a p-value",
    subject: "stats",
    shows: "Drag z: the red tail area under the normal curve beyond z is the p-value, doubled for a two-sided test, and compared with α = 0.05",
    params: {
      zScore: {kind: "number", default: 1.96, min: -3.5, max: 3.5, step: 0.01, label: "z"},
      testType: {kind: "enum", values: ["one-sided", "two-sided"], default: "two-sided", label: "\\text{test}"}
    },
    formula: function (v) {
      var z = v.zScore, p = pOf(v), zs = Viz.n(z, 3), az = Viz.n(Math.abs(z), 3);
      if (v.testType === "two-sided") return "p=2\\,P(Z\\ge|z|)=2\\,\\big(1-\\Phi(" + az + ")\\big)=" + pNum(p);
      return z >= 0 ? "p=P(Z\\ge " + zs + ")=1-\\Phi(" + zs + ")=" + pNum(p) : "p=P(Z\\le " + zs + ")=\\Phi(" + zs + ")=" + pNum(p);
    },
    status: function (v) {
      var z = v.zScore, p = pOf(v), two = v.testType === "two-sided";
      if (z === 0) return "z = 0 is exactly what H₀ predicts: <b>p = " + (two ? "1" : "0.5") + "</b>, no evidence at all.";
      var head = two ? "Two-sided: " : "One-sided (H₁: " + (z > 0 ? "μ > μ₀" : "μ < μ₀") + "): ";
      if (Math.abs(p - 0.05) < 0.0005) return head + "right on the line, <b>p = " + pNum(p) + "</b> ≈ 0.05, which is why " + (two ? "±1.96" : (z > 0 ? "" : "−") + "1.645") + " is the 5% cutoff.";
      var pct = p * 100 < 0.1 ? Viz.fmt(p * 100, 3) : Viz.fmt(p * 100, 1);
      if (p < 0.05) return head + "only " + pct + "% of outcomes under H₀ are this extreme, so <b>p = " + pNum(p) + "</b> < 0.05: reject H₀ at the 5% level.";
      return head + pct + "% of outcomes under H₀ are at least this extreme, so <b>p = " + pNum(p) + "</b> ≥ 0.05: not significant at the 5% level.";
    },
    examples: [
      {name: "Minimum supported values", values: {zScore: -3.5}},
      {name: "Maximum supported values", values: {zScore: 3.5}},
      {name: "testType: one-sided", values: {testType: "one-sided"}},
      {name: "one-sided cutoff 1.645", values: {zScore: 1.645, testType: "one-sided"}},
      {name: "z = 0: no evidence", values: {zScore: 0}},
      {name: "below the mean, one-sided", values: {zScore: -1.2, testType: "one-sided"}}
    ],
    size: [400, 296],
    draw: function (api, v) {
      var c = api.color, z = v.zScore, two = v.testType === "two-sided", p = pOf(v), R = 4;
      var x0 = 20, x1 = 380, base = 196, top = 70, peak = pdf(0);
      var X = function (q) { return x0 + (x1 - x0) * (q + R) / (2 * R); }, Y = function (d) { return base - (base - top) * d / peak; };
      var curve = function (a, b) { var out = [], n = 90; for (var i = 0; i <= n; i++) { var q = a + (b - a) * i / n; out.push([X(q), Y(pdf(q))]); } return out; };
      var area = function (a, b) { if (b - a > 1e-6) api.polygon([[X(a), base]].concat(curve(a, b), [[X(b), base]]), {fill: c.c5, fillOpacity: 0.55}); };
      // the 5% rejection region, faint grey, behind the tails
      var cut = two ? CUT2 : CUT1, q = two || z >= 0 ? cut : -cut, cuts = two ? [-cut, cut] : [q];
      cuts.forEach(function (e) { api.rect(e > 0 ? X(e) : x0, 58, e > 0 ? x1 - X(e) : X(e) - x0, base - 58, {fill: c.muted, fillOpacity: 0.08, rx: 0}); });
      var a = Math.abs(z);
      if (two) { area(-R, -a); area(a, R); } else if (z >= 0) area(z, R); else area(-R, z);
      api.polyline(curve(-R, R), {stroke: c.c2, width: 2.4});
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.2});
      for (var k = -R + 1; k <= R - 1; k++) {
        api.line([X(k), base], [X(k), base + 4], {color: c.axis, width: 1});
        api.label([X(k), base + 15], api.fmt(k), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x1, base + 15], "z", {color: c.muted, size: 12.5, anchor: "end", italic: true});
      cuts.forEach(function (e) { api.line([X(e), base], [X(e), 58], {color: c.muted, width: 1.3, dash: "4 4"}); });
      api.label([X(q) + (q > 0 ? 5 : -5), 50], "5% cutoff " + (two ? "±1.96" : api.fmt(q, 3)), {color: c.muted, size: 12, anchor: q > 0 ? "start" : "end"});
      // the observed z, its mirror for a two-sided test, its value under the handle
      if (two && a > 0) api.line([X(-z), base], [X(-z), Y(pdf(z))], {color: c.c3, width: 1.6, dash: "3 3"});
      api.line([X(z), base], [X(z), Y(pdf(z)) - 10], {color: c.c3, width: 2.4});
      api.label([X(z), base + 34], "z = " + api.fmt(z, 3), {color: c.c3, size: 13, weight: 700, anchor: "middle"});
      api.label([x0, 20], two ? "two-sided: both tails" : "one-sided: the tail past z", {color: c.muted, size: 12.5});
      api.label([x1, 20], "p = " + pNum(p), {color: c.c5, size: 14, weight: 700, anchor: "end"});
      // p as a share of the whole curve, against alpha
      var by = 262, bw = x1 - x0, ax = x0 + 0.05 * bw;
      api.rect(x0, by, bw, 10, {fill: c.grid, rx: 2});
      if (p * bw > 0.4) api.rect(x0, by, Math.max(1.5, p * bw), 10, {fill: c.c5, fillOpacity: 0.85, rx: 2});
      api.line([ax, by - 4], [ax, by + 14], {color: c.ink, width: 1.6});
      api.label([ax + 6, by + 22], "α = 0.05", {color: c.ink, size: 12});
      api.label([x1, by + 22], Math.abs(p - 0.05) < 0.0005 ? "red ends right at α: the cutoff" : p < 0.05 ? "red ends before α: significant" : "red reaches past α: not significant", {color: c.c5, size: 12, anchor: "end"});
      api.label([x0, by - 12], "red share of the whole curve", {color: c.muted, size: 12});
      api.handle([X(z), base], {color: c.c3, onDrag: function (m) {
        api.set({zScore: Math.max(-3.5, Math.min(3.5, Math.round(((m[0] - x0) / (x1 - x0) * 2 * R - R) * 100) / 100))});
      }});
      tint(api);
    }
  });
})();
