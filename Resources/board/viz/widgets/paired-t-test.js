// Paired t test on 16 students' quiz scores before and after a study session (made-up data, fixed). Left: each
// student's before→after line, green for a gain and red for a drop. Top right: the differences d = after − before as a
// dot plot with their mean and 95% confidence interval against 0 (no change). Bottom right: t = d̄/(s_d/√n) on the t
// curve with n − 1 df, the p-value shaded for the chosen alternative at α = 0.05. "shift" adds the same number of
// points to every after score: it moves d̄ but leaves s_d alone. The t CDF is the regularized incomplete beta.
(function () {
  var BEFORE = [62, 71, 55, 80, 68, 74, 59, 66, 77, 70, 64, 58, 73, 69, 61, 75];
  var DIFF = [5, 3, -2, 6, 1, 4, 7, -1, 2, 5, 0, 6, -3, 4, 3, 2], ALPHA = 0.05;
  var COF = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
             12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lgamma(z) { if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z); z -= 1; var x = COF[0]; for (var i = 1; i < 9; i++) x += COF[i] / (z + i); var t = z + 7.5; return 0.9189385332046727 + (z + 0.5) * Math.log(t) - t + Math.log(x); }
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
  function betai(a, b, x) { if (x <= 0) return 0; if (x >= 1) return 1; var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
  function upper(t, df) { var tail = 0.5 * betai(df / 2, 0.5, df / (df + t * t)); return t >= 0 ? tail : 1 - tail; }
  function crit(tail, df) { var lo = 0, hi = 1; while (upper(hi, df) > tail) hi *= 2; for (var i = 0; i < 100; i++) { var mid = (lo + hi) / 2; if (upper(mid, df) > tail) lo = mid; else hi = mid; } return (lo + hi) / 2; }
  function pdf(t, df) { return Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI) - (df + 1) / 2 * Math.log(1 + t * t / df)); }
  function calc(v) {
    var n = v.number_of_pairs, d = DIFF.slice(0, n).map(function (x) { return x + v.shift; }), mean = 0, ss = 0;
    d.forEach(function (x) { mean += x / n; }); d.forEach(function (x) { ss += (x - mean) * (x - mean); });
    var sd = Math.sqrt(ss / (n - 1)), se = sd / Math.sqrt(n), t = mean / se, df = n - 1, alt = v.alternative;
    var p = alt === "two-sided" ? Math.min(1, 2 * upper(Math.abs(t), df)) : alt === "greater" ? upper(t, df) : upper(-t, df);
    var tc = crit(0.025, df);
    return {n: n, d: d, mean: mean, sd: sd, se: se, t: t, df: df, p: p, ci: [mean - tc * se, mean + tc * se], sig: p < ALPHA};
  }
  function pv(p) { return p < 1e-4 ? "p < 0.0001" : "p = " + Viz.fmt(p, 4); }
  function tint(api) { api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; }); }   // viz.css paints text ink

  Viz.register("paired-t-test", {
    title: "Paired t test",
    subject: "stats",
    shows: "Each student is measured twice: the test runs on the differences, so t is the mean change over its standard error",
    params: {
      number_of_pairs: {kind: "integer", default: 10, min: 4, max: 16, label: "n"},
      alternative: {kind: "enum", values: ["two-sided", "greater", "less"], default: "two-sided", label: "H_1",
                    names: {"two-sided": "after ≠ before", greater: "after > before", less: "after < before"}},
      shift: {kind: "number", default: 0, min: -5, max: 5, step: 0.5, label: "\\text{shift}"}
    },
    formula: function (v) {
      var b = calc(v);
      return "\\begin{array}{l}t=\\dfrac{\\bar d}{s_d/\\sqrt n}=\\dfrac{" + Viz.n(b.mean, 3) + "}{" + Viz.n(b.sd, 3) + "/\\sqrt{" + b.n + "}}=" + Viz.n(b.t, 3) +
        "\\\\[8pt]df=" + b.df + ",\\ p" + (b.p < 1e-4 ? "<0.0001" : "=" + Viz.n(b.p, 4)) + ",\\ \\alpha=0.05\\end{array}";
    },
    status: function (v) {
      var b = calc(v), ch = (b.mean >= 0 ? "gain" : "drop"), amt = Viz.fmt(Math.abs(b.mean), 2);
      var head = "Over " + b.n + " pairs the mean " + ch + " is " + amt + " points (SD of the differences " + Viz.fmt(b.sd, 2) + "), so t = " + Viz.fmt(b.t, 2) + " and " + pv(b.p);
      if (b.sig) return head + (b.p < 1e-4 ? ", far below 0.05" : " < 0.05") + ": <b>a significant " + (v.alternative === "less" ? "drop" : v.alternative === "greater" ? "gain" : ch) + "</b>.";
      var wrong = (v.alternative === "greater" && b.mean < 0) || (v.alternative === "less" && b.mean > 0);
      return head + " ≥ 0.05: <b>not significant</b>" + (wrong ? ", since the scores moved the opposite way from H₁." : "; a change this size could be chance with these pairs.");
    },
    examples: [
      {name: "Minimum supported values", values: {number_of_pairs: 4, shift: -5}},
      {name: "Maximum supported values", values: {number_of_pairs: 16, shift: 5}},
      {name: "only four pairs", values: {number_of_pairs: 4}},
      {name: "alternative: greater", values: {alternative: "greater"}},
      {name: "alternative: less", values: {alternative: "less"}},
      {name: "no real change", values: {number_of_pairs: 16, shift: -2.5}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, b = calc(v);
      // left: before -> after for each student
      var xb = 46, xa = 140, sy = function (s) { return 276 - (s - 44) * 236 / 52; };
      api.label([xb, 16], "before", {color: c.muted, size: 12, anchor: "middle"});
      api.label([xa, 16], "after", {color: c.muted, size: 12, anchor: "middle"});
      [50, 60, 70, 80, 90].forEach(function (s) { api.line([xb - 10, sy(s)], [xa + 10, sy(s)], {color: c.grid, width: 1}); api.label([xb - 14, sy(s)], String(s), {color: c.muted, size: 12, anchor: "end"}); });
      for (var i = 0; i < b.n; i++) {
        var y0 = BEFORE[i], y1 = BEFORE[i] + b.d[i], col = b.d[i] > 0 ? c.c4 : b.d[i] < 0 ? c.c5 : c.muted;
        api.line([xb, sy(y0)], [xa, sy(y1)], {color: col, width: 1.6, opacity: 0.85});
        api.circle([xb, sy(y0)], 2.8, {fill: c.ink}); api.circle([xa, sy(y1)], 2.8, {fill: col});
      }
      api.label([(xb + xa) / 2, 290], "score", {color: c.muted, size: 12, anchor: "middle"});
      // top right: dot plot of d with mean, 95% CI and the null value 0
      var dx0 = 196, dx1 = 386, dLo = -9, dHi = 13, DX = function (q) { return dx0 + (dx1 - dx0) * (q - dLo) / (dHi - dLo); }, base = 104;
      api.label([dx0, 16], "d = after − before", {color: c.muted, size: 12});
      api.line([dx0, base], [dx1, base], {color: c.axis, width: 1.2});
      for (var q = -8; q <= 12; q += 4) api.label([DX(q), base + 13], api.fmt(q), {color: c.muted, size: 12, anchor: "middle"});
      api.line([DX(0), base], [DX(0), 37], {color: c.muted, width: 1.4, dash: "4 3"});
      var stack = {};
      b.d.forEach(function (x) { var k = String(x); stack[k] = (stack[k] || 0) + 1; api.circle([DX(x), base - 6 - (stack[k] - 1) * 9], 3.6, {fill: x > 0 ? c.c4 : x < 0 ? c.c5 : c.muted}); });
      var ci = [Math.max(dLo, b.ci[0]), Math.min(dHi, b.ci[1])], yc = 44;
      api.line([DX(ci[0]), yc], [DX(ci[1]), yc], {color: c.c3, width: 2.5});
      [ci[0], ci[1]].forEach(function (e) { api.line([DX(e), yc - 5], [DX(e), yc + 5], {color: c.c3, width: 2}); });
      api.polygon([[DX(b.mean), yc + 4], [DX(b.mean) - 5, yc + 12], [DX(b.mean) + 5, yc + 12]], {fill: c.c3, fillOpacity: 1});
      api.label([DX(b.mean), yc - 12], "d̄ = " + api.fmt(b.mean, 2) + ", 95% CI", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      // bottom right: the t curve, p-value shaded
      var df = b.df, R = Math.max(4, Math.min(10, Math.abs(b.t) * 1.15)), tx0 = 196, tx1 = 386, tB = 262, tT = 168;
      var TX = function (t) { return tx0 + (tx1 - tx0) * (t + R) / (2 * R); }, pk = pdf(0, df), TY = function (d) { return tB - (tB - tT) * d / pk; };
      var curve = function (a, z) { var out = []; for (var k = 0; k <= 70; k++) { var t = a + (z - a) * k / 70; out.push([TX(t), TY(pdf(t, df))]); } return out; };
      var area = function (a, z) { a = Math.max(a, -R); z = Math.min(z, R); if (z - a > 1e-9) api.polygon([[TX(a), tB]].concat(curve(a, z), [[TX(z), tB]]), {fill: c.c6, fillOpacity: 0.5}); };
      var at = Math.abs(b.t);
      if (v.alternative === "two-sided") { area(at, R); area(-R, -at); } else if (v.alternative === "greater") area(b.t, R); else area(-R, b.t);
      api.polyline(curve(-R, R), {stroke: c.ink, width: 1.8});
      api.line([tx0, tB], [tx1, tB], {color: c.axis, width: 1.2});
      var tk = R <= 5 ? 2 : 4;
      for (var u = -Math.floor(R / tk) * tk; u <= R + 1e-9; u += tk) api.label([TX(u), tB + 13], api.fmt(u), {color: c.muted, size: 12, anchor: "middle"});
      api.label([tx0, 140], "t with " + df + " df: " + pv(b.p), {color: c.c6, size: 12, weight: 650});
      var tX = TX(Math.max(-R, Math.min(R, b.t)));
      api.line([tX, tB], [tX, tT - 6], {color: c.c3, width: 2});
      api.label([tX, tT - 14], "t = " + api.fmt(b.t, 2), {color: c.c3, size: 12, weight: 650, anchor: tX > 330 ? "end" : tX < 250 ? "start" : "middle"});
      api.label([tx1, tB + 28], b.sig ? "significant at 0.05" : "not significant", {color: b.sig ? c.ink : c.muted, size: 12, weight: 650, anchor: "end"});
      tint(api);
    }
  });
})();
