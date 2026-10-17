// The normal approximation to a binomial: bars are the exact Binomial(n, p) probabilities, the curve is the normal
// density with the same mean np and SD sqrt(np(1 − p)). The event (at most / at least / exactly k) is shaded twice:
// amber bars for the exact answer, a blue area under the curve for the approximation, which runs to k ± 0.5 (the
// continuity correction: bar k covers k − 0.5 to k + 0.5). The rule of thumb used is np ≥ 10 and n(1 − p) ≥ 10.
// k above n is capped at n (the slider's range is fixed at 80 while n can be as small as 10).
(function () {
  function Phi(x) { // Marsaglia (2004) series; exact to ~1e-15 on |x| < 8
    if (x < -8) return 0; if (x > 8) return 1;
    var s = x, t = 0, b = x, q = x * x, i = 1;
    while (s !== t) { t = s; b *= q / (i += 2); s = t + b; }
    return 0.5 + s * Math.exp(-0.5 * q - 0.91893853320467274178);
  }
  function calc(v) {
    var n = v.trials, p = v.success_probability, k = Math.min(v.success_count, n), probs = [], c = 1;
    for (var j = 0; j <= n; j++) { probs.push(c * Math.pow(p, j) * Math.pow(1 - p, n - j)); c = c * (n - j) / (j + 1); }
    var mu = n * p, sd = Math.sqrt(n * p * (1 - p)), lo, hi, exact = 0;
    if (v.event === "at_most") { lo = -Infinity; hi = k + 0.5; } else if (v.event === "at_least") { lo = k - 0.5; hi = Infinity; } else { lo = k - 0.5; hi = k + 0.5; }
    probs.forEach(function (q, j) { if (j > lo && j < hi) exact += q; });
    var zLo = (lo - mu) / sd, zHi = (hi - mu) / sd;
    var approx = (isFinite(hi) ? Phi(zHi) : 1) - (isFinite(lo) ? Phi(zLo) : 0);
    return {n: n, p: p, k: k, capped: v.success_count > n, probs: probs, mu: mu, sd: sd, lo: lo, hi: hi, zLo: zLo, zHi: zHi,
            exact: exact > 1 - 1e-12 ? 1 : exact, approx: approx, ok: mu >= 10 && n * (1 - p) >= 10};
  }
  function pr(x, tex) {
    if (x >= 0.99995 && x < 1) return (tex ? "1-" : "1 − ") + pr(1 - x, tex);
    if (x === 0 || x >= 0.0001) return Viz.fmt(x, 4).replace("−", tex ? "-" : "−");
    var e = x.toExponential(1).split("e");
    return tex ? e[0] + "\\times10^{" + Number(e[1]) + "}" : e[0] + "×10^" + String(Number(e[1])).replace("-", "−");
  }
  var SIGN = {at_most: "\\le", at_least: "\\ge", exactly: "="}, WORD = {at_most: "≤", at_least: "≥", exactly: "="};
  function tint(api) { api.root.querySelectorAll("text").forEach(function (t) { var f = t.getAttribute("fill"); if (f) t.style.fill = f; }); }   // viz.css paints text ink

  Viz.register("normal-approximation-to-binomial", {
    title: "Normal approximation to the binomial",
    subject: "stats",
    shows: "Set n, p and an event: the bell curve with the same mean and SD stands in for the binomial bars, with k ± 0.5 as the continuity correction",
    params: {
      trials: {kind: "integer", default: 40, min: 10, max: 80, label: "n"},
      success_probability: {kind: "number", default: 0.5, min: 0.02, max: 0.98, step: 0.01, label: "p"},
      success_count: {kind: "integer", default: 20, min: 0, max: 80, label: "k"},
      event: {kind: "enum", values: ["at_most", "at_least", "exactly"], default: "at_most", label: "event",
              names: {at_most: "X ≤ k", at_least: "X ≥ k", exactly: "X = k"}}
    },
    formula: function (v) {
      var b = calc(v), z = function (x) { return Viz.n(x, 2); }, frac = function (edge) { return "\\tfrac{" + Viz.n(edge, 1) + "-" + Viz.n(b.mu, 2) + "}{" + Viz.n(b.sd, 3) + "}"; };
      var zl = v.event === "at_most" ? "z=" + frac(b.hi) + "=" + z(b.zHi) : v.event === "at_least" ? "z=" + frac(b.lo) + "=" + z(b.zLo)
        : "z_1=" + frac(b.lo) + "=" + z(b.zLo) + ",\\ z_2=" + z(b.zHi);
      var ap = v.event === "at_most" ? "\\Phi(z)" : v.event === "at_least" ? "1-\\Phi(z)" : "\\Phi(z_2)-\\Phi(z_1)";
      return "\\begin{array}{l}P(X" + SIGN[v.event] + b.k + ")=" + pr(b.exact, true) + "\\ \\text{exact}\\\\[3pt]" + zl + "\\\\[3pt]\\approx " + ap + "=" + pr(b.approx, true) + "\\end{array}";
    },
    status: function (v) {
      var b = calc(v), err = Math.abs(b.exact - b.approx);
      var head = (b.capped ? "k is capped at n = " + b.n + ". " : "") + "Exact <b>" + pr(b.exact) + "</b>, normal <b>" + pr(b.approx) + "</b> (off by " + pr(err) + "): ";
      if (b.ok) return head + "np = " + Viz.fmt(b.mu, 2) + " and n(1 − p) = " + Viz.fmt(b.n - b.mu, 2) + " are both at least 10, so the bell curve fits the bars.";
      var small = b.mu < b.n - b.mu ? "np = " + Viz.fmt(b.mu, 2) : "n(1 − p) = " + Viz.fmt(b.n - b.mu, 2);
      return head + small + " is under 10, so the bars are too lopsided for a symmetric bell curve to trust.";
    },
    examples: [
      {name: "Minimum supported values", values: {trials: 10, success_probability: 0.02, success_count: 0}},
      {name: "Maximum supported values", values: {trials: 80, success_probability: 0.98, success_count: 80}},
      {name: "skewed: n = 20, p = 0.1, at most 1", values: {trials: 20, success_probability: 0.1, success_count: 1}},
      {name: "exactly 20 of 40", values: {event: "exactly"}},
      {name: "at least 30 of 80 at p = 0.3", values: {trials: 80, success_probability: 0.3, success_count: 30, event: "at_least"}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, b = calc(v), n = b.n;
      // window: the bulk of the distribution (±4 SD) plus k, at least 9 counts wide, inside 0..n
      var lo = Math.max(0, Math.floor(Math.min(b.k, b.mu - 4 * b.sd)) - 1), hi = Math.min(n, Math.ceil(Math.max(b.k, b.mu + 4 * b.sd)) + 1);
      while (hi - lo < 9) { if (lo > 0) lo--; if (hi - lo < 9 && hi < n) hi++; }
      var dens = function (x) { return Math.exp(-0.5 * Math.pow((x - b.mu) / b.sd, 2)) / (b.sd * Math.sqrt(2 * Math.PI)); };
      var top = Math.max(Math.max.apply(null, b.probs), dens(b.mu)) * 1.08;
      var x0 = 30, x1 = 386, yB = 228, yT = 66;
      var X = function (x) { return x0 + (x1 - x0) * (x - (lo - 0.5)) / (hi - lo + 1); }, Y = function (q) { return yB - (yB - yT) * q / top; };
      var bw = (x1 - x0) / (hi - lo + 1);
      for (var j = lo; j <= hi; j++) {
        var on = j > b.lo && j < b.hi, h = yB - Y(b.probs[j]);
        api.rect(X(j) - bw / 2 + (bw > 6 ? 0.8 : 0), yB - h, Math.max(1, bw - (bw > 6 ? 1.6 : 0.4)), h, {fill: on ? c.c3 : c.c1, fillOpacity: on ? 0.8 : 0.3, rx: bw > 8 ? 1.5 : 0});
      }
      // the normal area over the corrected range, then the curve itself
      var aLo = Math.max(lo - 0.5, isFinite(b.lo) ? b.lo : -Infinity), aHi = Math.min(hi + 0.5, isFinite(b.hi) ? b.hi : Infinity);
      if (aHi > aLo) {
        var area = [[X(aLo), yB]];
        for (var s = 0; s <= 60; s++) { var x = aLo + (aHi - aLo) * s / 60; area.push([X(x), Y(dens(x))]); }
        area.push([X(aHi), yB]);
        api.polygon(area, {fill: c.c2, fillOpacity: 0.22});
      }
      var pts = []; for (var t = 0; t <= 160; t++) { var xx = lo - 0.5 + (hi - lo + 1) * t / 160; pts.push([X(xx), Math.max(yT - 6, Y(dens(xx)))]); }
      api.polyline(pts, {stroke: c.c2, width: 2.2});
      [b.lo, b.hi].forEach(function (e) {
        if (!isFinite(e) || e < lo - 0.5 || e > hi + 0.5) return;
        api.line([X(e), yB + 4], [X(e), yT - 4], {color: c.c2, width: 1.4, dash: "4 3"});
      });
      // cut label above the plot, on the side away from the other cut
      var cut = isFinite(b.hi) ? b.hi : b.lo, cutTxt = v.event === "exactly" ? (b.k - 0.5) + " to " + (b.k + 0.5) : (v.event === "at_most" ? b.k + " + 0.5 = " : b.k + " − 0.5 = ") + api.fmt(cut, 1);
      api.label([X(cut), yT - 14], "cut at " + cutTxt, {color: c.c2, size: 12, weight: 600, anchor: X(cut) > 250 ? "end" : X(cut) < 150 ? "start" : "middle"});
      // axis and ticks
      api.line([x0, yB], [x1, yB], {color: c.axis, width: 1.2});
      var span = hi - lo, tk = span <= 12 ? 1 : span <= 24 ? 2 : span <= 60 ? 5 : 10;
      for (var q = Math.ceil(lo / tk) * tk; q <= hi; q += tk) api.label([X(q), yB + 13], String(q), {color: q === b.k ? c.c3 : c.muted, size: 12, anchor: "middle", weight: q === b.k ? 700 : 500});
      if (b.k % tk !== 0) api.label([X(b.k), yB + 13], String(b.k), {color: c.c3, size: 12, anchor: "middle", weight: 700});
      api.label([x1, yB + 30], "successes", {color: c.muted, size: 12, anchor: "end"});
      // the comparison, in the figure's own colors
      api.label([x0, 16], "bars: exact P(X " + WORD[v.event] + " " + b.k + ") = " + pr(b.exact), {color: c.c3, size: 12.5, weight: 650});
      api.label([x0, 36], "curve: N(" + api.fmt(b.mu, 2) + ", " + api.fmt(b.sd, 2) + "²) ≈ " + pr(b.approx), {color: c.c2, size: 12.5, weight: 650});
      api.label([x0, yB + 30], (b.ok ? "np, n(1 − p) ≥ 10: OK" : "np or n(1 − p) < 10: skewed"), {color: b.ok ? c.c4 : c.c5, size: 12, weight: 600});
      tint(api);
    }
  });
})();
