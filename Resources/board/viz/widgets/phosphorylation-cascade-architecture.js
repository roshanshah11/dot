// Why the MAPK module has three tiers and why MEK and ERK need two phosphates each: stacking tiers whose activation
// needs two phosphorylations turns a graded signal into a switch. Steady-state model, first-order (unsaturated)
// enzymes, distributive phosphorylation: tier 1 (Raf, one site) f1 = S / (1 + S), S = signal / phosphatase.
// A two-site tier (MEK on S218 + S222, ERK on the T and Y of its TEY motif) driven at r = g f_upstream sits at
// 0P : 1P : 2P = 1 : r : r^2, and only the doubly phosphorylated form is active: f = r^2 / (1 + r + r^2). g is the
// kinase-to-phosphatase capacity at each tier. With one site per tier, f = r / (1 + r): a chain of hyperbolas is
// still a hyperbola (n_H = 1), so the cascade shifts the response but never sharpens it. Effective Hill coefficient
// n_H = ln 81 / ln(S90 / S10), from the signals giving 10 % and 90 % of the tier's own maximum. Saturated enzymes
// (zero-order ultrasensitivity) steepen it further; Huang and Ferrell (1996) found n_H near 5 for MAPK in their model.
(function () {
  function tiers(S, g, dual) {
    var h = dual ? function (r) { return r * r / (1 + r + r * r); } : function (r) { return r / (1 + r); };
    var f1 = S / (1 + S), f2 = h(g * f1), f3 = h(g * f2);
    return [f1, f2, f3];
  }
  function hill(g, dual, i) {
    var top = tiers(1e12, g, dual)[i];
    var find = function (level) {
      var lo = -12, hi = 12;
      for (var k = 0; k < 70; k++) { var m = (lo + hi) / 2; if (tiers(Math.pow(10, m), g, dual)[i] < level * top) lo = m; else hi = m; }
      return (lo + hi) / 2;
    };
    return Math.log(81) / (Math.LN10 * (find(0.9) - find(0.1)));
  }
  var pc = function (x) { return Math.round(x * 100); };
  Viz.register("phosphorylation-cascade-architecture", {
    title: "Kinase cascade architecture",
    subject: "biology",
    shows: "Change the signal, the gain per tier and whether MEK and ERK need one phosphate or two: stacking two-phosphate tiers makes the response steeper at every tier, so ERK flips from off to on over a much narrower range of signal",
    params: {
      logS: {kind: "number", default: -0.8, min: -3, max: 2, step: 0.1, label: "\\log_{10} S"},
      g: {kind: "integer", default: 5, min: 1, max: 20, label: "g"},
      dual: {kind: "boolean", default: true, label: "\\text{sites}", on: "two on MEK, ERK", off: "one each"}
    },
    formula: function (v) {
      var f = tiers(Math.pow(10, v.logS), v.g, v.dual), r = v.g * f[1];
      return "f_{\\text{ERK}}=" + (v.dual ? "\\frac{r^2}{1+r+r^2}" : "\\frac{r}{1+r}") + "=" + f[2].toFixed(3) + "\\newline r=g\\,f_{\\text{MEK}}=" + v.g + "\\cdot" + f[1].toFixed(3) + "=" + r.toFixed(2);
    },
    status: function (v) {
      var S = Math.pow(10, v.logS), f = tiers(S, v.g, v.dual), n = [0, 1, 2].map(function (i) { return hill(v.g, v.dual, i); });
      var head = "S = " + Viz.fmt(S, S < 0.1 ? 3 : 2) + ": Raf <b>" + pc(f[0]) + "%</b>, MEK <b>" + pc(f[1]) + "%</b>, ERK <b>" + pc(f[2]) + "%</b> on";
      if (!v.dual) return head + "; with one site per kinase every tier stays hyperbolic (Hill coefficient 1: rising from 10% to 90% takes 81× more signal), so the cascade shifts the response but cannot make a switch.";
      return head + "; each two-phosphate tier steepens the response (Hill coefficient " + Viz.fmt(n[0], 1) + " → " + Viz.fmt(n[1], 1) + " → " + Viz.fmt(n[2], 1) + "), so ERK rises from 10% to 90% of its maximum with only <b>" + Viz.fmt(Math.pow(81, 1 / n[2]), 0) + "×</b> more signal, against 81× for Raf.";
    },
    examples: [
      {name: "weak signal", values: {logS: -3, g: 5, dual: true}},
      {name: "ERK at half", values: {logS: -0.8, g: 5, dual: true}},
      {name: "strong signal", values: {logS: 2, g: 20, dual: true}},
      {name: "one site per tier: no switch", values: {logS: -0.8, g: 5, dual: false}},
      {name: "gain 1", values: {logS: 0, g: 1, dual: true}}
    ],
    size: [400, 300],
    draw: function (api, v) {
      var c = api.color, S = Math.pow(10, v.logS), f = tiers(S, v.g, v.dual), cols = [c.c2, c.c6, c.c1], names = ["Raf", "MEK", "ERK"];
      var sub = ["MAPKKK, 1 site", v.dual ? "MAPKK, 2 sites" : "MAPKK, 1 site", v.dual ? "MAPK, 2 sites" : "MAPK, 1 site"];
      // the module: each tier's share of molecules with 0, 1 or 2 phosphates; only the last segment is active
      api.rect(6, 22, 46, 30, {fill: c.c3, fillOpacity: 0.25, stroke: c.c3, width: 1.3, rx: 7});
      api.label([29, 37], "signal", {color: c.c3, size: 12, weight: 650, anchor: "middle"});
      api.label([29, 66], "S = " + api.fmt(S, S < 0.1 ? 3 : 2), {color: c.c3, size: 12, anchor: "middle"});
      for (var i = 0; i < 3; i++) {
        var x = 70 + i * 110, two = i > 0 && v.dual, r = i === 0 ? S : v.g * f[i - 1];
        var parts = two ? [1, r, r * r] : [1, r], tot = parts.reduce(function (a, b) { return a + b; }, 0), bx = x, bw = 92;
        api.label([x + bw / 2, 12], names[i], {color: cols[i], size: 13, weight: 700, anchor: "middle"});
        api.label([x + bw / 2, 27], sub[i], {color: c.muted, size: 12, anchor: "middle"});
        parts.forEach(function (q, k) {
          var w = bw * q / tot, last = k === parts.length - 1;
          api.rect(bx, 38, w, 16, {fill: last ? cols[i] : k ? cols[i] : c.muted, fillOpacity: last ? 0.9 : k ? 0.3 : 0.2, rx: 0});
          bx += w;
        });
        api.rect(x, 38, bw, 16, {fill: "none", stroke: cols[i], width: 1.2, rx: 3});
        api.label([x + bw / 2, 68], (two ? "PP " : "P ") + pc(f[i]) + "% active", {color: cols[i], size: 12, weight: 650, anchor: "middle"});
        if (i < 2) api.arrow([x + bw + 2, 46], [x + 108, 46], {color: cols[i], width: 1.8, halo: false, head: 7});
      }
      api.arrow([54, 37], [68, 44], {color: c.c3, width: 1.8, halo: false, head: 7});
      api.label([392, 88], v.dual ? "grey: no P, pale: one P (still off), solid: both P (on)" : "grey: no P, solid: phosphorylated (on)", {color: c.muted, size: 12, anchor: "end"});
      // dose-response: active fraction against log signal for each tier
      var X0 = 46, X1 = 388, Y0 = 268, Y1 = 118, L0 = -3, L1 = 2;
      var X = function (l) { return X0 + (l - L0) / (L1 - L0) * (X1 - X0); }, Y = function (a) { return Y0 - a * (Y0 - Y1); };
      api.line([X0, Y0], [X1, Y0], {color: c.axis, width: 1.2}); api.line([X0, Y0], [X0, Y1], {color: c.axis, width: 1.2});
      [0, 50, 100].forEach(function (q) { api.label([X0 - 6, Y(q / 100)], q + "%", {color: c.muted, size: 12, anchor: "end"}); });
      [-3, -2, -1, 0, 1, 2].forEach(function (l) { api.label([X(l), Y0 + 13], l === 0 ? "1" : "10" + (l < 0 ? "⁻" : "") + "¹²³"[Math.abs(l) - 1], {color: c.muted, size: 12, anchor: "middle", raw: true}); });
      api.label([X1, Y0 + 27], "signal S (log scale)", {color: c.muted, size: 12, anchor: "end"});
      for (var j = 0; j < 3; j++) {
        var pts = []; for (var l = L0; l <= L1 + 1e-9; l += 0.025) pts.push([X(l), Y(tiers(Math.pow(10, l), v.g, v.dual)[j])]);
        api.polyline(pts, {stroke: cols[j], width: 2.4});
        api.point([X(v.logS), Y(f[j])], {color: cols[j], r: 4.5});
        api.label([X0 + 8, Y1 + 4 + j * 16], names[j] + "  nH = " + api.fmt(hill(v.g, v.dual, j), 2), {color: cols[j], size: 12, weight: 650, raw: true});
      }
      api.line([X(v.logS), Y1], [X(v.logS), Y0], {color: c.ink, width: 1.2, dash: "3 3"});
      api.root.querySelectorAll("text").forEach(function (e) { var f = e.getAttribute("fill"); if (f) e.style.fill = f; });   // viz.css paints svg text ink
    }
  });
})();
