// Variance of a discrete random variable by the shortcut Var(X) = E(X^2) - [E(X)]^2. X takes the values 1 to 5 with
// probabilities proportional to the five weights (P(X = k) = w_k / sum w), so any table of five probabilities can be
// dialled in. Left: the distribution, its mean (the balance point) and the band mean +- one SD. Right: E(X^2) and
// [E(X)]^2 as bars on one scale; the gap between their tops is the variance, never negative because E(X^2) >= [E(X)]^2.
// E(X^2) and [E(X)]^2 are rounded to 3 places and the variance shown is their difference, so the numbers on screen add up.
// All weights at zero leaves no distribution; the widget then treats the five values as equally likely and says so.
(function () {
  var KS = [1, 2, 3, 4, 5];
  function calc(v) {
    var w = KS.map(function (k) { return v["w" + k]; }), W = w.reduce(function (s, x) { return s + x; }, 0), flat = W === 0;
    var p = w.map(function (x) { return flat ? 0.2 : x / W; });
    var m = 0, m2 = 0; KS.forEach(function (k, i) { m += k * p[i]; m2 += k * k * p[i]; });
    var a = Math.round(m2 * 1000) / 1000, b = Math.round(m * m * 1000) / 1000, vr = Math.max(0, Math.round((a - b) * 1000) / 1000);
    return {p: p, flat: flat, m: m, m2: m2, a: a, b: b, vr: vr, sd: Math.sqrt(Math.max(0, m2 - m * m))};
  }
  function f(x) { return Viz.fmt(x, 3); }
  var params = {};
  KS.forEach(function (k) { params["w" + k] = {kind: "integer", default: [1, 2, 4, 2, 1][k - 1], min: 0, max: 10, label: "w_" + k}; });

  Viz.register("variance", {
    title: "Variance: E(X²) minus E(X)²",
    subject: "stats",
    shows: "Set the weights on the values 1 to 5: the variance is the gap between E(X²) and E(X)², and it grows as probability moves away from the mean",
    params: params,
    formula: function (v) {
      var r = calc(v);
      return "\\begin{array}{l}\\mathrm{Var}(X)=E(X^2)-[E(X)]^2\\\\[4pt]\\phantom{\\mathrm{Var}(X)}=" + Viz.n(r.a, 3) + "-" + Viz.n(r.m, 3) + "^2=" + Viz.n(r.vr, 3) + "\\end{array}";
    },
    status: function (v) {
      var r = calc(v), pre = r.flat ? "With every weight at zero the five values count as equally likely, so the" : "The";
      if (r.vr === 0) return "All the probability sits on <b>" + f(r.m) + "</b>, so X never strays from its mean: E(X²) = [E(X)]² and <b>Var(X) = 0</b>.";
      return pre + " mean is " + f(r.m) + " and E(X²) = " + f(r.a) + " exceeds [E(X)]² = " + f(r.b) + " by <b>Var(X) = " + f(r.vr) + "</b>, a typical distance from the mean of σ = " + Viz.fmt(r.sd, 2) + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {w1: 0, w2: 0, w3: 0, w4: 0, w5: 0}},
      {name: "Maximum supported values", values: {w1: 10, w2: 10, w3: 10, w4: 10, w5: 10}},
      {name: "all on one value: no spread", values: {w1: 0, w2: 0, w3: 10, w4: 0, w5: 0}},
      {name: "split between the ends: most spread", values: {w1: 10, w2: 0, w3: 0, w4: 0, w5: 10}},
      {name: "skewed toward 1", values: {w1: 6, w2: 4, w3: 2, w4: 1, w5: 0}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, r = calc(v), x0 = 18, x1 = 228, base = 196, top = 46;
      var X = function (k) { return x0 + (x1 - x0) * (k - 0.5) / 5; }, pmax = Math.max.apply(null, r.p) * 1.12;
      api.label([x0, 20], "P(X = k)", {color: c.muted, size: 12.5});
      // the distribution
      KS.forEach(function (k, i) {
        var h = (base - top) * r.p[i] / pmax;
        api.rect(X(k) - 14, base - h, 28, h, {fill: c.c2, fillOpacity: 0.75, rx: 3});
        api.label([X(k), base - h - 9], Viz.fmt(r.p[i], 2), {color: c.c2, size: 12, anchor: "middle"});
        api.label([X(k), base + 14], String(k), {color: c.muted, size: 12.5, anchor: "middle"});
      });
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.2});
      // the mean as the balance point under the axis, and the one-SD band around it
      var M = X(r.m);
      api.polygon([[M, base + 22], [M - 8, base + 34], [M + 8, base + 34]], {fill: c.c3, fillOpacity: 1});
      api.label([M + (r.m > 3 ? -12 : 12), base + 30], "E(X) = " + f(r.m), {color: c.c3, size: 12.5, weight: 700, anchor: r.m > 3 ? "end" : "start"});
      var lo = X(Math.max(0.5, r.m - r.sd)), hi = X(Math.min(5.5, r.m + r.sd)), by = base + 54;
      if (hi - lo > 2) {
        api.line([lo, by], [hi, by], {color: c.c5, width: 2.2});
        [lo, hi].forEach(function (q) { api.line([q, by - 5], [q, by + 5], {color: c.c5, width: 2.2}); });
      } else api.point([M, by], {color: c.c5, r: 3.5});
      api.label([M, by + 16], "E(X) ± σ, σ = " + Viz.fmt(r.sd, 2), {color: c.c5, size: 12.5, weight: 650, anchor: "middle"});
      // E(X^2) and [E(X)]^2 on one scale; the gap is the variance
      var bx1 = 262, bx2 = 312, bw = 34, smax = Math.max(1, r.m2) * 1.12, Yb = function (q) { return base - (base - top) * q / smax; };
      api.label([bx1 - 4, 20], "the shortcut", {color: c.muted, size: 12.5});
      api.rect(bx1, Yb(r.m2), bw, base - Yb(r.m2), {fill: c.c1, fillOpacity: 0.7, rx: 3});
      api.rect(bx2, Yb(r.m * r.m), bw, base - Yb(r.m * r.m), {fill: c.c3, fillOpacity: 0.7, rx: 3});
      api.line([bx1 - 6, base], [bx2 + bw + 6, base], {color: c.axis, width: 1.2});
      api.label([bx1 + bw / 2, Yb(r.m2) - 9], f(r.a), {color: c.c1, size: 12, weight: 650, anchor: "middle"});
      api.label([bx2 + bw / 2, Yb(r.m * r.m) - (r.vr > smax * 0.07 ? 9 : 22)], f(r.b), {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      api.label([bx1 + bw / 2, base + 14], "E(X²)", {color: c.c1, size: 12, anchor: "middle"});
      api.label([bx2 + bw / 2, base + 14], "[E(X)]²", {color: c.c3, size: 12, anchor: "middle"});
      var gx = bx2 + bw + 12, ya = Yb(r.m2), yb = Yb(r.m * r.m);
      api.line([bx1 + bw, ya], [gx + 4, ya], {color: c.c5, width: 1, dash: "3 3"});
      if (yb - ya > 3) {
        api.line([gx, ya], [gx, yb], {color: c.c5, width: 2.2});
        [ya, yb].forEach(function (q) { api.line([gx - 4, q], [gx + 4, q], {color: c.c5, width: 2.2}); });
      }
      api.label([gx + 7, (ya + yb) / 2 - 8], "Var", {color: c.c5, size: 12.5, weight: 700});
      api.label([gx + 7, (ya + yb) / 2 + 8], f(r.vr), {color: c.c5, size: 12.5, weight: 700});
      api.root.querySelectorAll("text").forEach(function (e) { var col = e.getAttribute("fill"); if (col) e.style.fill = col; });   // viz.css paints text ink
    }
  });
})();
