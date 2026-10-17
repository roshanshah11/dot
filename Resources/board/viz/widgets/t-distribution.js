// Student's t distribution with df degrees of freedom against the standard normal (dashed). The middle share
// (central_probability) is shaded teal between ±t*, the two tails red; t* is found by bisection on the two-sided tail
// P(|T| >= t) = I_{df/(df+t^2)}(df/2, 1/2), the regularized incomplete beta function (continued fraction, Numerical
// Recipes 6.4). The axis widens with t* so the cutoffs stay on the chart at 3 df and 99%. Densities are drawn to one
// common scale, so the t curve's lower peak and fatter tails are real.
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
  function tail2(t, df) { return ibeta(df / (df + t * t), df / 2, 0.5); }            // P(|T| >= |t|)
  function tpdf(t, df) { return Math.exp(lnG((df + 1) / 2) - lnG(df / 2) - 0.5 * Math.log(df * Math.PI) - (df + 1) / 2 * Math.log(1 + t * t / df)); }
  function tcrit(a2, df) { var lo = 0, hi = 1000; for (var i = 0; i < 100; i++) { var m = (lo + hi) / 2; if (tail2(m, df) > a2) lo = m; else hi = m; } return (lo + hi) / 2; }
  function Phi(x) { var s = x, t = 0, b = x, q = x * x, i = 1; while (s !== t) { t = s; b *= q / (i += 2); s = t + b; } return 0.5 + s * Math.exp(-0.5 * q - 0.91893853320467274178); }
  function zcrit(a2) { var lo = 0, hi = 10; for (var i = 0; i < 80; i++) { var m = (lo + hi) / 2; if (2 * (1 - Phi(m)) > a2) lo = m; else hi = m; } return (lo + hi) / 2; }
  function npdf(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }
  function pc(x) { return Viz.fmt(100 * x, 1) + "%"; }

  Viz.register("t-distribution", {
    title: "The t distribution vs the normal",
    subject: "stats",
    shows: "Set the degrees of freedom and the middle share: the t curve's cutoffs ±t* sit wider than the normal's ±z*, and close in on them as df grows",
    params: {
      degrees_of_freedom: {kind: "integer", default: 5, min: 3, max: 60, label: "\\text{df}"},
      central_probability: {kind: "number", default: 0.95, min: 0.9, max: 0.99, step: 0.005, label: "\\text{middle}"}
    },
    formula: function (v) {
      var df = v.degrees_of_freedom, cp = v.central_probability, t = tcrit(1 - cp, df), z = zcrit(1 - cp);
      return "\\begin{array}{l}T=\\dfrac{\\bar{x}-\\mu}{s/\\sqrt{n}}\\sim t_{" + df + "},\\ \\ n=" + (df + 1) + "\\\\[4pt]" +
        "P(|T|<t^*)=" + Viz.n(cp, 3) + "\\Rightarrow t^*=" + t.toFixed(3) + "\\end{array}";
    },
    status: function (v) {
      var df = v.degrees_of_freedom, cp = v.central_probability, t = tcrit(1 - cp, df), z = zcrit(1 - cp), wider = t / z - 1;
      if (df >= 30) return "With " + df + " df the t curve is nearly normal: the middle " + pc(cp) + " reaches <b>±" + t.toFixed(3) + "</b>, only " +
        pc(wider) + " past the normal's ±" + z.toFixed(3) + ".";
      return "With " + df + " df (a sample of " + (df + 1) + ") the middle " + pc(cp) + " needs <b>±" + t.toFixed(3) + "</b>, " + pc(wider) +
        " wider than the normal's ±" + z.toFixed(3) + ", because s only estimates σ.";
    },
    examples: [
      {name: "Minimum supported values", values: {degrees_of_freedom: 3, central_probability: 0.9}},
      {name: "Maximum supported values", values: {degrees_of_freedom: 60, central_probability: 0.99}},
      {name: "95% with 10 df", values: {degrees_of_freedom: 10, central_probability: 0.95}},
      {name: "30 df: close to normal", values: {degrees_of_freedom: 30, central_probability: 0.95}}
    ],
    size: [400, 280],
    draw: function (api, v) {
      var c = api.color, df = v.degrees_of_freedom, cp = v.central_probability, t = tcrit(1 - cp, df), z = zcrit(1 - cp);
      var R = Math.max(4.5, Math.ceil(t + 1)), x0 = 20, x1 = 380, base = 214, top = 66;
      var X = function (q) { return x0 + (x1 - x0) * (q + R) / (2 * R); }, Y = function (d) { return base - (base - top) * d / npdf(0); };
      var curve = function (f, a, b) { var out = [], n = 120; for (var i = 0; i <= n; i++) { var q = a + (b - a) * i / n; out.push([X(q), Y(f(q))]); } return out; };
      var tf = function (q) { return tpdf(q, df); };
      // tails red, middle teal, then the two curves
      [[-R, -t], [t, R]].forEach(function (s) { api.polygon([[X(s[0]), base]].concat(curve(tf, s[0], s[1]), [[X(s[1]), base]]), {fill: c.c5, fillOpacity: 0.32}); });
      api.polygon([[X(-t), base]].concat(curve(tf, -t, t), [[X(t), base]]), {fill: c.c1, fillOpacity: 0.3});
      api.polyline(curve(npdf, -R, R), {stroke: c.muted, width: 1.6, dash: "5 4"});
      api.polyline(curve(tf, -R, R), {stroke: c.c2, width: 2.4});
      // axis with integer ticks
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.2});
      var every = R > 6 ? 2 : 1;
      for (var k = Math.ceil(-R); k <= R; k++) {
        if (k % every || Math.abs(k) > R - 0.4) continue;   // the ends stay clear for the axis name
        api.line([X(k), base], [X(k), base + 4], {color: c.axis, width: 1});
        api.label([X(k), base + 15], api.fmt(k), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x1, base + 15], "t", {color: c.muted, size: 12.5, anchor: "end", italic: true});
      // the normal's cutoffs, short dashes up to its curve
      [-z, z].forEach(function (q) { api.line([X(q), base], [X(q), Y(npdf(q))], {color: c.muted, width: 1.2, dash: "2 3"}); });
      // the t cutoffs, the middle bracket and the shares
      [-t, t].forEach(function (q) {
        api.line([X(q), base], [X(q), 44], {color: c.c1, width: 1.8});
        api.label([X(q), base + 34], (q < 0 ? "−" : "") + t.toFixed(3), {color: c.c1, size: 12.5, weight: 700, anchor: "middle"});
      });
      api.line([X(-t) + 2, 44], [X(t) - 2, 44], {color: c.c1, width: 1.6, arrow: true, arrowStart: true});
      api.label([X(0), 28], "middle " + pc(cp) + " between ±" + t.toFixed(3), {color: c.c1, size: 13, weight: 700, anchor: "middle"});
      var tailTxt = pc((1 - cp) / 2), tx = Math.min(t + 0.9, R - 0.6), ty = Math.min(base - 14, Y(tpdf(t + 0.2, df)) - 14);
      api.label([X(tx), ty], tailTxt, {color: c.c5, size: 12.5, weight: 650, anchor: "start"});
      api.label([X(-tx), ty], tailTxt, {color: c.c5, size: 12.5, weight: 650, anchor: "end"});
      // a one-line key along the bottom edge, below every label the settings can move
      api.line([x0 + 2, 266], [x0 + 22, 266], {color: c.c2, width: 2.4});
      api.label([x0 + 28, 266], "t, " + df + " df", {color: c.c2, size: 13, weight: 650});
      api.line([x0 + 112, 266], [x0 + 132, 266], {color: c.muted, width: 1.6, dash: "5 4"});
      api.label([x0 + 138, 266], "standard normal", {color: c.muted, size: 12.5});
      api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
