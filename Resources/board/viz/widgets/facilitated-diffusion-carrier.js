// Facilitated diffusion by a carrier (a uniporter such as GLUT1 moving glucose). Each carrier binds one molecule on
// one side, changes shape (alternating access) and lets it go on the other, so it never makes an open pore and can
// only turn over so fast: flux saturates. Symmetric carrier model, the standard textbook one:
//   J = N k ( Co/(Km + Co) - Ci/(Km + Ci) )      N carriers, k = top turnover per carrier (s^-1), J > 0 is inward.
// Influx alone, N k Co/(Km + Co), is the hyperbola in the plot (half of J_max at Co = Km); efflux is the flat line set
// by Ci; the net flux is the gap between them, zero when Co = Ci. Km: GLUT1 about 1.5 mM, GLUT2 about 17 mM.
(function () {
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
  function sat(c, km) { return c / (km + c); }
  function flux(v) { return v.n * (sat(v.cOut, v.km) - sat(v.cIn, v.km)); }
  var STEP = ["open to the side with more glucose", "glucose binds in the pocket", "the carrier flips (alternating access)", "glucose is released on the other side"];

  Viz.register("facilitated-diffusion-carrier", {
    title: "Facilitated diffusion: carrier proteins",
    subject: "biology",
    shows: "Step a carrier through bind, flip and release, and change the glucose on each side: net flow runs down the gradient and levels off at Jₘₐₓ because each carrier can only turn over so fast",
    params: {
      cOut: {kind: "number", default: 8, min: 0, max: 20, step: 0.5, label: "C_o\\ (\\text{mM})"},
      cIn: {kind: "number", default: 1, min: 0, max: 20, step: 0.5, label: "C_i\\ (\\text{mM})"},
      km: {kind: "number", default: 1.5, min: 0.5, max: 20, step: 0.5, label: "K_m\\ (\\text{mM})"},
      n: {kind: "integer", default: 4, min: 1, max: 8, label: "N"}
    },
    steps: STEP,
    stepMs: 1500,
    formula: function (v) {
      var a = sat(v.cOut, v.km), b = sat(v.cIn, v.km);
      return "J=Nk\\left(\\frac{C_o}{K_m+C_o}-\\frac{C_i}{K_m+C_i}\\right)\\newline=" + v.n + "k\\,(" + Viz.n(a, 3) + "-" + Viz.n(b, 3) + ")=" + Viz.n(v.n * (a - b), 2) + "k";
    },
    status: function (v) {
      var J = flux(v), hi = Math.max(sat(v.cOut, v.km), sat(v.cIn, v.km));
      if (Math.abs(J) < 1e-9) return "Equal glucose on both sides: carriers move it in and out at the same rate, so the net flux is <b>0</b>.";
      var tail = hi >= 0.85 ? "; the high side is far above Kₘ, so the carriers are <b>nearly saturated</b>." :
                 hi <= 0.3 ? "; the high side is below Kₘ, so flux still rises almost in step with concentration." : ".";
      return "Glucose moves <b>" + (J > 0 ? "in" : "out") + "</b>, down its gradient, at <b>" + Viz.fmt(Math.abs(J), 2) + "k</b>, " +
        Math.round(100 * Math.abs(J) / v.n) + "% of Jₘₐₓ = " + v.n + "k" + tail;
    },
    examples: [
      {name: "GLUT1, steep gradient", values: {cOut: 8, cIn: 1, km: 1.5, n: 4, step: 3}},
      {name: "saturated: 20 mM outside", values: {cOut: 20, cIn: 0, km: 1.5, n: 4, step: 2}},
      {name: "GLUT2, high Kₘ", values: {cOut: 8, cIn: 1, km: 17, n: 4, step: 1}},
      {name: "equal sides: no net flux", values: {cOut: 5, cIn: 5, step: 4}},
      {name: "more inside: flows out", values: {cOut: 1, cIn: 10, n: 8, step: 4}},
      {name: "every value at its minimum", values: {cOut: 0, cIn: 0, km: 0.5, n: 1}},
      {name: "every value at its maximum", values: {cOut: 20, cIn: 20, km: 20, n: 8}}
    ],
    size: [400, 320],
    draw: function (api, v) {
      var c = api.color, s = v.step || 1, J = flux(v), inward = J >= 0, m0 = 58, m1 = 84;
      var T = function (at, t, col, o) { api.label(at, t, Object.assign({color: col, size: 12, weight: 600}, o || {})); };
      // membrane and glucose on each side (one dot per 0.75 mM)
      api.rect(14, m0, 372, m1 - m0, {fill: c.ink, fillOpacity: 0.06, rx: 3});
      api.line([14, m0], [386, m0], {color: c.muted, width: 1.3}); api.line([14, m1], [386, m1], {color: c.muted, width: 1.3});
      var dots = function (conc, y0, y1, seed) {
        var r = rng(seed), k = Math.round(conc / 0.75);
        for (var i = 0; i < k; i++) api.circle([84 + r() * 296, y0 + r() * (y1 - y0)], 3, {fill: c.c3, opacity: 0.75});
      };
      dots(v.cOut, 22, m0 - 14, 5); dots(v.cIn, m1 + 14, 116, 9);
      T([16, 10], "outside  " + api.fmt(v.cOut) + " mM glucose", c.muted, {weight: 500});
      T([16, 128], "cytosol  " + api.fmt(v.cIn) + " mM glucose", c.muted, {weight: 500});   // just under its dots, well clear of the plot title
      // carriers: open to the high side (steps 1-2), open to the low side (steps 3-4); the pocket holds glucose at 2-3
      var hiTop = inward, openTop = (s <= 2) === hiTop, gap = 292 / v.n, mid = (m0 + m1) / 2;
      for (var i = 0; i < v.n; i++) {
        var px = 92 + gap * (i + 0.5), wt = openTop ? 7 : 0, wb = openTop ? 0 : 7, hw = Math.min(15, gap * 0.36);
        [-1, 1].forEach(function (sg) {
          api.polygon([[px + sg * hw, m0 - 10], [px + sg * wt, m0 - 10], [px + sg * 3, mid], [px + sg * wb, m1 + 10], [px + sg * hw, m1 + 10]],
            {fill: c.c1, fillOpacity: 0.28, stroke: c.c1, width: 1.4});
        });
        if (s === 2 || s === 3) api.circle([px, openTop ? mid - 6 : mid + 6], 4, {fill: c.c3, stroke: c.card, width: 1});
        if (s === 4) api.circle([px, hiTop ? m1 + 20 : m0 - 20], 4, {fill: c.c3, stroke: c.card, width: 1});
      }
      T([386, 10], "carriers: " + v.n, c.c1, {anchor: "end"});
      // net flow arrow in the left margin of the membrane
      if (Math.abs(J) > 1e-9) {
        var len = 8 + 22 * Math.min(1, Math.abs(J) / 8);
        api.arrow([24, inward ? mid - len : mid + len], [24, inward ? mid + len : mid - len], {color: c.c4, width: 3, halo: false, head: 9});
        T([34, mid], "net " + (inward ? "in" : "out"), c.c4, {anchor: "start"});
      } else T([20, mid], "no net", c.c4, {anchor: "start"});
      // ---- the plot: influx hyperbola vs outside concentration, efflux line, net gap ----
      var bx0 = 40, bx1 = 318, by0 = 282, by1 = 166, X = function (q) { return bx0 + q / 20 * (bx1 - bx0); }, Y = function (j) { return by0 - j / 8 * (by0 - by1); };
      api.line([bx0, by0], [bx1 + 4, by0], {color: c.axis, width: 1.2}); api.line([bx0, by0], [bx0, by1 - 6], {color: c.axis, width: 1.2});
      [0, 5, 10, 15, 20].forEach(function (q) { if (Math.abs(X(q) - X(v.km)) >= 18) T([X(q), by0 + 11], String(q), c.muted, {anchor: "middle", weight: 500}); });
      [4, 8].forEach(function (j) { T([bx0 - 6, Y(j)], String(j), c.muted, {anchor: "end", weight: 500}); });
      T([(bx0 + bx1) / 2, 308], "outside glucose C_o (mM)", c.muted, {anchor: "middle", weight: 500});
      T([bx0 + 6, by1 - 10], "flux (units of k)", c.muted, {weight: 500});
      api.line([bx0, Y(v.n)], [bx1 - 2, Y(v.n)], {color: c.muted, width: 1.2, dash: "5 4"});   // stops short of the margin tags
      var kmx = X(v.km);
      api.line([kmx, by0], [kmx, Y(v.n / 2)], {color: c.c2, width: 1, dash: "2 3"});
      api.line([bx0, Y(v.n / 2)], [kmx, Y(v.n / 2)], {color: c.c2, width: 1, dash: "2 3"});
      T([kmx, by0 + 11], "K_m", c.c2, {anchor: "middle"});   // on the axis under its dashed line (a tick it would touch is dropped): clear of the curve, the point and the margin tags
      var pts = []; for (var q = 0; q <= 20.001; q += 0.25) pts.push([X(q), Y(v.n * sat(q, v.km))]);
      api.polyline(pts, {stroke: c.c2, width: 2.6});
      var yOut = Y(v.n * sat(v.cIn, v.km)), yIn = Y(v.n * sat(v.cOut, v.km)), xc = X(v.cOut);
      api.line([bx0, yOut], [bx1, yOut], {color: c.c6, width: 2});
      if (Math.abs(yIn - yOut) > 2) {
        api.line([xc, yOut], [xc, yIn], {color: c.c4, width: 3.5});
        var right = v.cOut < 13;
        T([xc + (right ? 7 : -7), (yIn + yOut) / 2], "net " + api.fmt(Math.abs(J), 2) + "k", c.c4, {anchor: right ? "start" : "end"});
      }
      api.circle([xc, yIn], 4.5, {fill: c.c2, stroke: c.card, width: 1.5});   // the operating point, drawn before the tags so none sits under it
      // line names in the right margin (from bx1 + 12, past the point's radius at C_o = 20), spread so they never overlap;
      // Jₘₐₓ is written in Unicode: a raw "J_{max}" counts 3 extra characters in the label clamp and gets pulled back left
      var tags = [[Y(v.n), "Jₘₐₓ = " + v.n + "k", c.muted], [Y(v.n * sat(20, v.km)), "influx", c.c2], [yOut, "efflux", c.c6]];
      tags.sort(function (a, b) { return a[0] - b[0]; });
      for (var t = 1; t < 3; t++) tags[t][0] = Math.max(tags[t][0], tags[t - 1][0] + 13);
      var over = tags[2][0] - (by0 + 4); if (over > 0) tags.forEach(function (g) { g[0] -= over; });
      tags.forEach(function (g) { T([bx1 + 12, g[0]], g[1], g[2], {anchor: "start", weight: g[2] === c.muted ? 500 : 600}); });
      // viz.css paints svg text ink over its fill attribute; restate each label's own color inline
      api.root.querySelectorAll("text").forEach(function (e) { if (e.getAttribute("fill")) e.style.fill = e.getAttribute("fill"); });
    }
  });
})();
