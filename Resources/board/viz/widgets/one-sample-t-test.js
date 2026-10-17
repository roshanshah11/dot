// One-sample t test. The curve is Student's t with n − 1 degrees of freedom (the null distribution of the statistic);
// red is the rejection region of size α for the chosen alternative, amber is the p-value, the area at least as extreme
// as the observed t. A second axis under the t axis reads the same points as sample means, x̄ = μ0 + t·s/√n.
// The t CDF uses the regularized incomplete beta function (Lentz continued fraction), P(T > t) = I_{ν/(ν+t²)}(ν/2, 1/2)/2.
(function () {
  var COF = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
             12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lgamma(z) { // Lanczos, g = 7
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    z -= 1; var x = COF[0]; for (var i = 1; i < 9; i++) x += COF[i] / (z + i);
    var t = z + 7.5; return 0.9189385332046727 + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }
  function betacf(a, b, x) {
    var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap, tiny = 1e-300;
    if (Math.abs(d) < tiny) d = tiny; d = 1 / d; var h = d;
    for (var m = 1; m <= 300; m++) {
      var m2 = 2 * m, aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny; c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny; c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny; d = 1 / d;
      var del = d * c; h *= del; if (Math.abs(del - 1) < 3e-15) break;
    }
    return h;
  }
  function betai(a, b, x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function upper(t, df) { var tail = 0.5 * betai(df / 2, 0.5, df / (df + t * t)); return t >= 0 ? tail : 1 - tail; }   // P(T > t)
  function crit(tail, df) { var lo = 0, hi = 1; while (upper(hi, df) > tail && hi < 1e7) hi *= 2; for (var i = 0; i < 100; i++) { var mid = (lo + hi) / 2; if (upper(mid, df) > tail) lo = mid; else hi = mid; } return (lo + hi) / 2; }
  function pdf(t, df) { return Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI) - (df + 1) / 2 * Math.log(1 + t * t / df)); }
  function calc(v) {
    var df = v.sample_size - 1, se = v.sample_standard_deviation / Math.sqrt(v.sample_size), t = (v.sample_mean - v.hypothesized_mean) / se;
    var alt = v.alternative, a = v.significance_level;
    var p = alt === "two-sided" ? Math.min(1, 2 * upper(Math.abs(t), df)) : alt === "greater" ? upper(t, df) : upper(-t, df);
    var tc = crit(alt === "two-sided" ? a / 2 : a, df);
    return {df: df, se: se, t: t, p: p, tc: tc, reject: p < a};
  }
  function pv(p) { return p < 1e-4 ? "< 0.0001" : Viz.fmt(p, 4); }
  function tint(api) { api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; }); }   // viz.css paints text ink

  Viz.register("one-sample-t-test", {
    title: "One-sample t test",
    subject: "stats",
    shows: "Set the sample's mean, SD and size against a hypothesized mean: t counts standard errors from μ0, and the shaded tail is the p-value",
    params: {
      hypothesized_mean: {kind: "number", default: 50, min: 0, max: 100, step: 0.5, label: "\\mu_0"},
      sample_mean: {kind: "number", default: 54, min: 0, max: 100, step: 0.5, label: "\\bar x"},
      sample_standard_deviation: {kind: "number", default: 10, min: 0.1, max: 100, step: 0.1, label: "s"},
      sample_size: {kind: "integer", default: 16, min: 3, max: 100, label: "n"},
      alternative: {kind: "enum", values: ["two-sided", "greater", "less"], default: "two-sided", label: "H_1",
                    names: {"two-sided": "μ ≠ μ₀", greater: "μ > μ₀", less: "μ < μ₀"}},
      significance_level: {kind: "number", default: 0.05, min: 0.001, max: 0.2, step: 0.001, label: "\\alpha"}
    },
    formula: function (v) {
      var b = calc(v), tc = v.alternative === "two-sided" ? "\\pm" + Viz.n(b.tc, 3) : (v.alternative === "less" ? "-" : "") + Viz.n(b.tc, 3);
      return "\\begin{array}{l}t=\\dfrac{\\bar x-\\mu_0}{s/\\sqrt n}=\\dfrac{" + Viz.n(v.sample_mean, 2) + "-" + Viz.n(v.hypothesized_mean, 2) + "}{" + Viz.n(v.sample_standard_deviation, 2) + "/\\sqrt{" + v.sample_size + "}}=" + Viz.n(b.t, 3) +
        "\\\\[8pt]df=" + b.df + ",\\ p" + (b.p < 1e-4 ? "<0.0001" : "=" + Viz.n(b.p, 4)) + ",\\ t^*=" + tc + "\\end{array}";
    },
    status: function (v) {
      var b = calc(v), a = Viz.fmt(v.significance_level, 3), xb = Viz.fmt(v.sample_mean, 2), m0 = Viz.fmt(v.hypothesized_mean, 2);
      var head = "t = " + Viz.fmt(b.t, 3) + " on " + b.df + " df gives p " + (b.p < 1e-4 ? "< 0.0001" : "= " + Viz.fmt(b.p, 4));
      if (b.reject) return head + " < α = " + a + ": <b>reject H₀</b>; a sample mean of " + xb + " is too far from " + m0 + " to blame on chance.";
      var wrongWay = (v.alternative === "greater" && b.t < 0) || (v.alternative === "less" && b.t > 0);
      return head + " ≥ α = " + a + ": <b>fail to reject H₀</b>" + (wrongWay ? "; the sample mean sits on the opposite side from what H₁ predicts." : "; " + xb + " is within what chance gives when μ = " + m0 + ".");
    },
    examples: [
      {name: "Minimum supported values", values: {hypothesized_mean: 0, sample_mean: 0, sample_standard_deviation: 0.1, sample_size: 3, significance_level: 0.001}},
      {name: "Maximum supported values", values: {hypothesized_mean: 100, sample_mean: 100, sample_standard_deviation: 100, sample_size: 100, significance_level: 0.2}},
      {name: "alternative: greater", values: {alternative: "greater"}},
      {name: "alternative: less", values: {alternative: "less"}},
      {name: "significant: x̄ = 57", values: {sample_mean: 57}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, b = calc(v), df = b.df, alt = v.alternative;
      var R = Math.max(4, Math.min(10, Math.max(b.tc, Math.abs(b.t)) * 1.15)), x0 = 40, x1 = 384, yB = 198, yT = 70;
      var X = function (t) { return x0 + (x1 - x0) * (t + R) / (2 * R); }, peak = pdf(0, df), Y = function (d) { return yB - (yB - yT) * d / peak; };
      var curve = function (a, z) { var out = [], N = 90; for (var i = 0; i <= N; i++) { var t = a + (z - a) * i / N; out.push([X(t), Y(pdf(t, df))]); } return out; };
      var area = function (a, z, col, op) { a = Math.max(a, -R); z = Math.min(z, R); if (z - a > 1e-9) api.polygon([[X(a), yB]].concat(curve(a, z), [[X(z), yB]]), {fill: col, fillOpacity: op}); };
      // the p-value tail(s) as amber area; the rejection region as a faint red area plus a red band on the t axis
      var at = Math.abs(b.t);
      if (alt === "two-sided") { area(at, R, c.c3, 0.5); area(-R, -at, c.c3, 0.5); }
      else if (alt === "greater") area(b.t, R, c.c3, 0.5); else area(-R, b.t, c.c3, 0.5);
      if (alt !== "less") area(b.tc, R, c.c5, 0.2);
      if (alt !== "greater") area(-R, -b.tc, c.c5, 0.2);
      api.polyline(curve(-R, R), {stroke: c.ink, width: 2});
      api.line([x0, yB], [x1, yB], {color: c.axis, width: 1.2});
      if (alt !== "less" && b.tc < R) api.line([X(b.tc), yB + 3], [x1, yB + 3], {color: c.c5, width: 4});
      if (alt !== "greater" && b.tc < R) api.line([x0, yB + 3], [X(-b.tc), yB + 3], {color: c.c5, width: 4});
      // critical values
      [alt === "less" ? null : b.tc, alt === "greater" ? null : -b.tc].forEach(function (t) {
        if (t === null) return;
        if (Math.abs(t) <= R) {
          // label outward from the center, unless the observed t line would run through it
          var txt = "t* = " + api.fmt(t, 3), w = txt.length * 6.8 + 6, out = t > 0 ? 1 : -1, gapPx = (X(b.t) - X(t)) * out;
          if (Math.abs(b.t) <= R && gapPx > 0 && gapPx < w) out = -out;
          api.line([X(t), yB], [X(t), yT + 14], {color: c.c5, width: 1.4, dash: "4 3"});
          api.label([X(t) + out * 3, yT + 4], txt, {color: c.c5, size: 12, weight: 600, anchor: out > 0 ? "start" : "end"});
        }
        else api.label([t > 0 ? x1 : x0, yT + 4], (t > 0 ? "" : "← ") + "t* = " + api.fmt(t, 2) + (t > 0 ? " →" : ""), {color: c.c5, size: 12, weight: 600, anchor: t > 0 ? "end" : "start"});
      });
      // ticks: t on top row, the same points as sample means underneath
      var tk = R <= 5 ? 1 : 2;
      for (var q = -Math.floor(R / tk) * tk; q <= R + 1e-9; q += tk) {
        api.line([X(q), yB], [X(q), yB + 4], {color: c.axis, width: 1});
        api.label([X(q), yB + 14], api.fmt(q), {color: c.muted, size: 12, anchor: "middle"});
        if (Math.round(q / tk) % 2 === 0) api.label([X(q), yB + 34], api.fmt(v.hypothesized_mean + q * b.se, 2), {color: c.c2, size: 12, anchor: "middle"});
      }
      api.label([10, yB + 14], "t", {color: c.muted, size: 12, italic: true});
      api.label([10, yB + 34], "x̄", {color: c.c2, size: 12, italic: true});
      api.label([10, yB + 54], "SE = s/√n = " + api.fmt(b.se, 3) + ", so each t step is " + api.fmt(b.se, 3) + " in x̄", {color: c.c2, size: 12});
      // the observed t
      if (Math.abs(b.t) <= R) {
        api.line([X(b.t), yB + 2], [X(b.t), yT - 22], {color: c.c3, width: 2.2});
        api.label([X(b.t), yT - 32], "t = " + api.fmt(b.t, 3), {color: c.c3, size: 13, weight: 700, anchor: X(b.t) > 300 ? "end" : X(b.t) < 100 ? "start" : "middle"});
      } else api.label([b.t > 0 ? x1 : x0, yT - 32], (b.t > 0 ? "" : "← ") + "t = " + api.fmt(b.t, 2) + (b.t > 0 ? " →" : ""), {color: c.c3, size: 13, weight: 700, anchor: b.t > 0 ? "end" : "start"});
      api.label([10, 16], "p-value " + pv(b.p), {color: c.c3, size: 12.5, weight: 650});
      api.label([x1, 16], "rejection region α = " + api.fmt(v.significance_level, 3), {color: c.c5, size: 12.5, weight: 650, anchor: "end"});
      tint(api);
    }
  });
})();
