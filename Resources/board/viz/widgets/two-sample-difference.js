// The difference between two sample means and its 95% confidence interval. Top: each mean's sampling distribution,
// centred on xbar_i with spread SE_i = s_i / sqrt(n_i). Bottom: the difference xbar1 - xbar2, whose spread
// SE = sqrt(SE1^2 + SE2^2) is wider than either (variances add, even when you subtract), with the 95% interval
// d +- t* SE shaded and 0 marked. Both panels share one horizontal scale, so the widths compare directly; each curve is
// drawn to the same peak height (no density axis is read here). The interval uses Welch's t with the
// Welch-Satterthwaite df, so the bottom curve is d + SE * T_df and the shaded share is exactly 95%. Top curves are normal.
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
  function tcrit(a2, df) { var lo = 0, hi = 1000; for (var i = 0; i < 100; i++) { var m = (lo + hi) / 2; if (tail2(m, df) > a2) lo = m; else hi = m; } return (lo + hi) / 2; }
  function calc(v) {
    var a = v.s1 * v.s1 / v.n1, b = v.s2 * v.s2 / v.n2, se = Math.sqrt(a + b), df = (a + b) * (a + b) / (a * a / (v.n1 - 1) + b * b / (v.n2 - 1));
    var d = v.m1 - v.m2, ts = tcrit(0.05, df);
    return {se1: Math.sqrt(a), se2: Math.sqrt(b), se: se, df: df, d: d, ts: ts, lo: d - ts * se, hi: d + ts * se};
  }
  function f2(x) { return Viz.fmt(x, 2); }

  Viz.register("two-sample-difference", {
    title: "Difference of two means: 95% interval",
    subject: "stats",
    shows: "Set each group's mean, SD and size: the difference x̄₁ − x̄₂ is noisier than either mean (SE² adds), and its 95% interval either clears 0 or straddles it",
    params: {
      m1: {kind: "number", default: 72, min: 0, max: 100, step: 0.5, label: "\\bar x_1"},
      s1: {kind: "number", default: 10, min: 0.5, max: 30, step: 0.5, label: "s_1"},
      n1: {kind: "integer", default: 25, min: 2, max: 200, label: "n_1"},
      m2: {kind: "number", default: 65, min: 0, max: 100, step: 0.5, label: "\\bar x_2"},
      s2: {kind: "number", default: 12, min: 0.5, max: 30, step: 0.5, label: "s_2"},
      n2: {kind: "integer", default: 30, min: 2, max: 200, label: "n_2"}
    },
    formula: function (v) {
      var r = calc(v);
      return "\\begin{array}{l}SE=\\sqrt{\\tfrac{" + Viz.n(v.s1) + "^2}{" + v.n1 + "}+\\tfrac{" + Viz.n(v.s2) + "^2}{" + v.n2 + "}}=" + Viz.n(r.se, 3) +
        ",\\ \\ \\text{df}=" + Viz.n(r.df, 1) + "\\\\[4pt]" + Viz.n(r.d, 2) + "\\pm" + Viz.n(r.ts, 3) + "\\cdot" + Viz.n(r.se, 3) + "=[" + Viz.n(r.lo, 2) + ",\\," + Viz.n(r.hi, 2) + "]\\end{array}";
    },
    status: function (v) {
      var r = calc(v), ci = "<b>" + f2(r.lo) + " to " + f2(r.hi) + "</b>";
      if (r.lo > 0) return "The 95% interval for μ₁ − μ₂ is " + ci + ": it sits above 0, so group 1's mean is higher at the 5% level.";
      if (r.hi < 0) return "The 95% interval for μ₁ − μ₂ is " + ci + ": it sits below 0, so group 2's mean is higher at the 5% level.";
      return "The 95% interval for μ₁ − μ₂ is " + ci + ": it includes 0, so these samples cannot rule out equal means.";
    },
    examples: [
      {name: "Minimum supported values", values: {m1: 0, s1: 0.5, n1: 2, m2: 0, s2: 0.5, n2: 2}},
      {name: "Maximum supported values", values: {m1: 100, s1: 30, n1: 200, m2: 100, s2: 30, n2: 200}},
      {name: "interval includes 0", values: {m1: 70, m2: 66, s1: 12, s2: 12, n1: 15, n2: 15}},
      {name: "group 2 higher", values: {m1: 58, m2: 64, s1: 6, s2: 9, n1: 40, n2: 35}},
      {name: "one tiny noisy group", values: {m1: 72, m2: 65, s1: 10, s2: 25, n1: 100, n2: 5}}
    ],
    size: [400, 330],
    draw: function (api, v) {
      var c = api.color, r = calc(v), x0 = 18, x1 = 382, H = 58;
      // one units-per-pixel scale for both panels, wide enough for whichever needs more room
      var tLo = Math.min(v.m1 - 3.6 * r.se1, v.m2 - 3.6 * r.se2), tHi = Math.max(v.m1 + 3.6 * r.se1, v.m2 + 3.6 * r.se2);
      var bLo = Math.min(0, r.lo - 1.3 * r.se), bHi = Math.max(0, r.hi + 1.3 * r.se);
      var span = Math.max(tHi - tLo, bHi - bLo) * 1.08, kx = (x1 - x0) / span;
      var Xt = function (q) { return x0 + (q - ((tLo + tHi) / 2 - span / 2)) * kx; }, Xb = function (q) { return x0 + (q - ((bLo + bHi) / 2 - span / 2)) * kx; };
      var bump = function (X, base, mu, sd, dens, a, b) {
        var pts = [], n = 90; for (var i = 0; i <= n; i++) { var q = a + (b - a) * i / n; pts.push([X(mu + q * sd), base - H * dens(q)]); } return pts;
      };
      var nrm = function (q) { return Math.exp(-0.5 * q * q); };
      var tdn = function (q) { return Math.pow(1 + q * q / r.df, -(r.df + 1) / 2); };
      var nice = function (raw) { var e = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / e; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e; };
      var axis = function (X, y, lo, hi) {
        api.line([x0, y], [x1, y], {color: c.axis, width: 1.2});
        var st = nice(span / 6), first = Math.ceil(((lo + hi) / 2 - span / 2) / st) * st;
        for (var q = first; X(q) <= x1 + 0.5; q += st) {
          if (X(q) < x0 - 0.5) continue;
          api.line([X(q), y], [X(q), y + 4], {color: c.axis, width: 1});
          api.label([X(q), y + 14], api.fmt(Math.abs(q) < st / 1e6 ? 0 : q, 3), {color: c.muted, size: 12, anchor: "middle"});
        }
      };
      // top panel: the two means
      var tb = 118;
      api.label([x0, 16], "each mean's sampling spread, SE = s/√n", {color: c.muted, size: 12.5});
      [[v.m1, r.se1, c.c1, "x̄₁"], [v.m2, r.se2, c.c3, "x̄₂"]].forEach(function (g) {
        var pts = bump(Xt, tb, g[0], g[1], nrm, -3.6, 3.6);
        api.polygon([[pts[0][0], tb]].concat(pts, [[pts[pts.length - 1][0], tb]]), {fill: g[2], fillOpacity: 0.16});
        api.polyline(pts, {stroke: g[2], width: 2.2});
        api.line([Xt(g[0]), tb], [Xt(g[0]), tb - H], {color: g[2], width: 1.4, dash: "3 3"});
      });
      var up = v.m1 >= v.m2;   // labels go on the outer side of each mean so the two never collide
      api.label([Xt(v.m1) + (up ? 6 : -6), tb - H - 8], "x̄₁ = " + api.fmt(v.m1, 2) + ", SE " + api.fmt(r.se1, 2), {color: c.c1, size: 13, weight: 700, anchor: up ? "start" : "end"});
      api.label([Xt(v.m2) + (up ? -6 : 6), tb - H - 8], "x̄₂ = " + api.fmt(v.m2, 2) + ", SE " + api.fmt(r.se2, 2), {color: c.c3, size: 13, weight: 700, anchor: up ? "end" : "start"});
      axis(Xt, tb, tLo, tHi);
      // bottom panel: the difference, its 95% interval, and 0
      var bb = 276, pts = bump(Xb, bb, r.d, r.se, tdn, -6, 6);
      api.label([x0, 158], "the difference x̄₁ − x̄₂, SE = √(SE₁² + SE₂²) = " + api.fmt(r.se, 3), {color: c.muted, size: 12.5});
      var inner = bump(Xb, bb, r.d, r.se, tdn, -r.ts, r.ts);
      api.polygon([[inner[0][0], bb]].concat(inner, [[inner[inner.length - 1][0], bb]]), {fill: c.c2, fillOpacity: 0.3});
      api.polyline(pts.filter(function (q) { return q[0] >= x0 - 2 && q[0] <= x1 + 2; }), {stroke: c.c2, width: 2.2});
      var zeroIn = r.lo <= 0 && r.hi >= 0, zc = zeroIn ? c.c5 : c.muted;
      api.line([Xb(0), bb], [Xb(0), bb - H - 10], {color: zc, width: 1.8, dash: "5 4"});
      api.label([x0, 318], "dashed: 0, no difference, " + (zeroIn ? "inside" : "outside") + " the interval", {color: zc, size: 12.5, weight: zeroIn ? 650 : 500});
      var cy = bb - H - 20;
      api.line([Xb(r.lo), cy], [Xb(r.hi), cy], {color: c.c2, width: 2.2});
      [r.lo, r.hi].forEach(function (q) { api.line([Xb(q), cy - 5], [Xb(q), cy + 5], {color: c.c2, width: 2.2}); });
      api.point([Xb(r.d), cy], {color: c.c2, r: 4});
      api.label([Xb(r.d), cy - 15], "95% CI " + f2(r.lo) + " to " + f2(r.hi), {color: c.c2, size: 13, weight: 700, anchor: "middle"});
      axis(Xb, bb, bLo, bHi);
      api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
