// Type I error, Type II error and power for a z test of H0: mu = mu0 with sigma known. The test statistic is drawn in
// standard-error units: under H0 it is N(0, 1); if the true effect is d standard deviations, it is N(delta, 1) with
// delta = d * sqrt(n). The dashed cutoff z_alpha (or +-z_{alpha/2}) splits the axis: red is alpha (H0 true, rejected),
// amber is beta (H1 true, not rejected), green is power = 1 - beta (H1 true, rejected). The axis widens with delta so
// both curves always fit. Phi is Marsaglia's (2004) series.
(function () {
  function Phi(x) {
    if (x < -9) return 0; if (x > 9) return 1;
    var s = x, t = 0, b = x, q = x * x, i = 1;
    while (s !== t) { t = s; b *= q / (i += 2); s = t + b; }
    return 0.5 + s * Math.exp(-0.5 * q - 0.91893853320467274178);
  }
  function zq(p) { var lo = -10, hi = 10; for (var i = 0; i < 90; i++) { var m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
  function pdf(x) { return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI); }
  function calc(v) {
    var two = v.tails === "two-sided", z = zq(1 - (two ? v.alpha / 2 : v.alpha)), dl = v.d * Math.sqrt(v.n);
    var power = two ? Phi(dl - z) + Phi(-dl - z) : Phi(dl - z);
    return {two: two, z: z, dl: dl, power: power, beta: 1 - power};
  }
  function f3(x) { return x > 0.9995 && x < 1 ? "> 0.999" : x < 0.0005 && x > 0 ? "< 0.001" : "= " + Viz.fmt(x, 3); }

  Viz.register("type-i-type-ii-power", {
    title: "Type I error, Type II error and power",
    subject: "stats",
    shows: "Set α, the true effect and the sample size: red is the false-alarm rate α, amber the miss rate β, green the power 1 − β, all split by the same cutoff",
    params: {
      alpha: {kind: "number", default: 0.05, min: 0.01, max: 0.2, step: 0.01, label: "\\alpha"},
      d: {kind: "number", default: 0.5, min: 0, max: 1, step: 0.05, label: "d\\ (\\text{effect})"},
      n: {kind: "integer", default: 25, min: 1, max: 50, label: "n"},
      tails: {kind: "enum", values: ["one-sided", "two-sided"], default: "one-sided", label: "\\text{test}"}
    },
    formula: function (v) {
      var r = calc(v), pw = Viz.n(r.power, 3);
      var eq = r.power > 0.9995 ? ">0.999" : "=" + pw;
      var line2 = r.two ? "1-\\beta=\\Phi(\\delta{-}z){+}\\Phi({-}\\delta{-}z)" + eq : "1-\\beta=\\Phi(\\delta-z_{\\alpha})" + eq;
      return "\\begin{array}{l}\\delta=d\\sqrt{n}=" + Viz.n(r.dl, 3) + ",\\ \\ z" + (r.two ? "=z_{\\alpha/2}" : "_{\\alpha}") + "=" + Viz.n(r.z, 3) +
        "\\\\[4pt]" + line2 + "\\end{array}";
    },
    status: function (v) {
      var r = calc(v), pct = function (x) { return x > 0.999 ? "over 99.9%" : x < 0.001 ? "under 0.1%" : Viz.fmt(100 * x, 1) + "%"; };
      if (v.d === 0) return "With no true effect, H₁ is H₀: the test rejects " + pct(v.alpha) + " of the time, and every rejection is a <b>Type I error</b>.";
      var verdict = r.power >= 0.8 ? "well powered" : r.power >= 0.5 ? "under the usual 80% target" : "underpowered: it misses more often than it finds";
      return "Power <b>" + pct(r.power) + "</b>: a true effect of d = " + Viz.fmt(v.d, 2) + " with n = " + v.n + " is caught " + pct(r.power) + " of the time and missed (Type II) " +
        pct(r.beta) + "; false alarms run at α = " + pct(v.alpha) + ". " + verdict.charAt(0).toUpperCase() + verdict.slice(1) + ".";
    },
    examples: [
      {name: "no true effect: power = α", values: {d: 0}},
      {name: "small sample, low power", values: {d: 0.3, n: 10}},
      {name: "big effect, big sample", values: {d: 1, n: 50}},
      {name: "two-sided test", values: {tails: "two-sided"}},
      {name: "stricter α costs power", values: {alpha: 0.01}}
    ],
    size: [400, 290],
    draw: function (api, v) {
      var c = api.color, r = calc(v), dl = r.dl, z = r.z;
      var lo = -3.8, hi = Math.max(3.8, dl + 3.6), x0 = 18, x1 = 382, base = 214, top = 86;
      var X = function (q) { return x0 + (x1 - x0) * (q - lo) / (hi - lo); }, Y = function (d) { return base - (base - top) * d / pdf(0); };
      var pts = function (mu, a, b) { var out = [], n = 80; for (var i = 0; i <= n; i++) { var q = a + (b - a) * i / n; out.push([X(q), Y(pdf(q - mu))]); } return out; };
      var fill = function (mu, a, b, col, op) { a = Math.max(a, lo); b = Math.min(b, hi); if (b - a > 1e-6) api.polygon([[X(a), base]].concat(pts(mu, a, b), [[X(b), base]]), {fill: col, fillOpacity: op}); };
      // under H1: power (green) beyond the cutoffs, beta (amber) between them; under H0: alpha (red) beyond them
      var L = r.two ? -z : -Infinity;
      fill(dl, z, hi, c.c4, 0.4); if (r.two) fill(dl, lo, L, c.c4, 0.4);
      fill(dl, L, z, c.c3, 0.4);
      fill(0, z, hi, c.c5, 0.6); if (r.two) fill(0, lo, L, c.c5, 0.6);
      api.polyline(pts(0, lo, hi), {stroke: c.ink, width: 2});
      if (dl > 0) api.polyline(pts(dl, lo, hi), {stroke: c.c2, width: 2.2});
      // curve names over the peaks where they have room; the key at the bottom always names them
      api.label([X(0), top - 10], dl > 0 ? "H₀ true" : "H₀ = H₁", {color: c.ink, size: 12.5, weight: 650, anchor: "middle"});
      if (dl > 0 && X(dl) - X(0) > 64 && Math.abs(X(dl) - X(z)) > 36) api.label([X(dl), top - 10], "H₁ true", {color: c.c2, size: 12.5, weight: 650, anchor: "middle"});
      // the cutoff(s): the value left of the line, the rejection side right of it
      [z].concat(r.two ? [-z] : []).forEach(function (q) { api.line([X(q), base], [X(q), 50], {color: c.ink, width: 1.4, dash: "5 4"}); });
      api.label([X(z) + 5, 44], "reject H₀ →", {color: c.ink, size: 12, anchor: "start"});
      api.label([X(z) - 5, 44], "z = " + (r.two ? "±" : "") + api.fmt(z, 3), {color: c.muted, size: 12, anchor: "end"});
      if (r.two) api.label([X(-z) - 5, 44], "← reject", {color: c.ink, size: 12, anchor: "end"});
      // axis in standard errors, with delta marked
      api.line([x0, base], [x1, base], {color: c.axis, width: 1.2});
      var every = hi - lo > 10 ? 2 : 1;
      for (var k = Math.ceil(lo); k <= hi; k++) {
        if (k % every) continue;
        api.line([X(k), base], [X(k), base + 4], {color: c.axis, width: 1});
        api.label([X(k), base + 15], api.fmt(k), {color: c.muted, size: 12, anchor: "middle"});
      }
      if (dl > 0) { api.line([X(0), base + 26], [X(dl), base + 26], {color: c.c2, width: 1.6, arrow: X(dl) - X(0) > 14});
        api.label([X(dl) + 6, base + 38], "δ = " + api.fmt(dl, 2), {color: c.c2, size: 12.5, weight: 650, anchor: X(dl) > x1 - 60 ? "end" : "start"}); }
      api.label([x1, base + 58], "z, in standard errors", {color: c.muted, size: 12, anchor: "end"});
      api.line([x0, base + 58], [x0 + 16, base + 58], {color: c.ink, width: 2});
      api.label([x0 + 21, base + 58], "H₀ true", {color: c.ink, size: 12});
      api.line([x0 + 78, base + 58], [x0 + 94, base + 58], {color: c.c2, width: 2.2});
      api.label([x0 + 99, base + 58], "H₁ true", {color: c.c2, size: 12});
      // the three rates, each in its region's colour
      api.label([x0, 20], "Type I α " + f3(v.alpha), {color: c.c5, size: 13, weight: 700});
      api.label([200, 20], "Type II β " + f3(r.beta), {color: c.c3, size: 13, weight: 700, anchor: "middle"});
      api.label([x1, 20], "power " + f3(r.power), {color: c.c4, size: 13, weight: 700, anchor: "end"});
      api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints text ink
    }
  });
})();
