// The binomial likelihood: with k successes in n trials fixed, L(p) ∝ p^k (1-p)^(n-k) is read as a function of p.
// It is drawn relative to its peak, L(p)/L(p̂), so the curve always tops out at 1 at the MLE p̂ = k/n. More trials
// sharpen it. The band marks where L(p)/L(p̂) ≥ e^(-1.92) ≈ 0.147, the likelihood-ratio ≈95% interval (Wilks:
// 2 ln ratio ≤ 3.84). Dot's extra p (a candidate value, draggable on the curve) shows how much less probable the
// data are under it. A k above n is impossible, so k is capped at n (the status says so).
(function () {
  var CUT = Math.exp(-3.841 / 2);
  function logL(p, k, n) {
    if ((p <= 0 && k > 0) || (p >= 1 && k < n)) return -Infinity;
    return (k > 0 ? k * Math.log(p) : 0) + (n - k > 0 ? (n - k) * Math.log(1 - p) : 0);
  }
  function calc(v) {
    var n = v.trials, k = Math.min(v.successes, n), ph = k / n, top = logL(ph, k, n);
    var rel = function (p) { return Math.exp(logL(p, k, n) - top); };
    function edge(a, b) { for (var i = 0; i < 60; i++) { var m = (a + b) / 2; if ((rel(m) >= CUT) === (rel(a) >= CUT)) a = m; else b = m; } return (a + b) / 2; }
    return {n: n, k: k, capped: v.successes > n, ph: ph, rel: rel, lo: k === 0 ? 0 : edge(0, ph), hi: k === n ? 1 : edge(ph, 1), r: rel(v.p)};
  }
  var f = function (x, d) { return Viz.fmt(x, d == null ? 3 : d); };
  // small ratios in scientific notation: text with a superscript exponent, or LaTeX
  function sci(x) { var e = Math.floor(Math.log10(x)), m = x / Math.pow(10, e); if (m >= 9.95) { m /= 10; e += 1; } return [Viz.n(m, 1), e]; }
  function sig(x) { if (x >= 0.01 || x === 0) return Viz.fmt(x, 3); var q = sci(x); return q[0] + "×10" + Viz.sub("^-") + String(-q[1]).split("").map(function (d) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[d]; }).join(""); }
  function tex(x) { if (x >= 0.01 || x === 0) return Viz.n(x, 3); var q = sci(x); return q[0] + "\\times10^{" + q[1] + "}"; }

  Viz.register("likelihood-function", {
    title: "Likelihood of a success probability",
    subject: "stats",
    shows: "Set the successes and trials: the likelihood p^k(1−p)^(n−k) peaks at p̂ = k/n and narrows as the trials grow",
    params: {
      successes: {kind: "integer", default: 3, min: 0, max: 48, label: "k"},
      trials: {kind: "integer", default: 12, min: 12, max: 48, label: "n"},
      p: {kind: "number", default: 0.5, min: 0, max: 1, step: 0.01, label: "p"}
    },
    formula: function (v) {
      var k = calc(v);
      return "\\begin{array}{l}L(p\\mid k,n)\\propto p^{k}(1-p)^{n-k}\\\\\\quad\\propto p^{" + k.k + "}(1-p)^{" + (k.n - k.k) + "},\\ \\ \\hat p=\\tfrac{k}{n}=\\tfrac{" + k.k + "}{" + k.n + "}=" + Viz.n(k.ph, 3) + "\\\\[3pt]" +
        "\\tfrac{L(" + Viz.n(v.p) + ")}{L(\\hat p)}=" + tex(k.r) + "\\end{array}";
    },
    status: function (v) {
      var k = calc(v), cap = k.capped ? "k can't exceed n, so k = " + k.n + ". " : "";
      if (Math.abs(v.p - k.ph) < 0.005) return cap + "p = " + f(v.p, 2) + " sits at the peak: no value of p makes " + k.k + " in " + k.n + " more probable.";
      return cap + "The likelihood peaks at <b>p̂ = " + f(k.ph) + "</b>; " + k.k + " in " + k.n + " is only <b>" + sig(k.r) + "</b> times as probable under p = " + f(v.p, 2) + ".";
    },
    examples: [
      {name: "Minimum supported values", values: {successes: 0, trials: 12}},
      {name: "Maximum supported values", values: {successes: 48, trials: 48}},
      {name: "same proportion, four times the data", values: {successes: 12, trials: 48, p: 0.5}},
      {name: "candidate at the peak", values: {successes: 6, trials: 12, p: 0.5}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, k = calc(v), x0 = 46, x1 = 384, yT = 84, yB = 252;
      var X = function (p) { return x0 + (x1 - x0) * p; }, Y = function (r) { return yB - (yB - yT) * r; };
      // the data: one dot per trial, successes filled
      var gap = Math.min(16, (x1 - x0) / k.n);
      for (var i = 0; i < k.n; i++) {
        var cx = x0 + gap * (i + 0.5);
        if (i < k.k) api.circle([cx, 22], Math.min(5, gap * 0.38), {fill: c.c1});
        else api.circle([cx, 22], Math.min(5, gap * 0.38) - 0.6, {stroke: c.muted, width: 1.2});
      }
      api.label([x0, 44], k.k + " success" + (k.k === 1 ? "" : "es") + " (filled) in " + k.n + " trials", {color: c.c1, size: 12, weight: 600});
      // axes
      [0, 0.5, 1].forEach(function (r) {
        api.line([x0, Y(r)], [x1, Y(r)], {color: r ? c.grid : c.axis, width: r ? 1 : 1.3});
        api.label([x0 - 7, Y(r)], String(r), {color: c.muted, size: 12, anchor: "end"});
      });
      for (var t = 0; t <= 10; t++) {
        api.line([X(t / 10), yB], [X(t / 10), yB + 4], {color: c.axis, width: 1});
        if (t % 2 === 0) api.label([X(t / 10), yB + 15], String(t / 10), {color: c.muted, size: 12, anchor: "middle"});
      }
      api.label([x1, yB + 29], "p", {color: c.muted, size: 12.5, anchor: "end", italic: true});
      api.label([x0 - 4, yT - 16], "L(p) / L(p̂)", {color: c.muted, size: 12});
      // the ≈95% likelihood interval
      api.rect(X(k.lo), yT, Math.max(1.5, X(k.hi) - X(k.lo)), yB - yT, {fill: c.c2, fillOpacity: 0.08, rx: 0});
      api.line([X(k.lo), Y(CUT)], [X(k.hi), Y(CUT)], {color: c.c2, width: 1.5, dash: "4 3"});
      api.label([x1, yT - 16], "shaded ≈95% interval: " + f(k.lo, 2) + " to " + f(k.hi, 2), {color: c.c2, size: 12, weight: 600, anchor: "end"});
      // the curve
      var pts = [];
      for (var j = 0; j <= 400; j++) { var p = j / 400; pts.push([X(p), Y(k.rel(p))]); }
      api.polygon([[X(0), yB]].concat(pts, [[X(1), yB]]), {fill: c.c2, fillOpacity: 0.12});
      api.polyline(pts, {stroke: c.c2, width: 2.5});
      // the peak
      api.line([X(k.ph), yT - 4], [X(k.ph), yB], {color: c.c3, width: 1.6, dash: "5 4"});
      var right = k.ph < 0.72;
      api.label([X(k.ph) + (right ? 8 : -8), yT + 2], "p̂ = " + f(k.ph), {color: c.c3, size: 12.5, weight: 650, anchor: right ? "start" : "end"});
      // the candidate p
      var P = [X(v.p), Y(k.r)];
      api.line([P[0], P[1]], [P[0], yB], {color: c.c1, width: 1.2, dash: "3 3"});
      var pr = v.p < 0.5, py = Math.min(Math.max(P[1] - 14, yT + 22), yB - 14);
      api.label([P[0] + (pr ? 10 : -10), py], "p = " + f(v.p, 2) + ": " + sig(k.r), {color: c.c1, size: 12.5, weight: 650, anchor: pr ? "start" : "end"});
      api.handle(P, {color: c.c1, r: 6, onDrag: function (q) {
        api.set({p: Math.max(0, Math.min(1, Math.round((q[0] - x0) / (x1 - x0) * 100) / 100))});
      }});
    }
  });
})();
